import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { FinWoCostSnapshot } from './entities/fin-wo-cost-snapshot.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import { CostRollupService } from '../cost-rollup/cost-rollup.service';
import { CostCategory } from '../cost-rollup/entities/cost-item.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateSnapshotDto } from './dto/cost-intelligence.dto';
import {
  computeCogs,
  DEFAULT_LABOR_RATE,
  DEFAULT_OVERHEAD_RATE,
  LaborSource,
  materialActualCost,
  materialPlanCost,
  OverheadSource,
  PartVariance,
  roundCurrency,
  round,
  scrapFromHolds,
  standardLaborHours,
  unitCost as unitCostOf,
  usageVarianceByPart,
} from './cogs-math';

export interface CostingRates {
  laborRate: number;
  overheadRate: number;
}

export interface WoCogs {
  woId: string;
  woFolio: string | null;
  model: string;
  line: string;
  programId: string | null;
  customer: string | null;
  status: string;
  quantityPlanned: number;
  quantityCompleted: number;
  materialCost: number;
  laborCost: number;
  laborSource: LaborSource;
  overheadCost: number;
  overheadSource: OverheadSource;
  cogs: number;
  unitCost: number;
  standardLaborHours: number;
  laborRate: number;
  overheadRate: number;
  currency: string;
}

export interface ProgramCogs {
  programId: string;
  workOrders: WoCogs[];
  totals: {
    count: number;
    quantityPlanned: number;
    quantityCompleted: number;
    materialCost: number;
    laborCost: number;
    overheadCost: number;
    cogs: number;
    unitCost: number;
  };
  currency: string;
}

export interface WoVariance {
  woId: string;
  woFolio: string | null;
  model: string;
  programId: string | null;
  quantityPlanned: number;
  quantityCompleted: number;
  materialPlanCost: number;
  materialActualCost: number;
  materialUsageVariance: number;
  usageVariancePct: number;
  scrapQty: number;
  scrapCost: number;
  totalVariance: number;
  byPart: PartVariance[];
  currency: string;
}

const CURRENCY = 'USD';

@Injectable()
export class CostIntelligenceService {
  private readonly logger = new Logger(CostIntelligenceService.name);

