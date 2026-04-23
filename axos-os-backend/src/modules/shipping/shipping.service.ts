import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from './entities/shipment.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(ShipmentItem)
    private readonly itemRepo: Repository<ShipmentItem>,
    private readonly inventory: InventoryService
  ) {}

  async findAll() {
    return this.shipmentRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const shipment = await this.shipmentRepo.findOne({ 
      where: { id },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    
    const items = await this.itemRepo.find({ where: { shipment: { id } } });
    return { ...shipment, items };
  }

  async create(dto: Partial<Shipment>) {
    const count = await this.shipmentRepo.count();
    const shipmentNumber = `SHP-2024-${(count + 1).toString().padStart(3, '0')}`;
    const shipment = this.shipmentRepo.create({ ...dto, shipmentNumber, status: ShipmentStatus.PLANNING });
    return this.shipmentRepo.save(shipment);
  }

  async addItem(shipmentId: number, itemDto: any) {
    const shipment = await this.shipmentRepo.findOne({ where: { id: shipmentId } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const item = this.itemRepo.create({ ...itemDto, shipment });
    await this.itemRepo.save(item);

    // Update Inventory status to 'staged_for_shipping'
    await this.inventory.recordTransaction({
      type: 'HOLD' as any, // Internal hold for staging
      partNumber: itemDto.partNumber,
      quantity: itemDto.quantity,
      fromWarehouseId: itemDto.fromWarehouseId || 'WH-FG',
      fromLocation: itemDto.fromLocation || 'STAGING',
      toWarehouseId: itemDto.fromWarehouseId || 'WH-FG',
      toLocation: 'SHIPPING_DOCK',
      actorName: 'Shipping Agent',
      holdStatus: 'staged_for_shipping',
      referenceType: 'SHIPMENT',
      referenceId: shipment.shipmentNumber,
      reason: `Staged for Shipment ${shipment.shipmentNumber}`
    });

    return item;
  }

  async dispatch(id: number, actor: string) {
    const shipment = await this.shipmentRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const items = await this.itemRepo.find({ where: { shipment: { id } } });

    for (const item of items) {
      // Final Inventory decrement (Shipped)
      await this.inventory.recordTransaction({
        type: 'TRANSFER' as any, // Final transfer out of AXOS OS
        partNumber: item.partNumber,
        quantity: item.quantity,
        fromWarehouseId: item.fromWarehouseId || 'WH-FG',
        fromLocation: 'SHIPPING_DOCK',
        actorName: actor,
        holdStatus: 'shipped',
        referenceType: 'SHIPMENT_DISPATCH',
        referenceId: shipment.shipmentNumber,
        reason: `Dispatched to Customer: ${shipment.customer}`
      });
    }

    shipment.status = ShipmentStatus.DISPATCHED;
    shipment.dispatchedAt = new Date();
    shipment.dispatchedBy = actor;
    return this.shipmentRepo.save(shipment);
  }
}
