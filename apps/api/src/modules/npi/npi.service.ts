import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { NpiProject } from './entities/npi-project.entity';
import { NpiGate } from './entities/npi-gate.entity';
import { NpiReadinessSnapshot } from './entities/npi-readiness-snapshot.entity';
import { NpiRisk } from './entities/npi-risk.entity';
import { ProductModel } from '../product-models/entities/product-model.entity';
import { VisualAid } from '../visual-aids/entities/visual-aid.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { Tool } from '../tooling/entities/tool.entity';
import { SfFai } from '../fai/entities/sf-fai.entity';
import { SupplierApprovedPart } from '../suppliers/entities/supplier-approved-part.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { BomService } from '../bom/bom.service';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  CreateNpiProjectDto,
  CreateNpiRiskDto,
  DecideGateDto,
  UpdateNpiRiskDto,
} from './dto/npi.dto';
import { RISK_SEVERITY_RANK } from './npi-risk-state';
import {
  assertGateTransition,
  comparePhases,
  isFinalPhase,
  isGateCleared,
  NPI_PHASES,
  NpiGateStatus,
  nextPhase,
} from './npi-state';
import {
  evaluateReadiness,
  ReadinessReport,
  ReadinessSignals,
} from './npi.readiness';

export interface ReadinessSnapshot extends ReadinessReport {
  model: string;
  revision: string;
  signals: ReadinessSignals;
}

export interface NpiProjectView extends NpiProject {
  gates: NpiGate[];
  readiness: ReadinessSnapshot;
}

export type SnapshotReason =
  | 'GATE_DECISION'
  | 'SCAN'
  | 'MANUAL'
  | 'PROJECT_CREATED'
  | 'MODEL_ACTIVATION';

export interface CaptureSnapshotOptions {
  projectId?: string | null;
  phase?: string | null;
  reason?: SnapshotReason;
  note?: string | null;
}

/** Prefer the most advanced BOM status when a model has several headers. */
const BOM_STATUS_RANK: Record<string, number> = {
  ACTIVE: 5,
  APPROVED: 4,
  PENDING_REVIEW: 3,
  DRAFT: 2,
  OBSOLETE: 1,
};

@Injectable()
export class NpiService {
  private readonly logger = new Logger(NpiService.name);

  constructor(
    @Inject(getTenantRepositoryToken(NpiProject))
    private readonly projects: TenantScopedRepository<NpiProject>,
    @Inject(getTenantRepositoryToken(NpiGate))
    private readonly gates: TenantScopedRepository<NpiGate>,
    @Inject(getTenantRepositoryToken(NpiReadinessSnapshot))
    private readonly snapshots: TenantScopedRepository<NpiReadinessSnapshot>,
    @Inject(getTenantRepositoryToken(NpiRisk))
    private readonly risks: TenantScopedRepository<NpiRisk>,
    @InjectRepository(ProductModel)
    private readonly productModels: Repository<ProductModel>,
    @InjectRepository(VisualAid)
    private readonly visualAids: Repository<VisualAid>,
    @InjectRepository(SfWorkOrder)
    private readonly workOrders: Repository<SfWorkOrder>,
    @InjectRepository(Tool)
    private readonly tools: Repository<Tool>,
    @InjectRepository(SfFai)
    private readonly fai: Repository<SfFai>,
    @InjectRepository(SupplierApprovedPart)
    private readonly avl: Repository<SupplierApprovedPart>,
    private readonly tenantCtx: TenantContextService,
    private readonly bom: BomService,
    private readonly lineEng: LineEngineeringService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly users?: UsersService,
  ) {}

  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private scopeFields() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  private sortGates(gates: NpiGate[]): NpiGate[] {
    return [...gates].sort((a, b) => comparePhases(a.phase, b.phase));
  }

  // ── Reads ───────────────────────────────────────────────────────────────────
  async listProjects(
    filter: { model?: string; status?: string } = {},
  ): Promise<NpiProject[]> {
    const qb = this.projects.createQueryBuilder('p');
    this.applyScope(qb, 'p');
    if (filter.model) qb.andWhere('p.model_number = :m', { m: filter.model });
    if (filter.status) qb.andWhere('p.status = :s', { s: filter.status });
    return qb.orderBy('p.created_at', 'DESC').getMany();
  }

