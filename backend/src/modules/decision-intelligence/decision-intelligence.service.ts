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

@Injectable()
export class DecisionIntelligenceService {
  constructor(
    @InjectRepository(ForecastRun) private readonly runRepo: Repository<ForecastRun>,
    @InjectRepository(ForecastSeriesResult) private readonly seriesRepo: Repository<ForecastSeriesResult>,
    @InjectRepository(PlanScenario) private readonly scenarioRepo: Repository<PlanScenario>,
    @InjectRepository(PlanPublication) private readonly publicationRepo: Repository<PlanPublication>,
    @InjectRepository(ProductionBayMaterialState) private readonly materialStateRepo: Repository<ProductionBayMaterialState>,
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
}
