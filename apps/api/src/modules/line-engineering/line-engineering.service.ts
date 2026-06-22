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
} from './entities/sf-line-layout.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
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
} from './line-balance';
import { flowAnalysis, FlowAnalysis } from './line-flow';

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

export interface LineLayout {
  model: string;
  revision: string;
  footprint: LayoutFootprint;
  stations: LayoutStation[];
  dxf: LayoutDxf | null;
  connectors: LayoutConnector[];
  assets: LayoutAsset[];
  annotations: LayoutAnnotation[];
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
    };
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
      dto.annotations
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

/** Coerce to a positive finite number, falling back to `fallback` otherwise. */
function clampPos(n: number, fallback: number): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
