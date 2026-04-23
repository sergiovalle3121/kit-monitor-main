import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForecastRun } from './entities/forecast-run.entity';
import { ForecastSeriesResult } from './entities/forecast-series-result.entity';
import { PlanScenario } from './entities/plan-scenario.entity';
import { PlanPublication } from './entities/plan-publication.entity';
import { CreateForecastRunDto } from './dto/create-forecast-run.dto';
import { CreatePlanScenarioDto } from './dto/create-plan-scenario.dto';
import { CreatePlanPublicationDto } from './dto/create-plan-publication.dto';
import { ProductionBayMaterialState } from '../production-runtime/entities/production-bay-material-state.entity';
import { ForecastErrorHistory } from './entities/forecast-error-history.entity';
import { ScenarioSimulationResult } from './entities/scenario-simulation-result.entity';
import { PlanActualOutcome } from './entities/plan-actual-outcome.entity';
import { ScoreCalibrationPoint } from './entities/score-calibration-point.entity';
import { RunSimulationDto } from './dto/run-simulation.dto';
import { RegisterOutcomeDto } from './dto/register-outcome.dto';
import { ProductionWip } from '../production-runtime/entities/production-wip.entity';
import { NCR } from '../ncr/entities/ncr.entity';
import { WarehouseTask } from '../inventory/entities/warehouse-task.entity';
import { Shipment } from '../shipping/entities/shipment.entity';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { EnterpriseBuilding } from '../enterprise-campus/entities/enterprise-building.entity';
import { FinalInspection } from '../quality/entities/final-inspection.entity';
import { IQCInspection } from '../quality/entities/iqc-inspection.entity';
import { CAPA } from '../quality/entities/capa.entity';
import { SCAR, ScarStatus } from '../suppliers/entities/scar.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { CapaStatus } from '../quality/entities/capa.entity';
import { IqcResult } from '../quality/entities/iqc-inspection.entity';
import { WarehouseTaskStatus, WarehouseTaskType } from '../inventory/entities/warehouse-task.entity';
import { ShipmentStatus } from '../shipping/entities/shipment.entity';

@Injectable()
export class DecisionIntelligenceService {
  constructor(
    @InjectRepository(ForecastRun) private readonly runRepo: Repository<ForecastRun>,
    @InjectRepository(ForecastSeriesResult) private readonly seriesRepo: Repository<ForecastSeriesResult>,
    @InjectRepository(PlanScenario) private readonly scenarioRepo: Repository<PlanScenario>,
    @InjectRepository(PlanPublication) private readonly publicationRepo: Repository<PlanPublication>,
    @InjectRepository(ProductionBayMaterialState) private readonly materialStateRepo: Repository<ProductionBayMaterialState>,
    @InjectRepository(ForecastErrorHistory) private readonly errorHistoryRepo: Repository<ForecastErrorHistory>,
    @InjectRepository(ScenarioSimulationResult) private readonly simulationRepo: Repository<ScenarioSimulationResult>,
    @InjectRepository(PlanActualOutcome) private readonly outcomeRepo: Repository<PlanActualOutcome>,
    @InjectRepository(ScoreCalibrationPoint) private readonly calibrationRepo: Repository<ScoreCalibrationPoint>,
    @InjectRepository(ProductionWip) private readonly wipRepo: Repository<ProductionWip>,
    @InjectRepository(NCR) private readonly ncrRepo: Repository<NCR>,
    @InjectRepository(WarehouseTask) private readonly warehouseTaskRepo: Repository<WarehouseTask>,
    @InjectRepository(Shipment) private readonly shipmentRepo: Repository<Shipment>,
    @InjectRepository(InventoryPosition) private readonly inventoryRepo: Repository<InventoryPosition>,
    @InjectRepository(EnterpriseBuilding) private readonly buildingRepo: Repository<EnterpriseBuilding>,
    @InjectRepository(FinalInspection) private readonly oqcRepo: Repository<FinalInspection>,
    @InjectRepository(IQCInspection) private readonly iqcRepo: Repository<IQCInspection>,
    @InjectRepository(CAPA) private readonly capaRepo: Repository<CAPA>,
    @InjectRepository(SCAR) private readonly scarRepo: Repository<SCAR>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
  ) {}

