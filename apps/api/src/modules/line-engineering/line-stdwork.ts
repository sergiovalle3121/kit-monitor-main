/**
 * Pure, side-effect-free Standard Work Combination Table for a line (Fase 38).
 *
 * The operator-loop balancer (Fase 34) groups stations into loops by MANUAL
 * time alone. The standard work combination table adds the other half an
 * operator actually spends: WALKING between the stations of the loop. Using the
 * placed positions it measures the walk in each loop and combines manual + walk
 * against takt — revealing loops that look fine on paper but bust takt once the
 * walking is counted, the classic reason a "balanced" line still can't hold its
 * cycle. The layout-native complement to the loop balancer.
 *
 * Kept pure so the math can be unit-tested without a database or a canvas.
 */

import { balanceLoops } from './line-loops';

export interface StdWorkStation {
  station: string;
  sequence: number;
  manualSec: number;
  /** Footprint center in layout units; null when the station isn't placed. */
  cx: number | null;
  cy: number | null;
}

export interface StdWorkStep {
  station: string;
  manualSec: number;
  /** Walk from this station to the next in the loop (cyclic), in seconds. */
  walkSec: number;
}

export interface StdWorkLoop {
  index: number;
  steps: StdWorkStep[];
  manualSec: number;
  walkSec: number;
  totalSec: number;
  utilizationPct: number;
  withinTakt: boolean;
}

export interface StdWorkResult {
  cadenceSec: number;
  taktSec: number;
  walkSpeedMps: number;
  loops: StdWorkLoop[];
  totalManualSec: number;
  totalWalkSec: number;
  /** Share of total operator time spent walking, %. */
  walkPct: number;
  loopsOverTakt: number;
  /** Stations with a placed position, %. Walk is only real where placed. */
  placedRatioPct: number;
}

export interface StdWorkOptions {
  taktSec?: number;
  /** Operator walking speed, m/s (default 1.0 — unhurried shop-floor pace). */
  walkSpeedMps?: number;
  /** Metres per layout unit, to convert distances (default 0.001 = mm). */
  metersPerUnit?: number;
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export function standardWork(
  stations: StdWorkStation[],
  opts: StdWorkOptions = {},
): StdWorkResult {
  const list = (stations ?? []).filter((s) => Number(s.manualSec) > 0);
  const walkSpeed =
    opts.walkSpeedMps && opts.walkSpeedMps > 0 ? opts.walkSpeedMps : 1.0;
  const metersPerUnit =
    opts.metersPerUnit && opts.metersPerUnit > 0 ? opts.metersPerUnit : 0.001;

  // Reuse the loop balancer for the grouping (by manual time), then layer walk.
  const grouping = balanceLoops(
    list.map((s) => ({
      station: s.station,
      sequence: s.sequence,
      cycleTimeSec: s.manualSec,
    })),
    { taktSec: opts.taktSec },
  );

  const byStation = new Map(list.map((s) => [s.station, s]));
  const dist = (a: StdWorkStation, b: StdWorkStation): number => {
    if (a.cx === null || a.cy === null || b.cx === null || b.cy === null) {
      return 0; // can't measure walk to/from an unplaced station
    }
    return Math.hypot(b.cx - a.cx, b.cy - a.cy) * metersPerUnit;
  };

  const cadence = grouping.cadenceSec;
  const loops: StdWorkLoop[] = grouping.loops.map((loop) => {
    const members = loop.stations
      .map((name) => byStation.get(name))
      .filter((s): s is StdWorkStation => !!s);
    const k = members.length;
    const steps: StdWorkStep[] = members.map((s, i) => {
      // Cyclic walk: from this station to the next (last walks back to first).
      const next = members[(i + 1) % k];
      const walkSec = k > 1 ? dist(s, next) / walkSpeed : 0;
      return {
        station: s.station,
        manualSec: round(s.manualSec),
        walkSec: round(walkSec),
      };
    });
    const manualSec = steps.reduce((a, s) => a + s.manualSec, 0);
    const walkSec = steps.reduce((a, s) => a + s.walkSec, 0);
    const totalSec = manualSec + walkSec;
    return {
      index: loop.index,
      steps,
      manualSec: round(manualSec),
      walkSec: round(walkSec),
      totalSec: round(totalSec),
      utilizationPct: cadence > 0 ? round((totalSec / cadence) * 100, 1) : 0,
      withinTakt: cadence > 0 ? totalSec <= cadence + 1e-6 : false,
    };
  });

  const totalManualSec = loops.reduce((a, l) => a + l.manualSec, 0);
  const totalWalkSec = loops.reduce((a, l) => a + l.walkSec, 0);
  const grand = totalManualSec + totalWalkSec;
  const placed = list.filter((s) => s.cx !== null && s.cy !== null).length;

  return {
    cadenceSec: round(cadence),
    taktSec: round(Math.max(0, Number(opts.taktSec) || 0)),
    walkSpeedMps: round(walkSpeed, 2),
    loops,
    totalManualSec: round(totalManualSec),
    totalWalkSec: round(totalWalkSec),
    walkPct: grand > 0 ? round((totalWalkSec / grand) * 100, 1) : 0,
    loopsOverTakt: loops.filter((l) => !l.withinTakt).length,
    placedRatioPct: list.length ? round((placed / list.length) * 100, 1) : 0,
  };
}
