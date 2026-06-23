import { autoArrange, ArrangeStation } from './line-autoarrange';

const fp = { footprintW: 1000, footprintH: 1000, gridSize: 10 };

describe('autoArrange (serpentine packing)', () => {
  const mk = (
    id: string,
    sequence: number,
    w = 200,
    h = 100,
  ): ArrangeStation => ({
    id,
    sequence,
    w,
    h,
  });

  it('places every station once, in routing order, snapped to the grid', () => {
    const out = autoArrange([mk('c', 30), mk('a', 10), mk('b', 20)], fp, {
      margin: 50,
      gap: 20,
    });
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c']); // sorted by sequence
    expect(out).toHaveLength(3);
    out.forEach((p) => {
      expect(p.x % fp.gridSize).toBe(0);
      expect(p.y % fp.gridSize).toBe(0);
      expect(p.rotation).toBe(0);
    });
  });

  it('lays the first row left-to-right with the requested gap', () => {
    const out = autoArrange([mk('a', 1), mk('b', 2)], fp, {
      margin: 50,
      gap: 20,
    });
    const a = out.find((p) => p.id === 'a')!;
    const b = out.find((p) => p.id === 'b')!;
    expect(a.x).toBe(50); // margin
    expect(a.y).toBe(50);
    expect(b.x).toBe(50 + 200 + 20); // after a + gap
    expect(b.y).toBe(a.y); // same row
  });

  it('wraps into a new row when the footprint width is exceeded', () => {
    // usableW = 1000 - 2*50 = 900. Four 200-wide fit (width 860); the 5th wraps.
    const stations = [1, 2, 3, 4, 5, 6].map((n) => mk(`s${n}`, n));
    const out = autoArrange(stations, fp, { margin: 50, gap: 20 });
    const rowsByY = new Set(out.map((p) => p.y));
    expect(rowsByY.size).toBe(2); // row1: s1..s4, row2: s5,s6
    const s5 = out.find((p) => p.id === 's5')!;
    expect(s5.y).toBeGreaterThan(50); // wrapped onto the second row
  });

  it('serpentines: the wrapped row is mirrored so flow snakes back', () => {
    const stations = [1, 2, 3, 4, 5, 6].map((n) => mk(`s${n}`, n));
    const ser = autoArrange(stations, fp, {
      margin: 50,
      gap: 20,
      serpentine: true,
    });
    const straight = autoArrange(stations, fp, {
      margin: 50,
      gap: 20,
      serpentine: false,
    });
    const s5Ser = ser.find((p) => p.id === 's5')!;
    const s5Straight = straight.find((p) => p.id === 's5')!;
    // First item of the wrapped row sits on opposite sides depending on mode.
    expect(s5Straight.x).toBe(50); // straight: back to the left margin
    expect(s5Ser.x).toBeGreaterThan(s5Straight.x); // serpentine: starts from the right
  });

  it('is empty-safe', () => {
    expect(autoArrange([], fp)).toEqual([]);
  });
});
