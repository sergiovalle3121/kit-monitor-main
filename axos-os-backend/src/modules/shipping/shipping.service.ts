import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { PackingList } from './entities/packing-list.entity';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';

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
    const shipmentNumber = `SHP-GDL-${(count + 1).toString().padStart(4, '0')}`;
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
      holdStatus: 'hold' as any, // staged_for_shipping is not in current union, using hold for now or cast
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
}
