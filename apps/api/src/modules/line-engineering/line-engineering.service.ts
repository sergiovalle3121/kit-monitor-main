import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { SfLineStation } from './entities/sf-line-station.entity';
import { SfModelLine } from './entities/sf-model-line.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateStationDto,
  QualifyModelLineDto,
  UpdateModelLineDto,
  UpdateStationDto,
} from './dto/line-engineering.dto';
import {
  balanceLine,
  BalanceResult,
  computeTaktSec,
  layoutCompleteness,
  LayoutCompleteness,
} from './line-balance';

/** One station's material/work requirement for a unit of a model — the bridge
 * that Material Staging (C) and the Operator Terminal (D) consume. */
export interface StationRequirement {
  station: string;
  sequence: number;
  npExpected: string | null;
  useFactor: number;
  stdTimeSec: number;
  visualAidUrl: string | null;
  ctq: boolean;
  feederPosition: string | null;
}

export interface LineEngineeringKpis {
  stationsTotal: number;
  stationsWithVisualAid: number;
  pctVisualAid: number;
  modelsQualified: number;
  modelsBalanced: number;
  pctModelsBalanced: number;
  ctqStations: number;
  incompleteLayouts: number;
}

const BALANCE_OK = 0.85; // a model is "balanced" at ≥85% line efficiency

