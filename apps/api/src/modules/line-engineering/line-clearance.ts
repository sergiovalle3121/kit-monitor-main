/**
 * Pure, side-effect-free clearance / aisle analysis for the plant layout
 * (Fase 43 — apoya al CAD).
 *
 * Collision (Fase 6) answers "do two things overlap?". This answers the next
 * question a layout review asks: "is there enough room *between and around*
 * everything to move and work safely?" — i.e. aisles, forklift/AGV access and
 * elbow room. Given the placed stations and equipment plus a minimum clearance,
 * it reports the pairs that sit closer than that gap, anything that overlaps or
 * spills past the footprint, the objects crowding the walls, and a single
 * circulation score.
 *
 * Boxes are treated axis-aligned (rotation ignored — a conservative bound that
 * never *under*-reports a tight gap). Kept pure so the geometry is unit-testable
 * without a DB or a canvas. All distances are in the layout's unit.
 */

export interface ClearanceBox {
  id: string;
  label: string;
  kind: 'station' | 'equipment';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClearanceInput {
  footprintW: number;
  footprintH: number;
  /** Minimum acceptable gap between objects and to the walls, in unit. */
  minClearance: number;
  boxes: ClearanceBox[];
}

export interface ClearancePair {
  a: string; // box id
  b: string; // box id
  aLabel: string;
  bLabel: string;
  gap: number; // edge-to-edge distance (0 when touching)
}

export interface ClearanceResult {
  minClearance: number;
  boxCount: number;
  /** Non-overlapping pairs closer than minClearance, tightest first. */
  tightPairs: ClearancePair[];
  /** Overlapping pairs (gap 0 in both axes), worst first. */
  overlaps: ClearancePair[];
  /** Ids of boxes extending beyond the footprint. */
  outOfBounds: string[];
  /** Ids of boxes closer than minClearance to a footprint wall. */
  perimeterTight: string[];
  /** Smallest non-overlapping gap found (Infinity → 0 when none). */
  minGap: number;
  /** Share of boxes with no clearance issue, 0..100. */
  clearancePct: number;
}

const round = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/** Edge-to-edge gap between two axis-aligned boxes; <0 marker via `overlap`. */
function gapBetween(a: ClearanceBox, b: ClearanceBox): { gap: number; overlap: boolean } {
  const dx = Math.max(0, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)));
  const dy = Math.max(0, Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
  if (dx === 0 && dy === 0) return { gap: 0, overlap: true };
  return { gap: Math.hypot(dx, dy), overlap: false };
}

/**
 * Compute the clearance picture for a placed layout. `minClearance` is clamped
 * to ≥0; boxes with non-positive size are ignored.
 */
export function computeClearance(input: ClearanceInput): ClearanceResult {
  const minC = Math.max(0, input.minClearance || 0);
  const boxes = (input.boxes || []).filter((b) => b.w > 0 && b.h > 0);
  const W = input.footprintW || 0;
  const H = input.footprintH || 0;

  const tightPairs: ClearancePair[] = [];
  const overlaps: ClearancePair[] = [];
  const flagged = new Set<string>();
  let minGap = Infinity;

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const { gap, overlap } = gapBetween(a, b);
      const pair: ClearancePair = { a: a.id, b: b.id, aLabel: a.label, bLabel: b.label, gap: round(gap) };
      if (overlap) {
        overlaps.push(pair);
        flagged.add(a.id); flagged.add(b.id);
      } else {
        if (gap < minGap) minGap = gap;
        if (gap < minC) {
          tightPairs.push(pair);
          flagged.add(a.id); flagged.add(b.id);
        }
      }
    }
  }

  const outOfBounds: string[] = [];
  const perimeterTight: string[] = [];
  for (const b of boxes) {
    if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H) {
      outOfBounds.push(b.id);
      flagged.add(b.id);
      continue;
    }
    const edge = Math.min(b.x, b.y, W - (b.x + b.w), H - (b.y + b.h));
    if (edge < minC) {
      perimeterTight.push(b.id);
      flagged.add(b.id);
    }
  }

  tightPairs.sort((p, q) => p.gap - q.gap);
  overlaps.sort((p, q) => p.a.localeCompare(q.a));

  const clearancePct = boxes.length
    ? round((100 * (boxes.length - flagged.size)) / boxes.length, 0)
    : 100;

  return {
    minClearance: minC,
    boxCount: boxes.length,
    tightPairs,
    overlaps,
    outOfBounds,
    perimeterTight,
    minGap: minGap === Infinity ? 0 : round(minGap),
    clearancePct,
  };
}
