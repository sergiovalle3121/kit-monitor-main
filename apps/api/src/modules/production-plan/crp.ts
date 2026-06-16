/**
 * Pure CRP (capacity requirements planning) roll-up for the plan wall.
 *
 * The wall publishes work orders; this turns the open WOs into a per-line load
 * vs capacity read so planning can *validate* the plan (is a line overbooked?),
 * not just reflect it. The minute-level run/changeover figures come from the
 * existing line-engineering capacity calculator (routing std times + the
 * model↔line changeover); this module only aggregates them per line and decides
 * the verdict. Kept side-effect-free so the math is unit-tested without a DB.
 */

/** One shift ≈ 8 h of run time. Callers may override with real available time. */
export const DEFAULT_SHIFT_MINUTES = 480;

export type CapacityStatus = 'idle' | 'optimal' | 'warning' | 'overloaded';

/** Per (model, revision) demand summarized on a line, with its computed load. */
export interface ModelLoad {
  model: string;
  revision: string;
  woCount: number;
  unitsRemaining: number;
  runMinutes: number; // Σ bottleneck cycle × units
  changeoverMinutes: number; // once per model on the line
  /** False when the model has no routing/std time, so its run load is unknown. */
  hasStdTime: boolean;
}

export interface LineCapacityLoad {
  line: string;
  availableMinutes: number;
  woCount: number;
  unitsRemaining: number;
  runMinutes: number;
  changeoverMinutes: number;
  requiredMinutes: number;
  utilizationPct: number;
  feasible: boolean;
  status: CapacityStatus;
  /** Models on the line whose run time can't be computed (missing routing). */
  modelsWithoutStdTime: number;
  models: ModelLoad[];
}

const round = (n: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
};

/**
 * Classify a line's utilization. Over 100% it cannot fit the available time
 * (overloaded / infeasible); a tight-but-feasible band warns; anything with real
 * load below that is optimal; zero computed load is idle.
 */
export function classifyUtilization(utilizationPct: number): CapacityStatus {
  const u = Number(utilizationPct) || 0;
  if (u > 100) return 'overloaded';
  if (u > 85) return 'warning';
  if (u > 0) return 'optimal';
  return 'idle';
}

/** Roll a line's per-model loads into a single capacity verdict. */
export function rollUpLine(
  line: string,
  models: ModelLoad[],
  availableMinutes: number,
): LineCapacityLoad {
  const avail = Number(availableMinutes) || 0;
  const runMinutes = round(
    models.reduce((a, m) => a + (Number(m.runMinutes) || 0), 0),
  );
  const changeoverMinutes = round(
    models.reduce((a, m) => a + (Number(m.changeoverMinutes) || 0), 0),
  );
  const requiredMinutes = round(runMinutes + changeoverMinutes);
  const woCount = models.reduce((a, m) => a + (Number(m.woCount) || 0), 0);
  const unitsRemaining = models.reduce(
    (a, m) => a + (Number(m.unitsRemaining) || 0),
    0,
  );
  const utilizationPct =
    avail > 0 ? round((requiredMinutes / avail) * 100, 1) : 0;
  const modelsWithoutStdTime = models.filter((m) => !m.hasStdTime).length;

  return {
    line,
    availableMinutes: avail,
    woCount,
    unitsRemaining,
    runMinutes,
    changeoverMinutes,
    requiredMinutes,
    utilizationPct,
    feasible: avail > 0 ? requiredMinutes <= avail : false,
    status: classifyUtilization(utilizationPct),
    modelsWithoutStdTime,
    models: models.map((m) => ({
      ...m,
      runMinutes: round(m.runMinutes),
      changeoverMinutes: round(m.changeoverMinutes),
    })),
  };
}
