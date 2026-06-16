import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { SfChangeover } from './entities/sf-changeover.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  ChecklistToggleDto,
  CompleteChangeoverDto,
  OpenChangeoverDto,
} from './dto/changeover.dto';
import {
  assertTransition,
  ChangeoverChecklistItem,
  ChangeoverStatus,
  checklistComplete,
  pendingItems,
} from './changeover-state';

/** Downtime category for the OEE/availability contract shared with B1 (MES). */
export const CHANGEOVER_DOWNTIME_CATEGORY = 'changeover';

export interface ChangeoverKpis {
  total: number;
  byStatus: Record<ChangeoverStatus, number>;
  inProgress: number;
  completed: number;
  avgDurationSec: number;
  avgDurationMin: number;
  onTarget: number;
  pctOnTarget: number;
  /** Total changeover downtime (seconds) across completed changeovers. */
  totalDowntimeSec: number;
}

@Injectable()
export class ChangeoverService {
  private readonly logger = new Logger(ChangeoverService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfChangeover))
    private readonly repo: TenantScopedRepository<SfChangeover>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    private readonly plan: ProductionPlanService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<SfChangeover>,
    alias: string,
  ): SelectQueryBuilder<SfChangeover> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private normalizeChecklist(
    items?: { key: string; label: string; done?: boolean }[],
  ): ChangeoverChecklistItem[] | null {
    if (!items?.length) return null;
    return items.map((i) => ({
      key: i.key.trim(),
      label: i.label.trim(),
      done: !!i.done,
      doneBy: null,
      doneAt: null,
    }));
  }

  // ── Open a changeover (stage the setup checklist) ───────────────────────────
  async open(dto: OpenChangeoverDto): Promise<SfChangeover> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('CHANGEOVER');
    } catch (err) {
      this.logger.warn(
        `Changeover folio allocation failed: ${(err as Error)?.message}`,
      );
    }

    // Enrich the incoming side from the WO (best-effort, read-only).
    let toModel = dto.toModel?.trim() || null;
    let toWoFolio: string | null = null;
    let programId: string | null = null;
    if (dto.toWoId) {
      try {
        const wo = await this.plan.getOne(dto.toWoId);
        toWoFolio = wo.folio;
        toModel = toModel ?? wo.model;
        programId = wo.programId ?? null;
      } catch {
        /* WO link is optional */
      }
    }

    const now = new Date();
    const start = !!dto.start;
    const entity = this.repo.create({
      folio,
      line: dto.line.trim(),
      fromModel: dto.fromModel?.trim() || null,
      toModel,
      fromWoId: dto.fromWoId ?? null,
      toWoId: dto.toWoId ?? null,
      toWoFolio,
      status: start ? 'IN_PROGRESS' : 'OPEN',
      checklist: this.normalizeChecklist(dto.checklist),
      startedAt: start ? now : null,
      completedAt: null,
      durationSec: null,
      targetMinutes: dto.targetMinutes ?? 0,
      downtimeCategory: CHANGEOVER_DOWNTIME_CATEGORY,
      downtimeReported: false,
      operator: dto.operator ?? this.tenantCtx.getUserEmail(),
      notes: dto.notes ?? null,
      programId,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.record(
      start ? 'SF_CHANGEOVER_STARTED' : 'SF_CHANGEOVER_OPENED',
      saved,
      { after: saved },
    );
    return saved;
  }

  // ── Start the stopwatch (line goes down) ────────────────────────────────────
  async start(id: string): Promise<SfChangeover> {
    const co = await this.getOne(id);
    this.move(co, 'IN_PROGRESS');
    co.startedAt = new Date();
    const saved = await this.repo.save(co);
    await this.record('SF_CHANGEOVER_STARTED', saved, {
      after: { startedAt: saved.startedAt },
    });
    return saved;
  }

  // ── Setup checklist ─────────────────────────────────────────────────────────
  async toggleChecklist(
    id: string,
    dto: ChecklistToggleDto,
  ): Promise<SfChangeover> {
    const co = await this.getOne(id);
    if (co.status === 'COMPLETED' || co.status === 'CANCELLED') {
      throw new BadRequestException('El changeover ya está cerrado.');
    }
    const items = co.checklist ?? [];
    const item = items.find((i) => i.key === dto.key);
    if (!item)
      throw new NotFoundException(
        `El paso "${dto.key}" no está en el checklist.`,
      );
    item.done = dto.done;
    item.doneBy = dto.done ? (dto.by ?? this.tenantCtx.getUserEmail()) : null;
    item.doneAt = dto.done ? new Date().toISOString() : null;
    co.checklist = [...items];
    return this.repo.save(co);
  }

  // ── Complete (stop the stopwatch, record changeover downtime) ───────────────
  async complete(
    id: string,
    dto: CompleteChangeoverDto = {},
  ): Promise<SfChangeover> {
    const co = await this.getOne(id);
    this.move(co, 'COMPLETED');
    if (!dto.force && !checklistComplete(co.checklist ?? [])) {
      throw new BadRequestException(
        `Faltan pasos del checklist: ${pendingItems(co.checklist ?? []).join(', ')}. Usa force para cerrar igual.`,
      );
    }
    const now = new Date();
    if (!co.startedAt) co.startedAt = now; // never started explicitly → zero-length window
    co.completedAt = now;
    co.durationSec = elapsedSec(co.startedAt, now);
    if (dto.notes !== undefined) co.notes = dto.notes ?? co.notes;

    // Register the changeover time as downtime category 'changeover' (B1 contract).
    await this.reportDowntime(co);
    co.downtimeReported = true;

    const saved = await this.repo.save(co);
    await this.record('SF_CHANGEOVER_COMPLETED', saved, {
      after: {
        durationSec: saved.durationSec,
        targetMinutes: saved.targetMinutes,
      },
    });
    return saved;
  }

  async cancel(id: string): Promise<SfChangeover> {
    const co = await this.getOne(id);
    this.move(co, 'CANCELLED');
    const saved = await this.repo.save(co);
    await this.record('SF_CHANGEOVER_CANCELLED', saved, {
      after: { status: saved.status },
    });
    return saved;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────
  async list(
    filters: { line?: string; status?: string } = {},
  ): Promise<SfChangeover[]> {
    const qb = this.repo.createQueryBuilder('c');
    this.applyScope(qb, 'c');
    if (filters.line) qb.andWhere('c.line = :l', { l: filters.line });
    if (filters.status) qb.andWhere('c.status = :s', { s: filters.status });
    return qb.orderBy('c.created_at', 'DESC').getMany();
  }

  async getOne(id: string): Promise<SfChangeover> {
    const co = await this.repo.findOne({ where: { id } });
    if (!co) throw new NotFoundException('Changeover no encontrado.');
    return co;
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  async kpis(): Promise<ChangeoverKpis> {
    const all = await this.list();
    const byStatus: Record<ChangeoverStatus, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    let durationSum = 0;
    let durationCount = 0;
    let onTarget = 0;
    for (const co of all) {
      byStatus[co.status] = (byStatus[co.status] ?? 0) + 1;
      if (co.status === 'COMPLETED' && co.durationSec != null) {
        durationSum += co.durationSec;
        durationCount++;
        if (co.targetMinutes > 0 && co.durationSec / 60 <= co.targetMinutes)
          onTarget++;
      }
    }
    const avgSec = durationCount ? round(durationSum / durationCount) : 0;
    return {
      total: all.length,
      byStatus,
      inProgress: byStatus.IN_PROGRESS,
      completed: byStatus.COMPLETED,
      avgDurationSec: avgSec,
      avgDurationMin: durationCount ? round(avgSec / 60, 2) : 0,
      onTarget,
      pctOnTarget: durationCount ? round(onTarget / durationCount, 4) : 0,
      totalDowntimeSec: durationSum,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────────────
  private move(co: SfChangeover, to: ChangeoverStatus): void {
    try {
      assertTransition(co.status, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    co.status = to;
  }

  /**
   * Publish the measured changeover time as downtime of category 'changeover'.
   *
   * Hook for B1 (MES/OEE): B1 owns `mes_downtime_events` (which already carries a
   * 'changeover' reason), but its downtime API is private and keyed to the legacy
   * integer execution — not to a line/sf-WO transition — so there is no endpoint
   * to consume yet. Until B1 exposes a line-keyed downtime endpoint, the changeover
   * time is recorded to the immutable event ledger (category 'changeover') and the
   * row carries `downtimeCategory`/`durationSec`; this method is the single seam to
   * call that endpoint once it exists.
   */
  private async reportDowntime(co: SfChangeover): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.PRODUCTION,
        action: 'SF_CHANGEOVER_DOWNTIME',
        referenceType: 'SF_CHANGEOVER',
        referenceId: co.id,
        line: co.line,
        model: co.toModel ?? undefined,
        workOrder: co.toWoFolio ?? undefined,
        program: co.programId ?? undefined,
        plant: co.plant_id ?? undefined,
        transaction: { quantity: co.durationSec ?? 0, unit: 'sec' },
        metadata: {
          reasonCode: CHANGEOVER_DOWNTIME_CATEGORY,
          reasonDesc: 'Tiempo de cambio de modelo (SMED)',
          folio: co.folio,
          fromModel: co.fromModel,
          toModel: co.toModel,
          durationSec: co.durationSec,
          targetMinutes: co.targetMinutes,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Changeover downtime ledger write skipped: ${(err as Error)?.message}`,
      );
    }
  }

  private async record(
    action: string,
    co: SfChangeover,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.PRODUCTION,
        action,
        referenceType: 'SF_CHANGEOVER',
        referenceId: co.id,
        line: co.line,
        model: co.toModel ?? undefined,
        workOrder: co.toWoFolio ?? undefined,
        program: co.programId ?? undefined,
        plant: co.plant_id ?? undefined,
        metadata: {
          folio: co.folio,
          fromModel: co.fromModel,
          toModel: co.toModel,
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

function elapsedSec(from: Date, to: Date): number {
  return Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000),
  );
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
