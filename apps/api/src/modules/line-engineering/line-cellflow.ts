/**
 * Pure, side-effect-free inter-cell flow analysis (Fase 28).
 *
 * In cellular manufacturing the goal is to keep material flow WITHIN a cell;
 * flow that crosses cell boundaries (inter-cell) is the cost of a poor cell
 * decomposition. Given the stations (with their cell membership and centers)
 * and the flow connectors, this splits the travel into intra-cell vs inter-cell
 * and reports the share that crosses boundaries. Connectors touching a station
 * with no cell are tallied apart (they don't belong to the ratio).
 *
 * Kept pure so the rule can be unit-tested without a database or a canvas.
 */

export interface CellFlowNode {
  id: string;
  cellId: string | null;
  cx: number;
  cy: number;
}

export interface CellFlowLink {
  from: string;
  to: string;
}

export interface CellFlowSegment {
  from: string;
  to: string;
  distance: number;
}

export interface CellFlowResult {
  intraCount: number;
  interCount: number;
  unassignedCount: number; // links touching an uncelled station
  intraDistance: number;
  interDistance: number;
  /** Share of celled-to-celled travel that crosses a cell boundary, %. */
  interPct: number;
  interSegments: CellFlowSegment[]; // inter-cell hops, longest first
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export function cellFlow(
  nodes: CellFlowNode[],
  links: CellFlowLink[],
): CellFlowResult {
  const byId = new Map((nodes ?? []).map((n) => [n.id, n]));
  let intraCount = 0;
  let interCount = 0;
  let unassignedCount = 0;
  let intraDistance = 0;
  let interDistance = 0;
  const interSegments: CellFlowSegment[] = [];

  for (const l of links ?? []) {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (!a || !b) continue;
    const distance = Math.hypot(a.cx - b.cx, a.cy - b.cy);
    if (a.cellId === null || b.cellId === null) {
      unassignedCount += 1;
      continue;
    }
    if (a.cellId === b.cellId) {
      intraCount += 1;
      intraDistance += distance;
    } else {
      interCount += 1;
      interDistance += distance;
      interSegments.push({ from: l.from, to: l.to, distance: round(distance) });
    }
  }

  interSegments.sort((x, y) => y.distance - x.distance);
  const denom = intraDistance + interDistance;
  return {
    intraCount,
    interCount,
    unassignedCount,
    intraDistance: round(intraDistance),
    interDistance: round(interDistance),
    interPct: denom > 0 ? round((interDistance / denom) * 100, 1) : 0,
    interSegments,
  };
}
