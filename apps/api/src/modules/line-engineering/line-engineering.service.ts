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
import {
  SfLineLayout,
  LayoutConnector,
  LayoutAsset,
  LayoutAnnotation,
  LayoutSnapshot,
  LayoutCell,
} from './entities/sf-line-layout.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import {
  EventDomain,
  LedgerEvent,
} from '../event-ledger/entities/ledger-event.entity';
import {
  CloneLayoutDto,
  CreateStationDto,
  DxfMetaDto,
  QualifyModelLineDto,
  SaveLayoutDto,
  UpdateModelLineDto,
  UpdateStationDto,
  UploadDxfDto,
} from './dto/line-engineering.dto';
import {
  balanceLine,
  BalanceResult,
  computeTaktSec,
  HeatmapResult,
  layoutCompleteness,
  LayoutCompleteness,
  stationHeatmap,
  StationHeat,
  stationCompleteness,
  StationCompletenessResult,
  StationCompletenessRow,
} from './line-balance';
import { flowAnalysis, FlowAnalysis } from './line-flow';
import { flowDirection, FlowDirectionResult } from './line-flowdir';
import { cellFlow, CellFlowResult } from './line-cellflow';
import { layoutCollisions, CollisionResult, RectBox } from './line-collision';
import { autoArrange, ArrangedPosition } from './line-autoarrange';
import { optimizeFlowOrder } from './line-optimize';
import { staffingPlan, StaffingResult, StationStaffing } from './line-staffing';
import { bufferPlan, BufferPlan } from './line-buffer';
import { balanceLoops, LoopPlan } from './line-loops';
import {
  costModel,
  areaToM2,
  unitToMeters,
  CostModel,
  CostRates,
} from './line-cost';
import { standardWork, StdWorkResult } from './line-stdwork';
import { dossierStationsToCsv, DossierStationRow } from './line-dossier';
import { computeTakeoff, Takeoff } from './line-takeoff';
import { flexLineAnalysis, FlexLineResult } from './line-flexline';
import {
  sensitivityCurve,
  demandSweep,
  SensitivityResult,
} from './line-sensitivity';
import { compareLayouts, LayoutComparison, LayoutKpis } from './line-compare';

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

/** A station as the 2D layout editor consumes it (placement may be null). */
export interface LayoutStation {
  id: string;
  station: string;
  line: string;
  sequence: number;
  ctq: boolean;
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
  rotation: number | null;
}

export interface LayoutFootprint {
  footprintW: number;
  footprintH: number;
  unit: string;
  gridSize: number;
}

/** DXF background placement (metadata only — the raw DXF is fetched apart). */
export interface LayoutDxf {
  name: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  visible: boolean;
  opacity: number;
}

export type ApprovalStatus = 'draft' | 'in_review' | 'approved';

export interface LayoutApproval {
  status: ApprovalStatus;
  by: string | null;
  at: string | null;
  note: string | null;
}

/** Category of a layout history event — drives the icon/color in the UI. */
export type LayoutHistoryKind =
  | 'save'
  | 'approval'
  | 'snapshot'
  | 'restore'
  | 'dxf'
  | 'clone'
  | 'other';

/** One entry in a layout's audit timeline (Fase 32) — a human-readable view of
 * a ledger event already recorded for this layout. */
export interface LayoutHistoryEntry {
  id: string;
  action: string;
  kind: LayoutHistoryKind;
  actor: string;
  at: string;
  title: string;
  detail: string;
}

export interface LineLayout {
  model: string;
  revision: string;
  footprint: LayoutFootprint;
  stations: LayoutStation[];
  dxf: LayoutDxf | null;
  connectors: LayoutConnector[];
  assets: LayoutAsset[];
  annotations: LayoutAnnotation[];
  cells: LayoutCell[];
  approval: LayoutApproval;
}

/** Consolidated layout dossier (Fase 14). */
export interface LayoutReport {
  model: string;
  revision: string;
  unit: string;
  stations: {
    total: number;
    placed: number;
    unplaced: number;
    readinessPct: number;
  };
  space: {
    footprintArea: number;
    occupiedArea: number;
    utilizationPct: number;
    assetCount: number;
  };
  flow: {
    totalDistance: number;
    longestSegment: number;
    crossings: number;
    connectorCount: number;
  };
  validation: { overlaps: number; outOfBounds: number; ok: boolean };
  balance: {
    balancePct: number;
    bottleneckStation: string | null;
    lineCycleTimeSec: number;
    stationCount: number;
  } | null;
}

/** Lightweight metadata for a saved layout version (Fase 13). */
export interface SnapshotSummary {
  id: string;
  name: string;
  createdAt: string;
  createdBy?: string | null;
  stationCount: number;
  assetCount: number;
  connectorCount: number;
  annotationCount: number;
}

/** What changed between a saved version and the live layout (Fase 17). */
export interface SnapshotDiff {
  snapshotId: string;
  name: string;
  movedCount: number;
  addedCount: number;
  removedCount: number;
  moved: { station: string; distance: number }[];
  added: string[];
  removed: string[];
  footprintChanged: boolean;
  connectorsDelta: number;
  assetsDelta: number;
  annotationsDelta: number;
}

/** Portable, consolidated export of a layout (Fase 39): the F14 report plus
 * manning, cost and a per-station table, with a spreadsheet-ready CSV. */
export interface LayoutDossier {
  generatedAt: string;
  model: string;
  revision: string;
  unit: string;
  report: LayoutReport;
  staffing: { totalOperators: number; avgUtilizationPct: number } | null;
  cost: {
    totalCostPerUnit: number;
    laborCostPerUnit: number;
    spaceCostPerUnit: number;
    capexPerUnit: number;
    monthlyVolume: number;
    throughputPerHour: number;
  } | null;
  completeness: {
    total: number;
    complete: number;
    completenessPct: number;
    missingVisualAid: number;
  };
  stations: DossierStationRow[];
  /** The station table serialized as RFC-4180 CSV. */
  csv: string;
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
    // `layouts` is optional and placed after `tenantCtx` on purpose: existing
    // callers that build this service positionally with (stations, modelLines,
    // ctx) keep working untouched. Production DI still injects it by token.
    @Optional()
    @Inject(getTenantRepositoryToken(SfLineLayout))
    private readonly layouts?: TenantScopedRepository<SfLineLayout>,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  /** The layout repo, guaranteed present (DI always provides it in real use). */
  private requireLayouts(): TenantScopedRepository<SfLineLayout> {
    if (!this.layouts) {
      throw new Error('SfLineLayout repository is not available.');
    }
    return this.layouts;
  }

