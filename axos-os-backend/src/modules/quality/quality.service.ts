import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QualityHold, QualityHoldLevel } from './entities/quality-hold.entity';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class QualityService {
  constructor(
    @InjectRepository(QualityHold)
    private readonly holdRepo: Repository<QualityHold>,
    @InjectRepository(InventoryPosition)
    private readonly positionRepo: Repository<InventoryPosition>,
    private readonly eventLedger: EventLedgerService,
    private readonly dataSource: DataSource,
  ) {}

  async findAllActiveHolds(): Promise<QualityHold[]> {
    return this.holdRepo.find({ where: { isActive: true }, orderBy: { createdAt: 'DESC' } });
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
}
