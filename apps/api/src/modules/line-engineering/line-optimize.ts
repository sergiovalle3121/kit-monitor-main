/**
 * Pure, side-effect-free flow-layout optimization (Fase 23).
 *
 * Given a set of uniform candidate slots (their centers) and the flow graph
 * (edges between stations), this assigns each station to a slot so the total
 * material travel along the flow edges is as short as possible. It starts from
 * the routing order (stations in sequence → slots in order, i.e. the serpentine
 * auto-arrange) and improves it with 2-opt swaps. The result is just an ORDER —
 * the caller repacks the real (own-sized) boxes in that order.
 *
 * Kept pure so the search can be unit-tested without a database or a canvas.
 */

export interface OptStation {
  id: string;
  sequence: number;
}

export interface OptSlot {
  cx: number;
  cy: number;
}

export interface OptEdge {
  from: string; // station id
  to: string; // station id
}

export interface OptimizeResult {
  /** Station ids in their optimized slot order (slot k → order[k]). */
  order: string[];
  costBefore: number;
  costAfter: number;
  improvedPct: number; // 0..100, share of travel removed
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}

export function optimizeFlowOrder(
  stations: OptStation[],
  slots: OptSlot[],
  edges: OptEdge[],
): OptimizeResult {
  const sorted = [...(stations ?? [])].sort((a, b) => a.sequence - b.sequence);
  const n = Math.min(sorted.length, slots?.length ?? 0);
  const ids = sorted.slice(0, n).map((s) => s.id);

  // slotStation[k] = station id currently placed in slot k.
  const slotStation = ids.slice();
  const valid = new Set(ids);
  const links = (edges ?? []).filter(
    (e) => e.from !== e.to && valid.has(e.from) && valid.has(e.to),
  );

  const identity: OptimizeResult = {
    order: slotStation.slice(),
    costBefore: 0,
    costAfter: 0,
    improvedPct: 0,
  };
  if (n < 2 || links.length === 0) return identity;

  const cost = (arrangement: string[]): number => {
    const slotOf = new Map<string, number>();
    arrangement.forEach((id, k) => slotOf.set(id, k));
    let total = 0;
    for (const e of links) {
      const ka = slotOf.get(e.from)!;
      const kb = slotOf.get(e.to)!;
      total += Math.hypot(
        slots[ka].cx - slots[kb].cx,
        slots[ka].cy - slots[kb].cy,
      );
    }
    return total;
  };

  const costBefore = cost(slotStation);

  // 2-opt: swap the stations in two slots while it shortens total travel.
  let improved = true;
  let passes = 0;
  const MAX_PASSES = 60;
  while (improved && passes < MAX_PASSES) {
    improved = false;
    passes += 1;
    let best = cost(slotStation);
    for (let i = 0; i < n - 1; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const tmp = slotStation[i];
        slotStation[i] = slotStation[j];
        slotStation[j] = tmp;
        const c = cost(slotStation);
        if (c < best - 1e-6) {
          best = c;
          improved = true;
        } else {
          // revert
          slotStation[j] = slotStation[i];
          slotStation[i] = tmp;
        }
      }
    }
  }

  const costAfter = cost(slotStation);
  return {
    order: slotStation.slice(),
    costBefore: round(costBefore),
    costAfter: round(costAfter),
    improvedPct:
      costBefore > 0
        ? round(((costBefore - costAfter) / costBefore) * 100, 1)
        : 0,
  };
}
