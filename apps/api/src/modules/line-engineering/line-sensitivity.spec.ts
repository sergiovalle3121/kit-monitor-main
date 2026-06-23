import {
  sensitivityCurve,
  demandSweep,
  SensitivityStation,
} from './line-sensitivity';

const ROUTE: SensitivityStation[] = [
  { station: 'EST-10', sequence: 10, stdTimeSec: 40 },
  { station: 'EST-20', sequence: 20, stdTimeSec: 55 }, // bottleneck
  { station: 'EST-30', sequence: 30, stdTimeSec: 30 },
];

describe('sensitivityCurve (Fase 36)', () => {
  it('sweeps demand into takt, operators, feasibility and unit cost', () => {
    // 8 h shift = 28 800 s available.
    const r = sensitivityCurve(ROUTE, {
      availableTimeSec: 28800,
      demands: [100, 400, 600],
      rates: { laborCostPerHour: 8 },
    });
    expect(r.bottleneckCycleSec).toBe(55);
    expect(r.points).toHaveLength(3);

    const p100 = r.points[0];
    expect(p100.taktSec).toBe(288); // 28800/100
    expect(p100.operators).toBe(3); // one per station fits
    expect(p100.feasible).toBe(true);

    const p400 = r.points[1];
    expect(p400.taktSec).toBe(72); // 28800/400
    expect(p400.operators).toBe(3);
    expect(p400.feasible).toBe(true); // 55 ≤ 72

    const p600 = r.points[2];
    expect(p600.taktSec).toBe(48); // 28800/600
    expect(p600.feasible).toBe(false); // 55 > 48 → bottleneck can't hold takt
    expect(p600.operators).toBe(4); // EST-20 needs 2 operators

    // Economies of scale: cost/unit falls as demand rises (labor better used).
    expect(p400.costPerUnit).toBeLessThan(p100.costPerUnit);
  });

  it('reports the demand ceiling and the cheapest *feasible* demand', () => {
    const r = sensitivityCurve(ROUTE, {
      availableTimeSec: 28800,
      demands: [100, 400, 600],
      rates: { laborCostPerHour: 8 },
    });
    // 600 is infeasible → ceiling is 400.
    expect(r.maxFeasibleDemand).toBe(400);
    // Cheapest feasible point is 400 (better operator utilization than 100),
    // never the infeasible 600 even if its labor/unit looks lower.
    expect(r.minCostDemand).toBe(400);
    expect(r.minCostPerUnit).toBeGreaterThan(0);
  });

  it('de-dups and sorts the swept demand, dropping non-positive values', () => {
    const r = sensitivityCurve(ROUTE, {
      availableTimeSec: 28800,
      demands: [400, 100, 400, 0, -5],
    });
    expect(r.points.map((p) => p.demandUnits)).toEqual([100, 400]);
  });

  it('handles no available time (takt 0 → infeasible) without NaN', () => {
    const r = sensitivityCurve(ROUTE, {
      availableTimeSec: 0,
      demands: [100],
    });
    expect(r.points[0].taktSec).toBe(0);
    expect(r.points[0].feasible).toBe(false);
    expect(r.maxFeasibleDemand).toBeNull();
    expect(Number.isNaN(r.points[0].costPerUnit)).toBe(false);
  });
});

describe('demandSweep (Fase 36)', () => {
  it('builds an ascending sweep around the planned demand', () => {
    const sweep = demandSweep(400, 9);
    expect(sweep[0]).toBe(160); // ~40% of 400
    expect(sweep[sweep.length - 1]).toBe(640); // ~160% of 400
    expect(sweep.length).toBeLessThanOrEqual(9);
    // Strictly ascending.
    for (let i = 1; i < sweep.length; i += 1) {
      expect(sweep[i]).toBeGreaterThan(sweep[i - 1]);
    }
  });
});
