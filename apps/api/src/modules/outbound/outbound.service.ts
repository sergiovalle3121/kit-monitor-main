import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Shipment } from './entities/shipment.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  AssignTransportDto,
  CreateShipmentDto,
  TransitionShipmentDto,
  UpdateShipmentDto,
} from './dto/outbound.dto';
import { assertTransition, ShipmentStatus } from './shipment-state';
import { TrafficService } from '../traffic/traffic.service';
import { PackingService } from '../packing/packing.service';
import { OutboundLinesService } from './outbound-lines.service';
import {
  buildAsn,
  buildPackingList,
  packingListCsv,
  toEdi856,
  type Asn,
  type PackingList,
} from './asn';
import {
  buildBol,
  buildCartaPorte,
  buildCoc,
  buildCommercialInvoice,
  type Bol,
  type CartaPorte,
  type Coc,
  type CommercialInvoice,
} from './documents';
import { GenealogyService } from '../genealogy/genealogy.service';
import { ErpSdService } from '../erp-core/services/erp-sd.service';
import { OutboundFiscalService } from './outbound-fiscal.service';
import { buildCartaPorteXml } from './carta-porte-xml';
import {
  checkCarrierAssignable,
  checkDockAssignable,
  checkDriverAssignable,
  checkVehicleAssignable,
} from '../traffic/traffic.rules';

