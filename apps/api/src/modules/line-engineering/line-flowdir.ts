/**
 * Pure, side-effect-free flow-direction analysis for the 2D layout (Fase 21).
 *
 * Material should advance through the routing sequence; when consecutive routing
 * steps are placed so that a hop runs AGAINST the net flow direction, the part
 * back-tracks — wasted travel and a smell of a layout to rearrange. The net
 * direction is simply first→last placed station (the telescoping sum of hops),
 * so a serpentine layout (whose within-row hops are sideways, perpendicular to
 * the net direction) is NOT falsely flagged: only hops that genuinely point back
 * toward the start count as back-tracking.
 *
 * Kept pure so the rule can be unit-tested without a database or a canvas.
 */

export interface FlowDirStation {
  station: string;
  sequence: number;
  cx: number;
  cy: number;
}

export interface FlowDirHop {
  from: string;
  to: string;
  distance: number; // physical hop length
  backtrack: number; // how far it goes against the net direction
}

export interface FlowDirectionResult {
  placedCount: number;
  hasDirection: boolean;
  forwardDistance: number;
  backtrackDistance: number;
  directionalEfficiencyPct: number; // 0..100, share of progress that goes forward
  backtrackCount: number;
  backtrackHops: FlowDirHop[]; // worst first
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export function flowDirection(stations: FlowDirStation[]): FlowDirectionResult {
  const seq = [...(stations ?? [])].sort((a, b) => a.sequence - b.sequence);
  const empty: FlowDirectionResult = {
    placedCount: seq.length,
    hasDirection: false,
    forwardDistance: 0,
    backtrackDistance: 0,
    directionalEfficiencyPct: 0,
    backtrackCount: 0,
    backtrackHops: [],
  };
  if (seq.length < 2) return empty;

  const first = seq[0];
  const last = seq[seq.length - 1];
  const nx = last.cx - first.cx;
  const ny = last.cy - first.cy;
  const netLen = Math.hypot(nx, ny);
  if (netLen < 1) return empty; // no meaningful net direction (loops back on itself)

  const ux = nx / netLen;
  const uy = ny / netLen;
  let forwardDistance = 0;
  let backtrackDistance = 0;
  const hops: FlowDirHop[] = [];

  for (let i = 0; i < seq.length - 1; i += 1) {
    const a = seq[i];
    const b = seq[i + 1];
    const hx = b.cx - a.cx;
    const hy = b.cy - a.cy;
    const proj = hx * ux + hy * uy; // signed progress along the net direction
    if (proj >= 0) {
      forwardDistance += proj;
    } else {
      backtrackDistance += -proj;
      hops.push({
        from: a.station,
        to: b.station,
        distance: round(Math.hypot(hx, hy)),
        backtrack: round(-proj),
      });
    }
  }

  hops.sort((a, b) => b.backtrack - a.backtrack);
  const denom = forwardDistance + backtrackDistance;
  return {
    placedCount: seq.length,
    hasDirection: true,
    forwardDistance: round(forwardDistance),
    backtrackDistance: round(backtrackDistance),
    directionalEfficiencyPct:
      denom > 0 ? round((forwardDistance / denom) * 100, 1) : 100,
    backtrackCount: hops.length,
    backtrackHops: hops,
  };
}