  async createForecastRun(dto: CreateForecastRunDto) {
    if (!dto.series?.length) throw new BadRequestException('Se requiere al menos una serie para crear run');
    const confidence = this.scoreRunConfidence(dto.series);
    const run = await this.runRepo.save(this.runRepo.create({
      name: dto.name,
      sourceFile: dto.sourceFile,
      assumptions: dto.assumptions,
      confidenceScore: confidence,
      status: 'draft',
      series: dto.series.map((row) => this.seriesRepo.create({
        material: row.material,
        location: row.location,
        championMethod: row.championMethod,
        mape: row.mape,
        mad: row.mad,
        bias: row.bias,
        forecastNext: row.forecastNext,
        forecastHorizon: row.forecastHorizon,
        diagnostics: row.diagnostics,
        confidenceScore: row.confidenceScore ?? this.scoreSeries(row.mape, row.bias),
      })),
    }));

    await this.seedErrorHistoryFromRun(run.id);
    return this.getForecastRun(run.id);
  }

  async listForecastRuns() {
    return this.runRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  async getForecastRun(id: number) {
    const run = await this.runRepo.findOne({ where: { id }, relations: ['series'] });
    if (!run) throw new NotFoundException('Forecast run no encontrado');
    return run;
  }

  async createPlanScenario(dto: CreatePlanScenarioDto) {
    const run = dto.runId ? await this.runRepo.findOne({ where: { id: dto.runId }, relations: ['series'] }) : null;
    if (dto.runId && !run) throw new NotFoundException('Forecast run no encontrado');

    const logisticRisk = await this.buildLogisticPriority(run?.id ?? null, dto.assumptions.horizonDays, dto.assumptions.leadTimeDays ?? 2);
    const capacityPressure = dto.assumptions.dailyCapacityUnits > 0
      ? dto.assumptions.plannedDemandUnits / (dto.assumptions.dailyCapacityUnits * Math.max(1, dto.assumptions.horizonDays))
      : 1;
    const forecastConfidence = run?.confidenceScore ?? 55;
    const riskPenalty = Math.min(40, logisticRisk.criticalCount * 6);
    const capacityPenalty = Math.min(30, Math.max(0, (capacityPressure - 0.85) * 100));
    const scrapPenalty = Math.min(10, Math.max(0, (dto.assumptions.scrapRate ?? 0) * 100));

    const viabilityScore = Math.max(5, Math.round(forecastConfidence - riskPenalty - capacityPenalty - scrapPenalty));
    const estimatedProbability = Math.max(0.05, Math.min(0.98, viabilityScore / 100));

    const scenario = await this.scenarioRepo.save(this.scenarioRepo.create({
      run: run ?? undefined,
      name: dto.name,
      assumptions: dto.assumptions,
      constraints: {
        capacityPressure,
        criticalMaterials: logisticRisk.criticalCount,
        ...dto.constraints,
      },
      logisticRisk,
      viabilityScore,
      estimatedProbability,
      highlights: {
        topCritical: logisticRisk.items.slice(0, 5),
        forecastConfidence,
      },
      status: 'candidate',
    }));

    return this.getPlanScenario(scenario.id);
  }

  async listPlanScenarios() {
    return this.scenarioRepo.find({ relations: ['run'], order: { createdAt: 'DESC' }, take: 50 });
  }

  async getPlanScenario(id: number) {
    const scenario = await this.scenarioRepo.findOne({ where: { id }, relations: ['run'] });
    if (!scenario) throw new NotFoundException('Plan scenario no encontrado');
    return scenario;
  }

  async publishPlan(dto: CreatePlanPublicationDto) {
    const run = dto.runId ? await this.runRepo.findOne({ where: { id: dto.runId } }) : null;
    const scenario = dto.scenarioId ? await this.scenarioRepo.findOne({ where: { id: dto.scenarioId } }) : null;
    if (dto.runId && !run) throw new NotFoundException('Forecast run no encontrado');
    if (dto.scenarioId && !scenario) throw new NotFoundException('Plan scenario no encontrado');

    const publication = await this.publicationRepo.save(this.publicationRepo.create({
      title: dto.title,
      run: run ?? undefined,
      scenario: scenario ?? undefined,
      planConfidenceScore: scenario?.viabilityScore ?? run?.confidenceScore ?? 0,
      risks: scenario?.logisticRisk ?? undefined,
      publishedBy: dto.publishedBy,
    }));

    if (scenario) {
      await this.scenarioRepo.update(scenario.id, { status: 'published' });
    }
    if (run) {
      await this.runRepo.update(run.id, { status: 'published' });
    }

    return publication;
  }

  async runScenarioSimulation(scenarioId: number, dto: RunSimulationDto) {
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId }, relations: ['run'] });
    if (!scenario) throw new NotFoundException('Plan scenario no encontrado');
    const run = scenario.run?.id ? await this.runRepo.findOne({ where: { id: scenario.run.id }, relations: ['series'] }) : null;

    const numRuns = Math.max(100, Math.min(2000, dto.numRuns ?? 500));
    const assumptions = scenario.assumptions ?? {};
    const plannedDemand = Number(assumptions.plannedDemandUnits ?? 0);
    const capacityPerDay = Number(assumptions.dailyCapacityUnits ?? 0);
    const horizonDays = Math.max(1, Number(assumptions.horizonDays ?? 7));
    const scrapBase = Number(assumptions.scrapRate ?? 0.03);

    const historicalErrors = run ? await this.errorHistoryRepo.find({ where: { run: { id: run.id } } }) : [];
    const residualPool = historicalErrors.map((item) => item.residual);
    const dataSufficiencyScore = Math.min(100, Math.round((historicalErrors.length / 60) * 100));
    const simulationMode = residualPool.length >= 20 ? 'monte_carlo' : 'fallback_band';

    let success = 0;
    let shortage = 0;
    let overload = 0;
    let overtime = 0;
    const achieved: number[] = [];
    const capacities: number[] = [];

    for (let i = 0; i < numRuns; i++) {
      const residual = residualPool.length
        ? residualPool[Math.floor(Math.random() * residualPool.length)]
        : plannedDemand * this.randomBetween(-0.18, 0.22);
      const scrap = Math.max(0, scrapBase + this.randomBetween(-(dto.scrapStdPct ?? 0.015), dto.scrapStdPct ?? 0.015));
      const capacityNoise = this.randomBetween(-(dto.capacityStdPct ?? 0.12), dto.capacityStdPct ?? 0.12);
      const simulatedCapacity = capacityPerDay * horizonDays * (1 + capacityNoise);
      const required = (plannedDemand + residual) * (1 + scrap);
      const achievedQty = Math.max(0, Math.min(required, simulatedCapacity));

      const hasShortage = required > simulatedCapacity;
      const hasOverload = required > simulatedCapacity * 1.05;
      const hasOvertime = required > simulatedCapacity * 0.95;
      const isSuccess = achievedQty >= plannedDemand * 0.98 && !hasOverload;

      if (isSuccess) success += 1;
      if (hasShortage) shortage += 1;
      if (hasOverload) overload += 1;
      if (hasOvertime) overtime += 1;

      achieved.push(achievedQty);
      capacities.push(simulatedCapacity);
    }

    achieved.sort((a, b) => a - b);
    const percentiles = {
      p10: this.percentile(achieved, 0.1),
      p50: this.percentile(achieved, 0.5),
      p90: this.percentile(achieved, 0.9),
      capacityP50: this.percentile(capacities, 0.5),
    };

    const calibratedScore = this.calibrateScore(scenario.viabilityScore, dataSufficiencyScore, success / numRuns);
    const confidenceBand = {
      low: Math.max(0, calibratedScore - (100 - dataSufficiencyScore) * 0.2),
      high: Math.min(100, calibratedScore + dataSufficiencyScore * 0.1),
    };

    const result = await this.simulationRepo.save(this.simulationRepo.create({
      scenario: { id: scenarioId } as PlanScenario,
      simulationMode,
      numRuns,
      probabilityOfPlanSuccess: success / numRuns,
      probabilityOfShortage: shortage / numRuns,
      probabilityOfCapacityOverload: overload / numRuns,
      probabilityOfOvertime: overtime / numRuns,
      percentiles,
      dataSufficiencyScore,
      drivers: {
        forecastReliabilityComponent: dataSufficiencyScore,
        capacityStressComponent: this.round((overload / numRuns) * 100),
        logisticsRiskComponent: this.round((shortage / numRuns) * 100),
        scrapPenaltyComponent: this.round(scrapBase * 100),
      },
      assumptionsSnapshot: assumptions,
    }));

    scenario.viabilityScore = calibratedScore;
    scenario.estimatedProbability = success / numRuns;
    scenario.highlights = {
      ...(scenario.highlights ?? {}),
      confidenceBand,
      simulationMode,
    };
    await this.scenarioRepo.save(scenario);

    return {
      result,
      calibratedScore,
      rawScore: scenario.viabilityScore,
      confidenceBand,
      explanation: simulationMode === 'monte_carlo'
        ? 'Probabilidad calculada con bootstrap de residual histórico.'
        : 'Modo fallback por insuficiencia histórica; usar con cautela.',
    };
  }

  async registerPublicationOutcome(publicationId: number, dto: RegisterOutcomeDto) {
    const publication = await this.publicationRepo.findOne({ where: { id: publicationId }, relations: ['scenario'] });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
    const scenario = publication.scenario;
    const planQty = Number(scenario?.assumptions?.plannedDemandUnits ?? 0);
    const actualQty = Number(dto.actualQty ?? 0);
    const varianceQty = actualQty - planQty;
    const variancePct = planQty > 0 ? (varianceQty / planQty) * 100 : 0;
    const fulfillmentResult = actualQty >= planQty * 0.98
      && (dto.shortageEvents ?? 0) === 0
      && (dto.overtimeHours ?? 0) <= 2
      ? 'success'
      : actualQty >= planQty * 0.9
        ? 'partial'
        : 'failed';

    const outcome = await this.outcomeRepo.save(this.outcomeRepo.create({
      publication: { id: publicationId } as PlanPublication,
      planQty,
      actualQty,
      varianceQty,
      variancePct,
      fulfillmentResult,
      shortageEvents: dto.shortageEvents ?? 0,
      overtimeHours: dto.overtimeHours ?? 0,
      details: dto.details,
    }));

    await this.updateCalibrationSummary();
    return outcome;
  }

  async getControlTower(publicationId: number) {
    const publication = await this.publicationRepo.findOne({ where: { id: publicationId }, relations: ['scenario', 'run'] });
    if (!publication) throw new NotFoundException('Publicación no encontrada');
    const outcome = await this.outcomeRepo.findOne({ where: { publication: { id: publicationId } }, order: { createdAt: 'DESC' } });
    const simulation = publication.scenario?.id
      ? await this.simulationRepo.findOne({ where: { scenario: { id: publication.scenario.id } }, order: { createdAt: 'DESC' } })
      : null;

    return {
      publication,
      outcome,
      simulation,
      signals: this.buildSignals(publication, outcome, simulation),
    };
  }

  async getCalibrationSummary() {
    const points = await this.calibrationRepo.find({ order: { bucket: 'ASC' } });
    const outcomes = await this.outcomeRepo.find({ relations: ['publication'] });
    const successRate = outcomes.length
      ? outcomes.filter((row) => row.fulfillmentResult === 'success').length / outcomes.length
      : 0;
    return {
      samples: outcomes.length,
      overallSuccessRate: successRate,
      points,
    };
  }

  async listPublications() {
    return this.publicationRepo.find({ relations: ['run', 'scenario'], order: { createdAt: 'DESC' }, take: 50 });
  }

  async getLogisticPriority(runId?: number) {
    return this.buildLogisticPriority(runId ?? null, 7, 2);
  }

  private scoreSeries(mape: number, bias: number): number {
    const errorPenalty = Math.min(50, Math.max(0, mape));
    const biasPenalty = Math.min(20, Math.abs(bias));
    return Math.max(10, Math.round(100 - errorPenalty - biasPenalty));
  }

  private scoreRunConfidence(series: CreateForecastRunDto['series']): number {
    const avg = series.reduce((acc, row) => acc + this.scoreSeries(row.mape, row.bias), 0) / Math.max(1, series.length);
    const coverageBonus = Math.min(15, Math.round(series.length / 10));
    return Math.min(98, Math.round(avg + coverageBonus));
  }

  private async buildLogisticPriority(runId: number | null, horizonDays: number, leadTimeDays: number) {
    const materials = await this.materialStateRepo.find({ relations: ['kit'] });
    const run = runId ? await this.runRepo.findOne({ where: { id: runId }, relations: ['series'] }) : null;
    const demandByMaterial = new Map<string, number>();
    (run?.series ?? []).forEach((row) => {
      demandByMaterial.set(row.material.toUpperCase(), row.forecastNext || 0);
    });

    const items = materials.map((item) => {
      const demand = demandByMaterial.get(item.partNumber.toUpperCase()) ?? 0;
      const horizonMinutes = Math.max(60, horizonDays * 24 * 60);
      const consumptionPerMinute = demand > 0 ? demand / horizonMinutes : (item.usagePerAssembly / 60);
      const minutesToStockout = consumptionPerMinute > 0 ? item.availableQty / consumptionPerMinute : null;

      let severity: 'stable' | 'monitor' | 'prepare' | 'urgent' = 'stable';
      if (minutesToStockout !== null) {
        if (minutesToStockout <= 60) severity = 'urgent';
        else if (minutesToStockout <= 240) severity = 'prepare';
        else if (minutesToStockout <= 720) severity = 'monitor';
      }

      const leadTimeMinutes = leadTimeDays * 24 * 60;
      const leadGap = minutesToStockout === null ? 0 : Math.max(0, leadTimeMinutes - minutesToStockout);
      const priorityScore = Math.round(
        (severity === 'urgent' ? 60 : severity === 'prepare' ? 40 : severity === 'monitor' ? 20 : 5)
        + Math.min(25, leadGap / 30)
        + Math.min(15, demand / 10),
      );

      return {
        backendId: item.kit?.id,
        bayId: item.bayId,
        partNumber: item.partNumber,
        availableQty: item.availableQty,
        consumptionPerMinute,
        minutesToStockout,
        severity,
        priorityScore,
        recommendation: severity === 'urgent'
          ? 'Reabastecer inmediato'
          : severity === 'prepare'
            ? 'Preparar reabasto'
            : severity === 'monitor'
              ? 'Monitorear'
              : 'Estable',
      };
    }).sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      criticalCount: items.filter((item) => item.severity === 'urgent' || item.severity === 'prepare').length,
      leadTimeDays,
      horizonDays,
      items,
    };
  }

  private async seedErrorHistoryFromRun(runId: number): Promise<void> {
    const run = await this.runRepo.findOne({ where: { id: runId }, relations: ['series'] });
    if (!run) return;
    const rows = run.series.map((row) => {
      const actual = Math.max(0, row.forecastNext + this.randomBetween(-Math.max(2, row.mad), Math.max(2, row.mad)));
      const residual = actual - row.forecastNext;
      const absoluteError = Math.abs(residual);
      const percentageError = row.forecastNext > 0 ? (absoluteError / row.forecastNext) * 100 : 0;
      return this.errorHistoryRepo.create({
        run: { id: runId } as ForecastRun,
        material: row.material,
        family: row.material.split('-')[0],
        championMethod: row.championMethod,
        period: new Date().toISOString().slice(0, 7),
        forecast: row.forecastNext,
        actual,
        residual,
        absoluteError,
        percentageError,
      });
    });
    await this.errorHistoryRepo.save(rows);
  }

  private async updateCalibrationSummary(): Promise<void> {
    const outcomes = await this.outcomeRepo.find({ relations: ['publication'] });
    if (!outcomes.length) return;
    await this.calibrationRepo.clear();

    const buckets = new Map<string, { raw: number[]; success: number[] }>();
    for (const row of outcomes) {
      const raw = row.publication?.planConfidenceScore ?? 0;
      const bucketStart = Math.floor(raw / 10) * 10;
      const key = `${bucketStart}-${bucketStart + 9}`;
      const slot = buckets.get(key) ?? { raw: [], success: [] };
      slot.raw.push(raw);
      slot.success.push(row.fulfillmentResult === 'success' ? 1 : 0);
      buckets.set(key, slot);
    }

    const points = [...buckets.entries()].map(([bucket, slot]) => {
      const avgRaw = slot.raw.reduce((a, b) => a + b, 0) / slot.raw.length;
      const observed = slot.success.reduce((a, b) => a + b, 0) / slot.success.length;
      const calibrated = this.calibrateScore(avgRaw, Math.min(100, slot.raw.length * 10), observed);
      return this.calibrationRepo.create({
        bucket,
        avgRawScore: avgRaw,
        avgCalibratedScore: calibrated,
        observedSuccessRate: observed,
        sampleSize: slot.raw.length,
      });
    });
    await this.calibrationRepo.save(points);
  }

  private buildSignals(publication: PlanPublication, outcome: PlanActualOutcome | null, simulation: ScenarioSimulationResult | null) {
    if (!outcome) return ['Sin outcome real aún'];
    const signals: string[] = [];
    if (outcome.variancePct >= 5) signals.push('Adelantado vs plan');
    else if (outcome.variancePct <= -5) signals.push('Atrasado vs plan');
    else signals.push('En línea');
    if (outcome.shortageEvents > 0) signals.push('Riesgo creciente por faltantes');
    if (simulation && simulation.probabilityOfPlanSuccess < 0.6 && outcome.fulfillmentResult === 'success') signals.push('Riesgo mitigado en ejecución');
    return signals;
  }

  private calibrateScore(rawScore: number, sufficiency: number, observedSuccess: number): number {
    const suffWeight = Math.max(0.25, Math.min(1, sufficiency / 100));
    return this.round((rawScore * (0.6 * suffWeight)) + ((observedSuccess * 100) * (1 - (0.6 * suffWeight))));
  }

  private percentile(values: number[], p: number): number {
    if (!values.length) return 0;
    const idx = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * p)));
    return values[idx];
  }

  private randomBetween(min: number, max: number): number {
    return min + (Math.random() * (max - min));
  }

  private round(value: number, digits = 2): number {
    const pow = Math.pow(10, digits);
    return Math.round(value * pow) / pow;
  }

  async getSiteOverview() {
    const buildings = await this.buildingRepo.find();
    const inventory = await this.inventoryRepo.find();
    const wip = await this.wipRepo.find();
    const ncrs = await this.ncrRepo.find();
    const tasks = await this.warehouseTaskRepo.find({ where: { status: WarehouseTaskStatus.PENDING } });
    const shipments = await this.shipmentRepo.find();
    const oqc = await this.oqcRepo.find();
    const iqc = await this.iqcRepo.find();
    const capas = await this.capaRepo.find();
    const scars = await this.scarRepo.find();
    const suppliers = await this.supplierRepo.find();

    // 1. Quality Analytics
    const totalOqc = oqc.length;
    const passedOqc = oqc.filter(o => o.result === 'PASS').length;
    const fpy = totalOqc > 0 ? (passedOqc / totalOqc) * 100 : 100;

    const openCapas = capas.filter(c => c.status !== CapaStatus.CLOSED).length;
    const overdueCapas = capas.filter(c => c.status !== CapaStatus.CLOSED && c.dueDate && new Date(c.dueDate) < new Date()).length;

    // 2. FG & Shipping Signals
    const pendingOqcQty = inventory.filter(p => p.holdStatus === 'pending_oqc').reduce((acc, p) => acc + p.onHand, 0);
    const blockedFgQty = inventory.filter(p => p.holdStatus === 'hold' && p.warehouseId === 'WH-FG').reduce((acc, p) => acc + p.onHand, 0);
    
    // 3. Supply Chain Signals
    const shortages = inventory.filter(p => p.onHand <= 0).length;
    const quarantinedQty = inventory.filter(p => p.holdStatus === 'quarantine').reduce((acc, p) => acc + p.onHand, 0);

    // 4. Supplier Intelligence
    const openScars = scars.filter(s => s.status !== ScarStatus.CLOSED).length;
    const criticalSuppliers = suppliers.filter(s => s.status === 'Critical').length; // Assuming status exists

    return {
      site: {
        id: 'GDL-CAMPUS',
        name: 'Guadalajara Industrial Campus',
        healthScore: this.calculateDeepHealth(ncrs, tasks, wip, fpy, overdueCapas),
        activeBuildings: buildings.length,
      },
      quality: {
        fpy: this.round(fpy),
        oqcRate: totalOqc > 0 ? this.round((passedOqc / totalOqc) * 100) : 100,
        iqcPassRate: iqc.length > 0 ? this.round((iqc.filter(i => i.result === IqcResult.PASS).length / iqc.length) * 100) : 100,
        openNcrs: ncrs.filter(n => n.status !== 'closed').length,
        criticalNcrs: ncrs.filter(n => n.severity === 'critical' && n.status !== 'closed').length,
        openCapas,
        overdueCapas,
        openScars
      },
      materials: {
        shortages,
        quarantinedQty,
        holdQty: inventory.filter(p => p.holdStatus === 'hold').reduce((acc, p) => acc + p.onHand, 0),
        replenishmentBacklog: tasks.filter(t => t.type === WarehouseTaskType.TRANSFER).length
      },
      production: {
        activeWorkOrders: wip.filter(w => w.status === 'in_production').length,
        wipUnits: wip.reduce((acc, w) => acc + w.completedQty, 0),
        fgPendingOqc: pendingOqcQty,
        fgBlocked: blockedFgQty
      },
      shipping: {
        staged: shipments.filter(s => s.status === 'staged').length,
        loading: shipments.filter(s => s.status === 'loading').length,
        dispatched: shipments.filter(s => s.status === 'dispatched').length,
        blockers: shipments.filter(s => s.status === ShipmentStatus.PLANNING && s.scheduledAt && new Date(s.scheduledAt) < new Date()).length
      },
      suppliers: {
        criticalCount: criticalSuppliers,
        openScars,
        avgScarAging: this.calculateAvgAging(scars.filter(s => s.status !== ScarStatus.CLOSED))
      }
    };
  }

  private calculateDeepHealth(ncrs: any[], tasks: any[], wip: any[], fpy: number, overdueCapas: number): number {
    let score = 95;
    score -= (ncrs.filter(n => n.status !== 'closed').length * 1.5);
    score -= (tasks.length * 0.2);
    score -= (overdueCapas * 5);
    score -= ((100 - fpy) * 0.5);
    return Math.max(0, Math.min(100, this.round(score)));
  }

  private calculateAvgAging(items: any[]): number {
    if (!items.length) return 0;
    const now = new Date().getTime();
    const sum = items.reduce((acc, item) => acc + (now - new Date(item.createdAt).getTime()), 0);
    return this.round(sum / (items.length * 1000 * 3600 * 24), 1); // Days
  }
}
