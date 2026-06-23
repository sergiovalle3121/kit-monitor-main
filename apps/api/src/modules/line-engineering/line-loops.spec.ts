import { balanceLoops, LoopStation } from './line-loops';

const ROUTE: LoopStation[] = [
  { station: 'EST-10', sequence: 10, cycleTimeSec: 40 },
  { station: 'EST-20', sequence: 20, cycleTimeSec: 55 }, // bottleneck
  { station: 'EST-30', sequence: 30, cycleTimeSec: 30 },
];

describe('balanceLoops (Fase 34)', () => {
  it('packs consecutive stations into operator loops capped at takt', () => {
    const plan = balanceLoops(ROUTE, { taktSec: 100 });
    expect(plan.cadenceSec).toBe(100);
    // 40+55 = 95 ≤ 100 → one loop; 30 → second loop. Two operators instead of
    // the three a per-station staffing would give.
    expect(plan.operatorCount).toBe(2);
    expect(plan.loops[0]).toMatchObject({
      stations: ['EST-10', 'EST-20'],
      totalTimeSec: 95,
      overTakt: false,
    });
    expect(plan.loops[0].idleSec).toBe(5);
    expect(plan.loops[1].stations).toEqual(['EST-30']);
    expect(plan.constraintLoopIndex).toBe(0);
    expect(plan.maxLoopTimeSec).toBe(95);
    // 125 work / (2 × 100) = 62.5%.
    expect(plan.balanceEfficiencyPct).toBeCloseTo(62.5, 1);
  });

  it('falls back to the bottleneck cycle as cadence when no takt is given', () => {
    const plan = balanceLoops(ROUTE);
    expect(plan.taktSec).toBe(0);
    expect(plan.cadenceSec).toBe(55);
    // Nothing combines under a 55s cap → one loop per station.
    expect(plan.operatorCount).toBe(3);
    expect(plan.loops[1]).toMatchObject({
      stations: ['EST-20'],
      utilizationPct: 100,
      overTakt: false,
    });
  });

  it('isolates and flags a station that alone exceeds the cadence', () => {
    const plan = balanceLoops(
      [
        { station: 'A', sequence: 1, cycleTimeSec: 30 },
        { station: 'B', sequence: 2, cycleTimeSec: 80 }, // > takt
        { station: 'C', sequence: 3, cycleTimeSec: 20 },
      ],
      { taktSec: 50 },
    );
    expect(plan.operatorCount).toBe(3);
    expect(plan.loops[1]).toMatchObject({
      stations: ['B'],
      overTakt: true,
      idleSec: 0,
    });
    expect(plan.loops[0].stations).toEqual(['A']);
    expect(plan.loops[2].stations).toEqual(['C']);
  });

  it('packs many tiny stations into a single operator loop and sorts by sequence', () => {
    const tiny: LoopStation[] = [
      { station: 'T3', sequence: 3, cycleTimeSec: 10 },
      { station: 'T1', sequence: 1, cycleTimeSec: 10 },
      { station: 'T4', sequence: 4, cycleTimeSec: 10 },
      { station: 'T2', sequence: 2, cycleTimeSec: 10 },
    ];
    const plan = balanceLoops(tiny, { taktSec: 50 });
    expect(plan.operatorCount).toBe(1);
    expect(plan.loops[0].stations).toEqual(['T1', 'T2', 'T3', 'T4']);
    expect(plan.loops[0].totalTimeSec).toBe(40);
    expect(plan.loops[0].utilizationPct).toBe(80);
  });

  it('returns an empty plan with no stations or no cadence', () => {
    expect(balanceLoops([], { taktSec: 60 }).loops).toEqual([]);
    const noCadence = balanceLoops([
      { station: 'A', sequence: 1, cycleTimeSec: 0 },
    ]);
    expect(noCadence.cadenceSec).toBe(0);
    expect(noCadence.operatorCount).toBe(0);
  });
});
