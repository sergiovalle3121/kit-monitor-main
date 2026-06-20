import { computeStandardCost } from './costing';

describe('computeStandardCost', () => {
  it('combines material + labor + overhead (overhead on direct cost)', () => {
    // material 100, labor 120 min @ $30/h = $60, direct 160, overhead 15% = 24
    const r = computeStandardCost({
      materialCost: 100,
      laborMinutes: 120,
      laborRatePerHour: 30,
      overheadPct: 15,
      qty: 10,
    });
    expect(r.laborCost).toBe(60);
    expect(r.overheadCost).toBe(24);
    expect(r.totalCost).toBe(184);
    expect(r.unitCost).toBe(18.4); // 184 / 10
  });

  it('computes breakdown percentages that sum to ~100', () => {
    const r = computeStandardCost({ materialCost: 100, laborMinutes: 120, laborRatePerHour: 30, overheadPct: 15, qty: 1 });
    const sum = r.breakdown.reduce((s, b) => s + b.percentage, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it('handles zero labor / overhead (pure material)', () => {
    const r = computeStandardCost({ materialCost: 50, laborMinutes: 0, laborRatePerHour: 30, overheadPct: 0, qty: 5 });
    expect(r.laborCost).toBe(0);
    expect(r.overheadCost).toBe(0);
    expect(r.totalCost).toBe(50);
    expect(r.unitCost).toBe(10);
  });

  it('guards against negative/zero qty and negative inputs', () => {
    const r = computeStandardCost({ materialCost: -5, laborMinutes: -10, laborRatePerHour: -1, overheadPct: -2, qty: 0 });
    expect(r.totalCost).toBe(0);
    expect(r.unitCost).toBe(0);
  });
});