  async getProject(id: string): Promise<NpiProjectView> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Proyecto NPI no encontrado.');
    await this.backfillProductModelId(project);
    const gates = await this.gates.find({ where: { projectId: id } });
    const readiness = await this.deriveReadiness(
      project.modelNumber,
      project.revision,
    );
    return { ...project, gates: this.sortGates(gates), readiness };
  }

  /**
   * Soft-link the project to the canonical ProductModel by number (scoped),
   * read-only against `pm_product_models`. Returns the id or null when no master
   * record exists yet. No FK — keeps NPI decoupled from product-models.
   */
  private async resolveProductModelId(
    modelNumber: string,
  ): Promise<string | null> {
    const m = (modelNumber ?? '').trim();
    if (!m) return null;
    const qb = this.productModels
      .createQueryBuilder('pm')
      .select('pm.id', 'id')
      .where('UPPER(pm.model_number) = UPPER(:m)', { m });
    this.applyScope(qb, 'pm');
    const found = await qb.getRawOne<{ id: string }>().catch((err) => {
      this.logger.warn(
        `Product-model lookup failed for ${m}: ${(err as Error)?.message}`,
      );
      return null;
    });
    return found?.id ?? null;
  }

  /**
   * Lazily fill `productModelId` for projects created before the soft link
   * existed (or before the master record did). Best-effort: a failed persist
   * never breaks a read.
   */
  private async backfillProductModelId(project: NpiProject): Promise<void> {
    if (project.productModelId) return;
    const pmId = await this.resolveProductModelId(project.modelNumber);
    if (!pmId) return;
    project.productModelId = pmId;
    await this.projects
      .save(project)
      .catch((err) =>
        this.logger.warn(
          `No se pudo enlazar el modelo al proyecto NPI ${project.id}: ${(err as Error)?.message}`,
        ),
      );
  }

  // ── Readiness derivation (live, READ-ONLY across existing modules) ───────────
  /**
   * Resolves the release signals read-only from the modules that own them and
   * folds them with the pure `evaluateReadiness`. Anything that cannot be
   * resolved cheaply stays `null` → reported UNKNOWN (never assumed good).
   * ADVISORY: this never mutates anything outside `npi_`.
   */
  async deriveReadiness(
    model: string,
    revision = '1.0',
  ): Promise<ReadinessSnapshot> {
    const m = (model ?? '').trim();
    if (!m) throw new BadRequestException('model requerido.');
    const rev = (revision ?? '1.0').trim() || '1.0';
    const signals = await this.collectSignals(m, rev);
    return {
      model: m,
      revision: rev,
      signals,
      ...evaluateReadiness(signals),
    };
  }

  // ── Readiness snapshots (history / audit trail) ─────────────────────────────
  /**
   * Derive the live readiness and PERSIST it as an immutable snapshot. The only
   * write that readiness produces, and it lands only in `npi_`. Best-effort
   * caller wrappers should tolerate failure — a snapshot must never break a flow.
   */
  async captureSnapshot(
    model: string,
    revision = '1.0',
    opts: CaptureSnapshotOptions = {},
  ): Promise<NpiReadinessSnapshot> {
    const report = await this.deriveReadiness(model, revision);
    const snapshot = this.snapshots.create({
      projectId: opts.projectId ?? null,
      modelNumber: report.model,
      revision: report.revision,
      phase: opts.phase ?? null,
      reason: opts.reason ?? 'MANUAL',
      gateReady: report.gateReady,
      readyCount: report.readyCount,
      notReadyCount: report.notReadyCount,
      unknownCount: report.unknownCount,
      criteria: report.criteria,
      signals: report.signals,
      blockers: report.blockers,
      note: opts.note ?? null,
      ...this.scopeFields(),
    });
    return this.snapshots.save(snapshot);
  }

  /** Best-effort capture — logs and swallows errors (for hooks). */
  private async captureSnapshotSafe(
    model: string,
    revision: string,
    opts: CaptureSnapshotOptions,
  ): Promise<NpiReadinessSnapshot | null> {
    try {
      return await this.captureSnapshot(model, revision, opts);
    } catch (err) {
      this.logger.warn(
        `Snapshot de readiness omitido (${opts.reason}): ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  async listSnapshots(
    filter: {
      model?: string;
      revision?: string;
      projectId?: string;
      limit?: number;
    } = {},
  ): Promise<NpiReadinessSnapshot[]> {
    const qb = this.snapshots.createQueryBuilder('s');
    this.applyScope(qb, 's');
    if (filter.model) qb.andWhere('s.model_number = :m', { m: filter.model });
    if (filter.revision) qb.andWhere('s.revision = :r', { r: filter.revision });
    if (filter.projectId)
      qb.andWhere('s.project_id = :p', { p: filter.projectId });
    qb.orderBy('s.created_at', 'DESC').take(
      Math.min(Math.max(filter.limit ?? 50, 1), 200),
    );
    return qb.getMany();
  }

  /** The most recent snapshot for a project (used by the scan to detect change). */
  async getLatestSnapshot(
    projectId: string,
  ): Promise<NpiReadinessSnapshot | null> {
    const qb = this.snapshots.createQueryBuilder('s');
    this.applyScope(qb, 's');
    qb.andWhere('s.project_id = :p', { p: projectId })
      .orderBy('s.created_at', 'DESC')
      .limit(1);
    return qb.getOne();
  }

  private async collectSignals(
    model: string,
    revision: string,
  ): Promise<ReadinessSignals> {
    const [
      bestHeader,
      faiStatus,
      line,
      stdTimeComplete,
      visualAidsActive,
      productionWorkOrders,
      programId,
    ] = await Promise.all([
      this.resolveBestBomHeader(model),
      this.resolveFaiStatus(model),
      this.resolveLine(model, revision),
      this.resolveStdTimeComplete(model, revision),
      this.resolveVisualAidsActive(model),
      this.resolveProductionWorkOrders(model),
      this.resolveModelProgramId(model),
    ]);
    const [avlCoverage, toolingAssets] = await Promise.all([
      this.resolveAvlCoverage(bestHeader),
      this.resolveToolingAssets(programId),
    ]);
    return {
      bomStatus: bestHeader?.status ?? null,
      faiStatus,
      lineBalancePct: line.balancePct,
      lineCompletenessPct: line.completenessPct,
      stdTimeComplete,
      avlCoverage,
      visualAidsActive,
      productionWorkOrders,
      toolingAssets,
    };
  }

  /**
   * The canonical program for a model (from `pm_product_models`, scoped). Used to
   * resolve program-scoped signals like tooling. Null when no master record or
   * no program. Read-only, best-effort.
   */
  private async resolveModelProgramId(model: string): Promise<string | null> {
    const m = (model ?? '').trim();
    if (!m) return null;
    try {
      const qb = this.productModels
        .createQueryBuilder('pm')
        .select('pm.program_id', 'programId')
        .where('UPPER(pm.model_number) = UPPER(:m)', { m });
      this.applyScope(qb, 'pm');
      const row = await qb.getRawOne<{ programId: string | null }>();
      return row?.programId ?? null;
    } catch (err) {
      this.logger.warn(
        `Program lookup failed for ${m}: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  /**
   * Count of tooling assets for the model's program (`tooling_assets`). Tooling
   * is program-scoped (no model column), so null when the model has no program.
   * Read-only, advisory.
   */
  private async resolveToolingAssets(
    programId: string | null,
  ): Promise<number | null> {
    if (!programId) return null;
    try {
      const qb = this.tools
        .createQueryBuilder('t')
        .where('t.program_id = :p', { p: programId });
      this.applyScope(qb, 't');
      return await qb.getCount();
    } catch (err) {
      this.logger.warn(
        `Tooling lookup failed for program ${programId}: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  /**
   * Count of ACTIVE visual aids (work instructions) for the model. Tenant-scoped
   * only (the `visual_aids` table has no plant_id). 0 = none published yet;
   * null = could not resolve. Read-only, advisory.
   */
  private async resolveVisualAidsActive(model: string): Promise<number | null> {
    const m = (model ?? '').trim();
    if (!m) return null;
    try {
      const tenant = this.tenantCtx.getTenantId();
      const qb = this.visualAids
        .createQueryBuilder('v')
        .where('LOWER(v.model) = LOWER(:m)', { m })
        .andWhere('v.isActive = :a', { a: true });
      if (tenant) qb.andWhere('v.tenant_id = :t', { t: tenant });
      else qb.andWhere('v.tenant_id IS NULL');
      return await qb.getCount();
    } catch (err) {
      this.logger.warn(
        `Visual-aids lookup failed for ${m}: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  /**
   * Count of production work orders published for the model (`sf_work_orders`).
   * 0 = no plan yet; null = could not resolve. Read-only, advisory.
   */
  private async resolveProductionWorkOrders(
    model: string,
  ): Promise<number | null> {
    const m = (model ?? '').trim();
    if (!m) return null;
    try {
      const qb = this.workOrders
        .createQueryBuilder('wo')
        .where('wo.model = :m', { m });
      this.applyScope(qb, 'wo');
      return await qb.getCount();
    } catch (err) {
      this.logger.warn(
        `Work-order lookup failed for ${m}: ${(err as Error)?.message}`,
      );
      return null;
    }
  }

  /** The most advanced BOM header for the model (read-only via BomService). */
  private async resolveBestBomHeader(model: string) {
    const headers = await this.bom.findAllBomHeaders(model).catch((err) => {
      this.logger.warn(`BOM lookup failed: ${(err as Error)?.message}`);
      return [] as Awaited<ReturnType<BomService['findAllBomHeaders']>>;
    });
    if (!headers.length) return null;
    return headers.reduce((best, h) =>
      (BOM_STATUS_RANK[h.status] ?? 0) > (BOM_STATUS_RANK[best.status] ?? 0)
        ? h
        : best,
    );
  }

  /** PASS if any first piece passed; else FAIL if any failed; else PENDING. */
  private async resolveFaiStatus(model: string): Promise<string | null> {
    const qb = this.fai.createQueryBuilder('f');
    this.applyScope(qb, 'f');
    qb.andWhere('f.model = :m', { m: model });
    const rows = await qb.getMany();
    if (!rows.length) return null;
    if (rows.some((r) => r.result === 'PASS')) return 'PASS';
    if (rows.some((r) => r.result === 'FAIL')) return 'FAIL';
    return 'PENDING';
  }

  /** Line balance efficiency + documentation completeness (read-only). */
  private async resolveLine(
    model: string,
    revision: string,
  ): Promise<{ balancePct: number | null; completenessPct: number | null }> {
    try {
      const b = await this.lineEng.balance({ model, revision });
      return {
        balancePct: Number.isFinite(b.balancePct) ? b.balancePct : null,
        completenessPct: b.completeness?.completenessPct ?? null,
      };
    } catch {
      // No routing for this model+revision — honest UNKNOWN, not a failure.
      return { balancePct: null, completenessPct: null };
    }
  }

  /** True only when every routed station carries a standard time (>0). */
  private async resolveStdTimeComplete(
    model: string,
    revision: string,
  ): Promise<boolean | null> {
    try {
      const route = await this.lineEng.routing(model, revision);
      if (!route.length) return null;
      return route.every((s) => Number(s.stdTimeSec) > 0);
    } catch {
      return null;
    }
  }

  /** Fraction of BOM parts with an APPROVED source in the AVL (read-only). */
  private async resolveAvlCoverage(
    header: { components?: { componentNumber?: string }[] } | null,
  ): Promise<number | null> {
    if (!header) return null;
    const parts = Array.from(
      new Set(
        (header.components ?? [])
          .map((c) => c.componentNumber)
          .filter((p): p is string => !!p),
      ),
    );
    if (!parts.length) return null;
    const approved = await this.avl.find({
      where: { partNumber: In(parts), approvalStatus: 'APPROVED' },
    });
    const covered = new Set(approved.map((a) => a.partNumber));
    return covered.size / parts.length;
  }

  /** Idempotency lookup, scoped (tenant+plant) to match the unique index. */
  private async findByModelRevision(
    model: string,
    revision: string,
  ): Promise<NpiProject | null> {
    const qb = this.projects.createQueryBuilder('p');
    this.applyScope(qb, 'p');
    qb.andWhere('p.model_number = :m', { m: model }).andWhere(
      'p.revision = :r',
      { r: revision },
    );
    return qb.getOne();
  }

  // ── Create (idempotent by model+revision) ───────────────────────────────────
  async createProject(dto: CreateNpiProjectDto): Promise<NpiProjectView> {
    const model = dto.modelNumber.trim();
    if (!model) throw new BadRequestException('modelNumber requerido.');
    const revision = (dto.revision ?? '1.0').trim() || '1.0';

    const existing = await this.findByModelRevision(model, revision);
    if (existing) return this.getProject(existing.id);

    const productModelId = await this.resolveProductModelId(model);
    const project = this.projects.create({
      modelNumber: model,
      revision,
      productModelId,
      customer: dto.customer?.trim() || null,
      currentPhase: 'QUOTE',
      status: 'OPEN',
      programId: dto.programId?.trim() || null,
      notes: dto.notes?.trim() || null,
      ...this.scopeFields(),
    });

    let saved: NpiProject;
    try {
      saved = await this.projects.save(project);
    } catch (err) {
      // Lost a race on the unique (tenant, plant, model, revision) index.
      const winner = await this.findByModelRevision(model, revision);
      if (winner) return this.getProject(winner.id);
      throw err;
    }

    // Seed one PENDING gate per phase.
    await this.gates.save(
      NPI_PHASES.map((phase) =>
        this.gates.create({
          projectId: saved.id,
          phase,
          status: 'PENDING',
          decidedByEmail: null,
          decidedAt: null,
          notes: null,
          ...this.scopeFields(),
        }),
      ),
    );

    await this.record('NPI_PROJECT_CREATED', saved.id, {
      model: saved.modelNumber,
      revision: saved.revision,
    });
    await this.captureSnapshotSafe(saved.modelNumber, saved.revision, {
      projectId: saved.id,
      phase: saved.currentPhase,
      reason: 'PROJECT_CREATED',
    });
    return this.getProject(saved.id);
  }

  // ── Decide a gate ────────────────────────────────────────────────────────────
  async decideGate(id: string, dto: DecideGateDto): Promise<NpiGate> {
    const gate = await this.gates.findOne({ where: { id } });
    if (!gate) throw new NotFoundException('Gate NPI no encontrado.');
    const target = dto.decision as NpiGateStatus;
    try {
      assertGateTransition(gate.status, target);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    gate.status = target;
    gate.decidedByEmail = this.tenantCtx.getUserEmail() || null;
    gate.decidedAt = new Date();
    if (dto.notes !== undefined) gate.notes = dto.notes?.trim() || null;
    const saved = await this.gates.save(gate);

    // Advance the advisory phase pointer / release status within npi_ only.
    await this.applyGateOutcomeToProject(saved);

    await this.record(`NPI_GATE_${target}`, saved.id, {
      projectId: saved.projectId,
      phase: saved.phase,
    });

    // Snapshot the readiness at the moment of the decision (history/audit).
    const project = await this.projects.findOne({
      where: { id: saved.projectId },
    });
    if (project) {
      await this.captureSnapshotSafe(project.modelNumber, project.revision, {
        projectId: project.id,
        phase: saved.phase,
        reason: 'GATE_DECISION',
        note: `Gate ${saved.phase} → ${target}`,
      });
    }

    // Passing the FINAL (MP) gate → one advisory inbox alert. Never activates
    // the model and never touches product-models.
    if (isFinalPhase(saved.phase) && target === 'PASSED') {
      await this.notifyFinalGate(saved);
    }
    return saved;
  }

  /**
   * Move the project's advisory `currentPhase` forward when a gate is cleared,
   * and mark it RELEASED when the MP gate passes. Mutates `npi_project` only.
   */
  private async applyGateOutcomeToProject(gate: NpiGate): Promise<void> {
    const project = await this.projects.findOne({
      where: { id: gate.projectId },
    });
    if (!project) return;
    let dirty = false;

    if (isFinalPhase(gate.phase)) {
      if (gate.status === 'PASSED' && project.status === 'OPEN') {
        project.status = 'RELEASED';
        dirty = true;
      }
    } else if (
      isGateCleared(gate.status) &&
      project.currentPhase === gate.phase
    ) {
      const next = nextPhase(gate.phase);
      if (next) {
        project.currentPhase = next;
        dirty = true;
      }
    }

    if (dirty) {
      await this.projects
        .save(project)
        .catch((err) =>
          this.logger.warn(
            `No se pudo avanzar el proyecto NPI ${project.id}: ${(err as Error)?.message}`,
          ),
        );
    }
  }

  private async notifyFinalGate(gate: NpiGate): Promise<void> {
    if (!this.notifications || !this.users) return;
    try {
      const project = await this.projects.findOne({
        where: { id: gate.projectId },
      });
      if (!project) return;
      const email = this.tenantCtx.getUserEmail();
      if (!email) return;
      const user = await this.users.findOneByEmail(email).catch(() => null);
      if (!user) return;
      await this.notifications.create({
        userId: user.id,
        kind: 'npi',
        severity: 'medium',
        domain: 'engineering',
        source: 'NPI',
        title: `NPI: gate MP aprobado · ${project.modelNumber} rev ${project.revision}`,
        body:
          `El modelo ${project.modelNumber} (rev ${project.revision}) pasó el gate final (MP). ` +
          `Revisa la readiness antes de activar el modelo (este aviso es solo informativo).`,
        dedupeKey: `npi-mp-passed:${project.id}`,
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo crear aviso de gate MP: ${(err as Error)?.message}`,
      );
    }
  }

  // ── Risks (advisory register) ───────────────────────────────────────────────
  /** Risks for a launch, sorted open-first, then severity desc, then due date. */
  async listRisks(projectId: string): Promise<NpiRisk[]> {
    const rows = await this.risks.find({ where: { projectId } });
    return rows.sort((a, b) => {
      const ao = a.status === 'CLOSED' ? 1 : 0;
      const bo = b.status === 'CLOSED' ? 1 : 0;
      if (ao !== bo) return ao - bo;
      const sev =
        (RISK_SEVERITY_RANK[b.severity] ?? 0) -
        (RISK_SEVERITY_RANK[a.severity] ?? 0);
      if (sev !== 0) return sev;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });
  }

  async createRisk(
    projectId: string,
    dto: CreateNpiRiskDto,
  ): Promise<NpiRisk> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto NPI no encontrado.');
    const risk = this.risks.create({
      projectId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      severity: dto.severity ?? 'MEDIUM',
      status: 'OPEN',
      owner: dto.owner?.trim() || null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      mitigation: dto.mitigation?.trim() || null,
      ...this.scopeFields(),
    });
    const saved = await this.risks.save(risk);
    await this.record('NPI_RISK_CREATED', saved.id, {
      projectId,
      severity: saved.severity,
    });
    return saved;
  }

  async updateRisk(id: string, dto: UpdateNpiRiskDto): Promise<NpiRisk> {
    const risk = await this.risks.findOne({ where: { id } });
    if (!risk) throw new NotFoundException('Riesgo NPI no encontrado.');
    if (dto.title !== undefined) risk.title = dto.title.trim();
    if (dto.description !== undefined)
      risk.description = dto.description.trim() || null;
    if (dto.severity !== undefined) risk.severity = dto.severity;
    if (dto.status !== undefined) risk.status = dto.status;
    if (dto.owner !== undefined) risk.owner = dto.owner.trim() || null;
    if (dto.dueDate !== undefined)
      risk.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.mitigation !== undefined)
      risk.mitigation = dto.mitigation.trim() || null;
    const saved = await this.risks.save(risk);
    await this.record('NPI_RISK_UPDATED', saved.id, {
      projectId: saved.projectId,
      status: saved.status,
    });
    return saved;
  }

  async deleteRisk(id: string): Promise<{ deleted: boolean }> {
    const risk = await this.risks.findOne({ where: { id } });
    if (!risk) throw new NotFoundException('Riesgo NPI no encontrado.');
    await this.risks.remove(risk);
    await this.record('NPI_RISK_DELETED', id, { projectId: risk.projectId });
    return { deleted: true };
  }

  private async record(
    action: string,
    referenceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.ENGINEERING,
        action,
        referenceType: 'NPI',
        referenceId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata,
      });
    } catch (err) {
      this.logger.warn(
        `Ledger skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