export interface OutboundKpis {
  toShip: number;
  inTransit: number;
  delivered: number;
  overdue: number;
  otdPct: number | null;
  byStatus: Record<ShipmentStatus, number>;
}

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly repo: Repository<Shipment>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    private readonly traffic: TrafficService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly packing?: PackingService,
    @Optional() private readonly lines?: OutboundLinesService,
    @Optional() private readonly genealogy?: GenealogyService,
    @Optional() private readonly sd?: ErpSdService,
    @Optional() private readonly fiscal?: OutboundFiscalService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Shipment>,
    alias: string,
  ): SelectQueryBuilder<Shipment> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateShipmentDto): Promise<Shipment> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('SHIPMENT');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      title: dto.title,
      customerName: dto.customerName ?? null,
      destination: dto.destination ?? null,
      incoterm: dto.incoterm ?? 'DAP',
      status: 'PACKING',
      carrier: dto.carrier ?? null,
      packageCount: dto.packageCount ?? 0,
      programId: dto.programId ?? null,
      notes: dto.notes ?? null,
      promisedDate: dto.promisedDate ? new Date(dto.promisedDate) : null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('SHIPMENT_CREATED', saved, { after: saved });
    return saved;
  }

  async list(
    filters: {
      status?: string;
      customerName?: string;
      programId?: string;
    } = {},
  ): Promise<Shipment[]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'DESC');
    this.applyScope(qb, 's');
    if (filters.status) qb.andWhere('s.status = :st', { st: filters.status });
    if (filters.customerName)
      qb.andWhere('s.customer_name = :cn', { cn: filters.customerName });
    if (filters.programId)
      qb.andWhere('s.program_id = :p', { p: filters.programId });
    return qb.getMany();
  }

  async getOne(id: string): Promise<Shipment> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Embarque no encontrado.');
    return found;
  }

  // ── Demand link: create an outbound shipment from a sales order (SD) ─────────

  /** Shippable sales orders (confirmed / in production / partially shipped). */
  async listOpenSalesOrders(): Promise<
    {
      id: number;
      soNumber: string;
      customerName: string | null;
      status: string;
    }[]
  > {
    if (!this.sd) return [];
    const sos = await this.sd.listSOs();
    return sos
      .filter((o) =>
        ['confirmed', 'in_production', 'partially_shipped'].includes(o.status),
      )
      .map((o) => ({
        id: o.id,
        soNumber: o.soNumber,
        customerName: o.customerName,
        status: o.status,
      }));
  }

  /**
   * Create an outbound shipment from a sales order: pulls the customer and the
   * still-open lines (qty − qtyShipped) as content lines, and links the shipment
   * to the SO so shipping later posts fulfilment + COGS back to it.
   */
  async createFromSalesOrder(soId: number): Promise<Shipment> {
    if (!this.sd)
      throw new BadRequestException('Módulo de ventas no disponible.');
    const so = await this.sd.getSO(soId);
    const shipment = await this.create({
      title: `Pedido ${so.soNumber}`,
      customerName: so.customerName ?? so.customerCode,
    });
    shipment.salesOrderId = so.id;
    shipment.salesOrderNumber = so.soNumber;
    await this.repo.save(shipment);

    if (this.lines) {
      for (const l of so.lines ?? []) {
        const open = (Number(l.quantity) || 0) - (Number(l.qtyShipped) || 0);
        if (open <= 0) continue;
        await this.lines.addLine(shipment.id, {
          partNumber: l.model,
          description: l.description ?? undefined,
          quantity: open,
          uom: 'EA',
          salesOrder: so.soNumber,
          salesOrderLine: String(l.lineNo),
          unitPrice: l.unitPrice ?? undefined,
          currency: so.currency ?? undefined,
        });
      }
    }
    return this.getOne(shipment.id);
  }

  async update(id: string, dto: UpdateShipmentDto): Promise<Shipment> {
    const s = await this.getOne(id);
    Object.assign(s, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.destination !== undefined && { destination: dto.destination }),
      ...(dto.incoterm !== undefined && { incoterm: dto.incoterm }),
      ...(dto.carrier !== undefined && { carrier: dto.carrier }),
      ...(dto.trackingNumber !== undefined && {
        trackingNumber: dto.trackingNumber,
      }),
      ...(dto.packageCount !== undefined && { packageCount: dto.packageCount }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.promisedDate !== undefined && {
        promisedDate: dto.promisedDate ? new Date(dto.promisedDate) : null,
      }),
    });
    const saved = await this.repo.save(s);
    await this.recordLedger('SHIPMENT_UPDATED', saved, { after: saved });
    return saved;
  }

  async transition(id: string, dto: TransitionShipmentDto): Promise<Shipment> {
    const s = await this.getOne(id);
    const from = s.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    // Carga verificada (Fase 2b): a shipment can only become READY once every
    // packed handling unit has been scan-verified onto the truck at the dock.
    if (from === 'PACKING' && dto.status === 'READY' && this.packing) {
      try {
        await this.packing.assertLoadingComplete(s.id);
      } catch (err) {
        await this.recordLedger('SHIPMENT_READY_BLOCKED', s, {
          after: { reason: (err as Error).message },
        });
        throw err;
      }
    }

    const now = new Date();
    s.status = dto.status;
    if (dto.carrier) s.carrier = dto.carrier;
    if (dto.trackingNumber) s.trackingNumber = dto.trackingNumber;
    if (dto.status === 'SHIPPED') {
      if (!s.shippedDate) s.shippedDate = now;
      // Generate an ASN folio at ship time (EDI 856 analog).
      if (!s.asn) {
        try {
          s.asn = await this.numbering.allocate('ASN');
        } catch (err) {
          this.logger.warn(`ASN allocation failed: ${(err as Error)?.message}`);
        }
      }
      const actor = this.tenantCtx.getUserEmail() ?? 'Outbound';
      // Goods-issue: if this shipment fulfils a sales order, route it through the
      // SO ship (it posts FG issue + COGS + fulfilment) so we don't double-issue;
      // otherwise issue FG straight from the shipment's lines. Both best-effort.
      if (s.salesOrderId && this.sd) {
        try {
          const soLines = (await this.linesFor(s.id))
            .filter((l) => l.salesOrderLine && l.quantity > 0)
            .map((l) => ({
              lineNo: Number(l.salesOrderLine),
              qty: l.quantity,
            }));
          await this.sd.shipSO(
            s.salesOrderId,
            soLines.length ? { lines: soLines } : undefined,
            actor,
          );
          await this.lines?.markShipped(s.id);
        } catch (err) {
          this.logger.warn(
            `SO fulfilment failed for ${s.salesOrderNumber}: ${(err as Error)?.message}`,
          );
        }
      } else {
        await this.lines?.postShipmentInventory(s.id, actor);
      }
      // Link shipped serials → shipment → customer for recall/where-used.
      await this.linkGenealogy(s);
    }
    if (dto.status === 'DELIVERED' && !s.deliveredDate) s.deliveredDate = now;

    const saved = await this.repo.save(s);
    await this.recordLedger('SHIPMENT_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  /**
   * Traffic assigns transport (carrier / unit / driver / dock) to a shipment.
   * Each provided piece is validated against the assignment poka-yoke (must exist,
   * be active, not in maintenance, not already tied to another shipment, and the
   * dock must be a shipping door). On success the piece is flipped to assigned/
   * occupied and a denormalized snapshot is stored on the shipment.
   */
  async assignTransport(
    id: string,
    dto: AssignTransportDto,
  ): Promise<Shipment> {
    const s = await this.getOne(id);

    if (dto.carrierId) {
      const c = await this.traffic.getCarrier(dto.carrierId);
      const issue = checkCarrierAssignable(c);
      if (issue) throw new BadRequestException(issue.reason);
      s.carrierId = c.id;
      s.carrier = c.name;
    }

    if (dto.vehicleId) {
      const v = await this.traffic.getVehicle(dto.vehicleId);
      const same = s.vehicleId === v.id;
      const issue = checkVehicleAssignable(v, { allowReassignSame: same });
      if (issue) throw new BadRequestException(issue.reason);
      if (s.vehicleId && s.vehicleId !== v.id) {
        await this.traffic
          .setVehicleStatus(s.vehicleId, 'available')
          .catch(() => undefined);
      }
      s.vehicleId = v.id;
      s.vehiclePlate = v.plate;
      s.vehicleType = v.type;
      if (v.status !== 'assigned')
        await this.traffic.setVehicleStatus(v.id, 'assigned');
    }

    if (dto.driverId) {
      const d = await this.traffic.getDriver(dto.driverId);
      const same = s.driverId === d.id;
      const issue = checkDriverAssignable(d, { allowReassignSame: same });
      if (issue) throw new BadRequestException(issue.reason);
      if (s.driverId && s.driverId !== d.id) {
        await this.traffic
          .setDriverStatus(s.driverId, 'available')
          .catch(() => undefined);
      }
      s.driverId = d.id;
      s.driverName = d.name;
      if (d.status !== 'assigned')
        await this.traffic.setDriverStatus(d.id, 'assigned');
    }

    if (dto.dockId) {
      const k = await this.traffic.getDock(dto.dockId);
      const same = s.dockId === k.id;
      const issue = checkDockAssignable(k, { allowReassignSame: same });
      if (issue) throw new BadRequestException(issue.reason);
      if (s.dockId && s.dockId !== k.id) {
        await this.traffic
          .setDockStatus(s.dockId, 'available')
          .catch(() => undefined);
      }
      s.dockId = k.id;
      s.dockCode = k.code;
      if (k.status !== 'occupied')
        await this.traffic.setDockStatus(k.id, 'occupied');
    }

    s.transportAssignedAt = new Date();
    s.transportAssignedBy = this.tenantCtx.getUserEmail();
    const saved = await this.repo.save(s);
    await this.recordLedger('SHIPMENT_TRANSPORT_ASSIGNED', saved, {
      after: {
        carrier: saved.carrier,
        vehiclePlate: saved.vehiclePlate,
        driverName: saved.driverName,
        dockCode: saved.dockCode,
      },
    });
    return saved;
  }

  /** Releases the assigned transport, freeing the unit/driver/dock back to available. */
  async releaseTransport(id: string): Promise<Shipment> {
    const s = await this.getOne(id);
    if (s.vehicleId)
      await this.traffic
        .setVehicleStatus(s.vehicleId, 'available')
        .catch(() => undefined);
    if (s.driverId)
      await this.traffic
        .setDriverStatus(s.driverId, 'available')
        .catch(() => undefined);
    if (s.dockId)
      await this.traffic
        .setDockStatus(s.dockId, 'available')
        .catch(() => undefined);
    s.carrierId = null;
    s.vehicleId = null;
    s.vehiclePlate = null;
    s.vehicleType = null;
    s.driverId = null;
    s.driverName = null;
    s.dockId = null;
    s.dockCode = null;
    s.transportAssignedAt = null;
    s.transportAssignedBy = null;
    const saved = await this.repo.save(s);
    await this.recordLedger('SHIPMENT_TRANSPORT_RELEASED', saved, {
      after: { released: true },
    });
    return saved;
  }

  async kpis(): Promise<OutboundKpis> {
    const all = await this.list();
    const now = Date.now();
    const byStatus = {
      PACKING: 0,
      READY: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    } as Record<ShipmentStatus, number>;

    let toShip = 0;
    let inTransit = 0;
    let delivered = 0;
    let overdue = 0;
    let otdEligible = 0;
    let otdOnTime = 0;

    for (const s of all) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      if (s.status === 'PACKING' || s.status === 'READY') {
        toShip += 1;
        if (s.promisedDate && new Date(s.promisedDate).getTime() < now) {
          overdue += 1;
        }
      }
      if (s.status === 'SHIPPED') inTransit += 1;
      if (s.status === 'DELIVERED') {
        delivered += 1;
        if (s.promisedDate && s.deliveredDate) {
          otdEligible += 1;
          if (
            new Date(s.deliveredDate).getTime() <=
            new Date(s.promisedDate).getTime() + 86_400_000
          ) {
            otdOnTime += 1;
          }
        }
      }
    }

    return {
      toShip,
      inTransit,
      delivered,
      overdue,
      otdPct:
        otdEligible > 0
          ? Math.round((otdOnTime / otdEligible) * 1000) / 10
          : null,
      byStatus,
    };
  }

  // ── Documents: ASN (EDI 856) + packing list, assembled from the load ────────

  /** Handling units packed for this shipment (empty if packing isn't wired in). */
  private async unitsFor(shipmentId: string) {
    if (!this.packing) return [];
    return this.packing.list({ shipmentId });
  }

  /** Hierarchical Advance Ship Notice (Shipment → Tare → Pack → Item) + totals. */
  async assembleAsn(id: string): Promise<Asn> {
    const s = await this.getOne(id);
    return buildAsn(s, await this.unitsFor(id));
  }

  /** Simplified EDI 856 flat file for the ASN (download). */
  async asnEdi(id: string): Promise<string> {
    return toEdi856(await this.assembleAsn(id));
  }

  /** Flat packing list (one row per content line) + totals. */
  async assemblePackingList(id: string): Promise<PackingList> {
    const s = await this.getOne(id);
    return buildPackingList(s, await this.unitsFor(id));
  }

  /** Packing list as CSV (download). */
  async packingListCsvText(id: string): Promise<string> {
    return packingListCsv(await this.assemblePackingList(id));
  }

  /** Content lines for this shipment (empty if lines aren't wired in). */
  private async linesFor(shipmentId: string) {
    if (!this.lines) return [];
    return this.lines.listLines(shipmentId);
  }

  /** Bill of Lading. */
  async assembleBol(id: string): Promise<Bol> {
    const s = await this.getOne(id);
    return buildBol(s, await this.linesFor(id), await this.unitsFor(id));
  }

  /** Carta Porte (MX, CFDI complemento 3.1) — datos + requisitos de configuración. */
  async assembleCartaPorte(id: string): Promise<CartaPorte> {
    const s = await this.getOne(id);
    return buildCartaPorte(s, await this.linesFor(id), await this.unitsFor(id));
  }

  /** Commercial invoice (from priced content lines). */
  async assembleInvoice(id: string): Promise<CommercialInvoice> {
    const s = await this.getOne(id);
    return buildCommercialInvoice(s, await this.linesFor(id));
  }

  /** Certificate of Conformance. */
  async assembleCoc(id: string): Promise<Coc> {
    const s = await this.getOne(id);
    return buildCoc(s, await this.linesFor(id), await this.unitsFor(id));
  }

  /** Carta Porte as CFDI 4.0 + complemento 3.1 XML (pre-timbrado). */
  async cartaPorteXml(id: string): Promise<string> {
    const carta = await this.assembleCartaPorte(id);
    const fiscalData = this.fiscal
      ? await this.fiscal.getData()
      : {
          emisorRfc: null,
          emisorNombre: null,
          regimenFiscal: null,
          lugarExpedicion: null,
          origenDomicilio: null,
          permSct: null,
          numPermisoSct: null,
          configVehicular: null,
          aseguraRespCivil: null,
          polizaRespCivil: null,
          claveProdServDefault: null,
        };
    return buildCartaPorteXml(carta, fiscalData);
  }

  /**
   * Cradle-to-grave tomb link: at ship time, tie every shipped serial (from the
   * handling units' contents) to this shipment + customer so a defective lot can
   * be traced forward to the shipments/customers that received it. Best-effort and
   * idempotent (the genealogy module dedups by serial+shipment).
   */
  private async linkGenealogy(s: Shipment): Promise<number> {
    if (!this.genealogy) return 0;
    const units = await this.unitsFor(s.id);
    const shippedAt = s.shippedDate
      ? new Date(s.shippedDate).toISOString()
      : new Date().toISOString();
    let linked = 0;
    for (const u of units) {
      for (const c of u.contents ?? []) {
        for (const serial of c.serials ?? []) {
          try {
            await this.genealogy.linkShipment({
              builtSerial: serial,
              shipmentId: s.id,
              shipmentFolio: s.folio ?? undefined,
              asn: s.asn ?? undefined,
              customerName: s.customerName ?? undefined,
              destination: s.destination ?? undefined,
              shippedAt,
              programId: s.programId ?? undefined,
            });
            linked += 1;
          } catch (err) {
            this.logger.warn(
              `Genealogy link skipped for serial ${serial} (${s.id}): ${(err as Error)?.message}`,
            );
          }
        }
      }
    }
    return linked;
  }

  private async recordLedger(
    action: string,
    s: Shipment,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SHIPPING,
        action,
        referenceType: 'SHIPMENT',
        referenceId: s.id,
        program: s.programId ?? undefined,
        plant: s.plant_id ?? undefined,
        metadata: {
          folio: s.folio,
          asn: s.asn,
          customer: s.customerName,
          beforeState: states.before,
          afterState: states.after,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
