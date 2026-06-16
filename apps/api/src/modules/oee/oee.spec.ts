import { computeOee, weightedIdealCycleSec, clamp01 } from './oee';

describe('computeOee (pure helper)', () => {
  it('computes the textbook OEE = A × P × Q', () => {
    // 480 min planned, 60 min down → 420 run. Ideal cycle 60s, 400 pieces →
    // ideal run = 400 min. Quality 380/400.
    const r = computeOee({
      plannedTimeMin: 480,
      downtimeMin: 60,
      idealCycleSec: 60,
      totalPieces: 400,
      goodPieces: 380,
    });
    expect(r.runTimeMin).toBe(420);
    expect(r.availability).toBe(0.875); // 420/480
    expect(r.performance).toBeCloseTo(0.9524, 4); // 400/420
    expect(r.quality).toBe(0.95); // 380/400
    expect(r.oee).toBeCloseTo(0.875 * (400 / 420) * 0.95, 4);
  });

  it('clamps performance at 1 when the line runs faster than ideal cycle', () => {
    const r = computeOee({
      plannedTimeMin: 100,
      downtimeMin: 0,
      idealCycleSec: 120, // 2 min/pc ideal
      totalPieces: 100, // ideal run = 200 min > 100 run → >1 raw
      goodPieces: 100,
    });
    expect(r.performance).toBe(1);
    expect(r.availability).toBe(1);
    expect(r.quality).toBe(1);
    expect(r.oee).toBe(1);
  });

  it('availability is 0 when there is no planned time', () => {
    const r = computeOee({
      plannedTimeMin: 0,
      downtimeMin: 0,
      idealCycleSec: 60,
      totalPieces: 10,
      goodPieces: 10,
    });
    expect(r.availability).toBe(0);
    expect(r.oee).toBe(0);
  });

  it('downtime exceeding planned time floors run time (and OEE) at 0', () => {
    const r = computeOee({
      plannedTimeMin: 100,
      downtimeMin: 150,
      idealCycleSec: 60,
      totalPieces: 10,
      goodPieces: 10,
    });
    expect(r.runTimeMin).toBe(0);
    expect(r.availability).toBe(0);
    expect(r.performance).toBe(0);
    expect(r.oee).toBe(0);
  });

  it('no production → quality and OEE are 0 (no signal)', () => {
    const r = computeOee({
      plannedTimeMin: 480,
      downtimeMin: 30,
      idealCycleSec: 60,
      totalPieces: 0,
      goodPieces: 0,
    });
    expect(r.performance).toBe(0);
    expect(r.quality).toBe(0);
    expect(r.oee).toBe(0);
    expect(r.availability).toBeCloseTo(450 / 480, 4); // availability still meaningful
  });

  it('clamps good pieces into [0, total] (defensive)', () => {
    const r = computeOee({
      plannedTimeMin: 60,
      downtimeMin: 0,
      idealCycleSec: 60,
      totalPieces: 50,
      goodPieces: 999,
    });
    expect(r.goodPieces).toBe(50);
    expect(r.quality).toBe(1);
  });

  it('coerces garbage inputs to 0 instead of NaN', () => {
    const r = computeOee({
      plannedTimeMin: NaN,
      downtimeMin: undefined as unknown as number,
      idealCycleSec: 'x' as unknown as number,
      totalPieces: -5,
      goodPieces: -1,
    });
    expect(r.oee).toBe(0);
    expect(r.availability).toBe(0);
    expect(Number.isNaN(r.oee)).toBe(false);
  });
});

describe('weightedIdealCycleSec', () => {
  it('weights ideal cycle by pieces so the line formula stays exact', () => {
    // 30 pcs @ 60s + 10 pcs @ 120s = (1800 + 1200)/40 = 75s
    const w = weightedIdealCycleSec([
      { taktSec: 60, pieces: 30 },
      { taktSec: 120, pieces: 10 },
    ]);
    expect(w).toBe(75);
    // and it reconstructs the ideal run time exactly: 75 * 40 / 60 = 50 min
    const r = computeOee({
      plannedTimeMin: 100,
      downtimeMin: 0,
      idealCycleSec: w,
      totalPieces: 40,
      goodPieces: 40,
    });
    expect(r.idealRunTimeMin).toBe(50);
    expect(r.performance).toBe(0.5);
  });

  it('returns 0 for an empty mix', () => {
    expect(weightedIdealCycleSec([])).toBe(0);
  });
});

describe('clamp01', () => {
  it('clamps into [0,1] and zeroes non-finite/negative', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(1);
  });
});
