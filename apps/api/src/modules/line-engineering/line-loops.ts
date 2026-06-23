/**
 * Pure, side-effect-free operator-loop balancing for a line (Fase 34).
 *
 * Staffing (Fase 16) asks how many operators each station needs on its own.
 * This asks the complementary question: if ONE operator can tend several quick
 * adjacent stations (a "loop" / water-spider zone, walking between them), what
 * is the fewest operators that can run the line without any loop exceeding takt?
 * It walks the routing in sequence and greedily packs consecutive stations into
 * loops capped at the cadence — the concrete realization of the theoretical
 * minimum-stations number, respecting process order.
 *
 * Kept pure so the rules can be unit-tested without a database or a canvas.
 */

export interface LoopStation {
  station: string;
  sequence: number;
  cycleTimeSec: number;
}

export interface OperatorLoop {
  index: number;
  stations: string[];
  totalTimeSec: number;
  /** Slack to the cadence (cadence − total), 0 when the loop is over takt. */
  idleSec: number;
  utilizationPct: number;
  /** A single station alone that already exceeds the cadence — needs splitting
   * or parallel operators (staffing covers that). */
  overTakt: boolean;
}

export interface LoopPlan {
  /** Cadence used to cap loops: the takt, or the bottleneck cycle with no takt. */
  cadenceSec: number;
  taktSec: number;
  loops: OperatorLoop[];
  operatorCount: number;
  stationCount: number;
  /** Σ work / (operators × cadence), % — how evenly the loops are loaded. */
  balanceEfficiencyPct: number;
  maxLoopTimeSec: number;
  constraintLoopIndex: number | null;
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

const EPS = 1e-6;

export function balanceLoops(
  stations: LoopStation[],
  opts: { taktSec?: number } = {},
): LoopPlan {
  const route = (stations ?? [])
    .map((s) => ({
      station: s.station,
      sequence: Number(s.sequence) || 0,
      cycle: Math.max(0, Number(s.cycleTimeSec) || 0),
    }))
    .filter((s) => s.cycle > 0)
    .sort((a, b) => a.sequence - b.sequence);

  const takt = Math.max(0, Number(opts.taktSec) || 0);
  const bottleneck = route.length ? Math.max(...route.map((s) => s.cycle)) : 0;
  const cadence = takt > 0 ? takt : bottleneck;

  if (cadence <= 0 || route.length === 0) {
    return {
      cadenceSec: round(cadence),
      taktSec: round(takt),
      loops: [],
      operatorCount: 0,
      stationCount: 0,
      balanceEfficiencyPct: 0,
      maxLoopTimeSec: 0,
      constraintLoopIndex: null,
    };
  }

  // Greedy first-fit by sequence: accumulate consecutive stations into a loop
  // until the next one would push it past the cadence. A station that alone
  // exceeds the cadence becomes its own (over-takt) loop.
  const groups: { stations: string[]; total: number }[] = [];
  let cur: { stations: string[]; total: number } | null = null;
  for (const s of route) {
    if (s.cycle > cadence + EPS) {
      if (cur) {
        groups.push(cur);
        cur = null;
      }
      groups.push({ stations: [s.station], total: s.cycle });
      continue;
    }
    if (!cur) {
      cur = { stations: [s.station], total: s.cycle };
    } else if (cur.total + s.cycle <= cadence + EPS) {
      cur.stations.push(s.station);
      cur.total += s.cycle;
    } else {
      groups.push(cur);
      cur = { stations: [s.station], total: s.cycle };
    }
  }
  if (cur) groups.push(cur);

  const loops: OperatorLoop[] = groups.map((g, i) => {
    const overTakt = g.total > cadence + EPS;
    return {
      index: i,
      stations: g.stations,
      totalTimeSec: round(g.total),
      idleSec: round(Math.max(0, cadence - g.total)),
      utilizationPct: round((g.total / cadence) * 100, 1),
      overTakt,
    };
  });

  const totalWork = route.reduce((a, s) => a + s.cycle, 0);
  const maxLoopTimeSec = loops.reduce((m, l) => Math.max(m, l.totalTimeSec), 0);
  const constraint = loops.reduce<OperatorLoop | null>(
    (best, l) => (!best || l.totalTimeSec > best.totalTimeSec ? l : best),
    null,
  );

  return {
    cadenceSec: round(cadence),
    taktSec: round(takt),
    loops,
    operatorCount: loops.length,
    stationCount: route.length,
    balanceEfficiencyPct: loops.length
      ? round((totalWork / (loops.length * cadence)) * 100, 1)
      : 0,
    maxLoopTimeSec,
    constraintLoopIndex: constraint ? constraint.index : null,
  };
}
