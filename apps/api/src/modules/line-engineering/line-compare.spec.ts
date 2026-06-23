import { compareLayouts, LayoutKpis } from './line-compare';

function kpis(over: Partial<LayoutKpis>): LayoutKpis {
  return {
    model: 'AX',
    revision: 'A',
    stations: 3,
    placed: 3,
    readinessPct: 100,
    utilizationPct: 40,
    assetCount: 2,
    flowDistance: 1000,
    crossings: 0,
    overlaps: 0,
    outOfBounds: 0,
    balancePct: 80,
    bottleneckStation: 'EST-20',
    lineCycleTimeSec: 55,
    operators: 3,
    costPerUnit: 1.0,
    ...over,
  };
}

describe('compareLayouts (Fase 37)', () => {
  it('scores each KPI for the better side honoring its good direction', () => {
    const a = kpis({
      revision: 'A',
      costPerUnit: 1.2,
      operators: 4,
      balancePct: 70,
    });
    const b = kpis({
      revision: 'B',
      costPerUnit: 0.9,
      operators: 3,
      balancePct: 85,
    });
    const cmp = compareLayouts(a, b);

    const byKey = Object.fromEntries(cmp.deltas.map((d) => [d.key, d]));
    // Lower cost is better → B wins, delta = 0.9 − 1.2 = −0.3.
    expect(byKey.costPerUnit).toMatchObject({ betterSide: 'b' });
    expect(byKey.costPerUnit.delta).toBeCloseTo(-0.3, 6);
    // Fewer operators is better → B.
    expect(byKey.operators.betterSide).toBe('b');
    // Higher balance is better → B.
    expect(byKey.balancePct.betterSide).toBe('b');
    // B wins those three; the rest tie.
    expect(cmp.scoreB).toBeGreaterThanOrEqual(3);
    expect(cmp.verdict).toBe('b');
  });

  it('calls an exact KPI a tie and leaves the score even', () => {
    const a = kpis({});
    const b = kpis({}); // identical
    const cmp = compareLayouts(a, b);
    expect(cmp.scoreA).toBe(0);
    expect(cmp.scoreB).toBe(0);
    expect(cmp.verdict).toBe('tie');
    expect(cmp.deltas.every((d) => d.betterSide === 'tie')).toBe(true);
  });

  it('marks a KPI not-available when either side is missing', () => {
    const a = kpis({ costPerUnit: null, operators: null });
    const b = kpis({ costPerUnit: 0.8, operators: 3 });
    const cmp = compareLayouts(a, b);
    const byKey = Object.fromEntries(cmp.deltas.map((d) => [d.key, d]));
    expect(byKey.costPerUnit).toMatchObject({ betterSide: 'na', delta: null });
    expect(byKey.operators.betterSide).toBe('na');
    // NA KPIs don't score for anyone.
    expect(cmp.scoreA + cmp.scoreB).toBeLessThanOrEqual(cmp.deltas.length - 2);
  });

  it('splits the verdict when each side wins different KPIs', () => {
    // A cheaper but worse balance; B better balance but pricier.
    const a = kpis({ costPerUnit: 0.8, balancePct: 70 });
    const b = kpis({ costPerUnit: 1.0, balancePct: 90 });
    const cmp = compareLayouts(a, b);
    const byKey = Object.fromEntries(cmp.deltas.map((d) => [d.key, d]));
    expect(byKey.costPerUnit.betterSide).toBe('a');
    expect(byKey.balancePct.betterSide).toBe('b');
    expect(cmp.scoreA).toBe(1);
    expect(cmp.scoreB).toBe(1);
    expect(cmp.verdict).toBe('tie');
  });
});
