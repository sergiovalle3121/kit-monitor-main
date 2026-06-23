/**
 * Pure, side-effect-free layout validation geometry for the 2D plan (Fase 11).
 *
 * Two placed objects must not physically overlap, and (optionally) must keep a
 * minimum clearance between them for aisles / safety. They must also stay inside
 * the footprint. This module answers "does this layout physically work?" using
 * oriented bounding boxes (stations/equipment can be rotated), the Separating
 * Axis Theorem for overlap, and box inflation for clearance.
 *
 * Kept pure so the rules can be unit-tested without a database or a canvas.
 */

export interface RectBox {
  id: string;
  label: string;
  kind: 'station' | 'asset';
  /** Center of the box, in layout units. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Rotation in degrees. */
  angle: number;
}

export type ConflictType = 'overlap' | 'clearance' | 'out_of_bounds';

export interface Conflict {
  type: ConflictType;
  a: string; // box id
  aLabel: string;
  b: string | null; // box id, or null for out_of_bounds
  bLabel: string | null;
}

export interface CollisionResult {
  conflicts: Conflict[];
  overlaps: number;
  clearanceIssues: number;
  outOfBounds: number;
  ok: boolean;
}

type Pt = { x: number; y: number };

function corners(b: RectBox, pad = 0): Pt[] {
  const rad = (b.angle || 0) * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = b.w / 2 + pad;
  const hh = b.h / 2 + pad;
  const local: Pt[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return local.map((p) => ({
    x: b.cx + p.x * cos - p.y * sin,
    y: b.cy + p.x * sin + p.y * cos,
  }));
}

function axes(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
    const len = Math.hypot(edge.x, edge.y) || 1;
    out.push({ x: -edge.y / len, y: edge.x / len }); // normal
  }
  return out;
}

function project(poly: Pt[], ax: Pt): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const p of poly) {
    const d = p.x * ax.x + p.y * ax.y;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}

/** Separating Axis Theorem overlap test for two convex polygons (rectangles). */
function polygonsOverlap(a: Pt[], b: Pt[]): boolean {
  for (const ax of [...axes(a), ...axes(b)]) {
    const pa = project(a, ax);
    const pb = project(b, ax);
    if (pa.max < pb.min - 1e-9 || pb.max < pa.min - 1e-9) return false; // gap → separated
  }
  return true;
}

export interface CollisionOptions {
  footprintW?: number;
  footprintH?: number;
  /** Minimum clearance between objects, in layout units. 0 disables the check. */
  minClearance?: number;
}

export function layoutCollisions(
  boxes: RectBox[],
  opts: CollisionOptions = {},
): CollisionResult {
  const list = (boxes ?? []).filter((b) => b.w > 0 && b.h > 0);
  const conflicts: Conflict[] = [];
  const clearance = Math.max(0, Number(opts.minClearance) || 0);

  // Precompute polygons once (and inflated polygons for the clearance pass).
  const polys = list.map((b) => corners(b));
  const inflated =
    clearance > 0 ? list.map((b) => corners(b, clearance / 2)) : null;

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (polygonsOverlap(polys[i], polys[j])) {
        conflicts.push({
          type: 'overlap',
          a: list[i].id,
          aLabel: list[i].label,
          b: list[j].id,
          bLabel: list[j].label,
        });
      } else if (inflated && polygonsOverlap(inflated[i], inflated[j])) {
        conflicts.push({
          type: 'clearance',
          a: list[i].id,
          aLabel: list[i].label,
          b: list[j].id,
          bLabel: list[j].label,
        });
      }
    }
  }

  // Out-of-bounds: any corner outside the footprint rectangle.
  const W = Number(opts.footprintW) || 0;
  const H = Number(opts.footprintH) || 0;
  if (W > 0 && H > 0) {
    list.forEach((b, idx) => {
      const out = polys[idx].some(
        (p) => p.x < -1e-6 || p.y < -1e-6 || p.x > W + 1e-6 || p.y > H + 1e-6,
      );
      if (out) {
        conflicts.push({
          type: 'out_of_bounds',
          a: b.id,
          aLabel: b.label,
          b: null,
          bLabel: null,
        });
      }
    });
  }

  const overlaps = conflicts.filter((c) => c.type === 'overlap').length;
  const clearanceIssues = conflicts.filter(
    (c) => c.type === 'clearance',
  ).length;
  const outOfBounds = conflicts.filter(
    (c) => c.type === 'out_of_bounds',
  ).length;
  return {
    conflicts,
    overlaps,
    clearanceIssues,
    outOfBounds,
    ok: conflicts.length === 0,
  };
}
