import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { PackingList } from './entities/packing-list.entity';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { ExceptionSeverity, ExceptionDomain } from '../governance/entities/operational-exception.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { Asn, AsnTare, toEdi856 } from '../outbound/asn';
import { buildSscc, normalizePrefix } from '../packing/packing.sscc';
import { ssccLabelZpl } from '../packing/packing.zpl';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(ShipmentItem)
    private readonly itemRepo: Repository<ShipmentItem>,
    @InjectRepository(PackingList)
    private readonly packingRepo: Repository<PackingList>,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly numbering: DocumentNumberingService,
  ) {}

  async findAll(user: User) {
    // TODO: Apply scope filtering
    return this.shipmentRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number, user: User) {
    const shipment = await this.shipmentRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    
    const items = await this.itemRepo.find({ where: { shipment: { id } } });
    const packingLists = await this.packingRepo.find({ where: { shipment: { id } } });
    return { ...shipment, items, packingLists };
  }

  async create(dto: Partial<Shipment>, user: User) {
    const count = await this.shipmentRepo.count();
    const shipmentNumber = `SHP-${(count + 1).toString().padStart(5, '0')}`;
    const shipment = this.shipmentRepo.create({ ...dto, shipmentNumber, status: ShipmentStatus.PLANNING });
    return this.shipmentRepo.save(shipment);
  }

  async addItem(shipmentId: number, itemDto: any, user: User) {
    const shipment = await this.shipmentRepo.findOne({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    // ELIGIBILITY RULE: Only 'available' stock (OQC Passed) can be added
    const stock = await this.inventory.findAllPositions(user, { 
      partNumber: itemDto.partNumber, 
      warehouseId: 'WH-FG'
    });

    const eligibleStock = stock.filter(s => s.holdStatus === 'available');

    const totalAvailable = eligibleStock.reduce((acc, s) => acc + s.onHand, 0);
    if (totalAvailable < itemDto.quantity) {
      // AUTOMATION: Create Operational Exception for Shipping Blocker
      await this.audit.recordException({
        severity: ExceptionSeverity.CRITICAL,
        domain: ExceptionDomain.SHIPPING,
        title: `Shipping Blocked: Material Unreleased`,
        description: `Attempted to stage ${itemDto.partNumber} for shipment ${shipment.shipmentNumber}, but material is on hold or pending OQC.`,
        actor: user.email || 'Shipping Agent',
        resourceType: 'Shipment',
        resourceId: shipment.id.toString(),
        metadata: { partNumber: itemDto.partNumber, requested: itemDto.quantity, available: totalAvailable }
      });
      
      throw new BadRequestException(`Material not eligible for shipping. Available released: ${totalAvailable}, Requested: ${itemDto.quantity}. Check OQC status.`);
    }

    const item = this.itemRepo.create({ ...itemDto, shipment });
    await this.itemRepo.save(item);

    // Update Inventory status to 'staged_for_shipping'
    await this.inventory.recordTransaction({
      type: 'HOLD',
      partNumber: itemDto.partNumber,
      quantity: itemDto.quantity,
      fromWarehouseId: 'WH-FG',
      fromLocation: itemDto.fromLocation || 'STAGING',
      toWarehouseId: 'WH-FG',
      toLocation: 'SHIPPING_DOCK',
      actorName: 'Shipping Agent',
      // Reserva para embarque: NO cuenta como 'available' (evita doble asignación)
      // pero el lock de inventario permite despacharla. Antes era 'hold', que
      // bloqueaba el dispatch para siempre (stage sí, dispatch nunca).
      holdStatus: 'staged_for_shipping' as any,
      referenceType: 'SHIPMENT_STAGING',
      referenceId: shipment.shipmentNumber,
      reason: `Staged for Shipment ${shipment.shipmentNumber}`
    });

    shipment.status = ShipmentStatus.STAGED;
    await this.shipmentRepo.save(shipment);

    return item;
  }

  async generatePackingList(shipmentId: number, actor: string, user: User) {
    const shipment = await this.shipmentRepo.findOne({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const items = await this.itemRepo.find({ where: { shipment: { id: shipmentId } } });
    
    const plNumber = `PL-${shipment.shipmentNumber}-${Date.now().toString().slice(-4)}`;
    const packingList = this.packingRepo.create({
      packingListNumber: plNumber,
      shipment: shipment,
      customer: shipment.customer,
      items: items.map(i => ({ partNumber: i.partNumber, quantity: i.quantity })),
      generatedBy: actor,
      status: 'FINALIZED'
    });

    return this.packingRepo.save(packingList);
  }

  async startLoading(id: number, manifestDto: any) {
    const shipment = await this.shipmentRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    Object.assign(shipment, manifestDto, {
      status: ShipmentStatus.LOADING,
      loadingStartedAt: new Date()
    });

    return this.shipmentRepo.save(shipment);
  }

  async dispatch(id: number, actor: string) {
    const shipment = await this.shipmentRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const items = await this.itemRepo.find({ where: { shipment: { id } } });

    // ELIGIBILITY RULE: Shipment must be in LOADING state to dispatch
    if (shipment.status !== ShipmentStatus.LOADING) {
      await this.audit.recordException({
        severity: ExceptionSeverity.HIGH,
        domain: ExceptionDomain.SHIPPING,
        title: `Dispatch Anomaly: Invalid State`,
        description: `Attempted dispatch for shipment ${shipment.shipmentNumber} while in ${shipment.status} state. Expected LOADING.`,
        actor,
        resourceType: 'Shipment',
        resourceId: shipment.id.toString(),
        metadata: { currentStatus: shipment.status }
      });
      throw new BadRequestException(`Shipment ${shipment.shipmentNumber} cannot be dispatched. Current status: ${shipment.status}`);
    }

    for (const item of items) {
      await this.inventory.recordTransaction({
        type: 'TRANSFER',
        partNumber: item.partNumber,
        quantity: item.quantity,
        fromWarehouseId: 'WH-FG',
        fromLocation: 'SHIPPING_DOCK',
        actorName: actor,
        holdStatus: 'available' as any, // will be 'shipped' logic in inventory if added, using available for now
        referenceType: 'DISPATCH_EXECUTION',
        referenceId: shipment.shipmentNumber,
        reason: `Final Dispatch - Carrier: ${shipment.carrier}`
      });
    }

    const before = { ...shipment };
    shipment.status = ShipmentStatus.DISPATCHED;
    shipment.dispatchedAt = new Date();
    shipment.dispatchedBy = actor;
    const saved = await this.shipmentRepo.save(shipment);

    await this.audit.log({
      actor,
      action: 'DISPATCH_EXECUTION',
      entity: 'Shipment',
      entityId: String(shipment.id),
      before,
      after: saved,
      scope: { carrier: shipment.carrier, route: shipment.route }
    });

    return saved;
  }

  async closeShipment(id: number) {
    const shipment = await this.shipmentRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    shipment.status = ShipmentStatus.CLOSED;
    return this.shipmentRepo.save(shipment);
  }

  async reportPackingDiscrepancy(shipmentId: number, discrepancy: { type: string, detail: string, actor: string }) {
    const shipment = await this.shipmentRepo.findOne({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    await this.audit.recordException({
      severity: ExceptionSeverity.HIGH,
      domain: ExceptionDomain.SHIPPING,
      title: `Packing Discrepancy: ${discrepancy.type}`,
      description: `Mismatch detected during packing list validation for shipment ${shipment.shipmentNumber}. Detail: ${discrepancy.detail}`,
      actor: discrepancy.actor,
      resourceType: 'Shipment',
      resourceId: shipment.id.toString(),
      metadata: { discrepancyType: discrepancy.type, detail: discrepancy.detail }
    });

    return { success: true };
  }

  // ── ASN (EDI 856) + etiqueta GS1 ────────────────────────────────────────────
  // El embarque legacy lleva renglones planos (ShipmentItem): sin jerarquía de
  // tarimas/cajas ni SSCC por bulto. Se arma un ASN de una sola "tarima" (sin
  // SSCC) con las líneas y se reutiliza el render EDI 856 de outbound. La etiqueta
  // GS1 es a nivel embarque (un SSCC). El folio ASN y el SSCC se emiten UNA vez y
  // se persisten (idempotente). El SSCC sale con prefijo placeholder hasta que se
  // configure GS1_COMPANY_PREFIX (se reporta honestamente con `placeholder`).

  private async loadForDocs(id: number): Promise<{ shipment: Shipment; items: ShipmentItem[] }> {
    const shipment = await this.shipmentRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    const items = await this.itemRepo.find({ where: { shipment: { id } } });
    return { shipment, items };
  }

  private buildAsnObject(shipment: Shipment, items: ShipmentItem[]): Asn {
    const lines = items.map((i) => ({
      partNumber: i.partNumber,
      quantity: Number(i.quantity) || 0,
      serials: [] as string[],
    }));
    const pieces = lines.reduce((a, l) => a + l.quantity, 0);
    const parts = new Set(lines.map((l) => l.partNumber)).size;
    const loaded =
      shipment.status === ShipmentStatus.DISPATCHED || shipment.status === ShipmentStatus.CLOSED;
    const shipDateSrc = shipment.dispatchedAt ?? shipment.scheduledAt ?? null;
    const tare: AsnTare = {
      id: String(shipment.id),
      sscc: null,
      type: 'SHIPMENT',
      loaded,
      weightKg: null,
      lines,
      packs: [],
    };
    return {
      asn: shipment.asn ?? null,
      folio: shipment.shipmentNumber,
      shipDate: shipDateSrc ? new Date(shipDateSrc).toISOString().slice(0, 10) : null,
      shipTo: { name: shipment.customer ?? null, destination: shipment.route ?? null },
      carrier: shipment.carrier ?? null,
      tracking: shipment.trackingNumber ?? null,
      incoterm: 'N/A',
      status: shipment.status,
      hierarchy: [tare],
      totals: { tares: 1, packs: 0, units: 1, pieces, parts, weightKg: 0, loaded: loaded ? 1 : 0 },
    };
  }

  /** Emite (una vez) el folio ASN y devuelve el ASN jerárquico (1 tarima, líneas planas). */
  async assembleAsn(id: number): Promise<Asn> {
    const { shipment, items } = await this.loadForDocs(id);
    if (!shipment.asn) {
      shipment.asn = await this.numbering.allocate('ASN');
      await this.shipmentRepo.save(shipment);
    }
    return this.buildAsnObject(shipment, items);
  }

  /** ASN como archivo EDI 856 (texto plano) para descarga. */
  async asnEdi(id: number): Promise<string> {
    return toEdi856(await this.assembleAsn(id));
  }

  /** Etiqueta logística GS1 (SSCC) del embarque: ZPL + el SSCC legible. */
  async label(id: number): Promise<{ sscc: string; placeholder: boolean; zpl: string }> {
    const { shipment, items } = await this.loadForDocs(id);
    const { placeholder } = normalizePrefix(process.env.GS1_COMPANY_PREFIX);
    if (!shipment.sscc) {
      const serialStr = await this.numbering.allocate('SSCC');
      const serial = Number(String(serialStr).replace(/\D/g, '')) || Date.now() % 1_000_000_000;
      shipment.sscc = buildSscc(process.env.GS1_COMPANY_PREFIX, serial).sscc;
      await this.shipmentRepo.save(shipment);
    }
    const contents = items
      .map((i) => `${i.partNumber} x${Number(i.quantity) || 0}`)
      .join(' · ')
      .slice(0, 120);
    const zpl = ssccLabelZpl({
      sscc: shipment.sscc,
      shipToName: shipment.customer ?? null,
      shipToAddress: shipment.route ?? null,
      fromName: 'AXOS OS',
      poNumber: null,
      contents: contents || null,
      weightKg: null,
      cartonOf: null,
    });
    return { sscc: shipment.sscc, placeholder, zpl };
  }

  /** Solo el ZPL (descarga .zpl directa). */
  async labelRaw(id: number): Promise<string> {
    return (await this.label(id)).zpl;
  }
}
