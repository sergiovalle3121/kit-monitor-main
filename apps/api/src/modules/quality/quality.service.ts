import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QualityHold, QualityHoldLevel } from './entities/quality-hold.entity';
import { QuarantineTransfer, QuarantineTransferStatus } from './entities/quarantine-transfer.entity';
import { Disposition, DispositionType, DispositionStatus } from './entities/disposition.entity';
import { CAPA, CapaStatus } from './entities/capa.entity';
import { IQCInspection, IqcResult } from './entities/iqc-inspection.entity';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { InventoryService } from '../inventory/inventory.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { NcrService } from '../ncr/ncr.service';
import { NcrStatus } from '../ncr/entities/ncr.entity';
import { SuppliersService } from '../suppliers/suppliers.service';

import { FinalInspection } from './entities/final-inspection.entity';
import { AuditService } from '../governance/audit.service';
import { ExceptionSeverity, ExceptionDomain } from '../governance/entities/operational-exception.entity';

@Injectable()
export class QualityService {
  constructor(
    @InjectRepository(QualityHold)
    private readonly holdRepo: Repository<QualityHold>,
    @InjectRepository(QuarantineTransfer)
    private readonly transferRepo: Repository<QuarantineTransfer>,
    @InjectRepository(Disposition)
    private readonly dispositionRepo: Repository<Disposition>,
    @InjectRepository(CAPA)
    private readonly capaRepo: Repository<CAPA>,
    @InjectRepository(IQCInspection)
    private readonly iqcRepo: Repository<IQCInspection>,
    @InjectRepository(FinalInspection)
    private readonly oqcRepo: Repository<FinalInspection>,
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    private readonly eventLedger: EventLedgerService,
    private readonly inventory: InventoryService,
    private readonly ncrService: NcrService,
    private readonly suppliersService: SuppliersService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
    private readonly numbering: DocumentNumberingService,
  ) {}

