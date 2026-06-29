import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { SfWorkOrder } from './entities/sf-work-order.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import {
  AuthorizeOperatorsDto,
  PublishWorkOrderDto,
  ResequenceDto,
  TransitionWorkOrderDto,
} from './dto/production-plan.dto';
import { assertTransition, WorkOrderStatus } from './wo-state';
import { assertSafeCancellation } from './wo-cancellation';
import {
  DEFAULT_SHIFT_MINUTES,
  LineCapacityLoad,
  ModelLoad,
  rollUpLine,
} from './crp';

export interface WorkOrderBlockers {
  runnable: boolean;
  blockers: string[];
}

export interface PlanKpis {
  total: number;
  byStatus: Record<WorkOrderStatus, number>;
  open: number;
  inExecution: number;
  unitsPlanned: number;
  unitsCompleted: number;
  planAdherencePct: number; // completed / planned (active WOs)
  woWithReadiness: number;
  pctWithReadiness: number;
  behindSchedule: number;
}

@Injectable()
export class ProductionPlanService {
  private readonly logger = new Logger(ProductionPlanService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfWorkOrder))
    private readonly repo: TenantScopedRepository<SfWorkOrder>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly lineEng?: LineEngineeringService,
  ) {}

  private applyScope(qb: SelectQueryBuilder<SfWorkOrder>, alias: string): SelectQueryBuilder<SfWorkOrder> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  async publish(dto: PublishWorkOrderDto): Promise<SfWorkOrder> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('WORK_ORDER');
    } catch (err) {
      this.logger.warn(`WO folio allocation failed: ${(err as Error)?.message}`);
    }
    const now = new Date();
    const entity = this.repo.create({
      folio,
      model: dto.model.trim(),
      revision: (dto.revision ?? 'A').trim(),
      line: dto.line.trim(),
      bay: dto.bay?.trim() || null,
      quantityPlanned: dto.quantityPlanned,
      quantityCompleted: 0,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      sequence: dto.sequence ?? 100,
      priority: dto.priority ?? 'MEDIUM',
      status: 'RELEASED',
      consumptionMode: dto.consumptionMode ?? 'BY_UNIT',
      serialControl: dto.serialControl ?? 'NONE',
      taktTargetSec: dto.taktTargetSec ?? 0,
      materialReady: false,
      qualityClear: true,
      faiRequired: dto.faiRequired ?? false,
      faiApproved: false,
      authorizedOperators: [],
      programId: dto.programId ?? null,
      customer: dto.customer ?? null,
      publishedBy: this.tenantCtx.getUserEmail(),
      publishedAt: now,
      notes: dto.notes ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.record('SF_WO_PUBLISHED', saved, { after: saved });
    return saved;
  }

  // ── Reads ───────────────────────────────────────────────────────────────────
  async list(filters: { line?: string; status?: string; model?: string } = {}): Promise<SfWorkOrder[]> {
    const qb = this.repo.createQueryBuilder('wo');
    this.applyScope(qb, 'wo');
    if (filters.line) qb.andWhere('wo.line = :l', { l: filters.line });
    if (filters.status) qb.andWhere('wo.status = :s', { s: filters.status });
    if (filters.model) qb.andWhere('wo.model = :m', { m: filters.model });
    return qb
      .orderBy('wo.sequence', 'ASC')
      .addOrderBy('wo.created_at', 'DESC')
      .getMany();
  }

  async getOne(id: string): Promise<SfWorkOrder> {
    const wo = await this.repo.findOne({ where: { id } });
    if (!wo) throw new NotFoundException('Orden de trabajo no encontrada.');
    return wo;
  }

  // ── Plan management ─────────────────────────────────────────────────────────
  async resequence(id: string, dto: ResequenceDto): Promise<SfWorkOrder> {
    const wo = await this.getOne(id);
    wo.sequence = dto.sequence;
    if (dto.priority) wo.priority = dto.priority;
    const saved = await this.repo.save(wo);
    await this.record('SF_WO_RESEQUENCED', saved, { after: { sequence: saved.sequence, priority: saved.priority } });
    return saved;
  }

  async transition(id: string, dto: TransitionWorkOrderDto): Promise<SfWorkOrder> {
    const wo = await this.getOne(id);
    const from = wo.status;
    try {
      assertTransition(from, dto.status);
      if (dto.status === 'CANCELLED') assertSafeCancellation(wo);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    this.applyStatus(wo, dto.status);
    const saved = await this.repo.save(wo);
    await this.record('SF_WO_TRANSITIONED', saved, { before: { status: from }, after: { status: dto.status } });
    return saved;
  }

  private applyStatus(wo: SfWorkOrder, status: WorkOrderStatus): void {
    wo.status = status;
    const now = new Date();
    if (status === 'IN_EXECUTION' && !wo.startedAt) wo.startedAt = now;
    if (status === 'COMPLETED') wo.completedAt = now;
  }

  async authorizeOperators(id: string, dto: AuthorizeOperatorsDto): Promise<SfWorkOrder> {
    const wo = await this.getOne(id);
    const set = new Set([...(wo.authorizedOperators ?? []), ...dto.operators.map((e) => e.toLowerCase())]);
    wo.authorizedOperators = Array.from(set);
    const saved = await this.repo.save(wo);
    await this.record('SF_WO_OPERATORS_AUTHORIZED', saved, { after: { operators: saved.authorizedOperators } });
    return saved;
  }

  isOperatorAuthorized(wo: SfWorkOrder, email?: string | null): boolean {
    const list = wo.authorizedOperators ?? [];
    if (list.length === 0) return true; // no explicit gate set → open to certified operators
    return !!email && list.includes(email.toLowerCase());
  }

  /** Why a WO cannot run right now (material, quality hold, FAI). */
  runBlockers(wo: SfWorkOrder): WorkOrderBlockers {
    const blockers: string[] = [];
    if (!wo.materialReady) blockers.push('Material no montado (readiness incompleto).');
    if (!wo.qualityClear) blockers.push('Retención de calidad activa en esta WO.');
    if (wo.faiRequired && !wo.faiApproved) blockers.push('Primera pieza (FAI) sin aprobar.');
    if (wo.status === 'CANCELLED') blockers.push('WO cancelada.');
    if (wo.status === 'COMPLETED') blockers.push('WO ya completada.');
    return { runnable: blockers.length === 0, blockers };
  }

  // ── Hooks consumed by other shop-floor modules ──────────────────────────────

  /** Called by the operator terminal after a confirmed unit/quantity. */
  async incrementCompleted(id: string, qty: number): Promise<SfWorkOrder> {
    const wo = await this.getOne(id);
    // No acumular contra una WO terminal: confirmar sobre una WO ya COMPLETED /
    // CANCELLED sobre-contaba la producción (el auto-complete solo corre desde
    // IN_EXECUTION, así que ni bloqueaba ni se re-disparaba).
    if (wo.status === 'COMPLETED' || wo.status === 'CANCELLED') {
      throw new BadRequestException(
        `La WO ${wo.folio ?? id} no está en ejecución (estado ${wo.status}).`,
      );
    }
    const now = new Date();
    wo.quantityCompleted = (wo.quantityCompleted ?? 0) + Math.max(0, qty);
    if (wo.status === 'RELEASED' || wo.status === 'STAGED') {
      wo.status = 'IN_EXECUTION';
      if (!wo.startedAt) wo.startedAt = now;
    }
    if (wo.quantityCompleted >= wo.quantityPlanned && wo.status === 'IN_EXECUTION') {
      wo.status = 'COMPLETED';
      wo.completedAt = now;
    }
    return this.repo.save(wo);
  }

  /** Called by Material Staging (C) when staging is complete / shorted. */
  async setMaterialReady(id: string, ready: boolean): Promise<SfWorkOrder> {
    const wo = await this.getOne(id);
    wo.materialReady = ready;
    if (ready && wo.status === 'RELEASED') wo.status = 'STAGED';
    if (!ready && wo.status === 'STAGED') wo.status = 'RELEASED';
    return this.repo.save(wo);
  }

  /** Called by Floor Quality (F) when a hold is placed / cleared on a WO. */
  async setQualityClear(id: string, clear: boolean): Promise<SfWorkOrder> {
    const wo = await this.getOne(id);
    wo.qualityClear = clear;
    return this.repo.save(wo);
  }

  /** Called by the FAI gate (E) on first-piece approval. */
  async setFaiApproved(id: string, approved: boolean): Promise<SfWorkOrder> {
    const wo = await this.getOne(id);
    wo.faiApproved = approved;
    return this.repo.save(wo);
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  async kpis(): Promise<PlanKpis> {
    const all = await this.list();
    const byStatus = { RELEASED: 0, STAGED: 0, IN_EXECUTION: 0, COMPLETED: 0, CANCELLED: 0 } as Record<WorkOrderStatus, number>;
    let unitsPlanned = 0;
    let unitsCompleted = 0;
    let woWithReadiness = 0;
    let behind = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const wo of all) {
      byStatus[wo.status] = (byStatus[wo.status] ?? 0) + 1;
      if (wo.status !== 'CANCELLED') {
        unitsPlanned += Number(wo.quantityPlanned ?? 0);
        unitsCompleted += Number(wo.quantityCompleted ?? 0);
      }
      if (wo.materialReady && wo.qualityClear) woWithReadiness++;
      if (
        wo.scheduledDate &&
        new Date(wo.scheduledDate) < today &&
        wo.status !== 'COMPLETED' &&
        wo.status !== 'CANCELLED'
      ) {
        behind++;
      }
    }
    const open = all.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED').length;
    return {
      total: all.length,
      byStatus,
      open,
      inExecution: byStatus.IN_EXECUTION,
      unitsPlanned,
      unitsCompleted,
      planAdherencePct: unitsPlanned > 0 ? round(unitsCompleted / unitsPlanned, 4) : 0,
      woWithReadiness,
      pctWithReadiness: all.length ? round(woWithReadiness / all.length, 4) : 0,
      behindSchedule: behind,
    };
  }

  // ── CRP / capacity ───────────────────────────────────────────────────────────
  /**
   * Per-line load vs capacity from the open published WOs. Reuses the
   * line-engineering capacity calculator (routing std times + model↔line
   * changeover) and aggregates by line so the wall can VALIDATE the plan
   * (overbooked lines), not just reflect it. Read-only; no schema changes.
   *
   * `availableMinutes` is the run time each line is validated against (defaults
   * to one shift). Demand is the still-to-build remainder (planned − completed),
   * grouped per model+revision so changeover is counted once per model.
   */
  async capacityLoad(
    params: { availableMinutes?: number; line?: string } = {},
  ): Promise<{ availableMinutes: number; generatedAt: Date; lines: LineCapacityLoad[] }> {
    const availableMinutes =
      params.availableMinutes && params.availableMinutes > 0 ? params.availableMinutes : DEFAULT_SHIFT_MINUTES;

    const open = (await this.list(params.line ? { line: params.line } : {})).filter(
      (wo) => wo.status !== 'COMPLETED' && wo.status !== 'CANCELLED',
    );

    // Group remaining demand by line → model|revision.
    type Group = { model: string; revision: string; unitsRemaining: number; woCount: number };
    const byLine = new Map<string, Map<string, Group>>();
    for (const wo of open) {
      const remaining = Math.max(0, (Number(wo.quantityPlanned) || 0) - (Number(wo.quantityCompleted) || 0));
      const revision = wo.revision || 'A';
      const key = `${wo.model}|${revision}`;
      const groups = byLine.get(wo.line) ?? new Map<string, Group>();
      const g = groups.get(key) ?? { model: wo.model, revision, unitsRemaining: 0, woCount: 0 };
      g.unitsRemaining += remaining;
      g.woCount += 1;
      groups.set(key, g);
      byLine.set(wo.line, groups);
    }

    const lines: LineCapacityLoad[] = [];
    for (const [line, groups] of byLine) {
      const models: ModelLoad[] = [];
      for (const [, g] of groups) {
        let runMinutes = 0;
        let changeoverMinutes = 0;
        // Nothing to run ⇒ trivially "known" (zero load); otherwise the
        // calculator tells us, and a 0 result means the model has no std time.
        let hasStdTime = g.unitsRemaining === 0;
        if (this.lineEng) {
          const cap = await this.lineEng.capacity({
            model: g.model,
            revision: g.revision,
            line,
            availableMinutes,
            demandUnits: g.unitsRemaining,
          });
          runMinutes = cap.requiredMinutes;
          changeoverMinutes = cap.changeoverMinutes;
          hasStdTime = g.unitsRemaining === 0 || cap.requiredMinutes > 0;
        }
        models.push({
          model: g.model,
          revision: g.revision,
          woCount: g.woCount,
          unitsRemaining: g.unitsRemaining,
          runMinutes,
          changeoverMinutes,
          hasStdTime,
        });
      }
      lines.push(rollUpLine(line, models, availableMinutes));
    }

    // Worst-loaded lines first so the wall surfaces the constraints up top.
    lines.sort((a, b) => b.utilizationPct - a.utilizationPct);
    return { availableMinutes, generatedAt: new Date(), lines };
  }

  private async record(action: string, wo: SfWorkOrder, states: { before?: unknown; after?: unknown }): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.PRODUCTION,
        action,
        referenceType: 'SF_WORK_ORDER',
        referenceId: wo.id,
        program: wo.programId ?? undefined,
        plant: wo.plant_id ?? undefined,
        metadata: { folio: wo.folio, model: wo.model, line: wo.line, beforeState: states.before, afterState: states.after },
      });
    } catch (err) {
      this.logger.warn(`Ledger skipped for ${action}: ${(err as Error)?.message}`);
    }
  }
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