  // ── Scope ────────────────────────────────────────────────────────────────
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
    await this.record('SF_STATION_LAYOUT_CREATED', saved.id, saved.programId, {
      after: saved,
    });
    return saved;
  }

  async listStations(
    filters: { model?: string; line?: string; revision?: string } = {},
  ): Promise<SfLineStation[]> {
    const qb = this.stations.createQueryBuilder('s');
    this.applyScope(qb, 's');
    if (filters.model) qb.andWhere('s.model = :m', { m: filters.model });
    if (filters.line) qb.andWhere('s.line = :l', { l: filters.line });
    if (filters.revision)
      qb.andWhere('s.revision = :r', { r: filters.revision });
    return qb
      .orderBy('s.line', 'ASC')
      .addOrderBy('s.sequence', 'ASC')
      .getMany();
  }

  async getStation(id: string): Promise<SfLineStation> {
    const found = await this.stations.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Estación no encontrada.');
    return found;
  }

  async updateStation(
    id: string,
    dto: UpdateStationDto,
  ): Promise<SfLineStation> {
    const s = await this.getStation(id);
    const before = { ...s };
    Object.assign(s, {
      ...(dto.sequence !== undefined && { sequence: dto.sequence }),
      ...(dto.npExpected !== undefined && {
        npExpected: dto.npExpected.trim() || null,
      }),
      ...(dto.useFactor !== undefined && { useFactor: dto.useFactor }),
      ...(dto.stdTimeSec !== undefined && { stdTimeSec: dto.stdTimeSec }),
      ...(dto.feederPosition !== undefined && {
        feederPosition: dto.feederPosition.trim() || null,
      }),
      ...(dto.visualAidUrl !== undefined && {
        visualAidUrl: dto.visualAidUrl.trim() || null,
      }),
      ...(dto.ctq !== undefined && { ctq: dto.ctq }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.active !== undefined && { active: dto.active }),
    });
    const saved = await this.stations.save(s);
    await this.record('SF_STATION_LAYOUT_UPDATED', saved.id, saved.programId, {
      before,
      after: saved,
    });
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
  async stationRequirements(
    model: string,
    revision = 'A',
  ): Promise<StationRequirement[]> {
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
      throw new BadRequestException(
        'Ese modelo ya está calificado en esa línea.',
      );
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
    await this.record('SF_MODEL_LINE_QUALIFIED', saved.id, saved.programId, {
      after: saved,
    });
    return saved;
  }

  async listQualifications(
    filters: { line?: string; model?: string } = {},
  ): Promise<SfModelLine[]> {
    const qb = this.modelLines.createQueryBuilder('q');
    this.applyScope(qb, 'q');
    if (filters.line) qb.andWhere('q.line = :l', { l: filters.line });
    if (filters.model) qb.andWhere('q.model = :m', { m: filters.model });
    return qb.orderBy('q.line', 'ASC').addOrderBy('q.model', 'ASC').getMany();
  }

  async updateQualification(
    id: string,
    dto: UpdateModelLineDto,
  ): Promise<SfModelLine> {
    const q = await this.modelLines.findOne({ where: { id } });
    if (!q) throw new NotFoundException('Calificación no encontrada.');
    Object.assign(q, {
      ...(dto.changeoverMinutes !== undefined && {
        changeoverMinutes: dto.changeoverMinutes,
      }),
      ...(dto.taktTargetSec !== undefined && {
        taktTargetSec: dto.taktTargetSec,
      }),
      ...(dto.active !== undefined && { active: dto.active }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    const saved = await this.modelLines.save(q);
    await this.record('SF_MODEL_LINE_UPDATED', saved.id, saved.programId, {
      after: saved,
    });
    return saved;
  }

  // ── Layout (2D physical placement) ─────────────────────────────────────────

  private static readonly DEFAULT_FOOTPRINT: LayoutFootprint = {
    footprintW: 20000,
    footprintH: 10000,
    unit: 'mm',
    gridSize: 500,
  };

  private toLayoutStation(s: SfLineStation): LayoutStation {
    return {
      id: s.id,
      station: s.station,
      line: s.line,
      sequence: s.sequence,
      ctq: !!s.ctq,
      x: s.layoutX ?? null,
      y: s.layoutY ?? null,
      w: s.layoutW ?? null,
      h: s.layoutH ?? null,
      rotation: s.layoutRotation ?? null,
    };
  }

  private toDxf(layout: SfLineLayout): LayoutDxf | null {
    if (!layout.dxfData) return null;
    return {
      name: layout.dxfName || 'plano.dxf',
      offsetX: Number(layout.dxfOffsetX) || 0,
      offsetY: Number(layout.dxfOffsetY) || 0,
      scale: Number(layout.dxfScale) || 1,
      rotation: Number(layout.dxfRotation) || 0,
      visible: layout.dxfVisible !== false,
      opacity: Number(layout.dxfOpacity ?? 0.5),
    };
  }

  private applyDxfMeta(layout: SfLineLayout, meta: DxfMetaDto): void {
    if (meta.offsetX !== undefined)
      layout.dxfOffsetX = Number(meta.offsetX) || 0;
    if (meta.offsetY !== undefined)
      layout.dxfOffsetY = Number(meta.offsetY) || 0;
    if (meta.scale !== undefined)
      layout.dxfScale = clampPos(meta.scale, layout.dxfScale || 1);
    if (meta.rotation !== undefined)
      layout.dxfRotation = Number(meta.rotation) || 0;
    if (meta.visible !== undefined) layout.dxfVisible = !!meta.visible;
    if (meta.opacity !== undefined)
      layout.dxfOpacity = Math.min(1, Math.max(0, Number(meta.opacity) || 0));
  }

  private async findLayout(
    model: string,
    revision: string,
  ): Promise<SfLineLayout | null> {
    const qb = this.requireLayouts().createQueryBuilder('l');
    this.applyScope(qb, 'l');
    qb.andWhere('l.model = :m', { m: model }).andWhere('l.revision = :r', {
      r: revision,
    });
    return qb.getOne();
  }

  private async ensureLayout(
    model: string,
    revision: string,
  ): Promise<SfLineLayout> {
    const existing = await this.findLayout(model, revision);
    if (existing) return existing;
    return this.requireLayouts().create({
      model,
      revision,
      ...LineEngineeringService.DEFAULT_FOOTPRINT,
      ...this.scopeFields(),
    });
  }

  /** Hydrate the 2D layout editor: footprint config + stations (placed or not). */
  async getLayout(model: string, revision = 'A'): Promise<LineLayout> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const sQb = this.stations.createQueryBuilder('s');
    this.applyScope(sQb, 's');
    sQb.andWhere('s.model = :m', { m }).andWhere('s.revision = :r', { r });
    const stations = await sQb.orderBy('s.sequence', 'ASC').getMany();

    const layout = await this.findLayout(m, r);

    return {
      model: m,
      revision: r,
      footprint: layout
        ? {
            footprintW: Number(layout.footprintW),
            footprintH: Number(layout.footprintH),
            unit: layout.unit || 'mm',
            gridSize: Number(layout.gridSize),
          }
        : { ...LineEngineeringService.DEFAULT_FOOTPRINT },
      stations: stations.map((s) => this.toLayoutStation(s)),
      dxf: layout ? this.toDxf(layout) : null,
      connectors: layout?.connectors ?? [],
      assets: layout?.assets ?? [],
      annotations: layout?.annotations ?? [],
      cells: layout?.cells ?? [],
      approval: {
        status: (layout?.approvalStatus as ApprovalStatus) || 'draft',
        by: layout?.approvedBy ?? null,
        at: layout?.approvedAt
          ? new Date(layout.approvedAt).toISOString()
          : null,
        note: layout?.approvalNote ?? null,
      },
    };
  }

  /**
   * Quantity take-off / bill of materials for a layout (Fase 42 — CAD 3D):
   * station and equipment counts, floor area used, footprint utilisation and
   * total wall run. Read-only; reuses getLayout and the pure take-off helper.
   */
  async getTakeoff(model: string, revision = 'A'): Promise<Takeoff> {
    const layout = await this.getLayout(model, revision);
    return computeTakeoff({
      footprint: {
        footprintW: layout.footprint.footprintW,
        footprintH: layout.footprint.footprintH,
        unit: layout.footprint.unit,
      },
      stations: layout.stations.map((s) => ({
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
      })),
      assets: (layout.assets ?? []).map((a) => ({
        kind: a.kind,
        w: a.w,
        h: a.h,
      })),
      annotations: (layout.annotations ?? []).map((a) => ({ type: a.type })),
    });
  }

  /**
   * Set the layout's release state (Fase 29): draft → in_review → approved.
   * Approving stamps the current user + time; moving back to draft/in_review
   * clears the stamp. Additive — never touches the geometry.
   */
  async setApproval(dto: {
    model: string;
    revision?: string;
    status: string;
    note?: string;
  }): Promise<LineLayout> {
    const m = (dto.model ?? '').trim();
    const r = (dto.revision ?? 'A').trim() || 'A';
    if (!m) throw new BadRequestException('model es obligatorio.');
    const status: ApprovalStatus = (
      ['draft', 'in_review', 'approved'] as const
    ).includes(dto.status as ApprovalStatus)
      ? (dto.status as ApprovalStatus)
      : 'draft';
    const layout = await this.ensureLayout(m, r);
    layout.approvalStatus = status;
    layout.approvalNote = dto.note ? String(dto.note).slice(0, 240) : null;
    if (status === 'approved') {
      layout.approvedBy = this.tenantCtx.getUserEmail() ?? null;
      layout.approvedAt = new Date();
    } else {
      layout.approvedBy = null;
      layout.approvedAt = null;
    }
    await this.requireLayouts().save(layout);
    await this.record('SF_LINE_LAYOUT_APPROVAL', `${m}|${r}`, null, {
      after: { status, by: layout.approvedBy },
    });
    return this.getLayout(m, r);
  }

  /**
   * Audit timeline for a layout (Fase 32): the chronological log of who saved,
   * approved, snapshotted, restored, cloned or attached a plan — read straight
   * from the event ledger that the mutating methods already write to. Read-only
   * and degrades gracefully (empty list) when the ledger isn't wired in.
   */
  async getLayoutHistory(
    model: string,
    revision = 'A',
    limit = 50,
  ): Promise<LayoutHistoryEntry[]> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    if (!m) throw new BadRequestException('model es obligatorio.');
    if (!this.ledger) return [];
    const ref = `${m}|${r}`;
    let events: LedgerEvent[];
    try {
      events = await this.ledger.getEventsByReference(
        'SF_LINE_ENGINEERING',
        ref,
      );
    } catch (err) {
      this.logger.warn(
        `Historial no disponible para ${ref}: ${(err as Error)?.message}`,
      );
      return [];
    }
    const n = Math.min(Math.max(1, Math.floor(Number(limit) || 50)), 200);
    return events.slice(0, n).map((e) => toHistoryEntry(e));
  }

  /**
   * Persist a model+revision layout additively: upsert the footprint config and
   * write each station's x/y/w/h/rotation. Only stations already in scope for
   * this model+revision are touched — the routing/balance data is never altered.
   */
  async saveLayout(dto: SaveLayoutDto): Promise<LineLayout> {
    const model = (dto.model ?? '').trim();
    const revision = (dto.revision ?? 'A').trim() || 'A';
    if (!model) throw new BadRequestException('model es obligatorio.');

    // Load the model's stations once (scoped) and index by id, so a bad/foreign
    // id in positions or connectors is simply ignored (never escapes scope).
    const sQb = this.stations.createQueryBuilder('s');
    this.applyScope(sQb, 's');
    sQb
      .andWhere('s.model = :m', { m: model })
      .andWhere('s.revision = :r', { r: revision });
    const stations = await sQb.getMany();
    const byId = new Map(stations.map((s) => [s.id, s]));

    // 1) Footprint config + DXF placement + flow connectors + assets +
    //    annotations (find-or-create within scope). DXF data is never touched.
    if (
      dto.footprint ||
      dto.dxf ||
      dto.connectors ||
      dto.assets ||
      dto.annotations ||
      dto.cells
    ) {
      const layout = await this.ensureLayout(model, revision);
      const f = dto.footprint;
      if (f) {
        if (f.footprintW !== undefined)
          layout.footprintW = clampPos(f.footprintW, layout.footprintW);
        if (f.footprintH !== undefined)
          layout.footprintH = clampPos(f.footprintH, layout.footprintH);
        if (f.unit !== undefined) layout.unit = f.unit === 'm' ? 'm' : 'mm';
        if (f.gridSize !== undefined)
          layout.gridSize = clampPos(f.gridSize, layout.gridSize);
      }
      if (dto.dxf) this.applyDxfMeta(layout, dto.dxf);
      if (dto.connectors) {
        // keep only links whose endpoints are real stations in this scope
        layout.connectors = dto.connectors
          .filter((c) => c.from !== c.to && byId.has(c.from) && byId.has(c.to))
          .map((c) => ({ from: c.from, to: c.to, kind: c.kind || 'flow' }));
      }
      if (dto.assets) {
        layout.assets = dto.assets.map((a) => ({
          id: String(a.id).slice(0, 64),
          kind: String(a.kind || 'box').slice(0, 24),
          x: Number(a.x) || 0,
          y: Number(a.y) || 0,
          w: clampPos(a.w, 1),
          h: clampPos(a.h, 1),
          rotation: Number(a.rotation) || 0,
          ...(a.label ? { label: String(a.label).slice(0, 64) } : {}),
        }));
      }
      if (dto.annotations) {
        layout.annotations = dto.annotations.map((a) => ({
          id: String(a.id).slice(0, 64),
          type: a.type === 'dim' ? ('dim' as const) : ('text' as const),
          x: Number(a.x) || 0,
          y: Number(a.y) || 0,
          ...(a.x2 !== undefined ? { x2: Number(a.x2) || 0 } : {}),
          ...(a.y2 !== undefined ? { y2: Number(a.y2) || 0 } : {}),
          ...(a.text ? { text: String(a.text).slice(0, 240) } : {}),
          ...(a.color ? { color: String(a.color).slice(0, 16) } : {}),
        }));
      }
      if (dto.cells) {
        // keep only member ids that are real stations in this scope
        layout.cells = dto.cells.map((c) => ({
          id: String(c.id).slice(0, 64),
          name: String(c.name || 'Celda').slice(0, 48),
          color: String(c.color || '#6366f1').slice(0, 16),
          stationIds: (c.stationIds ?? [])
            .filter((sid) => byId.has(sid))
            .slice(0, 200),
        }));
      }
      await this.requireLayouts().save(layout);
    }

    const dirty = new Set<SfLineStation>();
    for (const p of dto.positions ?? []) {
      const s = byId.get(p.id);
      if (!s) continue;
      s.layoutX = Number(p.x) || 0;
      s.layoutY = Number(p.y) || 0;
      s.layoutW = p.w !== undefined ? clampPos(p.w, s.layoutW ?? 1) : s.layoutW;
      s.layoutH = p.h !== undefined ? clampPos(p.h, s.layoutH ?? 1) : s.layoutH;
      s.layoutRotation =
        p.rotation !== undefined
          ? Number(p.rotation) || 0
          : (s.layoutRotation ?? 0);
      dirty.add(s);
    }
    for (const id of dto.cleared ?? []) {
      const s = byId.get(id);
      if (!s) continue;
      s.layoutX = null;
      s.layoutY = null;
      s.layoutW = null;
      s.layoutH = null;
      s.layoutRotation = null;
      dirty.add(s);
    }
    if (dirty.size > 0) await this.stations.save([...dirty]);

    await this.record('SF_LINE_LAYOUT_SAVED', `${model}|${revision}`, null, {
      after: {
        model,
        revision,
        placed: dto.positions?.length ?? 0,
        cleared: dto.cleared?.length ?? 0,
      },
    });

    return this.getLayout(model, revision);
  }

  /**
   * Per-cell metrics (Fase 27): for each manufacturing cell, the station count,
   * how many are placed, the total cycle time and the share of the footprint
   * its bounding box covers. Read-only aggregation over the cells + placements.
   */
  async getCellMetrics(
    model: string,
    revision = 'A',
  ): Promise<{
    model: string;
    revision: string;
    unit: string;
    footprintArea: number;
    cells: {
      id: string;
      name: string;
      color: string;
      stationCount: number;
      placedCount: number;
      totalCycleTimeSec: number;
      areaPctOfFootprint: number;
    }[];
  }> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.getLayout(m, r);
    const route = await this.routing(m, r);
    const stdById = new Map(
      route.map((s) => [s.id, Number(s.stdTimeSec) || 0]),
    );
    const stationById = new Map(layout.stations.map((s) => [s.id, s]));
    const fp = layout.footprint;
    const footprintArea = fp.footprintW * fp.footprintH;
    const defW = fp.footprintW * 0.06;
    const defH = fp.footprintH * 0.08;

    const cells = layout.cells.map((c) => {
      const members = c.stationIds
        .map((id) => stationById.get(id))
        .filter((s): s is NonNullable<typeof s> => !!s);
      const placed = members.filter((s) => s.x !== null && s.y !== null);
      const totalCycleTimeSec = c.stationIds.reduce(
        (a, id) => a + (stdById.get(id) ?? 0),
        0,
      );
      let area = 0;
      if (placed.length > 0) {
        const xs = placed.map((s) => s.x as number);
        const ys = placed.map((s) => s.y as number);
        const xe = placed.map((s) => (s.x as number) + (s.w ?? defW));
        const ye = placed.map((s) => (s.y as number) + (s.h ?? defH));
        area =
          (Math.max(...xe) - Math.min(...xs)) *
          (Math.max(...ye) - Math.min(...ys));
      }
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        stationCount: members.length,
        placedCount: placed.length,
        totalCycleTimeSec: round(totalCycleTimeSec),
        areaPctOfFootprint:
          footprintArea > 0 ? round((area / footprintArea) * 100, 1) : 0,
      };
    });

    return {
      model: m,
      revision: r,
      unit: fp.unit,
      footprintArea: round(footprintArea),
      cells,
    };
  }

  // ── Snapshots / versions (Fase 13) ─────────────────────────────────────────
  private static readonly MAX_SNAPSHOTS = 30;

  private toSnapshotSummary(s: LayoutSnapshot): SnapshotSummary {
    return {
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      createdBy: s.createdBy ?? null,
      stationCount: s.positions?.length ?? 0,
      assetCount: s.assets?.length ?? 0,
      connectorCount: s.connectors?.length ?? 0,
      annotationCount: s.annotations?.length ?? 0,
    };
  }

  /** List saved versions of a layout (newest first), metadata only. */
  async listSnapshots(
    model: string,
    revision = 'A',
  ): Promise<SnapshotSummary[]> {
    const layout = await this.findLayout(
      (model ?? '').trim(),
      (revision ?? 'A').trim() || 'A',
    );
    return (layout?.snapshots ?? [])
      .map((s) => this.toSnapshotSummary(s))
      .reverse();
  }

  /** Capture the current arrangement as a named, restorable version. */
  async createSnapshot(
    model: string,
    revision = 'A',
    name?: string,
  ): Promise<SnapshotSummary> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    if (!m) throw new BadRequestException('model es obligatorio.');
    const cur = await this.getLayout(m, r);
    const snap: LayoutSnapshot = {
      id: `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      name: (name?.trim() || `Versión ${new Date().toISOString()}`).slice(
        0,
        80,
      ),
      createdAt: new Date().toISOString(),
      createdBy: this.tenantCtx.getUserEmail() ?? null,
      footprint: cur.footprint,
      positions: cur.stations
        .filter((s) => s.x !== null && s.y !== null)
        .map((s) => ({
          id: s.id,
          x: s.x as number,
          y: s.y as number,
          w: s.w ?? Math.round(cur.footprint.footprintW * 0.06),
          h: s.h ?? Math.round(cur.footprint.footprintH * 0.08),
          rotation: s.rotation ?? 0,
        })),
      dxf: cur.dxf
        ? {
            offsetX: cur.dxf.offsetX,
            offsetY: cur.dxf.offsetY,
            scale: cur.dxf.scale,
            rotation: cur.dxf.rotation,
            visible: cur.dxf.visible,
            opacity: cur.dxf.opacity,
          }
        : null,
      connectors: cur.connectors,
      assets: cur.assets,
      annotations: cur.annotations,
    };
    const layout = await this.ensureLayout(m, r);
    const list = [...(layout.snapshots ?? []), snap];
    layout.snapshots = list.slice(-LineEngineeringService.MAX_SNAPSHOTS);
    await this.requireLayouts().save(layout);
    await this.record('SF_LINE_LAYOUT_SNAPSHOT', `${m}|${r}`, null, {
      after: { id: snap.id, name: snap.name },
    });
    return this.toSnapshotSummary(snap);
  }

  /** Restore a saved version onto the live layout (positions, footprint, flow,
   * equipment, annotations and DXF placement). Faithful: stations absent from
   * the version are un-placed. The raw DXF drawing is left as-is. */
  async restoreSnapshot(
    model: string,
    revision = 'A',
    snapshotId = '',
  ): Promise<LineLayout> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.findLayout(m, r);
    const snap = layout?.snapshots?.find((s) => s.id === snapshotId);
    if (!layout || !snap) {
      throw new NotFoundException('Versión no encontrada.');
    }
    const sQb = this.stations.createQueryBuilder('s');
    this.applyScope(sQb, 's');
    sQb.andWhere('s.model = :m', { m }).andWhere('s.revision = :r', { r });
    const stations = await sQb.getMany();
    const byId = new Map(stations.map((s) => [s.id, s]));
    const inSnap = new Map(snap.positions.map((p) => [p.id, p]));
    const dirty = new Set<SfLineStation>();
    for (const s of stations) {
      const p = inSnap.get(s.id);
      if (p) {
        s.layoutX = Number(p.x) || 0;
        s.layoutY = Number(p.y) || 0;
        s.layoutW = clampPos(p.w, 1);
        s.layoutH = clampPos(p.h, 1);
        s.layoutRotation = Number(p.rotation) || 0;
      } else {
        s.layoutX = null;
        s.layoutY = null;
        s.layoutW = null;
        s.layoutH = null;
        s.layoutRotation = null;
      }
      dirty.add(s);
    }
    if (dirty.size > 0) await this.stations.save([...dirty]);

    layout.footprintW = clampPos(snap.footprint.footprintW, layout.footprintW);
    layout.footprintH = clampPos(snap.footprint.footprintH, layout.footprintH);
    layout.unit = snap.footprint.unit === 'm' ? 'm' : 'mm';
    layout.gridSize = clampPos(snap.footprint.gridSize, layout.gridSize);
    layout.connectors = (snap.connectors ?? [])
      .filter((c) => c.from !== c.to && byId.has(c.from) && byId.has(c.to))
      .map((c) => ({ from: c.from, to: c.to, kind: c.kind || 'flow' }));
    layout.assets = snap.assets ?? [];
    layout.annotations = snap.annotations ?? [];
    if (snap.dxf) {
      layout.dxfOffsetX = snap.dxf.offsetX;
      layout.dxfOffsetY = snap.dxf.offsetY;
      layout.dxfScale = snap.dxf.scale;
      layout.dxfRotation = snap.dxf.rotation;
      layout.dxfVisible = snap.dxf.visible;
      layout.dxfOpacity = snap.dxf.opacity;
    }
    await this.requireLayouts().save(layout);
    await this.record('SF_LINE_LAYOUT_RESTORED', `${m}|${r}`, null, {
      after: { id: snap.id, name: snap.name },
    });
    return this.getLayout(m, r);
  }

  /** Delete a saved version. Returns the remaining versions (newest first). */
  async deleteSnapshot(
    model: string,
    revision = 'A',
    snapshotId = '',
  ): Promise<SnapshotSummary[]> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.findLayout(m, r);
    if (!layout) throw new NotFoundException('Layout no encontrado.');
    const before = layout.snapshots ?? [];
    const after = before.filter((s) => s.id !== snapshotId);
    if (after.length === before.length) {
      throw new NotFoundException('Versión no encontrada.');
    }
    layout.snapshots = after;
    await this.requireLayouts().save(layout);
    return after.map((s) => this.toSnapshotSummary(s)).reverse();
  }

  /** Compare a saved version against the live layout (Fase 17): which stations
   * moved (and how far), which were added/removed, whether the footprint
   * changed, and the flow/equipment/annotation deltas. Read-only. */
  async diffSnapshot(
    model: string,
    revision = 'A',
    snapshotId = '',
  ): Promise<SnapshotDiff> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.findLayout(m, r);
    const snap = layout?.snapshots?.find((s) => s.id === snapshotId);
    if (!layout || !snap) {
      throw new NotFoundException('Versión no encontrada.');
    }
    const cur = await this.getLayout(m, r);
    const nameById = new Map(cur.stations.map((s) => [s.id, s.station]));
    const curPos = new Map(
      cur.stations
        .filter((s) => s.x !== null && s.y !== null)
        .map((s) => [s.id, { x: s.x as number, y: s.y as number }]),
    );
    const snapPos = new Map(
      snap.positions.map((p) => [p.id, { x: p.x, y: p.y }]),
    );

    const moved: { station: string; distance: number }[] = [];
    const added: string[] = [];
    for (const [id, c] of curPos) {
      const s = snapPos.get(id);
      if (!s) {
        added.push(nameById.get(id) ?? id);
        continue;
      }
      const dist = Math.hypot(c.x - s.x, c.y - s.y);
      if (dist > 1) {
        moved.push({ station: nameById.get(id) ?? id, distance: round(dist) });
      }
    }
    const removed: string[] = [];
    for (const [id] of snapPos) {
      if (!curPos.has(id)) removed.push(nameById.get(id) ?? id);
    }
    moved.sort((a, b) => b.distance - a.distance);

    const footprintChanged =
      round(snap.footprint.footprintW) !== round(cur.footprint.footprintW) ||
      round(snap.footprint.footprintH) !== round(cur.footprint.footprintH) ||
      snap.footprint.unit !== cur.footprint.unit ||
      round(snap.footprint.gridSize) !== round(cur.footprint.gridSize);

    return {
      snapshotId: snap.id,
      name: snap.name,
      movedCount: moved.length,
      addedCount: added.length,
      removedCount: removed.length,
      moved,
      added,
      removed,
      footprintChanged,
      connectorsDelta: cur.connectors.length - (snap.connectors?.length ?? 0),
      assetsDelta: cur.assets.length - (snap.assets?.length ?? 0),
      annotationsDelta:
        cur.annotations.length - (snap.annotations?.length ?? 0),
    };
  }

  /** Raw DXF (name + content) for rendering the background — fetched apart so
   * the main layout payload stays light. */
  async getDxf(
    model: string,
    revision = 'A',
  ): Promise<{ name: string; data: string } | null> {
    const layout = await this.findLayout(
      (model ?? '').trim(),
      (revision ?? 'A').trim() || 'A',
    );
    if (!layout?.dxfData) return null;
    return { name: layout.dxfName || 'plano.dxf', data: layout.dxfData };
  }

  /** Upload/replace the DXF background; resets its placement to defaults. */
  async setDxf(dto: UploadDxfDto): Promise<LineLayout> {
    const model = (dto.model ?? '').trim();
    const revision = (dto.revision ?? 'A').trim() || 'A';
    if (!model) throw new BadRequestException('model es obligatorio.');
    if (!dto.data?.trim()) throw new BadRequestException('El DXF está vacío.');
    const layout = await this.ensureLayout(model, revision);
    layout.dxfData = dto.data;
    layout.dxfName = (dto.name || 'plano.dxf').slice(0, 255);
    layout.dxfOffsetX = 0;
    layout.dxfOffsetY = 0;
    layout.dxfScale = 1;
    layout.dxfRotation = 0;
    layout.dxfVisible = true;
    layout.dxfOpacity = 0.5;
    await this.requireLayouts().save(layout);
    await this.record('SF_LINE_LAYOUT_DXF_SET', `${model}|${revision}`, null, {
      after: { model, revision, name: layout.dxfName, bytes: dto.data.length },
    });
    return this.getLayout(model, revision);
  }

  /** Remove the DXF background (data + placement) from the layout. */
  async clearDxf(model: string, revision = 'A'): Promise<LineLayout> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.findLayout(m, r);
    if (layout?.dxfData) {
      layout.dxfData = null;
      layout.dxfName = null;
      layout.dxfOffsetX = 0;
      layout.dxfOffsetY = 0;
      layout.dxfScale = 1;
      layout.dxfRotation = 0;
      layout.dxfVisible = true;
      layout.dxfOpacity = 0.5;
      await this.requireLayouts().save(layout);
      await this.record('SF_LINE_LAYOUT_DXF_CLEARED', `${m}|${r}`, null, {
        after: { model: m, revision: r },
      });
    }
    return this.getLayout(m, r);
  }

  private async scopedStations(
    model: string,
    revision: string,
  ): Promise<SfLineStation[]> {
    const qb = this.stations.createQueryBuilder('s');
    this.applyScope(qb, 's');
    qb.andWhere('s.model = :m', { m: model }).andWhere('s.revision = :r', {
      r: revision,
    });
    return qb.getMany();
  }

  /**
   * Clone a layout from one model+revision onto another (Fase 8). Copies the
   * canvas config (footprint, DXF, equipment, annotations); station positions and
   * flow connectors are remapped by matching station name+line, so revisions of
   * the same model copy fully while different models keep what makes sense.
   */
  async cloneLayout(dto: CloneLayoutDto): Promise<LineLayout> {
    const fromModel = (dto.fromModel ?? '').trim();
    const fromRev = (dto.fromRevision ?? 'A').trim() || 'A';
    const toModel = (dto.toModel ?? '').trim();
    const toRev = (dto.toRevision ?? 'A').trim() || 'A';
    if (!fromModel || !toModel) {
      throw new BadRequestException(
        'Modelo origen y destino son obligatorios.',
      );
    }
    if (fromModel === toModel && fromRev === toRev) {
      throw new BadRequestException('El origen y el destino son el mismo.');
    }

    const source = await this.findLayout(fromModel, fromRev);
    const target = await this.ensureLayout(toModel, toRev);
    const [srcStations, tgtStations] = await Promise.all([
      this.scopedStations(fromModel, fromRev),
      this.scopedStations(toModel, toRev),
    ]);
    const tgtByName = new Map(
      tgtStations.map((s) => [`${s.line}|${s.station}`, s]),
    );
    const srcNameById = new Map(
      srcStations.map((s) => [s.id, `${s.line}|${s.station}`]),
    );

    if (source) {
      target.footprintW = source.footprintW;
      target.footprintH = source.footprintH;
      target.unit = source.unit;
      target.gridSize = source.gridSize;
      target.dxfData = source.dxfData;
      target.dxfName = source.dxfName;
      target.dxfOffsetX = source.dxfOffsetX;
      target.dxfOffsetY = source.dxfOffsetY;
      target.dxfScale = source.dxfScale;
      target.dxfRotation = source.dxfRotation;
      target.dxfVisible = source.dxfVisible;
      target.dxfOpacity = source.dxfOpacity;
      target.assets = source.assets
        ? source.assets.map((a) => ({ ...a }))
        : null;
      target.annotations = source.annotations
        ? source.annotations.map((a) => ({ ...a }))
        : null;
      // Remap connectors by station name → target id (drop unmatched ends).
      const remapped: LayoutConnector[] = [];
      for (const c of source.connectors ?? []) {
        const ft = tgtByName.get(srcNameById.get(c.from) ?? '');
        const tt = tgtByName.get(srcNameById.get(c.to) ?? '');
        if (ft && tt) remapped.push({ from: ft.id, to: tt.id, kind: c.kind });
      }
      target.connectors = remapped;
    }
    await this.requireLayouts().save(target);

    // Copy station positions where a same-named station exists in the target.
    const dirty = new Set<SfLineStation>();
    for (const s of srcStations) {
      if (s.layoutX == null) continue;
      const t = tgtByName.get(`${s.line}|${s.station}`);
      if (!t) continue;
      t.layoutX = s.layoutX;
      t.layoutY = s.layoutY;
      t.layoutW = s.layoutW;
      t.layoutH = s.layoutH;
      t.layoutRotation = s.layoutRotation;
      dirty.add(t);
    }
    if (dirty.size > 0) await this.stations.save([...dirty]);

    await this.record('SF_LINE_LAYOUT_CLONED', `${toModel}|${toRev}`, null, {
      after: { from: `${fromModel}|${fromRev}`, to: `${toModel}|${toRev}` },
    });
    return this.getLayout(toModel, toRev);
  }

  // ── Calculations ───────────────────────────────────────────────────────────

  /** Balance a model's routing against a takt (from demand or explicit target). */
  async balance(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
  }): Promise<
    BalanceResult & {
      completeness: LayoutCompleteness;
      model: string;
      revision: string;
    }
  > {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const result = balanceLine(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        stdTimeSec: Number(s.stdTimeSec),
      })),
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
   * Per-station cycle-time / utilization heatmap for the 2D layout overlay
   * (Fase 9). Pure engineering analysis: it ranks each station's standard time
   * against takt (when demand/time are supplied) or against the line bottleneck,
   * so the layout can be painted with a load ramp and the bottleneck spotted at
   * a glance. Read-only; reuses the routing already on file.
   */
  async getHeatmap(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
  }): Promise<
    HeatmapResult & {
      model: string;
      revision: string;
      updatedAt: string;
      stations: (StationHeat & { line: string })[];
    }
  > {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const heat = stationHeatmap(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        stdTimeSec: Number(s.stdTimeSec),
      })),
      takt,
    );
    const lineByStation = new Map(route.map((s) => [s.station, s.line]));
    return {
      ...heat,
      model: params.model,
      revision,
      updatedAt: new Date().toISOString(),
      stations: heat.stations.map((h) => ({
        ...h,
        line: lineByStation.get(h.station) ?? '',
      })),
    };
  }

  /**
   * Per-station documentation readiness (Fase 19): which stations declare a
   * part number, use factor and visual aid — the "is this line ready to run?"
   * gate, station by station, for the layout overlay. Read-only.
   */
  async getCompleteness(
    model: string,
    revision = 'A',
  ): Promise<
    StationCompletenessResult & {
      model: string;
      revision: string;
      stations: (StationCompletenessRow & { line: string })[];
    }
  > {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const route = await this.routing(m, r);
    const result = stationCompleteness(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        npExpected: s.npExpected,
        useFactor: s.useFactor === null ? null : Number(s.useFactor),
        visualAidUrl: s.visualAidUrl,
        ctq: !!s.ctq,
      })),
    );
    const lineByStation = new Map(route.map((s) => [s.station, s.line]));
    return {
      ...result,
      model: m,
      revision: r,
      stations: result.stations.map((s) => ({
        ...s,
        line: lineByStation.get(s.station) ?? '',
      })),
    };
  }

  /**
   * Manning / staffing estimate (Fase 16): how many operators each station and
   * the whole line need to hold takt. A station whose cycle exceeds takt needs
   * parallel operators (⌈cycle/takt⌉). Read-only; reuses the routing on file.
   */
  async getStaffing(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
  }): Promise<
    StaffingResult & {
      model: string;
      revision: string;
      stations: (StationStaffing & { line: string })[];
    }
  > {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const plan = staffingPlan(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        stdTimeSec: Number(s.stdTimeSec),
      })),
      takt,
    );
    const lineByStation = new Map(route.map((s) => [s.station, s.line]));
    return {
      ...plan,
      model: params.model,
      revision,
      stations: plan.stations.map((s) => ({
        ...s,
        line: lineByStation.get(s.station) ?? '',
      })),
    };
  }

  /**
   * WIP / decoupling-buffer plan for the line (Fase 33). Read-only: sizes the
   * inventory to hold between consecutive stations so a stoppage on one doesn't
   * immediately starve/block its neighbour, and reports the total decoupling WIP
   * plus the lead time it adds (Little's law). Pure math via `bufferPlan`.
   */
  async getBufferPlan(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
    coverageSec?: number;
  }): Promise<BufferPlan & { model: string; revision: string }> {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const plan = bufferPlan(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        cycleTimeSec: Number(s.stdTimeSec),
      })),
      {
        taktSec: takt,
        coverageSec:
          params.coverageSec && params.coverageSec > 0
            ? params.coverageSec
            : undefined,
      },
    );
    return { ...plan, model: params.model, revision };
  }

  /**
   * Operator-loop balancing for the line (Fase 34). Read-only: greedily packs
   * consecutive stations into operator loops capped at the takt, answering "how
   * few operators run this line if one can tend several quick adjacent stations"
   * — the assignment complement to per-station staffing. Pure via `balanceLoops`.
   */
  async getOperatorLoops(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
  }): Promise<LoopPlan & { model: string; revision: string }> {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const plan = balanceLoops(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        cycleTimeSec: Number(s.stdTimeSec),
      })),
      { taktSec: takt },
    );
    return { ...plan, model: params.model, revision };
  }

  /**
   * Unit-economics estimate for the layout (Fase 35). Read-only: combines the
   * manning (staffing), takt, floor area and equipment count with the rates the
   * planner supplies into a cost-per-unit split across labor, space and
   * amortized capex — so two candidate layouts can be compared on cost. Pure
   * arithmetic via `costModel`.
   */
  async getCostModel(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
    rates?: CostRates;
  }): Promise<
    CostModel & {
      model: string;
      revision: string;
      operatorCount: number;
      stationCount: number;
      assetCount: number;
      footprintAreaM2: number;
    }
  > {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const staffing = staffingPlan(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        stdTimeSec: Number(s.stdTimeSec),
      })),
      takt,
    );
    const layout = await this.getLayout(params.model, revision);
    const footprintAreaM2 = areaToM2(
      layout.footprint.footprintW * layout.footprint.footprintH,
      layout.footprint.unit,
    );
    const cost = costModel(
      {
        operatorCount: staffing.totalOperators,
        taktSec: takt,
        footprintAreaM2,
        assetCount: layout.assets.length,
        stationCount: route.length,
      },
      params.rates ?? {},
    );
    return {
      ...cost,
      model: params.model,
      revision,
      operatorCount: staffing.totalOperators,
      stationCount: route.length,
      assetCount: layout.assets.length,
      footprintAreaM2: round(footprintAreaM2, 2),
    };
  }

  /**
   * Demand-sensitivity sweep for the layout (Fase 36). Read-only: walks a range
   * of demand around the planned point and reports, at each level, takt,
   * operators, feasibility and unit cost — showing how the layout scales, where
   * an extra operator must step in and the demand ceiling. Pure via
   * `sensitivityCurve`.
   */
  async getSensitivity(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    steps?: number;
    rates?: CostRates;
  }): Promise<SensitivityResult & { model: string; revision: string }> {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const availableTimeSec =
      params.availableTimeSec && params.availableTimeSec > 0
        ? params.availableTimeSec
        : 28800; // default 8 h shift
    const centerDemand =
      params.demandUnits && params.demandUnits > 0 ? params.demandUnits : 400;
    const layout = await this.getLayout(params.model, revision);
    const footprintAreaM2 = areaToM2(
      layout.footprint.footprintW * layout.footprint.footprintH,
      layout.footprint.unit,
    );
    const result = sensitivityCurve(
      route.map((s) => ({
        station: s.station,
        sequence: s.sequence,
        stdTimeSec: Number(s.stdTimeSec),
      })),
      {
        availableTimeSec,
        demands: demandSweep(centerDemand, params.steps ?? 9),
        footprintAreaM2,
        assetCount: layout.assets.length,
        rates: params.rates ?? {},
      },
    );
    return { ...result, model: params.model, revision };
  }

  /**
   * Compact analytics bundle for one layout (Fase 37) — readiness, floor use,
   * flow, validation, balance, manning and cost — used by the scenario
   * comparison. Manning/cost degrade to null when the model has no routing.
   */
  private async layoutKpis(
    model: string,
    revision: string,
    opts: {
      availableTimeSec?: number;
      demandUnits?: number;
      taktTargetSec?: number;
      rates?: CostRates;
    },
  ): Promise<LayoutKpis> {
    const report = await this.getLayoutReport(model, revision);
    let operators: number | null = null;
    let costPerUnit: number | null = null;
    try {
      const staffing = await this.getStaffing({
        model,
        revision,
        availableTimeSec: opts.availableTimeSec,
        demandUnits: opts.demandUnits,
        taktTargetSec: opts.taktTargetSec,
      });
      operators = staffing.totalOperators;
    } catch {
      operators = null;
    }
    try {
      const cost = await this.getCostModel({
        model,
        revision,
        availableTimeSec: opts.availableTimeSec,
        demandUnits: opts.demandUnits,
        taktTargetSec: opts.taktTargetSec,
        rates: opts.rates,
      });
      costPerUnit = cost.totalCostPerUnit;
    } catch {
      costPerUnit = null;
    }
    return {
      model,
      revision,
      stations: report.stations.total,
      placed: report.stations.placed,
      readinessPct: report.stations.readinessPct,
      utilizationPct: report.space.utilizationPct,
      assetCount: report.space.assetCount,
      flowDistance: report.flow.totalDistance,
      crossings: report.flow.crossings,
      overlaps: report.validation.overlaps,
      outOfBounds: report.validation.outOfBounds,
      // balancePct is a 0..1 fraction in the report → percent for display.
      balancePct: report.balance
        ? round(report.balance.balancePct * 100, 1)
        : null,
      bottleneckStation: report.balance?.bottleneckStation ?? null,
      lineCycleTimeSec: report.balance?.lineCycleTimeSec ?? null,
      operators,
      costPerUnit,
    };
  }

  /**
   * Head-to-head scenario comparison of two layouts (Fase 37). Read-only: pits
   * two (model, revision) scopes against each other across the KPI suite,
   * scoring each metric for the better side and returning an overall verdict —
   * the capstone that turns the analytics into a layout decision. Pure scoring
   * via `compareLayouts`.
   */
  async getComparison(params: {
    modelA: string;
    revisionA?: string;
    modelB: string;
    revisionB?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
    rates?: CostRates;
  }): Promise<LayoutComparison> {
    const mA = (params.modelA ?? '').trim();
    const mB = (params.modelB ?? '').trim();
    if (!mA || !mB) {
      throw new BadRequestException('modelA y modelB son obligatorios.');
    }
    const opts = {
      availableTimeSec: params.availableTimeSec,
      demandUnits: params.demandUnits,
      taktTargetSec: params.taktTargetSec,
      rates: params.rates,
    };
    const [a, b] = await Promise.all([
      this.layoutKpis(mA, (params.revisionA ?? 'A').trim() || 'A', opts),
      this.layoutKpis(mB, (params.revisionB ?? 'A').trim() || 'A', opts),
    ]);
    return compareLayouts(a, b);
  }

  /**
   * Standard Work Combination Table for the line (Fase 38). Read-only: takes
   * the operator loops (manual time) and layers the WALK between the placed
   * stations of each loop, combining manual + walk against takt — surfacing
   * loops that hold takt on paper but bust it once walking is counted. Pure via
   * `standardWork`.
   */
  async getStandardWork(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
    walkSpeedMps?: number;
  }): Promise<
    StdWorkResult & { model: string; revision: string; unit: string }
  > {
    const revision = params.revision ?? 'A';
    const route = await this.routing(params.model, revision);
    if (route.length === 0) {
      throw new NotFoundException(
        `Sin ruteo para ${params.model} rev ${revision}.`,
      );
    }
    const takt =
      params.taktTargetSec && params.taktTargetSec > 0
        ? params.taktTargetSec
        : computeTaktSec(params.availableTimeSec ?? 0, params.demandUnits ?? 0);
    const layout = await this.getLayout(params.model, revision);
    const defW = layout.footprint.footprintW * 0.06;
    const defH = layout.footprint.footprintH * 0.08;
    const posByStation = new Map(layout.stations.map((s) => [s.station, s]));
    const stations = route.map((s) => {
      const p = posByStation.get(s.station);
      const placed = !!p && p.x !== null && p.y !== null;
      return {
        station: s.station,
        sequence: s.sequence,
        manualSec: Number(s.stdTimeSec),
        cx: placed ? (p.x as number) + (p.w ?? defW) / 2 : null,
        cy: placed ? (p.y as number) + (p.h ?? defH) / 2 : null,
      };
    });
    const result = standardWork(stations, {
      taktSec: takt,
      walkSpeedMps: params.walkSpeedMps,
      metersPerUnit: unitToMeters(layout.footprint.unit),
    });
    return {
      ...result,
      model: params.model,
      revision,
      unit: layout.footprint.unit,
    };
  }

  /**
   * Portable layout dossier (Fase 39). Read-only: consolidates the report (F14)
   * with manning, cost and a per-station table into one object, plus a
   * spreadsheet-ready CSV of the stations — so the whole computed picture of a
   * layout can be handed off (Excel, a report, management) in one download.
   * Manning/cost degrade to null when the model has no routing.
   */
  async getDossier(params: {
    model: string;
    revision?: string;
    availableTimeSec?: number;
    demandUnits?: number;
    taktTargetSec?: number;
    rates?: CostRates;
  }): Promise<LayoutDossier> {
    const model = (params.model ?? '').trim();
    const revision = (params.revision ?? 'A').trim() || 'A';
    if (!model) throw new BadRequestException('model es obligatorio.');

    const [report, completeness, layout, route] = await Promise.all([
      this.getLayoutReport(model, revision),
      this.getCompleteness(model, revision),
      this.getLayout(model, revision),
      this.routing(model, revision),
    ]);

    let staffing: LayoutDossier['staffing'] = null;
    let cost: LayoutDossier['cost'] = null;
    try {
      const st = await this.getStaffing({
        model,
        revision,
        availableTimeSec: params.availableTimeSec,
        demandUnits: params.demandUnits,
        taktTargetSec: params.taktTargetSec,
      });
      staffing = {
        totalOperators: st.totalOperators,
        avgUtilizationPct: st.avgUtilizationPct,
      };
    } catch {
      staffing = null;
    }
    try {
      const c = await this.getCostModel({
        model,
        revision,
        availableTimeSec: params.availableTimeSec,
        demandUnits: params.demandUnits,
        taktTargetSec: params.taktTargetSec,
        rates: params.rates,
      });
      cost = {
        totalCostPerUnit: c.totalCostPerUnit,
        laborCostPerUnit: c.laborCostPerUnit,
        spaceCostPerUnit: c.spaceCostPerUnit,
        capexPerUnit: c.capexPerUnit,
        monthlyVolume: c.monthlyVolume,
        throughputPerHour: c.throughputPerHour,
      };
    } catch {
      cost = null;
    }

    const placedSet = new Set(
      layout.stations
        .filter((s) => s.x !== null && s.y !== null)
        .map((s) => s.station),
    );
    const cycleByStation = new Map(
      route.map((s) => [s.station, Number(s.stdTimeSec) || 0]),
    );
    const seqByStation = new Map(route.map((s) => [s.station, s.sequence]));
    const lineByStation = new Map(route.map((s) => [s.station, s.line]));
    const stations: DossierStationRow[] = completeness.stations.map((s) => ({
      station: s.station,
      line: lineByStation.get(s.station) ?? '',
      sequence: seqByStation.get(s.station) ?? 0,
      cycleTimeSec: cycleByStation.get(s.station) ?? 0,
      hasNp: s.hasNp,
      hasUseFactor: s.hasUseFactor,
      hasVisualAid: s.hasVisualAid,
      complete: s.complete,
      placed: placedSet.has(s.station),
    }));

    const completenessPct =
      completeness.total > 0
        ? round((completeness.complete / completeness.total) * 100, 1)
        : 0;

    return {
      generatedAt: new Date().toISOString(),
      model,
      revision,
      unit: layout.footprint.unit,
      report,
      staffing,
      cost,
      completeness: {
        total: completeness.total,
        complete: completeness.complete,
        completenessPct,
        missingVisualAid: completeness.missingVisualAid,
      },
      stations,
      csv: dossierStationsToCsv(stations),
    };
  }

  /**
   * Flex-line (multi-model) analysis (Fase 40). Read-only: finds every model
   * that runs on a physical line and measures how much they SHARE — the common
   * station backbone vs each model's changeover-specific stations — plus each
   * model's line cycle. The line can be given directly, or derived from a model
   * (its routing's line). Pure set math via `flexLineAnalysis`.
   */
  async getFlexLine(params: {
    line?: string;
    model?: string;
    revision?: string;
  }): Promise<FlexLineResult> {
    let line = (params.line ?? '').trim();
    // Derive the line from a model's routing when not given directly.
    if (!line && params.model) {
      const route = await this.routing(
        params.model.trim(),
        (params.revision ?? 'A').trim() || 'A',
      );
      line = route[0]?.line ?? '';
    }
    if (!line) {
      throw new BadRequestException('line (o model) es obligatorio.');
    }

    // Distinct (model, revision) pairs with active stations on this line.
    const pairsQb = this.stations.createQueryBuilder('s');
    this.applyScope(pairsQb, 's');
    pairsQb
      .select('s.model', 'model')
      .addSelect('s.revision', 'revision')
      .andWhere('s.line = :line', { line })
      .andWhere('s.active = :a', { a: true })
      .groupBy('s.model')
      .addGroupBy('s.revision')
      .orderBy('s.model', 'ASC')
      .addOrderBy('s.revision', 'ASC');
    const pairs = await pairsQb.getRawMany<{
      model: string;
      revision: string;
    }>();

    const routes = await Promise.all(
      pairs.map(async (p) => {
        const route = await this.routing(p.model, p.revision || 'A');
        const bottleneckSec = route.reduce(
          (m, s) => Math.max(m, Number(s.stdTimeSec) || 0),
          0,
        );
        return {
          model: p.model,
          revision: p.revision || 'A',
          stations: route.map((s) => s.station),
          bottleneckSec,
        };
      }),
    );

    return flexLineAnalysis(line, routes);
  }

  /**
   * Material-flow "spaghetti diagram" for the 2D layout (Fase 10). Read-only
   * geometry: it takes the placed stations and the flow connectors already on
   * the plan and measures how far material travels, the longest hop, and how
   * many flow lines cross (the tangle). Pure math via `flowAnalysis`.
   */
  async getFlowAnalysis(
    model: string,
    revision = 'A',
  ): Promise<FlowAnalysis & { model: string; revision: string; unit: string }> {
    const layout = await this.getLayout(model, revision);
    const halfW = layout.footprint.footprintW * 0.03; // = (W*0.06)/2 default box
    const halfH = layout.footprint.footprintH * 0.04; // = (H*0.08)/2 default box
    const nodes = layout.stations
      .filter((s) => s.x !== null && s.y !== null)
      .map((s) => ({
        id: s.id,
        station: s.station,
        x: (s.x as number) + (s.w !== null ? s.w / 2 : halfW),
        y: (s.y as number) + (s.h !== null ? s.h / 2 : halfH),
      }));
    const analysis = flowAnalysis(nodes, layout.connectors);
    return {
      ...analysis,
      model,
      revision,
      unit: layout.footprint.unit,
    };
  }

  /**
   * Flow-direction / back-tracking analysis (Fase 21). Measures how much the
   * material advances vs. travels back against the net first→last direction
   * along the routing order, and lists the hops that back-track. Read-only.
   */
  async getFlowDirection(
    model: string,
    revision = 'A',
  ): Promise<
    FlowDirectionResult & { model: string; revision: string; unit: string }
  > {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.getLayout(m, r);
    const defW = layout.footprint.footprintW * 0.03;
    const defH = layout.footprint.footprintH * 0.04;
    const placed = layout.stations
      .filter((s) => s.x !== null && s.y !== null)
      .map((s) => ({
        station: s.station,
        sequence: s.sequence,
        cx: (s.x as number) + (s.w !== null ? s.w / 2 : defW),
        cy: (s.y as number) + (s.h !== null ? s.h / 2 : defH),
      }));
    const result = flowDirection(placed);
    return { ...result, model: m, revision: r, unit: layout.footprint.unit };
  }

  /**
   * Inter-cell flow analysis (Fase 28): splits the material flow into intra-cell
   * vs inter-cell (crossing cell boundaries) using the cells and connectors on
   * the plan, and reports the share that crosses boundaries. Read-only.
   */
  async getCellFlow(
    model: string,
    revision = 'A',
  ): Promise<
    CellFlowResult & {
      model: string;
      revision: string;
      unit: string;
      cellCount: number;
      interSegments: { from: string; to: string; distance: number }[];
    }
  > {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.getLayout(m, r);
    const defW = layout.footprint.footprintW * 0.03;
    const defH = layout.footprint.footprintH * 0.04;
    const cellOf = new Map<string, string>();
    for (const cell of layout.cells) {
      for (const sid of cell.stationIds) cellOf.set(sid, cell.id);
    }
    const nameById = new Map(layout.stations.map((s) => [s.id, s.station]));
    const nodes = layout.stations
      .filter((s) => s.x !== null && s.y !== null)
      .map((s) => ({
        id: s.id,
        cellId: cellOf.get(s.id) ?? null,
        cx: (s.x as number) + (s.w !== null ? s.w / 2 : defW),
        cy: (s.y as number) + (s.h !== null ? s.h / 2 : defH),
      }));
    const result = cellFlow(nodes, layout.connectors);
    return {
      ...result,
      model: m,
      revision: r,
      unit: layout.footprint.unit,
      cellCount: layout.cells.length,
      interSegments: result.interSegments.map((seg) => ({
        from: nameById.get(seg.from) ?? seg.from,
        to: nameById.get(seg.to) ?? seg.to,
        distance: seg.distance,
      })),
    };
  }

  /**
   * Layout validation (Fase 11): does the plan physically work? Checks placed
   * stations and equipment for overlaps, optional minimum clearance (aisles /
   * safety) and out-of-bounds placement. Read-only oriented-bounding-box
   * geometry via `layoutCollisions` — rotation aware.
   */
  async getCollisions(
    model: string,
    revision = 'A',
    minClearance = 0,
  ): Promise<
    CollisionResult & {
      model: string;
      revision: string;
      unit: string;
      minClearance: number;
    }
  > {
    const layout = await this.getLayout(model, revision);
    const defW = layout.footprint.footprintW * 0.06;
    const defH = layout.footprint.footprintH * 0.08;
    const boxes: RectBox[] = [];
    for (const s of layout.stations) {
      if (s.x === null || s.y === null) continue;
      const w = s.w ?? defW;
      const h = s.h ?? defH;
      boxes.push({
        id: s.id,
        label: s.station,
        kind: 'station',
        cx: s.x + w / 2,
        cy: s.y + h / 2,
        w,
        h,
        angle: s.rotation ?? 0,
      });
    }
    for (const a of layout.assets) {
      boxes.push({
        id: a.id,
        label: a.label || a.kind,
        kind: 'asset',
        cx: a.x + a.w / 2,
        cy: a.y + a.h / 2,
        w: a.w,
        h: a.h,
        angle: a.rotation ?? 0,
      });
    }
    const result = layoutCollisions(boxes, {
      footprintW: layout.footprint.footprintW,
      footprintH: layout.footprint.footprintH,
      minClearance,
    });
    return {
      ...result,
      model,
      revision,
      unit: layout.footprint.unit,
      minClearance: Math.max(0, minClearance),
    };
  }

  /**
   * Auto-arrange (Fase 12): suggest serpentine positions for every station in
   * routing order, packed into the footprint. Read-only — it returns positions
   * for the editor to apply; the engineer reviews and saves. Existing box sizes
   * are preserved; only placement changes.
   */
  async autoArrangeLayout(
    model: string,
    revision = 'A',
    opts: { margin?: number; gap?: number; serpentine?: boolean } = {},
  ): Promise<{
    model: string;
    revision: string;
    positions: ArrangedPosition[];
  }> {
    const layout = await this.getLayout(model, revision);
    const positions = autoArrange(
      layout.stations.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        w: s.w,
        h: s.h,
      })),
      layout.footprint,
      opts,
    );
    return { model, revision, positions };
  }

  /**
   * Flow-layout optimization (Fase 23): suggest a station ORDER that minimizes
   * total material travel over the flow graph (connectors, or the routing chain
   * when there are none), then repack the real boxes in that order with the
   * serpentine auto-arrange. Read-only — returns positions for the editor to
   * apply; the engineer reviews and saves.
   */
  async optimizeLayout(
    model: string,
    revision = 'A',
  ): Promise<{
    model: string;
    revision: string;
    unit: string;
    positions: ArrangedPosition[];
    costBefore: number;
    costAfter: number;
    improvedPct: number;
  }> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.getLayout(m, r);
    const fp = layout.footprint;
    const sorted = [...layout.stations].sort((a, b) => a.sequence - b.sequence);

    // Uniform candidate slots (so they're interchangeable): pack max-sized boxes.
    const defW = Math.round(fp.footprintW * 0.06);
    const defH = Math.round(fp.footprintH * 0.08);
    const slotW = Math.max(defW, ...sorted.map((s) => s.w ?? defW), 1);
    const slotH = Math.max(defH, ...sorted.map((s) => s.h ?? defH), 1);
    const uniform = autoArrange(
      sorted.map((s) => ({
        id: s.id,
        sequence: s.sequence,
        w: slotW,
        h: slotH,
      })),
      fp,
    );
    const centerById = new Map(
      uniform.map((p) => [p.id, { cx: p.x + slotW / 2, cy: p.y + slotH / 2 }]),
    );
    const slots = sorted.map((s) => centerById.get(s.id) ?? { cx: 0, cy: 0 });

    // Flow edges: real connectors if any, else the consecutive routing chain.
    const present = new Set(sorted.map((s) => s.id));
    let edges = layout.connectors
      .filter((c) => present.has(c.from) && present.has(c.to))
      .map((c) => ({ from: c.from, to: c.to }));
    if (edges.length === 0) {
      edges = [];
      for (let i = 0; i < sorted.length - 1; i += 1) {
        edges.push({ from: sorted[i].id, to: sorted[i + 1].id });
      }
    }

    const opt = optimizeFlowOrder(
      sorted.map((s) => ({ id: s.id, sequence: s.sequence })),
      slots,
      edges,
    );

    // Repack the real (own-sized) boxes in the optimized order.
    const sizeById = new Map(sorted.map((s) => [s.id, { w: s.w, h: s.h }]));
    const positions = autoArrange(
      opt.order.map((id, idx) => ({
        id,
        sequence: idx,
        w: sizeById.get(id)?.w ?? null,
        h: sizeById.get(id)?.h ?? null,
      })),
      fp,
    );

    return {
      model: m,
      revision: r,
      unit: fp.unit,
      positions,
      costBefore: opt.costBefore,
      costAfter: opt.costAfter,
      improvedPct: opt.improvedPct,
    };
  }

  /**
   * Consolidated read-only layout dossier (Fase 14): a one-look summary an
   * engineer reviews before signing off — placement readiness, floor-space
   * utilization, material flow, physical conflicts and line balance. Pure
   * aggregation over the analyses already on file; writes nothing.
   */
  async getLayoutReport(model: string, revision = 'A'): Promise<LayoutReport> {
    const m = (model ?? '').trim();
    const r = (revision ?? 'A').trim() || 'A';
    const layout = await this.getLayout(m, r);
    const fp = layout.footprint;
    const defW = fp.footprintW * 0.06;
    const defH = fp.footprintH * 0.08;

    const total = layout.stations.length;
    const placedStations = layout.stations.filter(
      (s) => s.x !== null && s.y !== null,
    );
    const placed = placedStations.length;
    const stationArea = placedStations.reduce(
      (a, s) => a + (s.w ?? defW) * (s.h ?? defH),
      0,
    );
    const assetArea = layout.assets.reduce((a, x) => a + x.w * x.h, 0);
    const footprintArea = fp.footprintW * fp.footprintH;
    const occupiedArea = stationArea + assetArea;

    const [flow, collisions] = await Promise.all([
      this.getFlowAnalysis(m, r),
      this.getCollisions(m, r, 0),
    ]);

    const route = await this.routing(m, r);
    const balanceResult =
      route.length > 0
        ? balanceLine(
            route.map((s) => ({
              station: s.station,
              sequence: s.sequence,
              stdTimeSec: Number(s.stdTimeSec),
            })),
            0,
          )
        : null;

    return {
      model: m,
      revision: r,
      unit: fp.unit,
      stations: {
        total,
        placed,
        unplaced: total - placed,
        readinessPct: total > 0 ? round((placed / total) * 100, 1) : 0,
      },
      space: {
        footprintArea: round(footprintArea),
        occupiedArea: round(occupiedArea),
        utilizationPct:
          footprintArea > 0
            ? round((occupiedArea / footprintArea) * 100, 1)
            : 0,
        assetCount: layout.assets.length,
      },
      flow: {
        totalDistance: flow.totalDistance,
        longestSegment: flow.longestSegment?.distance ?? 0,
        crossings: flow.crossings,
        connectorCount: flow.segmentCount,
      },
      validation: {
        overlaps: collisions.overlaps,
        outOfBounds: collisions.outOfBounds,
        ok: collisions.ok,
      },
      balance: balanceResult
        ? {
            balancePct: balanceResult.balancePct,
            bottleneckStation: balanceResult.bottleneckStation,
            lineCycleTimeSec: balanceResult.lineCycleTimeSec,
            stationCount: balanceResult.stationCount,
          }
        : null,
    };
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
    qb.andWhere('q.model = :m', { m: params.model }).andWhere('q.line = :l', {
      l: params.line,
    });
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
      const takt =
        list
          .map(
            (s) =>
              quals.find((q) => q.model === s.model && q.taktTargetSec > 0)
                ?.taktTargetSec ?? 0,
          )
          .find((t) => t > 0) ?? 0;
      const res = balanceLine(
        list.map((s) => ({
          station: s.station,
          sequence: s.sequence,
          stdTimeSec: Number(s.stdTimeSec),
        })),
        takt,
      );
      if (res.balancePct >= BALANCE_OK && res.stationsOverTakt.length === 0)
        modelsBalanced++;
      const comp = layoutCompleteness(
        list.map((s) => ({
          npExpected: s.npExpected,
          useFactor: Number(s.useFactor),
          visualAidUrl: s.visualAidUrl,
          ctq: !!s.ctq,
        })),
      );
      if (comp.incompleteStations > 0) incompleteLayouts++;
    }

    return {
      stationsTotal: active.length,
      stationsWithVisualAid,
      pctVisualAid: active.length
        ? round(stationsWithVisualAid / active.length, 4)
        : 0,
      modelsQualified: quals.filter((q) => q.active).length,
      modelsBalanced,
      pctModelsBalanced: groups.size
        ? round(modelsBalanced / groups.size, 4)
        : 0,
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

const APPROVAL_LABEL: Record<string, string> = {
  draft: 'borrador',
  in_review: 'en revisión',
  approved: 'aprobado',
};

/** Turn a stored ledger event into a human-readable timeline entry (Fase 32). */
function toHistoryEntry(e: LedgerEvent): LayoutHistoryEntry {
  const after = (e.metadata?.afterState ?? {}) as Record<string, unknown>;
  const { title, detail, kind } = describeLayoutEvent(e.action, after);
  const at =
    e.timestamp instanceof Date
      ? e.timestamp.toISOString()
      : String(e.timestamp ?? '');
  return {
    id: e.id,
    action: e.action,
    kind,
    actor: e.actorName || 'anónimo',
    at,
    title,
    detail,
  };
}

/** Stringify a ledger after-state field that is typed `unknown`, without
 * stringifying objects (keeps the no-base-to-string lint honest). */
function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

/** Map a layout event action + its recorded after-state to a Spanish summary. */
function describeLayoutEvent(
  action: string,
  after: Record<string, unknown>,
): { title: string; detail: string; kind: LayoutHistoryKind } {
  switch (action) {
    case 'SF_LINE_LAYOUT_SAVED': {
      const placed = Math.max(0, Math.floor(Number(after.placed) || 0));
      const cleared = Math.max(0, Math.floor(Number(after.cleared) || 0));
      const parts: string[] = [];
      if (placed) parts.push(`${placed} colocada${placed === 1 ? '' : 's'}`);
      if (cleared) parts.push(`${cleared} retirada${cleared === 1 ? '' : 's'}`);
      return {
        title: 'Guardó el layout',
        detail: parts.join(' · ') || 'sin cambios de posición',
        kind: 'save',
      };
    }
    case 'SF_LINE_LAYOUT_APPROVAL': {
      const status = asText(after.status).toLowerCase();
      const label = APPROVAL_LABEL[status] ?? status ?? '—';
      return {
        title: `Cambió aprobación a ${label}`,
        detail: '',
        kind: 'approval',
      };
    }
    case 'SF_LINE_LAYOUT_SNAPSHOT':
      return {
        title: 'Creó un snapshot',
        detail: asText(after.name),
        kind: 'snapshot',
      };
    case 'SF_LINE_LAYOUT_RESTORED':
      return {
        title: 'Restauró un snapshot',
        detail: asText(after.name),
        kind: 'restore',
      };
    case 'SF_LINE_LAYOUT_DXF_SET': {
      const name = asText(after.name);
      const bytes = Math.max(0, Math.floor(Number(after.bytes) || 0));
      const detail = [name, bytes ? `${(bytes / 1024).toFixed(0)} KB` : '']
        .filter(Boolean)
        .join(' · ');
      return { title: 'Cargó un plano DXF', detail, kind: 'dxf' };
    }
    case 'SF_LINE_LAYOUT_DXF_CLEARED':
      return { title: 'Quitó el plano DXF', detail: '', kind: 'dxf' };
    case 'SF_LINE_LAYOUT_CLONED': {
      const from = asText(after.from);
      return {
        title: 'Clonó el layout',
        detail: from ? `desde ${from}` : '',
        kind: 'clone',
      };
    }
    default:
      return { title: action, detail: '', kind: 'other' };
  }
}

/** Coerce to a positive finite number, falling back to `fallback` otherwise. */
function clampPos(n: number, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