  /**
   * Certifica (firma electrónicamente) un Certificado de Conformancia. Emite un
   * folio oficial COC- y registra una ATESTACIÓN INMUTABLE en el Event Ledger:
   * quién certifica (identidad de la sesión, no del body), cuándo, el folio y un
   * hash del contenido del documento. No es PKI legal, pero es una firma
   * electrónica atribuible + un registro inmutable real (el ledger es append-only).
   */
  async certifyCoc(
    dto: { subjectType?: string; subject?: string; contentHash?: string },
    actor: string,
  ): Promise<{ folio: string; certifiedBy: string; certifiedAt: string; contentHash: string | null }> {
    const folio = await this.numbering.allocate('COC');
    const certifiedAt = new Date().toISOString();
    const referenceType = (dto.subjectType || 'COC').toUpperCase();
    const referenceId = (dto.subject || folio).toString();
    const contentHash = dto.contentHash ?? null;
    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'COC_CERTIFIED',
      actorName: actor,
      referenceType,
      referenceId,
      metadata: {
        document: 'Certificate of Conformance',
        folio,
        contentHash,
        certifiedAt,
      },
    });
    return { folio, certifiedBy: actor, certifiedAt, contentHash };
  }

  async findAllActiveHolds(): Promise<QualityHold[]> {
    return this.holdRepo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async createHold(dto: {
    partNumber: string;
    level: QualityHoldLevel;
    levelValue?: string;
    reason: string;
    heldBy: string;
    notes?: string;
  }): Promise<QualityHold> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Save Hold Rule
      const hold = this.holdRepo.create({ ...dto, isActive: true });
      const savedHold = await queryRunner.manager.save(hold);

      // 2. Apply to Inventory Positions
      // Build update query based on level
      const qb = queryRunner.manager.createQueryBuilder(InventoryPosition, 'pos')
        .update()
        .set({ holdStatus: 'hold' })
        .where('partNumber = :pn', { pn: dto.partNumber });

      if (dto.level === 'WAREHOUSE') qb.andWhere('warehouseId = :val', { val: dto.levelValue });
      if (dto.level === 'PROGRAM') qb.andWhere('programId = :val', { val: dto.levelValue });
      if (dto.level === 'LOT') qb.andWhere('lotNumber = :val', { val: dto.levelValue });
      if (dto.level === 'SERIAL') qb.andWhere('serialNumber = :val', { val: dto.levelValue });
      // BUILDING level would require joining warehouse, but for simplicity we assume warehouseId is prefixed or we handle it in business logic
      
      await qb.execute();

      // 3. Log Event
      await this.eventLedger.recordEvent({
        domain: EventDomain.QUALITY,
        action: 'QUALITY_HOLD_APPLIED',
        actorName: dto.heldBy,
        referenceType: 'QUALITY_HOLD',
        referenceId: savedHold.id.toString(),
        metadata: { 
          partNumber: dto.partNumber,
          level: dto.level,
          value: dto.levelValue,
          reason: dto.reason
        }
      });

      // AUTOMATION: Create Operational Exception for Quality Hold
      await this.audit.recordException({
        severity: ExceptionSeverity.CRITICAL,
        domain: ExceptionDomain.QUALITY,
        title: `Quality Hold: ${dto.partNumber}`,
        description: `Material ${dto.partNumber} blocked at ${dto.level} level (${dto.levelValue || 'ALL'}). Reason: ${dto.reason}`,
        actor: dto.heldBy,
        resourceType: 'QualityHold',
        resourceId: savedHold.id.toString(),
        metadata: { partNumber: dto.partNumber, level: dto.level, value: dto.levelValue }
      });

      await queryRunner.commitTransaction();
      return savedHold;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async releaseHold(id: number, releasedBy: string): Promise<QualityHold> {
    const hold = await this.holdRepo.findOne({ where: { id } });
    if (!hold) throw new NotFoundException('Hold not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      hold.isActive = false;
      hold.releasedBy = releasedBy;
      hold.releasedAt = new Date();
      await queryRunner.manager.save(hold);

      // Restore Inventory Positions
      const qb = queryRunner.manager.createQueryBuilder(InventoryPosition, 'pos')
        .update()
        .set({ holdStatus: 'available' })
        .where('partNumber = :pn', { pn: hold.partNumber });

      if (hold.level === 'WAREHOUSE') qb.andWhere('warehouseId = :val', { val: hold.levelValue });
      if (hold.level === 'PROGRAM') qb.andWhere('programId = :val', { val: hold.levelValue });
      if (hold.level === 'LOT') qb.andWhere('lotNumber = :val', { val: hold.levelValue });
      
      await qb.execute();

      await this.eventLedger.recordEvent({
        domain: EventDomain.QUALITY,
        action: 'QUALITY_HOLD_RELEASED',
        actorName: releasedBy,
        referenceType: 'QUALITY_HOLD',
        referenceId: hold.id.toString(),
        metadata: { partNumber: hold.partNumber, reason: hold.reason }
      });

      await this.audit.log({
        actor: releasedBy,
        action: 'QUALITY_HOLD_RELEASE',
        entity: 'QualityHold',
        entityId: String(hold.id),
        before: { id: hold.id, isActive: true },
        after: hold,
        scope: { partNumber: hold.partNumber }
      });

      await queryRunner.commitTransaction();
      return hold;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async checkIsHeld(partNumber: string, context: { warehouseId?: string; programId?: string }): Promise<boolean> {
    const activeHolds = await this.holdRepo.find({ where: { partNumber, isActive: true } });
    if (!activeHolds.length) return false;

    for (const hold of activeHolds) {
      if (hold.level === 'PART_NUMBER') return true;
      if (hold.level === 'WAREHOUSE' && hold.levelValue === context.warehouseId) return true;
      if (hold.level === 'PROGRAM' && hold.levelValue === context.programId) return true;
    }
    return false;
  }

  // --- QUARANTINE TRANSFERS ---

  async findTransfers(): Promise<QuarantineTransfer[]> {
    return this.transferRepo.find({ 
      relations: ['hold'],
      order: { createdAt: 'DESC' }
    });
  }

  async requestQuarantineTransfer(dto: {
    holdId: number;
    quantity: number;
    sourceWarehouseId: string;
    sourceLocation: string;
    destWarehouseId: string;
    destLocation: string;
    requestedBy: string;
  }): Promise<QuarantineTransfer> {
    const hold = await this.holdRepo.findOne({ where: { id: dto.holdId } });
    if (!hold) throw new NotFoundException('Hold not found');

    const transfer = this.transferRepo.create({
      ...dto,
      partNumber: hold.partNumber,
      status: QuarantineTransferStatus.PENDING
    });
    const saved = await this.transferRepo.save(transfer);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'QUARANTINE_TRANSFER_REQUESTED',
      actorName: dto.requestedBy,
      referenceType: 'QUARANTINE_TRANSFER',
      referenceId: saved.id.toString(),
      metadata: { partNumber: hold.partNumber, qty: dto.quantity }
    });

    // AUTOMATION: Create Operational Exception for Quarantine Transfer
    await this.audit.recordException({
      severity: ExceptionSeverity.MEDIUM,
      domain: ExceptionDomain.QUALITY,
      title: `Quarantine Transfer: ${hold.partNumber}`,
      description: `Containment requested for ${dto.quantity} units to be moved to ${dto.destWarehouseId}.`,
      actor: dto.requestedBy,
      resourceType: 'QuarantineTransfer',
      resourceId: saved.id.toString(),
      metadata: { partNumber: hold.partNumber, quantity: dto.quantity, destination: dto.destWarehouseId }
    });

    return saved;
  }

  async completeQuarantineTransfer(id: number, actor: string): Promise<QuarantineTransfer> {
    const transfer = await this.transferRepo.findOne({ where: { id }, relations: ['hold'] });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== QuarantineTransferStatus.PENDING) throw new Error('Transfer already processed');

    // Perform Physical Movement in Inventory Backbone
    await this.inventory.recordTransaction({
      type: 'TRANSFER',
      partNumber: transfer.partNumber,
      quantity: transfer.quantity,
      fromWarehouseId: transfer.sourceWarehouseId,
      fromLocation: transfer.sourceLocation,
      toWarehouseId: transfer.destWarehouseId,
      toLocation: transfer.destLocation,
      actorName: actor,
      referenceType: 'QUARANTINE_TRANSFER',
      referenceId: transfer.id.toString(),
      reason: `Quarantine Containment: ${transfer.hold.reason}`
    });

    // Update Status
    transfer.status = QuarantineTransferStatus.COMPLETED;
    transfer.completedBy = actor;
    transfer.completedAt = new Date();
    const updated = await this.transferRepo.save(transfer);

    // Update inventory position hold status to 'quarantine' in destination
    await this.positionRepo.update(
      { 
        partNumber: transfer.partNumber, 
        warehouseId: transfer.destWarehouseId, 
        location: transfer.destLocation 
      },
      { holdStatus: 'quarantine' }
    );

    return updated;
  }

  // --- DISPOSITION ENGINE ---

  async findDispositions(): Promise<Disposition[]> {
    return this.dispositionRepo.find({ 
      relations: ['ncr', 'hold'],
      order: { createdAt: 'DESC' }
    });
  }

  async proposeDisposition(dto: Partial<Disposition>): Promise<Disposition> {
    const disposition = this.dispositionRepo.create({
      ...dto,
      status: DispositionStatus.PROPOSED
    });
    const saved = await this.dispositionRepo.save(disposition);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'DISPOSITION_PROPOSED',
      actorName: dto.proposedBy,
      referenceType: 'DISPOSITION',
      referenceId: saved.id.toString(),
      metadata: { type: dto.type, partNumber: dto.partNumber }
    });

    // AUTOMATION: Create Operational Exception for Disposition
    await this.audit.recordException({
      severity: ExceptionSeverity.MEDIUM,
      domain: ExceptionDomain.QUALITY,
      title: `Disposition Proposed: ${dto.type}`,
      description: `New disposition proposed for ${dto.partNumber} (${dto.quantity} units). Type: ${dto.type}`,
      actor: dto.proposedBy,
      resourceType: 'Disposition',
      resourceId: saved.id.toString(),
      metadata: { type: dto.type, partNumber: dto.partNumber, quantity: dto.quantity }
    });

    return saved;
  }

  async approveDisposition(id: number, actor: string): Promise<Disposition> {
    const disposition = await this.dispositionRepo.findOne({ where: { id } });
    if (!disposition) throw new NotFoundException('Disposition not found');
    // Solo se aprueba desde PROPOSED. Sin este guard, re-aprobar una disposición
    // ya EXECUTED la regresaba a APPROVED y executeDisposition volvía a correr →
    // doble goods-issue (SCRAP/RTV) y re-cierre de la NCR.
    if (disposition.status !== DispositionStatus.PROPOSED) {
      throw new BadRequestException(
        `Solo se pueden aprobar disposiciones en estado PROPOSED (actual: ${disposition.status}).`,
      );
    }

    const before = { ...disposition };
    disposition.status = DispositionStatus.APPROVED;
    disposition.approvedBy = actor;
    const saved = await this.dispositionRepo.save(disposition);

    await this.audit.log({
      actor,
      action: 'DISPOSITION_APPROVAL',
      entity: 'Disposition',
      entityId: String(disposition.id),
      before,
      after: saved,
      scope: { type: disposition.type, partNumber: disposition.partNumber }
    });

    return saved;
  }

  async executeDisposition(id: number, actor: string): Promise<Disposition> {
    const disposition = await this.dispositionRepo.findOne({ 
      where: { id },
      relations: ['ncr', 'hold'] 
    });
    if (!disposition) throw new NotFoundException('Disposition not found');
    if (disposition.status !== DispositionStatus.APPROVED) throw new Error('Disposition must be approved before execution');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. IMPACT INVENTORY BASED ON TYPE
      if (disposition.type === DispositionType.RELEASE || disposition.type === DispositionType.USE_AS_IS) {
        // Restore to Available
        await queryRunner.manager.update(
          InventoryPosition,
          { 
            partNumber: disposition.partNumber, 
            warehouseId: disposition.warehouseId, 
            location: disposition.location 
          },
          { holdStatus: 'available' }
        );
      } else if (disposition.type === DispositionType.SCRAP || disposition.type === DispositionType.RTV) {
        // Permanently decrement stock
        await this.inventory.recordTransaction({
          type: 'ADJUST',
          partNumber: disposition.partNumber,
          quantity: disposition.quantity,
          fromWarehouseId: disposition.warehouseId,
          fromLocation: disposition.location,
          actorName: actor,
          reason: `Quality Disposition: ${disposition.type.toUpperCase()} - NCR ${disposition.ncr?.ncrNumber || 'N/A'}`
        });
      }

      // 2. CLOSE RELATED ENTITIES
      if (disposition.ncr) {
        await this.ncrService.updateStatus(disposition.ncr.id, NcrStatus.CLOSED, actor);
      }
      if (disposition.hold) {
        await this.releaseHold(disposition.hold.id, actor);
      }

      // 3. FINALIZE DISPOSITION
      disposition.status = DispositionStatus.EXECUTED;
      disposition.executedBy = actor;
      disposition.executedAt = new Date();
      const updated = await queryRunner.manager.save(disposition);

      await this.eventLedger.recordEvent({
        domain: EventDomain.QUALITY,
        action: 'DISPOSITION_EXECUTED',
        actorName: actor,
        referenceType: 'DISPOSITION',
        referenceId: updated.id.toString(),
        metadata: { type: updated.type, partNumber: updated.partNumber }
      });

      await queryRunner.commitTransaction();
      return updated;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // --- CAPA ENGINE ---

  async findCapas(filters: any): Promise<CAPA[]> {
    const qb = this.capaRepo.createQueryBuilder('capa')
      .leftJoinAndSelect('capa.ncr', 'ncr')
      .leftJoinAndSelect('capa.disposition', 'dispo');

    if (filters.status) qb.andWhere('capa.status = :status', { status: filters.status });
    if (filters.partNumber) qb.andWhere('capa.partNumber = :pn', { pn: filters.partNumber });

    qb.orderBy('capa.createdAt', 'DESC');
    return qb.getMany();
  }

  async createCapa(dto: Partial<CAPA>): Promise<CAPA> {
    const count = await this.capaRepo.count();
    const year = new Date().getFullYear();
    const capaNumber = `CAPA-${year}-${(count + 1).toString().padStart(4, '0')}`;

    const capa = this.capaRepo.create({
      ...dto,
      capaNumber,
      status: CapaStatus.OPEN
    });
    const saved = await this.capaRepo.save(capa);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'CAPA_CREATED',
      actorName: dto.createdBy || 'QA System',
      referenceType: 'CAPA',
      referenceId: saved.id.toString(),
      metadata: { capaNumber: saved.capaNumber, partNumber: saved.partNumber }
    });

    return saved;
  }

  async updateCapa(id: number, dto: Partial<CAPA>, actor: string): Promise<CAPA> {
    const capa = await this.capaRepo.findOne({ where: { id } });
    if (!capa) throw new NotFoundException('CAPA not found');

    Object.assign(capa, dto);
    const updated = await this.capaRepo.save(capa);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'CAPA_UPDATED',
      actorName: actor,
      referenceType: 'CAPA',
      referenceId: id.toString(),
      metadata: { status: updated.status }
    });

    return updated;
  }

  // --- IQC ENGINE ---

  async findIqcInspections(filters: any): Promise<IQCInspection[]> {
    const qb = this.iqcRepo.createQueryBuilder('iqc')
      .leftJoinAndSelect('iqc.supplier', 'supplier');

    if (filters.partNumber) qb.andWhere('iqc.partNumber = :pn', { pn: filters.partNumber });
    if (filters.result) qb.andWhere('iqc.result = :res', { res: filters.result });

    qb.orderBy('iqc.createdAt', 'DESC');
    return qb.getMany();
  }

  async recordIqcInspection(dto: Partial<IQCInspection>): Promise<IQCInspection> {
    const count = await this.iqcRepo.count();
    const year = new Date().getFullYear();
    const inspectionNumber = `IQC-${year}-${(count + 1).toString().padStart(4, '0')}`;

    const inspection = this.iqcRepo.create({
      ...dto,
      inspectionNumber,
    });
    const saved = await this.iqcRepo.save(inspection);

    // If PASS, release to usable stock
    if (dto.result === IqcResult.PASS) {
      await this.positionRepo.update(
        { 
          partNumber: saved.partNumber, 
          lotNumber: saved.lotNumber,
          holdStatus: 'pending_iqc'
        },
        { holdStatus: 'available' }
      );
    }

    // If FAIL, trigger containment
    if (dto.result === IqcResult.FAIL) {
      await this.createHold({
        partNumber: saved.partNumber,
        level: QualityHoldLevel.LOT,
        levelValue: saved.lotNumber,
        reason: `FAILED IQC: ${saved.inspectionNumber}`,
        heldBy: saved.inspector,
        notes: `Automatic hold triggered by IQC failure. ${saved.notes || ''}`
      });
    }

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'IQC_INSPECTION_RECORDED',
      actorName: saved.inspector,
      referenceType: 'IQC_INSPECTION',
      referenceId: saved.id.toString(),
      metadata: { result: saved.result, partNumber: saved.partNumber, lot: saved.lotNumber }
    });

    return saved;
  }
  async getPendingOqcBacklog(): Promise<InventoryPosition[]> {
    return this.positionRepo.find({
      where: { holdStatus: 'pending_oqc' as any },
      relations: ['material', 'warehouse'],
      order: { updatedAt: 'DESC' }
    });
  }

  async recordFinalInspection(dto: any): Promise<FinalInspection> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Record Inspection Result
      const inspection = this.oqcRepo.create(dto);
      const saved = await queryRunner.manager.save(inspection) as any as FinalInspection;

      // 2. Update Inventory Status based on result
      let targetStatus: any = 'available';
      if (dto.result === 'FAIL') targetStatus = 'hold';
      if (dto.result === 'CONDITIONAL') targetStatus = 'quarantine';

      // Find relevant positions in WH-FG
      const positions = await queryRunner.manager.find(InventoryPosition, {
        where: {
          partNumber: dto.partNumber,
          holdStatus: 'pending_oqc' as any,
          warehouseId: 'WH-FG'
        }
      });

      let remainingToApply = dto.quantityInspected;
      for (const pos of positions) {
        if (remainingToApply <= 0) break;
        const applyQty = Math.min(pos.onHand, remainingToApply);
        
        // Use inventory service for formal ledger
        await this.inventory.recordTransaction({
          type: 'HOLD',
          partNumber: pos.partNumber,
          quantity: applyQty,
          fromWarehouseId: 'WH-FG',
          fromLocation: pos.location,
          toWarehouseId: 'WH-FG',
          toLocation: pos.location,
          actorName: dto.inspector || 'Quality System',
          holdStatus: targetStatus as any,
          referenceType: 'OQC_INSPECTION',
          referenceId: saved.id.toString(),
          reason: `OQC Result: ${dto.result} - WO ${dto.workOrder}`
        });

        remainingToApply -= applyQty;
      }

      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getOqcHistory(partNumber?: string): Promise<FinalInspection[]> {
    const where = partNumber ? { partNumber } : {};
    return this.oqcRepo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }
}
