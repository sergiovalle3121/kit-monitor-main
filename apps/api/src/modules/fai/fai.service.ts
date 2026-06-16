import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { SfFai } from './entities/sf-fai.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateFaiDto, SubmitFaiDto } from './dto/fai.dto';
import {
  allWithinTolerance,
  assertTransition,
  evaluateMeasurements,
  FaiResult,
} from './fai-state';

export interface FaiKpis {
  total: number;
  byResult: Record<FaiResult, number>;
  pending: number;
  passed: number;
  failed: number;
  /** First-pass yield: PASS / (PASS + FAIL). */
  firstPassYieldPct: number;
  /** Distinct WOs with at least one passing FAI. */
  woApproved: number;
  measurementsOutOfTol: number;
}

@Injectable()
export class FaiService {
  private readonly logger = new Logger(FaiService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfFai))
    private readonly repo: TenantScopedRepository<SfFai>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    private readonly plan: ProductionPlanService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<SfFai>,
    alias: string,
  ): SelectQueryBuilder<SfFai> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  // ── Create (open a first-piece inspection tied to a WO) ─────────────────────
  async create(dto: CreateFaiDto): Promise<SfFai> {
    const wo = await this.plan.getOne(dto.woId); // 404s if the WO doesn't exist
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('FAI');
    } catch (err) {
      this.logger.warn(
        `FAI folio allocation failed: ${(err as Error)?.message}`,
      );
    }
    const measurements = dto.measurements?.length
      ? evaluateMeasurements(dto.measurements)
      : null;
    const now = new Date();
    const fai = this.repo.create({
      folio,
      woId: wo.id,
      woFolio: wo.folio,
      model: wo.model,
      revision: wo.revision ?? 'A',
      line: wo.line,
      station: dto.station ?? null,
      serial: dto.serial?.trim() || null,
      result: 'PENDING',
      measurements,
      inspector: null,
      inspectedAt: null,
      raisedBy: this.tenantCtx.getUserEmail(),
      raisedAt: now,
      notes: dto.notes ?? null,
      programId: wo.programId ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(fai);
    await this.record('SF_FAI_OPENED', saved, { after: saved });
    return saved;
  }

  // ── Submit decision (pass/fail) ─────────────────────────────────────────────
  async submit(id: string, dto: SubmitFaiDto): Promise<SfFai> {
    const fai = await this.getOne(id);
    const target: FaiResult = dto.pass ? 'PASS' : 'FAIL';
    try {
      assertTransition(fai.result, target);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const measurements = dto.measurements?.length
      ? evaluateMeasurements(dto.measurements)
      : (fai.measurements ?? null);

    // A first piece cannot be approved with any out-of-tolerance measurement.
    if (dto.pass && measurements && !allWithinTolerance(measurements)) {
      throw new BadRequestException(
        'No se puede aprobar la FAI: hay mediciones fuera de tolerancia.',
      );
    }

    fai.measurements = measurements;
    fai.result = target;
    fai.inspector = dto.inspector.trim();
    fai.inspectedAt = new Date();
    if (dto.serial !== undefined) fai.serial = dto.serial?.trim() || null;
    if (dto.station !== undefined) fai.station = dto.station ?? null;
    if (dto.notes !== undefined) fai.notes = dto.notes ?? null;
    const saved = await this.repo.save(fai);

    // On approval free the WO's first-piece gate (production-plan hook).
    if (target === 'PASS') {
      await this.plan
        .setFaiApproved(fai.woId, true)
        .catch((err) =>
          this.logger.warn(
            `setFaiApproved failed for WO ${fai.woId}: ${(err as Error)?.message}`,
          ),
        );
    }

    await this.record(
      target === 'PASS' ? 'SF_FAI_PASSED' : 'SF_FAI_FAILED',
      saved,
      { after: { result: saved.result, inspector: saved.inspector } },
    );
    return saved;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────
  async list(
    filters: { woId?: string; result?: string; line?: string } = {},
  ): Promise<SfFai[]> {
    const qb = this.repo.createQueryBuilder('f');
    this.applyScope(qb, 'f');
    if (filters.woId) qb.andWhere('f.wo_id = :w', { w: filters.woId });
    if (filters.result) qb.andWhere('f.result = :r', { r: filters.result });
    if (filters.line) qb.andWhere('f.line = :l', { l: filters.line });
    return qb.orderBy('f.created_at', 'DESC').getMany();
  }

  async getOne(id: string): Promise<SfFai> {
    const fai = await this.repo.findOne({ where: { id } });
    if (!fai) throw new NotFoundException('FAI no encontrada.');
    return fai;
  }

  /** All FAI attempts for a WO (most recent first) — the inspection history. */
  async byWo(woId: string): Promise<SfFai[]> {
    return this.list({ woId });
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  async kpis(): Promise<FaiKpis> {
    const all = await this.list();
    const byResult: Record<FaiResult, number> = {
      PENDING: 0,
      PASS: 0,
      FAIL: 0,
    };
    const approvedWos = new Set<string>();
    let outOfTol = 0;
    for (const f of all) {
      byResult[f.result] = (byResult[f.result] ?? 0) + 1;
      if (f.result === 'PASS') approvedWos.add(f.woId);
      for (const m of f.measurements ?? []) {
        if (m.pass === false) outOfTol++;
      }
    }
    const decided = byResult.PASS + byResult.FAIL;
    return {
      total: all.length,
      byResult,
      pending: byResult.PENDING,
      passed: byResult.PASS,
      failed: byResult.FAIL,
      firstPassYieldPct: decided ? round(byResult.PASS / decided, 4) : 0,
      woApproved: approvedWos.size,
      measurementsOutOfTol: outOfTol,
    };
  }

  private async record(
    action: string,
    fai: SfFai,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.QUALITY,
        action,
        referenceType: 'SF_FAI',
        referenceId: fai.id,
        line: fai.line ?? undefined,
        model: fai.model ?? undefined,
        workOrder: fai.woFolio ?? undefined,
        program: fai.programId ?? undefined,
        plant: fai.plant_id ?? undefined,
        context: { serial: fai.serial ?? undefined, revision: fai.revision },
        metadata: {
          folio: fai.folio,
          woId: fai.woId,
          beforeState: states.before,
          afterState: states.after,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
