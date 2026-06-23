import { bufferPlan, BufferStation } from './line-buffer';

const ROUTE: BufferStation[] = [
  { station: 'EST-10', sequence: 10, cycleTimeSec: 40 },
  { station: 'EST-20', sequence: 20, cycleTimeSec: 55 }, // bottleneck
  { station: 'EST-30', sequence: 30, cycleTimeSec: 30 },
];

describe('bufferPlan (Fase 33)', () => {
  it('sizes buffers from coverage/cadence and flags the bottleneck gaps', () => {
    const plan = bufferPlan(ROUTE, { taktSec: 60, coverageSec: 120 });
    expect(plan.cadenceSec).toBe(60);
    expect(plan.bottleneckStation).toBe('EST-20');
    // base = 120/60 = 2 units; tighter station 55s → 55/60 ≈ 0.917.
    expect(plan.gaps).toHaveLength(2);
    expect(plan.gaps[0]).toMatchObject({
      fromStation: 'EST-10',
      toStation: 'EST-20',
      recommendedUnits: 2, // ceil(2 * 0.917)
      critical: true, // feeds the bottleneck
    });
    expect(plan.gaps[0].tightnessPct).toBeCloseTo(91.7, 1);
    expect(plan.gaps[1]).toMatchObject({
      fromStation: 'EST-20',
      toStation: 'EST-30',
      critical: true, // follows the bottleneck
    });
    expect(plan.totalWipUnits).toBe(4);
    // Little's law: 4 units × 60s cadence.
    expect(plan.addedLeadTimeSec).toBe(240);
    expect(plan.criticalGaps).toBe(2);
  });

  it('falls back to the bottleneck cycle as cadence when no takt is given', () => {
    const plan = bufferPlan(ROUTE, { coverageSec: 110 });
    expect(plan.taktSec).toBe(0);
    expect(plan.cadenceSec).toBe(55); // bottleneck cycle
    // base = 110/55 = 2; tightness at the bottleneck = 1.
    expect(plan.gaps.map((g) => g.recommendedUnits)).toEqual([2, 2]);
    expect(plan.totalWipUnits).toBe(4);
    expect(plan.addedLeadTimeSec).toBe(220); // 4 × 55
  });

  it('gives fast pairs less buffer than near-takt pairs and sorts by sequence', () => {
    const unordered: BufferStation[] = [
      { station: 'S3', sequence: 30, cycleTimeSec: 95 }, // bottleneck
      { station: 'S1', sequence: 10, cycleTimeSec: 10 },
      { station: 'S2', sequence: 20, cycleTimeSec: 10 },
    ];
    const plan = bufferPlan(unordered, { taktSec: 100, coverageSec: 1000 });
    // base = 1000/100 = 10.
    expect(plan.gaps.map((g) => [g.fromStation, g.toStation])).toEqual([
      ['S1', 'S2'],
      ['S2', 'S3'],
    ]);
    // Fast pair (10s) → tightness 0.1 → ceil(1) = 1.
    expect(plan.gaps[0].recommendedUnits).toBe(1);
    // Near-takt pair (95s) → tightness 0.95 → ceil(9.5) = 10, and critical.
    expect(plan.gaps[1]).toMatchObject({
      recommendedUnits: 10,
      critical: true,
    });
  });

  it('never recommends less than one unit per gap', () => {
    const plan = bufferPlan(
      [
        { station: 'A', sequence: 1, cycleTimeSec: 5 },
        { station: 'B', sequence: 2, cycleTimeSec: 5 },
      ],
      { taktSec: 1000, coverageSec: 10 },
    );
    expect(plan.gaps[0].recommendedUnits).toBe(1);
    expect(plan.totalWipUnits).toBe(1);
  });

  it('returns an empty plan for fewer than two stations or no cadence', () => {
    expect(bufferPlan([], { taktSec: 60 }).gaps).toEqual([]);
    expect(
      bufferPlan([{ station: 'A', sequence: 1, cycleTimeSec: 30 }], {
        taktSec: 60,
      }).totalWipUnits,
    ).toBe(0);
    // No takt and no cycle times → no cadence to size against.
    const noCadence = bufferPlan(
      [
        { station: 'A', sequence: 1, cycleTimeSec: 0 },
        { station: 'B', sequence: 2, cycleTimeSec: 0 },
      ],
      {},
    );
    expect(noCadence.cadenceSec).toBe(0);
    expect(noCadence.gaps).toEqual([]);
  });
});
