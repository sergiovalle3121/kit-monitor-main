import { costModel, areaToM2 } from './line-cost';

describe('costModel (Fase 35)', () => {
  it('splits cost per unit into labor, space and amortized capex', () => {
    const c = costModel(
      {
        operatorCount: 3,
        taktSec: 60,
        footprintAreaM2: 200,
        assetCount: 4,
        stationCount: 3,
      },
      {
        laborCostPerHour: 10,
        spaceCostPerM2Month: 12,
        assetUnitCost: 5000,
        amortizationMonths: 36,
        monthlyVolume: 10000,
      },
    );
    expect(c.throughputPerHour).toBe(60); // 3600/60
    // labor = 3 × (60/3600) × 10 = 0.5
    expect(c.laborCostPerUnit).toBe(0.5);
    // space = (200 × 12) / 10000 = 0.24
    expect(c.spaceCostPerUnit).toBe(0.24);
    // capex = (4 × 5000 / 36) / 10000 ≈ 0.0556
    expect(c.capexTotal).toBe(20000);
    expect(c.capexPerUnit).toBeCloseTo(0.06, 2);
    expect(c.totalCostPerUnit).toBeCloseTo(0.8, 2);
    // labor dominates.
    expect(c.breakdownPct.labor).toBeGreaterThan(c.breakdownPct.space);
    expect(c.breakdownPct.space).toBeGreaterThan(c.breakdownPct.capex);
  });

  it('derives monthly volume from throughput and applies default rates', () => {
    const c = costModel({
      operatorCount: 2,
      taktSec: 90,
      footprintAreaM2: 100,
      assetCount: 2,
      stationCount: 2,
    });
    expect(c.throughputPerHour).toBeCloseTo(40, 1); // 3600/90
    expect(c.monthlyVolume).toBe(6400); // 40 × 160 h
    expect(c.rates.laborCostPerHour).toBe(8); // default
    // labor = 2 × (90/3600) × 8 = 0.4 → month = 0.4 × 6400 = 2560 = 2×160×8
    expect(c.laborCostPerUnit).toBe(0.4);
    expect(c.laborCostPerMonth).toBe(2560);
  });

  it('degrades to zero per-unit cost when there is no takt/throughput', () => {
    const c = costModel({
      operatorCount: 3,
      taktSec: 0,
      footprintAreaM2: 200,
      assetCount: 4,
      stationCount: 3,
    });
    expect(c.throughputPerHour).toBe(0);
    expect(c.monthlyVolume).toBe(0);
    expect(c.totalCostPerUnit).toBe(0);
    expect(Number.isNaN(c.spaceCostPerUnit)).toBe(false);
  });

  it('converts footprint area to square metres by unit', () => {
    expect(areaToM2(1_000_000, 'mm')).toBeCloseTo(1, 6); // 1e6 mm² = 1 m²
    expect(areaToM2(5, 'm')).toBeCloseTo(5, 6);
    expect(areaToM2(10_000, 'cm')).toBeCloseTo(1, 6); // 1e4 cm² = 1 m²
    expect(areaToM2(1_000_000, 'unknown')).toBeCloseTo(1, 6); // → mm
  });
});
