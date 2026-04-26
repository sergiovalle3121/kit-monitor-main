import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanScenario } from './entities/plan-scenario.entity';
import { ForecastErrorHistory } from './entities/forecast-error-history.entity';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class StressTestConfigDto {
  /**
   * Scenario A — Supply Chain Failure
   * Fraction of material availability lost (0.0–1.0).
   * E.g. 0.30 = 30 % reduction in supply.
   */
  supplyReductionFraction?: number;

  /**
   * Scenario B — Labor Shortage
   * Fraction of production capacity lost (0.0–1.0).
   * E.g. 0.25 = 25 % capacity reduction.
   */
  capacityReductionFraction?: number;

  /** Number of Monte Carlo iterations. Default 500, max 2000. */
  numRuns?: number;
}

export interface StressTestResult {
  scenarioId: number;
  scenarioName: string;
  stressConfig: Required<Omit<StressTestConfigDto, 'numRuns'>> & { numRuns: number };
  simulationMode: 'monte_carlo' | 'fallback_band';
  dataSufficiencyScore: number;

  /** Probability of completing ≥ 98 % of planned demand under stress */
  probabilityOfCompletion: number;
  /** Probability of a material shortage event */
  probabilityOfShortage: number;
  /** Probability of capacity overload */
  probabilityOfCapacityOverload: number;

  percentiles: { p10: number; p50: number; p90: number };

  /** Comparison against the baseline (un-stressed) scenario viability score */
  baselineViabilityScore: number;
  degradation: number; // absolute points drop vs baseline

  explanation: string;
  generatedAt: Date;
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * MonteCarloService
 *
 * Dedicated Monte Carlo engine extracted from DecisionIntelligenceService.
 * Adds Stress Testing capabilities on top of the baseline simulation:
 *
 *   runStressTest(scenarioId, config)
 *     → Scenario A: Supply Chain Failure  — reduces material availability
 *     → Scenario B: Labor Shortage        — reduces production capacity
 *     → Combined                          — applies both shocks simultaneously
 *
 * The baseline Monte Carlo loop lives in DecisionIntelligenceService.runScenarioSimulation().
 * This service re-implements the core loop with stress multipliers applied so both
 * codepaths remain independently testable and documented.
 */
@Injectable()
export class MonteCarloService {
  constructor(
    @InjectRepository(PlanScenario)
    private readonly scenarioRepo: Repository<PlanScenario>,
    @InjectRepository(ForecastErrorHistory)
    private readonly errorHistoryRepo: Repository<ForecastErrorHistory>,
  ) {}

