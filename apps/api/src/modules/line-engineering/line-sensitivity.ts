/**
 * Pure, side-effect-free demand-sensitivity sweep for a line layout (Fase 36).
 *
 * The what-if simulator (Fase 25) answers a single demand point. This sweeps a
 * whole range of demand and reports, at each level, the takt, the operators
 * needed, whether one operator per station still keeps up, and the resulting
 * cost per unit — so the planner sees how the layout SCALES: where economies of
 * scale flatten the unit cost, where an extra operator must step in, and the
 * demand ceiling beyond which a station can no longer hold takt.
 *
 * Reuses the pure staffing and cost models so the curve is consistent with the
 * point estimates elsewhere. Kept pure for unit-testing without a DB or canvas.
 */

import { staffingPlan } from './line-staffing';
import { costModel, CostRates } from './line-cost';

export interface SensitivityStation {
  station: string;
  sequence: number;
  stdTimeSec: number;
}

export interface SensitivityPoint {
  demandUnits: number;
  taktSec: number;
  operators: number;
  /** One operator per station still holds takt (bottleneck ≤ takt). */
  feasible: boolean;
  throughputPerHour: number;
  costPerUnit: number;
}

export interface SensitivityResult {
  availableTimeSec: number;
  bottleneckCycleSec: number;
  /** Highest swept demand still feasible with one operator per station. */
  maxFeasibleDemand: number | null;
  /** Demand (within the sweep) with the lowest unit cost. */
  minCostDemand: number | null;
  minCostPerUnit: number | null;
  points: SensitivityPoint[];
}

export interface SensitivityOptions {
  availableTimeSec: number;
  demands: number[];
  footprintAreaM2?: number;
  assetCount?: number;
  rates?: CostRates;
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export function sensitivityCurve(
  stations: SensitivityStation[],
  opts: SensitivityOptions,
): SensitivityResult {
  const valid = (stations ?? []).filter((s) => Number(s.stdTimeSec) > 0);
  const availableTimeSec = Math.max(0, Number(opts.availableTimeSec) || 0);
  const bottleneckCycleSec = valid.length
    ? Math.max(...valid.map((s) => Number(s.stdTimeSec)))
    : 0;

  const staffStations = valid.map((s) => ({
    station: s.station,
    sequence: s.sequence,
    stdTimeSec: Number(s.stdTimeSec),
  }));

  // De-dup + sort the swept demand levels, dropping non-positive ones.
  const demands = Array.from(
    new Set(
      (opts.demands ?? [])
        .map((d) => Math.floor(Number(d) || 0))
        .filter((d) => d > 0),
    ),
  ).sort((a, b) => a - b);

  const points: SensitivityPoint[] = demands.map((demandUnits) => {
    const taktSec = availableTimeSec > 0 ? availableTimeSec / demandUnits : 0;
    const staffing = staffingPlan(staffStations, taktSec);
    const feasible = taktSec > 0 && bottleneckCycleSec <= taktSec + 1e-6;
    const cost = costModel(
      {
        operatorCount: staffing.totalOperators,
        taktSec,
        footprintAreaM2: opts.footprintAreaM2 ?? 0,
        assetCount: opts.assetCount ?? 0,
        stationCount: staffStations.length,
      },
      // The per-point demand IS the volume basis; scale to a single-shift month.
      { ...(opts.rates ?? {}), monthlyVolume: demandUnits * 20 },
    );
    return {
      demandUnits,
      taktSec: round(taktSec),
      operators: staffing.totalOperators,
      feasible,
      throughputPerHour: cost.throughputPerHour,
      costPerUnit: cost.totalCostPerUnit,
    };
  });

  const feasiblePts = points.filter((p) => p.feasible);
  const maxFeasibleDemand = feasiblePts.length
    ? Math.max(...feasiblePts.map((p) => p.demandUnits))
    : null;
  // Cheapest *feasible* point — an infeasible demand can't be run without
  // splitting a station, so it should never be the recommendation.
  const minCostPt = feasiblePts.reduce<SensitivityPoint | null>(
    (best, p) => (!best || p.costPerUnit < best.costPerUnit ? p : best),
    null,
  );

  return {
    availableTimeSec: round(availableTimeSec),
    bottleneckCycleSec: round(bottleneckCycleSec),
    maxFeasibleDemand,
    minCostDemand: minCostPt ? minCostPt.demandUnits : null,
    minCostPerUnit: minCostPt ? minCostPt.costPerUnit : null,
    points,
  };
}

/** Build a sensible ascending demand sweep of `steps` points around a center
 * demand (e.g. the planned demand), from ~40% to ~160% of it. */
export function demandSweep(centerDemand: number, steps = 9): number[] {
  const c = Math.max(1, Math.floor(Number(centerDemand) || 0));
  const n = Math.min(Math.max(3, Math.floor(steps) || 9), 25);
  const lo = Math.max(1, Math.round(c * 0.4));
  const hi = Math.max(lo + n, Math.round(c * 1.6));
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(Math.round(lo + ((hi - lo) * i) / (n - 1)));
  }
  return Array.from(new Set(out));
}
