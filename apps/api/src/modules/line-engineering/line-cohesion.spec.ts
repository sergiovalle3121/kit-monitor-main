import { computeCohesion, CohesionStation } from './line-cohesion';

const st = (id: string, line: string, cx: number, cy: number, w = 2, h = 2): CohesionStation => ({
  id,
  station: id,
  line,
  cx,
  cy,
  w,
  h,
});

describe('computeCohesion (Fase 46)', () => {
  it('rates two compact, well-separated lines fully cohesive', () => {
    const r = computeCohesion({
      stations: [
        st('A1', 'L-A', 1, 1),
        st('A2', 'L-A', 3, 1), // L-A tiles x[0..4] y[0..2]
        st('B1', 'L-B', 1, 11),
        st('B2', 'L-B', 3, 11), // L-B far below, tiles x[0..4] y[10..12]
      ],
    });
    expect(r.cohesive).toBe(true);
    expect(r.cohesionPct).toBe(100);
    expect(r.lineCount).toBe(2);
    expect(r.intruders).toEqual([]);
    expect(r.overlapPairs).toBe(0);
    expect(r.groups.every((g) => g.fillPct === 100)).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('flags a single line scattered across the floor (low fill) yet still cohesive', () => {
    const r = computeCohesion({ stations: [st('A1', 'L-A', 0, 0), st('A2', 'L-A', 20, 20)] });
    expect(r.lineCount).toBe(1);
    expect(r.cohesive).toBe(true); // no intermixing — only one line
    expect(r.cohesionPct).toBe(100);
    expect(r.mostScattered!.line).toBe('L-A');
    expect(r.mostScattered!.fillPct).toBeLessThan(25);
    expect(r.issues.some((i) => i.includes('muy dispersa'))).toBe(true);
  });

  it('detects an intruder station sitting inside another line region', () => {
    const r = computeCohesion({
      stations: [
        st('A1', 'L-A', 5, 5, 10, 10), // L-A region x[0..10] y[0..10]
        st('B1', 'L-B', 8, 8, 1, 1), // centre (8,8) lands inside L-A
      ],
    });
    expect(r.cohesive).toBe(false);
    expect(r.intruders).toHaveLength(1);
    expect(r.intruders[0]).toMatchObject({ station: 'B1', line: 'L-B', insideLine: 'L-A' });
    expect(r.cohesionPct).toBe(50); // 1 of 2 stations intruding
    expect(r.issues.some((i) => i.includes('intercaladas'))).toBe(true);
  });

  it('reports overlapping line regions even without an intruder', () => {
    const r = computeCohesion({
      stations: [
        st('A1', 'L-A', 5, 1, 10, 2), // bbox y[0..2]
        st('B1', 'L-B', 5, 2.4, 10, 1.2), // bbox y[1.8..3.0] — overlaps A's band
      ],
    });
    expect(r.overlapPairs).toBe(1);
    expect(r.intruders).toEqual([]); // neither centre falls inside the other box
    expect(r.cohesive).toBe(true);
  });

  it('computes partial cohesion from the intruder ratio', () => {
    const r = computeCohesion({
      stations: [
        st('A1', 'L-A', 1, 1, 2, 2),
        st('A2', 'L-A', 9, 1, 2, 2),
        st('A3', 'L-A', 5, 9, 2, 2), // L-A bbox x[0..10] y[0..10]
        st('B1', 'L-B', 5, 5, 2, 2), // intrudes
      ],
    });
    expect(r.placedCount).toBe(4);
    expect(r.intruders).toHaveLength(1);
    expect(r.cohesionPct).toBe(75);
  });

  it('ignores stations with a non-positive footprint', () => {
    const r = computeCohesion({
      stations: [st('A1', 'L-A', 1, 1), { ...st('A2', 'L-A', 3, 1), w: 0 }],
    });
    expect(r.placedCount).toBe(1);
    expect(r.groups[0].stationCount).toBe(1);
  });

  it('is safe with nothing placed', () => {
    const r = computeCohesion({ stations: [] });
    expect(r.placedCount).toBe(0);
    expect(r.lineCount).toBe(0);
    expect(r.cohesionPct).toBe(0);
    expect(r.cohesive).toBe(false);
    expect(r.mostScattered).toBeNull();
    expect(r.issues).toContain('No hay estaciones colocadas que evaluar');
  });
});
