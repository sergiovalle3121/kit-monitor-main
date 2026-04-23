import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { PackingList } from './entities/packing-list.entity';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../governance/audit.service';

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
  ) {}

  async findAll() {
    return this.shipmentRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const shipment = await this.shipmentRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    
    const items = await this.itemRepo.find({ where: { shipment: { id } } });
    const packingLists = await this.packingRepo.find({ where: { shipment: { id } } });
    return { ...shipment, items, packingLists };
  }

  async create(dto: Partial<Shipment>) {
    const count = await this.shipmentRepo.count();
    const shipmentNumber = `SHP-GDL-${(count + 1).toString().padStart(4, '0')}`;
    const shipment = this.shipmentRepo.create({ ...dto, shipmentNumber, status: ShipmentStatus.PLANNING });
    return this.shipmentRepo.save(shipment);
  }

  async addItem(shipmentId: number, itemDto: any) {
    const shipment = await this.shipmentRepo.findOne({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    // ELIGIBILITY RULE: Only 'available' stock (OQC Passed) can be added
    const stock = await this.inventory.getInventoryPositions({ 
      partNumber: itemDto.partNumber, 
      warehouseId: 'WH-FG',
      holdStatus: 'available' 
    });

    const totalAvailable = stock.reduce((acc, s) => acc + s.onHand, 0);
    if (totalAvailable < itemDto.quantity) {
      throw new BadRequestException(`Material not eligible for shipping. Available released: ${totalAvailable}, Requested: ${itemDto.quantity}. Check OQC status.`);
    }

    const item = this.itemRepo.create({ ...itemDto, shipment });
    await this.itemRepo.save(item);

    // Update Inventory status to 'staged_for_shipping'
    await this.inventory.recordTransaction({
      type: 'HOLD' as any,
      partNumber: itemDto.partNumber,
      quantity: itemDto.quantity,
      fromWarehouseId: 'WH-FG',
      fromLocation: itemDto.fromLocation || 'STAGING',
      toWarehouseId: 'WH-FG',
      toLocation: 'SHIPPING_DOCK',
      actorName: 'Shipping Agent',
      holdStatus: 'staged_for_shipping',
      referenceType: 'SHIPMENT_STAGING',
      referenceId: shipment.shipmentNumber,
      reason: `Staged for Shipment ${shipment.shipmentNumber}`
    });

    shipment.status = ShipmentStatus.STAGED;
    await this.shipmentRepo.save(shipment);

    return item;
  }

  async generatePackingList(shipmentId: number, actor: string) {
    const shipment = await this.shipmentRepo.findOne({ where: { id: shipmentId } });
    const items = await this.itemRepo.find({ where: { shipment: { id: shipmentId } } });
    
    const plNumber = `PL-${shipment.shipmentNumber}-${Date.now().toString().slice(-4)}`;
    const packingList = this.packingRepo.create({
      packingListNumber: plNumber,
      shipment,
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

    for (const item of items) {
      await this.inventory.recordTransaction({
        type: 'TRANSFER' as any,
        partNumber: item.partNumber,
        quantity: item.quantity,
        fromWarehouseId: 'WH-FG',
        fromLocation: 'SHIPPING_DOCK',
        actorName: actor,
        holdStatus: 'shipped',
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
    shipment.status = ShipmentStatus.CLOSED;
    return this.shipmentRepo.save(shipment);
  }
}
