import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceivingEvent } from './entities/receiving-event.entity';
import { InventoryService } from '../inventory/inventory.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class ReceivingService {
  constructor(
    @InjectRepository(ReceivingEvent)
    private readonly receivingRepo: Repository<ReceivingEvent>,
    private readonly inventory: InventoryService,
    private readonly eventLedger: EventLedgerService,
  ) {}

  async findAll(): Promise<ReceivingEvent[]> {
    return this.receivingRepo.find({ order: { createdAt: 'DESC' } });
  }

  async recordReceipt(dto: Partial<ReceivingEvent>): Promise<ReceivingEvent> {
    const count = await this.receivingRepo.count();
    const year = new Date().getFullYear();
    const receiptNumber = `REC-${year}-${(count + 1).toString().padStart(4, '0')}`;

    const receipt = this.receivingRepo.create({
      ...dto,
      receiptNumber
    });
    const saved = await this.receivingRepo.save(receipt);

    // OPERATIONAL HARDENING: Any received material starts as 'pending_iqc'
    await this.inventory.recordTransaction({
      type: 'RECEIVE',
      partNumber: saved.partNumber,
      quantity: saved.quantity,
      toWarehouseId: saved.warehouseId,
      toLocation: saved.location,
      actorName: saved.receivedBy,
      referenceType: 'RECEIPT',
      referenceId: saved.receiptNumber,
      holdStatus: 'pending_iqc', // FORCE PENDING IQC STATUS
      lotNumber: saved.lotNumber,
      serialNumber: saved.serialNumber,
      reason: `Material Receipt from Supplier: ${saved.supplierCode}`
    });

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'MATERIAL_RECEIVED',
      actorName: saved.receivedBy,
      referenceType: 'RECEIPT',
      referenceId: saved.receiptNumber,
      metadata: { partNumber: saved.partNumber, qty: saved.quantity, status: 'pending_iqc' }
    });

    return saved;
  }
}
