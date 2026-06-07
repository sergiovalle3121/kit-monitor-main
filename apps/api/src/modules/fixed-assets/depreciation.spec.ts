import {
  monthsBetween,
  monthlyDepreciation,
  accumulatedDepreciation,
  bookValue,
} from './depreciation';

describe('depreciation helpers', () => {
  const asset = {
    acquisitionCost: 12000,
    salvageValue: 0,
    usefulLifeMonths: 12,
    acquisitionDate: '2026-01-01',
  };

  it('computes whole months elapsed', () => {
    expect(monthsBetween('2026-01-01', new Date('2026-04-01'))).toBe(3);
    expect(monthsBetween('2026-01-15', new Date('2026-02-10'))).toBe(0); // not a full month
    expect(monthsBetween(null)).toBe(0);
  });

  it('computes straight-line monthly depreciation', () => {
    expect(monthlyDepreciation(asset)).toBe(1000); // 12000/12
    expect(monthlyDepreciation({ ...asset, usefulLifeMonths: 0 })).toBe(0);
  });

  it('accumulates depreciation and caps at depreciable base', () => {
    expect(accumulatedDepreciation(asset, new Date('2026-04-01'))).toBe(3000);
    // Past useful life → capped at cost − salvage (12000).
    expect(accumulatedDepreciation(asset, new Date('2030-01-01'))).toBe(12000);
  });

  it('computes book value (cost − accumulated)', () => {
    expect(bookValue(asset, new Date('2026-04-01'))).toBe(9000);
    expect(bookValue(asset, new Date('2030-01-01'))).toBe(0);
  });

  it('respects salvage value', () => {
    const a = { acquisitionCost: 10000, salvageValue: 1000, usefulLifeMonths: 9, acquisitionDate: '2026-01-01' };
    expect(monthlyDepreciation(a)).toBe(1000); // (10000-1000)/9
    expect(bookValue(a, new Date('2030-01-01'))).toBe(1000); // floored at salvage
  });
});
