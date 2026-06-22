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

/**
 * Heat level for the layout cycle-time/utilization overlay (Fase 9).
 *   over — station cycle exceeds takt (a constraint that caps throughput)
 *   hot  — heavily loaded (near takt, or near the bottleneck when no takt)
 *   warm / cool — progressively lighter load
 *   cold — lightly loaded (candidate to absorb work when rebalancing)
 */
export type HeatLevel = 'cold' | 'cool' | 'warm' | 'hot' | 'over';

export interface StationHeat {
  station: string;
  sequence: number;
  cycleTimeSec: number;
  /** Cycle time vs takt, as a percentage. 0 when takt is unknown. */
  utilizationPct: number;
  /** Cycle time vs the bottleneck (slowest station), as a percentage. */
  loadPct: number;
  /** Normalized 0..1+ heat used to drive the color ramp. */
  heat: number;
  level: HeatLevel;
  bottleneck: boolean;
  overTakt: boolean;
}

export interface HeatmapResult {
  taktSec: number;
  lineCycleTimeSec: number; // bottleneck std time
  bottleneckStation: string | null;
  maxCycleTimeSec: number;
  avgCycleTimeSec: number;
  balancePct: number;
  stations: StationHeat[];
}

/**
 * Per-station cycle-time heatmap for the 2D layout overlay. Pure math: it ranks
 * each station's standard time against takt (when available) or against the
 * line bottleneck, so an engineer can SEE where the work piles up and which
 * stations starve. No takt → the ramp normalizes against the slowest station.
 */
export function stationHeatmap(
  stations: StationTime[],
  taktSec: number,
): HeatmapResult {
  const valid = (stations ?? []).filter((s) => Number(s.stdTimeSec) > 0);
  const takt = Number(taktSec) > 0 ? Number(taktSec) : 0;
  const cycles = valid.map((s) => Number(s.stdTimeSec));
  const maxCycle = cycles.length ? Math.max(...cycles) : 0;
  const totalWork = cycles.reduce((a, c) => a + c, 0);
  const avgCycle = cycles.length ? totalWork / cycles.length : 0;

  let bottleneck: StationTime | null = null;
  for (const s of valid) {
    if (!bottleneck || Number(s.stdTimeSec) > Number(bottleneck.stdTimeSec)) {
      bottleneck = s;
    }
  }
  const bottleneckStation = bottleneck?.station ?? null;
  const balancePct =
    valid.length > 0 && maxCycle > 0
      ? totalWork / (valid.length * maxCycle)
      : 0;

  const out: StationHeat[] = valid.map((s) => {
    const cycle = Number(s.stdTimeSec);
    const utilizationPct = takt > 0 ? (cycle / takt) * 100 : 0;
    const loadPct = maxCycle > 0 ? (cycle / maxCycle) * 100 : 0;
    const overTakt = takt > 0 && cycle > takt + 1e-9;

    let heat: number;
    let level: HeatLevel;
    if (takt > 0) {
      heat = cycle / takt;
      if (overTakt) level = 'over';
      else if (heat >= 0.85) level = 'hot';
      else if (heat >= 0.6) level = 'warm';
      else if (heat >= 0.35) level = 'cool';
      else level = 'cold';
    } else {
      heat = maxCycle > 0 ? cycle / maxCycle : 0;
      if (heat >= 0.9) level = 'hot';
      else if (heat >= 0.7) level = 'warm';
      else if (heat >= 0.45) level = 'cool';
      else level = 'cold';
    }

    return {
      station: s.station,
      sequence: s.sequence,
      cycleTimeSec: round(cycle),
      utilizationPct: round(utilizationPct, 1),
      loadPct: round(loadPct, 1),
      heat: round(heat, 4),
      level,
      bottleneck: s.station === bottleneckStation,
      overTakt,
    };
  });

  return {
    taktSec: round(takt),
    lineCycleTimeSec: round(maxCycle),
    bottleneckStation,
    maxCycleTimeSec: round(maxCycle),
    avgCycleTimeSec: round(avgCycle),
    balancePct: round(balancePct, 4),
    stations: out,
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
