import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CycleCount } from './entities/cycle-count.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateCycleCountDto,
  RecordCountDto,
  TransitionCycleCountDto,
} from './dto/cycle-counts.dto';
import { assertTransition, CycleCountStatus } from './count-state';

export interface CycleCountKpis {
  total: number;
  open: number;
  inventoryAccuracyPct: number | null;
  countsWithVariance: number;
  totalAbsVariance: number;
  adjustments: number;
  byStatus: Record<CycleCountStatus, number>;
}

@Injectable()
export class CycleCountsService {
  private readonly logger = new Logger(CycleCountsService.name);

  constructor(
    @InjectRepository(CycleCount)
    private readonly repo: Repository<CycleCount>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<CycleCount>,
    alias: string,
  ): SelectQueryBuilder<CycleCount> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateCycleCountDto): Promise<CycleCount> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('CYCLE_COUNT');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      partNumber: dto.partNumber,
      location: dto.location ?? null,
      uom: (dto.uom ?? 'PCS').toUpperCase(),
      systemQty: dto.systemQty,
      countedQty: null,
      variance: null,
      status: 'OPEN',
      programId: dto.programId ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('CYCLE_COUNT_CREATED', saved, { after: saved });
    return saved;
  }

  async list(filters: { status?: string; partNumber?: string } = {}): Promise<
    CycleCount[]
  > {
    const qb = this.repo.createQueryBuilder('cc').orderBy('cc.created_at', 'DESC');
    this.applyScope(qb, 'cc');
    if (filters.status) qb.andWhere('cc.status = :s', { s: filters.status });
    if (filters.partNumber)
      qb.andWhere('cc.part_number = :pn', { pn: filters.partNumber });
    return qb.getMany();
  }

  async getOne(id: string): Promise<CycleCount> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Conteo no encontrado.');
    return found;
  }

  /** Record the physical count: computes variance and moves OPEN → COUNTED. */
  async recordCount(id: string, dto: RecordCountDto): Promise<CycleCount> {
    const cc = await this.getOne(id);
    if (cc.status !== 'OPEN') {
      throw new BadRequestException(
        `Solo se puede contar un conteo OPEN (actual: ${cc.status}).`,
      );
    }
    cc.countedQty = dto.countedQty;
    cc.variance = dto.countedQty - Number(cc.systemQty ?? 0);
    cc.status = 'COUNTED';
    cc.countedBy = this.tenantCtx.getUserEmail();
    cc.countedAt = new Date();
    const saved = await this.repo.save(cc);
    await this.recordLedger('CYCLE_COUNT_COUNTED', saved, { after: saved });
    return saved;
  }

  async transition(
    id: string,
    dto: TransitionCycleCountDto,
  ): Promise<CycleCount> {
    const cc = await this.getOne(id);
    const from = cc.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    cc.status = dto.status;
    // ADJUSTED means inventory is corrected to the count → variance resolved to 0.
    if (dto.status === 'ADJUSTED' && cc.countedQty !== null) {
      cc.systemQty = cc.countedQty;
      cc.variance = 0;
    }
    const saved = await this.repo.save(cc);
    await this.recordLedger('CYCLE_COUNT_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<CycleCountKpis> {
    const all = await this.list();
    const byStatus = {
      OPEN: 0,
      COUNTED: 0,
      RECONCILED: 0,
      ADJUSTED: 0,
      CANCELLED: 0,
    } as Record<CycleCountStatus, number>;

    let countedTotal = 0;
    let accurate = 0;
    let countsWithVariance = 0;
    let totalAbsVariance = 0;

    for (const cc of all) {
      byStatus[cc.status] = (byStatus[cc.status] ?? 0) + 1;
      if (cc.countedQty !== null && cc.variance !== null) {
        countedTotal += 1;
        const v = Number(cc.variance);
        totalAbsVariance += Math.abs(v);
        if (v === 0) accurate += 1;
        else countsWithVariance += 1;
      }
    }

    return {
      total: all.length,
      open: byStatus.OPEN,
      inventoryAccuracyPct:
        countedTotal > 0 ? Math.round((accurate / countedTotal) * 1000) / 10 : null,
      countsWithVariance,
      totalAbsVariance: Math.round(totalAbsVariance * 100) / 100,
      adjustments: byStatus.ADJUSTED,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    cc: CycleCount,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.MATERIALS,
        action,
        referenceType: 'CYCLE_COUNT',
        referenceId: cc.id,
        program: cc.programId ?? undefined,
        plant: cc.plant_id ?? undefined,
        transaction: { quantity: cc.countedQty ?? undefined },
        metadata: {
          folio: cc.folio,
          partNumber: cc.partNumber,
          variance: cc.variance,
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
