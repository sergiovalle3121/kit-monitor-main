import { standardWork, StdWorkStation } from './line-stdwork';

// S1—S2 are 10 m apart, S2—S3 are 5 m apart (positions in mm).
const PLACED: StdWorkStation[] = [
  { station: 'S1', sequence: 1, manualSec: 40, cx: 0, cy: 0 },
  { station: 'S2', sequence: 2, manualSec: 50, cx: 10000, cy: 0 },
  { station: 'S3', sequence: 3, manualSec: 30, cx: 10000, cy: 5000 },
];

describe('standardWork (Fase 38)', () => {
  it('adds walk to manual and flags a loop that busts takt once walking counts', () => {
    const sw = standardWork(PLACED, { taktSec: 100, walkSpeedMps: 1 });
    expect(sw.cadenceSec).toBe(100);
    // Loop balancer groups [S1,S2] (90s manual ≤ 100) and [S3].
    expect(sw.loops).toHaveLength(2);

    const l0 = sw.loops[0];
    expect(l0.steps.map((s) => s.station)).toEqual(['S1', 'S2']);
    expect(l0.manualSec).toBe(90);
    // Cyclic walk: S1→S2 (10 m) + S2→S1 (10 m) = 20 m at 1 m/s = 20 s.
    expect(l0.walkSec).toBe(20);
    expect(l0.totalSec).toBe(110);
    // The whole point: fits on manual, busts takt with the walk added.
    expect(l0.withinTakt).toBe(false);

    const l1 = sw.loops[1];
    expect(l1.steps.map((s) => s.station)).toEqual(['S3']);
    expect(l1.walkSec).toBe(0); // single-station loop → no walk
    expect(l1.withinTakt).toBe(true);

    expect(sw.totalManualSec).toBe(120);
    expect(sw.totalWalkSec).toBe(20);
    expect(sw.walkPct).toBeCloseTo(14.3, 1); // 20 / 140
    expect(sw.loopsOverTakt).toBe(1);
    expect(sw.placedRatioPct).toBe(100);
  });

  it('counts zero walk when stations are not placed', () => {
    const unplaced = PLACED.map((s) => ({ ...s, cx: null, cy: null }));
    const sw = standardWork(unplaced, { taktSec: 100, walkSpeedMps: 1 });
    expect(sw.totalWalkSec).toBe(0);
    expect(sw.walkPct).toBe(0);
    expect(sw.placedRatioPct).toBe(0);
    // Without walk, the [S1,S2] loop (90s) holds takt.
    expect(sw.loops[0].withinTakt).toBe(true);
    expect(sw.loopsOverTakt).toBe(0);
  });

  it('a faster walking speed shrinks the walk and can recover takt', () => {
    const sw = standardWork(PLACED, { taktSec: 100, walkSpeedMps: 2 });
    // 20 m at 2 m/s = 10 s → loop total 100 ≤ takt.
    expect(sw.loops[0].walkSec).toBe(10);
    expect(sw.loops[0].totalSec).toBe(100);
    expect(sw.loops[0].withinTakt).toBe(true);
  });

  it('falls back to the bottleneck manual time as cadence with no takt', () => {
    const sw = standardWork(PLACED, { walkSpeedMps: 1 });
    expect(sw.taktSec).toBe(0);
    expect(sw.cadenceSec).toBe(50); // bottleneck manual (S2)
    // At a 50s cap nothing combines → one loop per station.
    expect(sw.loops).toHaveLength(3);
  });

  it('returns an empty table when there is no manual work', () => {
    const sw = standardWork([], { taktSec: 100 });
    expect(sw.loops).toEqual([]);
    expect(sw.totalManualSec).toBe(0);
    expect(sw.loopsOverTakt).toBe(0);
  });
});
