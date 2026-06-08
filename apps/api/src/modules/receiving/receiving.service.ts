import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReceivingEvent } from './entities/receiving-event.entity';
import { InventoryService } from '../inventory/inventory.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { In } from 'typeorm';

@Injectable()
export class ReceivingService {
  constructor(
    @InjectRepository(ReceivingEvent)
    private readonly receivingRepo: Repository<ReceivingEvent>,
    private readonly inventory: InventoryService,
    private readonly eventLedger: EventLedgerService,
    private readonly audit: AuditService,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    private readonly numbering: DocumentNumberingService,
  ) {}

  /**
   * Folio atómico vía DocumentNumberingService (docType GOODS_RECEIPT → conserva
   * el formato `REC-YYYY-NNNN`). Si la asignación falla, cae al esquema previo
   * basado en conteo para que un recibo nunca se quede sin folio.
   */
  private async nextReceiptNumber(): Promise<string> {
    try {
      return await this.numbering.allocate('GOODS_RECEIPT');
    } catch {
      const count = await this.receivingRepo.count();
      const year = new Date().getFullYear();
      return `REC-${year}-${(count + 1).toString().padStart(4, '0')}`;
    }
  }

  async findAll(user: User, filters: any = {}): Promise<ReceivingEvent[]> {
    const qb = this.receivingRepo.createQueryBuilder('rec');

    // 1. Scope-aware filtering
    const scopeBids = user.scopes?.buildings ?? [];
    if (scopeBids.length > 0) {
      const whs = await this.warehouseRepo.find({
        where: { building: { id: In(scopeBids) } },
      });
      const whIds = whs.map((w) => w.id);
      if (whIds.length > 0) {
        qb.andWhere('rec.warehouseId IN (:...whIds)', { whIds });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    // 2. Application filters
    if (filters.partNumber)
      qb.andWhere('rec.partNumber LIKE :pn', { pn: `%${filters.partNumber}%` });
    if (filters.supplierCode)
      qb.andWhere('rec.supplierCode = :sc', { sc: filters.supplierCode });
    if (filters.warehouseId)
      qb.andWhere('rec.warehouseId = :wh', { wh: filters.warehouseId });

    qb.orderBy('rec.createdAt', 'DESC');
    return qb.getMany();
  }

  async recordReceipt(
    dto: Partial<ReceivingEvent>,
    user: User,
  ): Promise<ReceivingEvent> {
    const receiptNumber = await this.nextReceiptNumber();

    const receipt = this.receivingRepo.create({
      ...dto,
      receiptNumber,
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
      reason: `Material Receipt from Supplier: ${saved.supplierCode}`,
    });

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'MATERIAL_RECEIVED',
      actorName: saved.receivedBy,
      referenceType: 'RECEIPT',
      referenceId: saved.receiptNumber,
      metadata: {
        partNumber: saved.partNumber,
        qty: saved.quantity,
        status: 'pending_iqc',
      },
    });

    await this.audit.recordAction({
      actor: user.email,
      action: 'MATERIAL_RECEIPT_RECORDED',
      resourceType: 'ReceivingEvent',
      resourceId: saved.receiptNumber,
      metadata: {
        partNumber: saved.partNumber,
        quantity: saved.quantity,
        warehouse: saved.warehouseId,
        supplier: saved.supplierCode,
      },
      outcome: 'ALLOWED',
    });

    return saved;
  }
}
