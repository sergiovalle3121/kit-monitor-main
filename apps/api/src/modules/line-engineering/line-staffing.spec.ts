import { staffingPlan, StaffStation } from './line-staffing';

const mk = (
  station: string,
  sequence: number,
  stdTimeSec: number,
): StaffStation => ({
  station,
  sequence,
  stdTimeSec,
});

describe('staffingPlan (manning math)', () => {
  it('needs one operator per station when every cycle is within takt', () => {
    const r = staffingPlan([mk('a', 1, 40), mk('b', 2, 55)], 60);
    expect(r.totalOperators).toBe(2);
    expect(r.stations.every((s) => s.operators === 1)).toBe(true);
  });

  it('adds parallel operators when a station exceeds takt', () => {
    // 130s cycle at 60s takt → ⌈130/60⌉ = 3 operators in parallel.
    const r = staffingPlan([mk('a', 1, 40), mk('big', 2, 130)], 60);
    const big = r.stations.find((s) => s.station === 'big')!;
    expect(big.operators).toBe(3);
    expect(r.totalOperators).toBe(4); // 1 + 3
    // Per-operator load on the big station: 130 / (3×60) ≈ 72.2%.
    expect(big.utilizationPct).toBeCloseTo(72.2, 0);
  });

  it('ignores stations with no standard time', () => {
    const r = staffingPlan([mk('a', 1, 40), mk('z', 2, 0)], 60);
    expect(r.stationCount).toBe(1);
    expect(r.totalOperators).toBe(1);
  });

  it('falls back to one operator per station with no takt', () => {
    const r = staffingPlan([mk('a', 1, 40), mk('b', 2, 130)], 0);
    expect(r.taktSec).toBe(0);
    expect(r.totalOperators).toBe(2);
    expect(r.stations.every((s) => s.operators === 1)).toBe(true);
  });

  it('is empty-safe', () => {
    expect(staffingPlan([], 60)).toMatchObject({
      totalOperators: 0,
      stationCount: 0,
      avgUtilizationPct: 0,
    });
  });
});