@Injectable()
export class LineEngineeringService {
  private readonly logger = new Logger(LineEngineeringService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfLineStation))
    private readonly stations: TenantScopedRepository<SfLineStation>,
    @Inject(getTenantRepositoryToken(SfModelLine))
    private readonly modelLines: TenantScopedRepository<SfModelLine>,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  // ── Scope ────────────────────────────────────────────────────────────────
  private applyScope<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string): SelectQueryBuilder<T> {
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

  // ── Stations (routing + layout) ────────────────────────────────────────────
  async createStation(dto: CreateStationDto): Promise<SfLineStation> {
    const entity = this.stations.create({
      model: dto.model.trim(),
      revision: (dto.revision ?? 'A').trim(),
      line: dto.line.trim(),
      station: dto.station.trim(),
      sequence: dto.sequence ?? 1,
      npExpected: dto.npExpected?.trim() || null,
      useFactor: dto.useFactor ?? 1,
      stdTimeSec: dto.stdTimeSec ?? 0,
      feederPosition: dto.feederPosition?.trim() || null,
      visualAidUrl: dto.visualAidUrl?.trim() || null,
      ctq: dto.ctq ?? false,
      programId: dto.programId ?? null,
      notes: dto.notes ?? null,
      active: true,
      ...this.scopeFields(),
    });
    const saved = await this.stations.save(entity);
    await this.record('SF_STATION_LAYOUT_CREATED', saved.id, saved.programId, { after: saved });
    return saved;
  }

  async listStations(filters: { model?: string; line?: string; revision?: string } = {}): Promise<SfLineStation[]> {
    const qb = this.stations.createQueryBuilder('s');
    this.applyScope(qb, 's');
    if (filters.model) qb.andWhere('s.model = :m', { m: filters.model });
    if (filters.line) qb.andWhere('s.line = :l', { l: filters.line });
    if (filters.revision) qb.andWhere('s.revision = :r', { r: filters.revision });
    return qb.orderBy('s.line', 'ASC').addOrderBy('s.sequence', 'ASC').getMany();
  }

  async getStation(id: string): Promise<SfLineStation> {
    const found = await this.stations.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Estación no encontrada.');
    return found;
  }

  async updateStation(id: string, dto: UpdateStationDto): Promise<SfLineStation> {
    const s = await this.getStation(id);
    const before = { ...s };
    Object.assign(s, {
      ...(dto.sequence !== undefined && { sequence: dto.sequence }),
      ...(dto.npExpected !== undefined && { npExpected: dto.npExpected.trim() || null }),
      ...(dto.useFactor !== undefined && { useFactor: dto.useFactor }),
      ...(dto.stdTimeSec !== undefined && { stdTimeSec: dto.stdTimeSec }),
      ...(dto.feederPosition !== undefined && { feederPosition: dto.feederPosition.trim() || null }),
      ...(dto.visualAidUrl !== undefined && { visualAidUrl: dto.visualAidUrl.trim() || null }),
      ...(dto.ctq !== undefined && { ctq: dto.ctq }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.active !== undefined && { active: dto.active }),
    });
    const saved = await this.stations.save(s);
    await this.record('SF_STATION_LAYOUT_UPDATED', saved.id, saved.programId, { before, after: saved });
    return saved;
  }

  /** Ordered routing for a model+revision (the sequence of stations). */
  async routing(model: string, revision = 'A'): Promise<SfLineStation[]> {
    const qb = this.stations.createQueryBuilder('s');
    this.applyScope(qb, 's');
    qb.andWhere('s.model = :m', { m: model })
      .andWhere('s.revision = :r', { r: revision })
      .andWhere('s.active = :a', { a: true });
    return qb.orderBy('s.sequence', 'ASC').getMany();
  }

  /** Station-by-station requirements for a unit — bridge to staging/operator. */
  async stationRequirements(model: string, revision = 'A'): Promise<StationRequirement[]> {
    const route = await this.routing(model, revision);
    return route.map((s) => ({
      station: s.station,
      sequence: s.sequence,
      npExpected: s.npExpected,
      useFactor: Number(s.useFactor ?? 1),
      stdTimeSec: Number(s.stdTimeSec ?? 0),
      visualAidUrl: s.visualAidUrl,
      ctq: !!s.ctq,
      feederPosition: s.feederPosition,
    }));
  }

  // ── Model↔Line qualification ───────────────────────────────────────────────
  async qualify(dto: QualifyModelLineDto): Promise<SfModelLine> {
    const qb = this.modelLines.createQueryBuilder('q');
    this.applyScope(qb, 'q');
    qb.andWhere('q.model = :m', { m: dto.model })
      .andWhere('q.line = :l', { l: dto.line })
      .andWhere('q.revision = :r', { r: dto.revision ?? 'A' });
    const existing = await qb.getOne();
    if (existing) {
      throw new BadRequestException('Ese modelo ya está calificado en esa línea.');
    }
    const entity = this.modelLines.create({
      model: dto.model.trim(),
      revision: (dto.revision ?? 'A').trim(),
      line: dto.line.trim(),
      changeoverMinutes: dto.changeoverMinutes ?? 0,
      taktTargetSec: dto.taktTargetSec ?? 0,
      programId: dto.programId ?? null,
      notes: dto.notes ?? null,
      active: true,
      ...this.scopeFields(),
    });
    const saved = await this.modelLines.save(entity);
    await this.record('SF_MODEL_LINE_QUALIFIED', saved.id, saved.programId, { after: saved });
    return saved;
  }

  async listQualifications(filters: { line?: string; model?: string } = {}): Promise<SfModelLine[]> {
    const qb = this.modelLines.createQueryBuilder('q');
    this.applyScope(qb, 'q');
    if (filters.line) qb.andWhere('q.line = :l', { l: filters.line });
    if (filters.model) qb.andWhere('q.model = :m', { m: filters.model });
    return qb.orderBy('q.line', 'ASC').addOrderBy('q.model', 'ASC').getMany();
  }

  async updateQualification(id: string, dto: UpdateModelLineDto): Promise<SfModelLine> {
    const q = await this.modelLines.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Calificación no encontrada.');
    Object.assign(q, {
      ...(dto.changeoverMinutes !== undefined && { changeoverMinutes: dto.changeoverMinutes }),
      ...(dto.taktTargetSec !== undefined && { taktTargetSec: dto.taktTargetSec }),
      ...(dto.active !== undefined && { active: dto.active }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    const saved = await this.modelLines.save(q);
    await this.record('SF_MODEL_LINE_UPDATED', saved.id, saved.programId, { after: saved });
    return saved;
  }

  // ── Calculations ───────────────────────────────────────────────────────────

  /** Balance a model's routing against a takt (from demand or explicit target). */
  async balance(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
  }): Promise<BalanceResult & { completeness: LayoutCompleteness; model: string; revision: string }> {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(`Sin ruteo para ${params.model} rev ${revision}.`);
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const result = balanceLine(
      route.map((s) => ({ station: s.station, sequence: s.sequence, stdTimeSec: Number(s.stdTimeSec) })),
      takt,
    );
    const completeness = layoutCompleteness(
      route.map((s) => ({
        npExpected: s.npExpected,
        useFactor: Number(s.useFactor),
        visualAidUrl: s.visualAidUrl,
        ctq: !!s.ctq,
      })),
    );
    return { ...result, completeness, model: params.model, revision };
  }

  /**
   * Capacity / load for a line: required minutes (Σ std time × demand) vs
   * available, plus the changeover toll. Standalone math an IE can run before a
   * plan exists.
   */
  async capacity(params: {
    model: string;
    revision?: string;
    line: string;
    availableMinutes: number;
    demandUnits: number;
  }): Promise<{
    line: string;
    model: string;
    requiredMinutes: number;
    changeoverMinutes: number;
    availableMinutes: number;
    utilizationPct: number;
    feasible: boolean;
  }> {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    const cycleSecPerUnit = route.length
      ? Math.max(...route.map((s) => Number(s.stdTimeSec) || 0))
      : 0;
    const requiredMinutes = (cycleSecPerUnit * (params.demandUnits || 0)) / 60;
    const qb = this.modelLines.createQueryBuilder('q');
    this.applyScope(qb, 'q');
    qb.andWhere('q.model = :m', { m: params.model }).andWhere('q.line = :l', { l: params.line });
    const ql = await qb.getOne();
    const changeover = ql ? Number(ql.changeoverMinutes) || 0 : 0;
    const totalRequired = requiredMinutes + changeover;
    const avail = params.availableMinutes || 0;
    return {
      line: params.line,
      model: params.model,
      requiredMinutes: round(requiredMinutes),
      changeoverMinutes: changeover,
      availableMinutes: avail,
      utilizationPct: avail > 0 ? round((totalRequired / avail) * 100, 1) : 0,
      feasible: avail > 0 ? totalRequired <= avail : false,
    };
  }

  async kpis(): Promise<LineEngineeringKpis> {
    const [allStations, quals] = await Promise.all([
      this.listStations(),
      this.listQualifications(),
    ]);
    const active = allStations.filter((s) => s.active);
    const stationsWithVisualAid = active.filter((s) => !!s.visualAidUrl).length;
    const ctqStations = active.filter((s) => s.ctq).length;

    // group active stations by model|revision to evaluate balance per model
    const groups = new Map<string, SfLineStation[]>();
    for (const s of active) {
      const key = `${s.model}|${s.revision}`;
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    let modelsBalanced = 0;
    let incompleteLayouts = 0;
    for (const [, list] of groups) {
      const takt = list
        .map((s) => quals.find((q) => q.model === s.model && q.taktTargetSec > 0)?.taktTargetSec ?? 0)
        .find((t) => t > 0) ?? 0;
      const res = balanceLine(
        list.map((s) => ({ station: s.station, sequence: s.sequence, stdTimeSec: Number(s.stdTimeSec) })),
        takt,
      );
      if (res.balancePct >= BALANCE_OK && res.stationsOverTakt.length === 0) modelsBalanced++;
      const comp = layoutCompleteness(
        list.map((s) => ({ npExpected: s.npExpected, useFactor: Number(s.useFactor), visualAidUrl: s.visualAidUrl, ctq: !!s.ctq })),
      );
      if (comp.incompleteStations > 0) incompleteLayouts++;
    }

    return {
      stationsTotal: active.length,
      stationsWithVisualAid,
      pctVisualAid: active.length ? round(stationsWithVisualAid / active.length, 4) : 0,
      modelsQualified: quals.filter((q) => q.active).length,
      modelsBalanced,
      pctModelsBalanced: groups.size ? round(modelsBalanced / groups.size, 4) : 0,
      ctqStations,
      incompleteLayouts,
    };
  }

  // ── Ledger ─────────────────────────────────────────────────────────────────
  private async record(
    action: string,
    referenceId: string,
    program: string | null,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.ENGINEERING,
        action,
        referenceType: 'SF_LINE_ENGINEERING',
        referenceId,
        program: program ?? undefined,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata: { beforeState: states.before, afterState: states.after },
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
