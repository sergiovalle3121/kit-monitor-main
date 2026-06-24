import { computeDensity, DensityBox } from './line-density';

// A 2×2 grid over a 10×10 footprint → each cell is 5×5 (area 25).
function grid2x2(boxes: DensityBox[]) {
  return computeDensity({ footprintW: 10, footprintH: 10, cols: 2, rows: 2, boxes });
}
const box = (x: number, y: number, w: number, h: number): DensityBox => ({ x, y, w, h });

describe('computeDensity (Fase 48)', () => {
  it('bins a box that fills one cell as 100% there and empty elsewhere', () => {
    const r = grid2x2([box(0, 0, 5, 5)]);
    expect(r.grid).toEqual([
      [100, 0],
      [0, 0],
    ]);
    expect(r.utilizationPct).toBe(25); // 25 of 100 units of floor
    expect(r.peakPct).toBe(100);
    expect(r.busiest).toMatchObject({ row: 0, col: 0, pct: 100 });
    expect(r.hotCells).toBe(1);
    expect(r.emptyCells).toBe(3);
    expect(r.boxCount).toBe(1);
  });

  it('computes partial occupancy when a box covers only part of a cell', () => {
    const r = grid2x2([box(0, 0, 2, 2)]); // 4 of the cell's 25 units → 16%
    expect(r.grid[0][0]).toBe(16);
    expect(r.utilizationPct).toBe(4);
  });

  it('clamps overlapping boxes so a cell never exceeds 100%', () => {
    const r = grid2x2([box(0, 0, 5, 5), box(0, 0, 5, 5)]);
    expect(r.grid[0][0]).toBe(100);
    expect(r.utilizationPct).toBe(25); // double-count clamped away
  });

  it('rates an evenly-spread layout as perfectly even', () => {
    const r = grid2x2([box(0, 0, 5, 5), box(5, 0, 5, 5), box(0, 5, 5, 5), box(5, 5, 5, 5)]);
    expect(r.evennessPct).toBe(100);
    expect(r.utilizationPct).toBe(100);
    expect(r.hotCells).toBe(4);
    expect(r.emptyCells).toBe(0);
  });

  it('flags a concentrated, uneven layout', () => {
    const r = grid2x2([box(0, 0, 5, 5)]); // one packed cell, three empty
    expect(r.evennessPct).toBeLessThan(40);
    expect(r.issues).toContain('1 zona(s) congestionada(s) (≥80% ocupadas)');
    expect(r.issues).toContain('Carga muy desigual: zonas saturadas junto a zonas vacías');
  });

  it('clips the part of a box that spills outside the footprint', () => {
    const r = grid2x2([box(8, 8, 10, 10)]); // only x[8..10] y[8..10] is in-bounds
    expect(r.grid[1][1]).toBe(16); // 2×2 of the 5×5 corner cell
    expect(r.utilizationPct).toBe(4);
  });

  it('is safe with nothing placed', () => {
    const r = grid2x2([]);
    expect(r.boxCount).toBe(0);
    expect(r.utilizationPct).toBe(0);
    expect(r.peakPct).toBe(0);
    expect(r.evennessPct).toBe(0);
    expect(r.busiest).toBeNull();
    expect(r.grid).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(r.issues).toContain('No hay nada colocado que evaluar');
  });
});
