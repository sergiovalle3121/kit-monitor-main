/**
 * Pure, side-effect-free manning/staffing math for a line (Fase 16).
 *
 * At a given takt, a station whose cycle time exceeds takt cannot keep up with
 * one operator — it needs parallel operators (or splitting). This computes how
 * many operators each station needs (⌈cycle / takt⌉) and the line total, plus
 * how loaded each operator ends up (utilization). It answers "how many people
 * does this line need to hit demand?" — the staffing side of line balancing.
 *
 * Kept pure so the rules can be unit-tested without a database.
 */

export interface StaffStation {
  station: string;
  sequence: number;
  stdTimeSec: number;
}

export interface StationStaffing {
  station: string;
  sequence: number;
  cycleTimeSec: number;
  operators: number;
  /** Load per operator at this station: cycle / (operators × takt), %. */
  utilizationPct: number;
}

export interface StaffingResult {
  taktSec: number;
  totalOperators: number;
  stationCount: number;
  /** Mean per-operator utilization across staffed stations, %. */
  avgUtilizationPct: number;
  stations: StationStaffing[];
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export function staffingPlan(
  stations: StaffStation[],
  taktSec: number,
): StaffingResult {
  const takt = Number(taktSec) > 0 ? Number(taktSec) : 0;
  const valid = (stations ?? []).filter((s) => Number(s.stdTimeSec) > 0);

  const out: StationStaffing[] = valid.map((s) => {
    const cycle = Number(s.stdTimeSec);
    // No takt → assume one operator per staffed station (the floor case).
    const operators = takt > 0 ? Math.max(1, Math.ceil(cycle / takt)) : 1;
    const utilizationPct = takt > 0 ? (cycle / (operators * takt)) * 100 : 0;
    return {
      station: s.station,
      sequence: s.sequence,
      cycleTimeSec: round(cycle),
      operators,
      utilizationPct: round(utilizationPct, 1),
    };
  });

  const totalOperators = out.reduce((a, s) => a + s.operators, 0);
  const avgUtilizationPct =
    out.length > 0
      ? round(out.reduce((a, s) => a + s.utilizationPct, 0) / out.length, 1)
      : 0;

  return {
    taktSec: round(takt),
    totalOperators,
    stationCount: out.length,
    avgUtilizationPct,
    stations: out,
  };
}
