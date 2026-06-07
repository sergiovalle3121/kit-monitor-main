import {
  balanceLine,
  computeTaktSec,
  layoutCompleteness,
} from './line-balance';

describe('line-balance (pure)', () => {
  it('computes takt = available time / demand', () => {
    expect(computeTaktSec(28800, 480)).toBe(60); // 8h shift / 480 units = 60s
    expect(computeTaktSec(28800, 0)).toBe(0);
    expect(computeTaktSec(0, 100)).toBe(0);
  });

  it('finds the bottleneck and line cycle time (slowest station)', () => {
    const r = balanceLine(
      [
        { station: 'A', sequence: 1, stdTimeSec: 40 },
        { station: 'B', sequence: 2, stdTimeSec: 55 },
        { station: 'C', sequence: 3, stdTimeSec: 30 },
      ],
      60,
    );
    expect(r.bottleneckStation).toBe('B');
    expect(r.lineCycleTimeSec).toBe(55);
    expect(r.totalWorkSec).toBe(125);
    // balance = 125 / (3 * 55) = 0.7576
    expect(r.balancePct).toBeCloseTo(0.7576, 3);
    expect(r.stationsOverTakt).toEqual([]); // all ≤ 60
    expect(r.throughputPerHour).toBeCloseTo(65.45, 1); // 3600/55
  });

  it('flags stations over takt as constraints', () => {
    const r = balanceLine(
      [
        { station: 'A', sequence: 1, stdTimeSec: 70 },
        { station: 'B', sequence: 2, stdTimeSec: 30 },
      ],
      60,
    );
    expect(r.stationsOverTakt).toEqual(['A']);
    expect(r.theoreticalMinStations).toBe(2); // ceil(100/60)
  });

  it('a perfectly balanced line is 100%', () => {
    const r = balanceLine(
      [
        { station: 'A', sequence: 1, stdTimeSec: 50 },
        { station: 'B', sequence: 2, stdTimeSec: 50 },
      ],
      60,
    );
    expect(r.balancePct).toBe(1);
  });

  it('measures layout completeness (np + use factor + visual aid)', () => {
    const c = layoutCompleteness([
      { npExpected: 'P1', useFactor: 1, visualAidUrl: 'a', ctq: true },
      { npExpected: 'P2', useFactor: 2, visualAidUrl: null, ctq: false }, // no aid
      { npExpected: null, useFactor: 1, visualAidUrl: 'c', ctq: false }, // no np
    ]);
    expect(c.total).toBe(3);
    expect(c.withVisualAid).toBe(2);
    expect(c.withNp).toBe(2);
    expect(c.ctqCount).toBe(1);
    expect(c.incompleteStations).toBe(2);
    expect(c.completenessPct).toBeCloseTo(0.3333, 3);
  });
});
