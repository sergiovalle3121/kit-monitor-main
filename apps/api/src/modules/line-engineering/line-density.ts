/**
 * Pure, side-effect-free occupancy-density grid for the 2D layout (Fase 48).
 *
 * Clearance (Fase 43) looks at pairwise gaps; this looks at the floor ZONALLY.
 * It bins the footprints of everything placed (stations + equipment) into a
 * coarse grid and reports, per cell, how much of it is occupied — turning the
 * plan into a heat map. That surfaces what a single utilisation number can't:
 * congestion clusters (a corner packed solid) next to large dead zones (wasted
 * floor), and how evenly the layout spreads its load.
 *
 * Kept pure so the binning can be unit-tested without a database or a canvas.
 */

export interface DensityBox {
  /** Top-left corner + size, in layout units. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DensityInput {
  footprintW: number;
  footprintH: number;
  cols: number;
  rows: number;
  boxes: DensityBox[];
}

export interface DensityResult {
  cols: number;
  rows: number;
  /** Occupancy per cell, 0..100, indexed [row][col]. */
  grid: number[][];
  /** Overall occupied area ÷ footprint area, 0..100. */
  utilizationPct: number;
  /** Busiest cell occupancy, 0..100. */
  peakPct: number;
  /** Mean cell occupancy, 0..100. */
  avgPct: number;
  /** Cells at or above 80% — congested. */
  hotCells: number;
  /** Cells below 1% — effectively empty floor. */
  emptyCells: number;
  /** The single most occupied cell, or null when nothing is placed. */
  busiest: { row: number; col: number; pct: number } | null;
  /** How evenly load spreads (100 = perfectly even), 0..100. */
  evennessPct: number;
  boxCount: number;
  issues: string[];
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}

/** Bin placed footprints into an occupancy heat-map grid (pure). */
export function computeDensity(input: DensityInput): DensityResult {
  const cols = Math.max(1, Math.floor(input.cols));
  const rows = Math.max(1, Math.floor(input.rows));
  const W = input.footprintW > 0 ? input.footprintW : 1;
  const H = input.footprintH > 0 ? input.footprintH : 1;
  const cellW = W / cols;
  const cellH = H / rows;
  const cellArea = cellW * cellH;

  const boxes = (input.boxes ?? []).filter((b) => b.w > 0 && b.h > 0);

  // Accumulate covered area per cell from each box's intersection with the cell.
  const area: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (const b of boxes) {
    const bx0 = b.x;
    const by0 = b.y;
    const bx1 = b.x + b.w;
    const by1 = b.y + b.h;
    // Only the cells the box can touch (clamped to the grid).
    const c0 = Math.max(0, Math.floor(bx0 / cellW));
    const c1 = Math.min(cols - 1, Math.floor((bx1 - 1e-9) / cellW));
    const r0 = Math.max(0, Math.floor(by0 / cellH));
    const r1 = Math.min(rows - 1, Math.floor((by1 - 1e-9) / cellH));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ix = Math.max(0, Math.min(bx1, (c + 1) * cellW) - Math.max(bx0, c * cellW));
        const iy = Math.max(0, Math.min(by1, (r + 1) * cellH) - Math.max(by0, r * cellH));
        area[r][c] += ix * iy;
      }
    }
  }

  const grid: number[][] = [];
  const flat: number[] = [];
  let occupied = 0;
  let peak = 0;
  let busiest: { row: number; col: number; pct: number } | null = null;
  let hotCells = 0;
  let emptyCells = 0;
  for (let r = 0; r < rows; r++) {
    const rowOut: number[] = [];
    for (let c = 0; c < cols; c++) {
      const covered = Math.min(area[r][c], cellArea);
      occupied += covered;
      const pct = cellArea > 0 ? Math.min(100, (100 * covered) / cellArea) : 0;
      const rounded = round(pct);
      rowOut.push(rounded);
      flat.push(pct);
      if (pct >= 80) hotCells++;
      if (pct < 1) emptyCells++;
      if (pct > peak) {
        peak = pct;
        busiest = { row: r, col: c, pct: rounded };
      }
    }
    grid.push(rowOut);
  }

  const cellCount = rows * cols;
  const footprintArea = W * H;
  const utilizationPct = footprintArea > 0 ? round(Math.min(100, (100 * occupied) / footprintArea)) : 0;
  const avg = flat.reduce((a, v) => a + v, 0) / (cellCount || 1);

  // Evenness via coefficient of variation: 100 when load is spread uniformly,
  // lower as it concentrates into fewer cells. Only meaningful with some load.
  let evennessPct = 100;
  if (avg > 0) {
    const variance = flat.reduce((a, v) => a + (v - avg) ** 2, 0) / cellCount;
    const cv = Math.sqrt(variance) / avg;
    evennessPct = round(Math.max(0, Math.min(100, 100 * (1 - cv))));
  } else {
    evennessPct = 0;
  }

  const issues: string[] = [];
  if (boxes.length === 0) {
    issues.push('No hay nada colocado que evaluar');
  } else {
    if (hotCells > 0) issues.push(`${hotCells} zona(s) congestionada(s) (≥80% ocupadas)`);
    if (utilizationPct < 15) issues.push(`Aprovechamiento bajo del piso (${utilizationPct}%)`);
    if (evennessPct < 40) issues.push('Carga muy desigual: zonas saturadas junto a zonas vacías');
  }

  return {
    cols,
    rows,
    grid,
    utilizationPct,
    peakPct: round(peak),
    avgPct: round(avg),
    hotCells,
    emptyCells,
    busiest,
    evennessPct,
    boxCount: boxes.length,
    issues,
  };
}