  constructor(
    @Inject(getTenantRepositoryToken(FinWoCostSnapshot))
    private readonly snapshots: TenantScopedRepository<FinWoCostSnapshot>,
    @InjectRepository(SfConsumptionEvent)
    private readonly consumption: Repository<SfConsumptionEvent>,
    @InjectRepository(SfQualityHold)
    private readonly holds: Repository<SfQualityHold>,
    @InjectRepository(MaterialMaster)
    private readonly materials: Repository<MaterialMaster>,
    private readonly tenantCtx: TenantContextService,
    private readonly plan: ProductionPlanService,
    private readonly lineEng: LineEngineeringService,
    private readonly costRollup: CostRollupService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  // ── Scoping ──────────────────────────────────────────────────────────────────
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

  private resolveRates(rates?: Partial<CostingRates>): CostingRates {
    return {
      laborRate:
        rates?.laborRate !== undefined && rates.laborRate >= 0
          ? Number(rates.laborRate)
          : DEFAULT_LABOR_RATE,
      overheadRate:
        rates?.overheadRate !== undefined && rates.overheadRate >= 0
          ? Number(rates.overheadRate)
          : DEFAULT_OVERHEAD_RATE,
    };
  }

  // ── Data loaders (read-only across the floor) ───────────────────────────────
  private async consumptionForWo(woId: string): Promise<SfConsumptionEvent[]> {
    const qb = this.consumption.createQueryBuilder('e');
    this.applyScope(qb, 'e');
    qb.andWhere('e.wo_id = :w', { w: woId });
    return qb.getMany();
  }

  private async holdsForWo(woId: string): Promise<SfQualityHold[]> {
    const qb = this.holds.createQueryBuilder('h');
    this.applyScope(qb, 'h');
    qb.andWhere('h.wo_id = :w', { w: woId });
    return qb.getMany();
  }

  /** Batch-load standard cost (master data, global) for a set of part numbers. */
  private async stdCostMap(parts: Array<string | null>): Promise<Map<string, number>> {
    const unique = Array.from(new Set(parts.filter((p): p is string => !!p)));
    if (unique.length === 0) return new Map();
    const rows = await this.materials.find({ where: { partNumber: In(unique) } });
    return new Map<string, number>(
      rows.map((m): [string, number] => [m.partNumber, Number(m.standardCost ?? 0)]),
    );
  }

  /** Reuse cost-rollup for recorded labor/overhead actuals (by WO folio). */
  private async rollupActuals(
    folio: string | null,
  ): Promise<{ labor: number; overhead: number }> {
    if (!folio) return { labor: 0, overhead: 0 };
    try {
      const rollup = await this.costRollup.getRollup({ workOrderId: folio });
      const amount = (cat: CostCategory) =>
        rollup.breakdown.find((b) => b.category === cat)?.amount ?? 0;
      return {
        labor: amount(CostCategory.LABOR),
        overhead: amount(CostCategory.OVERHEAD) + amount(CostCategory.ENERGY),
      };
    } catch (err) {
      this.logger.debug(`Cost rollup skipped for ${folio}: ${(err as Error)?.message}`);
      return { labor: 0, overhead: 0 };
    }
  }

  // ── COGS (live) ──────────────────────────────────────────────────────────────
  async cogsForWo(woId: string, rates?: Partial<CostingRates>): Promise<WoCogs> {
    const wo = await this.plan.getOne(woId);
    return this.computeWoCogs(wo, this.resolveRates(rates));
  }

  private async computeWoCogs(wo: SfWorkOrder, rates: CostingRates): Promise<WoCogs> {
    const [events, reqs] = await Promise.all([
      this.consumptionForWo(wo.id),
      this.lineEng.stationRequirements(wo.model, wo.revision).catch(() => []),
    ]);
    const costMap = await this.stdCostMap(events.map((e) => e.part));
    const stdTimeByStation = new Map<string, number>(
      reqs.map((r): [string, number] => [r.station, r.stdTimeSec]),
    );
    const stdCostOf = (p: string) => costMap.get(p) ?? 0;

    const material = materialActualCost(events, stdCostOf);
    const stdHours = standardLaborHours(events, (s) => stdTimeByStation.get(s) ?? 0);
    const rollup = await this.rollupActuals(wo.folio);

    const cogs = computeCogs({
      materialActual: material,
      rollupLabor: rollup.labor,
      rollupOverhead: rollup.overhead,
      standardLaborHours: stdHours,
      laborRate: rates.laborRate,
      overheadRate: rates.overheadRate,
    });

    return {
      woId: wo.id,
      woFolio: wo.folio,
      model: wo.model,
      line: wo.line,
      programId: wo.programId,
      customer: wo.customer,
      status: wo.status,
      quantityPlanned: Number(wo.quantityPlanned ?? 0),
      quantityCompleted: Number(wo.quantityCompleted ?? 0),
      materialCost: cogs.materialCost,
      laborCost: cogs.laborCost,
      laborSource: cogs.laborSource,
      overheadCost: cogs.overheadCost,
      overheadSource: cogs.overheadSource,
      cogs: cogs.cogs,
      unitCost: unitCostOf(cogs.cogs, wo.quantityCompleted),
      standardLaborHours: stdHours,
      laborRate: rates.laborRate,
      overheadRate: rates.overheadRate,
      currency: CURRENCY,
    };
  }

  async cogsForProgram(
    programId: string,
    rates?: Partial<CostingRates>,
  ): Promise<ProgramCogs> {
    const id = (programId ?? '').trim();
    if (!id) throw new BadRequestException('programId es requerido.');
    const resolved = this.resolveRates(rates);
    const all = await this.plan.list();
    const wos = all.filter((w) => (w.programId ?? '') === id);
    const workOrders: WoCogs[] = [];
    for (const wo of wos) {
      workOrders.push(await this.computeWoCogs(wo, resolved));
    }
    const totals = workOrders.reduce(
      (acc, w) => {
        acc.quantityPlanned += w.quantityPlanned;
        acc.quantityCompleted += w.quantityCompleted;
        acc.materialCost += w.materialCost;
        acc.laborCost += w.laborCost;
        acc.overheadCost += w.overheadCost;
        acc.cogs += w.cogs;
        return acc;
      },
      {
        count: workOrders.length,
        quantityPlanned: 0,
        quantityCompleted: 0,
        materialCost: 0,
        laborCost: 0,
        overheadCost: 0,
        cogs: 0,
        unitCost: 0,
      },
    );
    totals.materialCost = roundCurrency(totals.materialCost);
    totals.laborCost = roundCurrency(totals.laborCost);
    totals.overheadCost = roundCurrency(totals.overheadCost);
    totals.cogs = roundCurrency(totals.cogs);
    totals.unitCost = unitCostOf(totals.cogs, totals.quantityCompleted);
    return { programId: id, workOrders, totals, currency: CURRENCY };
  }

  // ── Variance (plan vs real + scrap) ──────────────────────────────────────────
  async varianceForWo(woId: string, rates?: Partial<CostingRates>): Promise<WoVariance> {
    const wo = await this.plan.getOne(woId);
    return this.computeWoVariance(wo);
  }

  private async computeWoVariance(wo: SfWorkOrder): Promise<WoVariance> {
    const [events, holds, reqs] = await Promise.all([
      this.consumptionForWo(wo.id),
      this.holdsForWo(wo.id),
      this.lineEng.stationRequirements(wo.model, wo.revision).catch(() => []),
    ]);
    const stations = reqs.map((r) => ({
      station: r.station,
      npExpected: r.npExpected,
      useFactor: r.useFactor,
      stdTimeSec: r.stdTimeSec,
    }));
    const costMap = await this.stdCostMap([
      ...events.map((e) => e.part),
      ...stations.map((s) => s.npExpected),
      ...holds.map((h) => h.part),
    ]);
    const stdCostOf = (p: string) => costMap.get(p) ?? 0;

    const planCost = materialPlanCost(stations, wo.quantityPlanned, stdCostOf);
    const actualCost = materialActualCost(events, stdCostOf);
    const usageVariance = roundCurrency(actualCost - planCost);
    const byPart = usageVarianceByPart(stations, events, wo.quantityPlanned, stdCostOf);
    const scrap = scrapFromHolds(
      holds.map((h) => ({
        part: h.part,
        qty: Number(h.qty ?? 0),
        scrapQty: Number(h.scrapQty ?? 0),
        disposition: h.disposition,
      })),
      stdCostOf,
    );

    return {
      woId: wo.id,
      woFolio: wo.folio,
      model: wo.model,
      programId: wo.programId,
      quantityPlanned: Number(wo.quantityPlanned ?? 0),
      quantityCompleted: Number(wo.quantityCompleted ?? 0),
      materialPlanCost: planCost,
      materialActualCost: actualCost,
      materialUsageVariance: usageVariance,
      usageVariancePct: planCost > 0 ? round(usageVariance / planCost, 4) : 0,
      scrapQty: scrap.scrapQty,
      scrapCost: scrap.scrapCost,
      totalVariance: roundCurrency(usageVariance + scrap.scrapCost),
      byPart,
      currency: CURRENCY,
    };
  }

  // ── Period-close snapshot (additive, frozen) ────────────────────────────────
  async createSnapshot(dto: CreateSnapshotDto): Promise<{
    period: string;
    created: number;
    skipped: number;
    snapshots: FinWoCostSnapshot[];
  }> {
    const rates = this.resolveRates(dto);
    let targets: SfWorkOrder[];
    if (dto.woId) {
      targets = [await this.plan.getOne(dto.woId)];
    } else if (dto.programId) {
      const all = await this.plan.list();
      targets = all.filter((w) => (w.programId ?? '') === dto.programId);
      if (targets.length === 0) {
        throw new BadRequestException(
          `Sin WOs para el programa ${dto.programId}.`,
        );
      }
    } else {
      throw new BadRequestException('Indica woId o programId para cerrar el periodo.');
    }

    const snapshots: FinWoCostSnapshot[] = [];
    let created = 0;
    let skipped = 0;
    for (const wo of targets) {
      const existing = await this.snapshots.findOne({
        where: { woId: wo.id, period: dto.period },
      });
      if (existing && !dto.force) {
        skipped++;
        snapshots.push(existing);
        continue;
      }
      const [cogs, variance] = await Promise.all([
        this.computeWoCogs(wo, rates),
        this.computeWoVariance(wo),
      ]);
      const row =
        existing ??
        this.snapshots.create({
          woId: wo.id,
          period: dto.period,
          ...this.scopeFields(),
        });
      Object.assign(row, {
        woFolio: wo.folio,
        model: wo.model,
        line: wo.line,
        programId: wo.programId,
        customer: wo.customer,
        woStatus: wo.status,
        quantityPlanned: Number(wo.quantityPlanned ?? 0),
        quantityCompleted: Number(wo.quantityCompleted ?? 0),
        materialPlanCost: variance.materialPlanCost,
        materialActualCost: variance.materialActualCost,
        materialUsageVariance: variance.materialUsageVariance,
        laborCost: cogs.laborCost,
        overheadCost: cogs.overheadCost,
        scrapQty: variance.scrapQty,
        scrapCost: variance.scrapCost,
        cogs: cogs.cogs,
        unitCost: cogs.unitCost,
        currency: CURRENCY,
        laborRate: rates.laborRate,
        overheadRate: rates.overheadRate,
        laborSource: cogs.laborSource,
        overheadSource: cogs.overheadSource,
        closedBy: this.tenantCtx.getUserEmail(),
        closedAt: new Date(),
        notes: dto.notes ?? row.notes ?? null,
      });
      const saved = await this.snapshots.save(row);
      snapshots.push(saved);
      created++;
      await this.record('FIN_WO_COST_SNAPSHOT', saved, dto.period);
    }
    return { period: dto.period, created, skipped, snapshots };
  }

  async listSnapshots(filters: {
    period?: string;
    programId?: string;
    woId?: string;
  } = {}): Promise<FinWoCostSnapshot[]> {
    const qb = this.snapshots.createQueryBuilder('s');
    this.applyScope(qb, 's');
    if (filters.period) qb.andWhere('s.period = :p', { p: filters.period });
    if (filters.programId) qb.andWhere('s.program_id = :prog', { prog: filters.programId });
    if (filters.woId) qb.andWhere('s.wo_id = :w', { w: filters.woId });
    return qb.orderBy('s.period', 'DESC').addOrderBy('s.created_at', 'DESC').getMany();
  }

  /** Period roll-up of the frozen snapshots (no live recompute of history). */
  async snapshotKpis(filters: { period?: string; programId?: string } = {}): Promise<{
    period: string | null;
    snapshots: number;
    cogs: number;
    materialActualCost: number;
    materialUsageVariance: number;
    laborCost: number;
    overheadCost: number;
    scrapCost: number;
    unitsCompleted: number;
    avgUnitCost: number;
    currency: string;
  }> {
    const rows = await this.listSnapshots(filters);
    const sum = (sel: (s: FinWoCostSnapshot) => number) =>
      rows.reduce((a, s) => a + Number(sel(s) ?? 0), 0);
    const unitsCompleted = sum((s) => s.quantityCompleted);
    const cogs = roundCurrency(sum((s) => s.cogs));
    return {
      period: filters.period ?? null,
      snapshots: rows.length,
      cogs,
      materialActualCost: roundCurrency(sum((s) => s.materialActualCost)),
      materialUsageVariance: roundCurrency(sum((s) => s.materialUsageVariance)),
      laborCost: roundCurrency(sum((s) => s.laborCost)),
      overheadCost: roundCurrency(sum((s) => s.overheadCost)),
      scrapCost: roundCurrency(sum((s) => s.scrapCost)),
      unitsCompleted,
      avgUnitCost: unitCostOf(cogs, unitsCompleted),
      currency: CURRENCY,
    };
  }

  private async record(
    action: string,
    snap: FinWoCostSnapshot,
    period: string,
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        // No FINANCE domain exists in the legacy ledger enum (do not modify it);
        // COGS intelligence derives from the production floor → PRODUCTION.
        domain: EventDomain.PRODUCTION,
        action,
        referenceType: 'FIN_WO_COST_SNAPSHOT',
        referenceId: snap.id,
        program: snap.programId ?? undefined,
        plant: snap.plant_id ?? undefined,
        metadata: {
          period,
          woFolio: snap.woFolio,
          model: snap.model,
          cogs: snap.cogs,
          materialUsageVariance: snap.materialUsageVariance,
          scrapCost: snap.scrapCost,
        },
      });
    } catch (err) {
      this.logger.warn(`Ledger skipped for ${action}: ${(err as Error)?.message}`);
    }
  }
}
