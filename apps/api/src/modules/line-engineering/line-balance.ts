/**
 * Pure, side-effect-free line-balancing math for industrial engineering.
 *
 * Takt time  = available production time / customer demand (the drum beat).
 * Cycle time = time each station needs per unit (standard time).
 * A line is "balanced" when every station's cycle time is at or below takt and
 * the work is evenly distributed (high balance %). The slowest station is the
 * bottleneck — it sets the real line cycle time and caps throughput.
 *
 * Kept pure so the rules can be unit-tested without a database.
 */

export interface StationTime {
  station: string;
  sequence: number;
  stdTimeSec: number;
}

export interface BalanceResult {
  taktSec: number;
  stationCount: number;
  lineCycleTimeSec: number; // = bottleneck std time (slowest station)
  bottleneckStation: string | null;
  totalWorkSec: number;
  /** Line balance efficiency: total work / (stations × bottleneck). 0..1. */
  balancePct: number;
  /** Stations whose cycle time exceeds takt (constraints to fix). */
  stationsOverTakt: string[];
  /** Theoretical hourly throughput at the bottleneck (units/hour). */
  throughputPerHour: number;
  /** Theoretical minimum stations needed to hit takt (Σwork / takt). */
  theoreticalMinStations: number;
}

/** Takt time in seconds. Returns 0 when demand is non-positive. */
export function computeTaktSec(availableTimeSec: number, demandUnits: number): number {
  const t = Number(availableTimeSec) || 0;
  const d = Number(demandUnits) || 0;
  if (d <= 0 || t <= 0) return 0;
  return t / d;
}

export function balanceLine(
  stations: StationTime[],
  taktSec: number,
): BalanceResult {
  const valid = (stations ?? []).filter((s) => Number(s.stdTimeSec) > 0);
  const stationCount = valid.length;
  const totalWorkSec = valid.reduce((a, s) => a + Number(s.stdTimeSec), 0);

  let bottleneck: StationTime | null = null;
  for (const s of valid) {
    if (!bottleneck || Number(s.stdTimeSec) > Number(bottleneck.stdTimeSec)) {
      bottleneck = s;
    }
  }
  const lineCycleTimeSec = bottleneck ? Number(bottleneck.stdTimeSec) : 0;

  const balancePct =
    stationCount > 0 && lineCycleTimeSec > 0
      ? totalWorkSec / (stationCount * lineCycleTimeSec)
      : 0;

  const stationsOverTakt =
    taktSec > 0
      ? valid.filter((s) => Number(s.stdTimeSec) > taktSec + 1e-9).map((s) => s.station)
      : [];

  const throughputPerHour =
    lineCycleTimeSec > 0 ? 3600 / lineCycleTimeSec : 0;

  const theoreticalMinStations =
    taktSec > 0 ? Math.ceil(totalWorkSec / taktSec) : stationCount;

  return {
    taktSec: round(taktSec),
    stationCount,
    lineCycleTimeSec: round(lineCycleTimeSec),
    bottleneckStation: bottleneck?.station ?? null,
    totalWorkSec: round(totalWorkSec),
    balancePct: round(balancePct, 4),
    stationsOverTakt,
    throughputPerHour: round(throughputPerHour, 2),
    theoreticalMinStations,
  };
}

export interface LayoutItem {
  npExpected: string | null;
  useFactor: number | null;
  visualAidUrl: string | null;
  ctq: boolean;
}

export interface LayoutCompleteness {
  total: number;
  withVisualAid: number;
  withNp: number;
  withUseFactor: number;
  ctqCount: number;
  completenessPct: number; // share of stations that are fully specified
  incompleteStations: number;
}

/**
 * A station is "complete" when it declares the expected part number (poka-yoke),
 * a use factor (for backflush), and a visual aid (work instruction). CTQ flags
 * are tracked for visibility but don't gate completeness.
 */
export function layoutCompleteness(items: LayoutItem[]): LayoutCompleteness {
  const list = items ?? [];
  const total = list.length;
  const withVisualAid = list.filter((i) => !!i.visualAidUrl).length;
  const withNp = list.filter((i) => !!i.npExpected).length;
  const withUseFactor = list.filter((i) => Number(i.useFactor) > 0).length;
  const ctqCount = list.filter((i) => i.ctq).length;
  const complete = list.filter(
    (i) => !!i.visualAidUrl && !!i.npExpected && Number(i.useFactor) > 0,
  ).length;
  return {
    total,
    withVisualAid,
    withNp,
    withUseFactor,
    ctqCount,
    completenessPct: total > 0 ? round(complete / total, 4) : 0,
    incompleteStations: total - complete,
  };
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