  /**
   * Run a stressed Monte Carlo simulation for a given plan scenario.
   *
   * @param scenarioId  PlanScenario.id to stress-test
   * @param config      Stress parameters and simulation settings
   */
  async runStressTest(scenarioId: number, config: StressTestConfigDto): Promise<StressTestResult> {
    const scenario = await this.scenarioRepo.findOne({ where: { id: scenarioId } });
    if (!scenario) throw new NotFoundException(`PlanScenario ${scenarioId} not found`);

    const numRuns    = Math.min(2000, Math.max(100, config.numRuns ?? 500));
    const supplyShock    = Math.min(1, Math.max(0, config.supplyReductionFraction   ?? 0));
    const capacityShock  = Math.min(1, Math.max(0, config.capacityReductionFraction ?? 0));

    const assumptions    = scenario.assumptions ?? {};
    const plannedDemand  = Number(assumptions.plannedDemandUnits ?? 100);
    const capacityPerDay = Number(assumptions.capacityPerDay ?? 20);
    const horizonDays    = Number(assumptions.horizonDays ?? 5);
    const scrapBase      = Number(assumptions.scrapRate ?? 0.02);

    // Bootstrap residual pool from historical forecast errors
    const historicalErrors = await this.errorHistoryRepo.find({
      where: { run: { id: scenario.id } },
    });
    const residualPool        = historicalErrors.map((e) => e.residual);
    const dataSufficiencyScore = Math.min(100, Math.round((residualPool.length / 60) * 100));
    const simulationMode       = residualPool.length >= 20 ? 'monte_carlo' : 'fallback_band';

    // ── Apply stress multipliers ─────────────────────────────────────────

    /**
     * Scenario A (Supply Chain Failure):
     * plannedDemand stays the same, but effective supply (material availability)
     * is reduced — meaning the factory can only source (1 - supplyShock) of
     * required materials, increasing shortage probability proportionally.
     */
    const effectiveSupplyMultiplier = 1 - supplyShock;

    /**
     * Scenario B (Labor Shortage):
     * Effective daily capacity is reduced. Workers are unavailable, so the line
     * can only run at (1 - capacityShock) of nominal throughput.
     */
    const stressedCapacityPerDay = capacityPerDay * (1 - capacityShock);

    // ── Simulation loop ──────────────────────────────────────────────────

    let completion = 0;
    let shortage   = 0;
    let overload   = 0;
    const achieved: number[] = [];

    for (let i = 0; i < numRuns; i++) {
      const residual = residualPool.length
        ? residualPool[Math.floor(Math.random() * residualPool.length)]
        : plannedDemand * this.randomBetween(-0.18, 0.22);

      const scrap    = Math.max(0, scrapBase + this.randomBetween(-0.015, 0.015));
      const capNoise = this.randomBetween(-0.12, 0.12);

      // Capacity after noise + labor shock
      const simulatedCapacity = stressedCapacityPerDay * horizonDays * (1 + capNoise);

      // Demand after residual + scrap
      const rawRequired = (plannedDemand + residual) * (1 + scrap);

      // Effective supply constraint: only a fraction of raw required can be sourced
      const supplyConstrained = rawRequired * effectiveSupplyMultiplier;
      const achievedQty = Math.max(0, Math.min(supplyConstrained, simulatedCapacity));

      const hasShortage = rawRequired > simulatedCapacity || supplyShock > 0 && achievedQty < rawRequired;
      const hasOverload = rawRequired > simulatedCapacity * 1.05;
      const isComplete  = achievedQty >= plannedDemand * 0.98 && !hasOverload;

      if (isComplete)    completion += 1;
      if (hasShortage)   shortage   += 1;
      if (hasOverload)   overload   += 1;

      achieved.push(achievedQty);
    }

    achieved.sort((a, b) => a - b);

    const probabilityOfCompletion      = completion / numRuns;
    const probabilityOfShortage        = shortage   / numRuns;
    const probabilityOfCapacityOverload = overload  / numRuns;

    const percentiles = {
      p10: this.percentile(achieved, 0.1),
      p50: this.percentile(achieved, 0.5),
      p90: this.percentile(achieved, 0.9),
    };

    // ── Baseline comparison ──────────────────────────────────────────────

    const baselineViabilityScore = scenario.viabilityScore ?? 0;
    const stressedScore          = Math.round(probabilityOfCompletion * 100);
    const degradation            = baselineViabilityScore - stressedScore;

    // ── Human-readable explanation ───────────────────────────────────────

    const shocks: string[] = [];
    if (supplyShock > 0) shocks.push(`Supply reduced ${Math.round(supplyShock * 100)}%`);
    if (capacityShock > 0) shocks.push(`Capacity reduced ${Math.round(capacityShock * 100)}%`);
    const shockLabel = shocks.join(' + ') || 'No stress applied';

    const explanation = [
      `Stress scenario: ${shockLabel}.`,
      simulationMode === 'monte_carlo'
        ? `${numRuns} iterations using historical residual bootstrap (${residualPool.length} data points).`
        : `${numRuns} iterations using fallback ±18/22% demand band (insufficient history).`,
      `Plan completion probability under stress: ${(probabilityOfCompletion * 100).toFixed(1)}%`,
      degradation > 0
        ? `Degradation vs baseline: −${degradation.toFixed(1)} points.`
        : 'No degradation vs baseline.',
    ].join(' ');

    return {
      scenarioId,
      scenarioName:             scenario.name ?? `Scenario #${scenarioId}`,
      stressConfig: {
        supplyReductionFraction:  supplyShock,
        capacityReductionFraction: capacityShock,
        numRuns,
      },
      simulationMode,
      dataSufficiencyScore,
      probabilityOfCompletion,
      probabilityOfShortage,
      probabilityOfCapacityOverload,
      percentiles,
      baselineViabilityScore,
      degradation,
      explanation,
      generatedAt: new Date(),
    };
  }

  // ── Math helpers ─────────────────────────────────────────────────────────

  private randomBetween(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)));
    return Math.round(sorted[idx] * 100) / 100;
  }
}
