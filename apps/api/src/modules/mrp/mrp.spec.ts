import { computeNetting, MrpDemandLine, MrpSupply } from './mrp';

const demand: MrpDemandLine[] = [
  { partNumber: 'RES-1', description: 'Resistor', uom: 'EA', grossQty: 100, unitCost: 0.01, makeBuy: 'BUY' },
  { partNumber: 'CAP-1', description: 'Cap', uom: 'EA', grossQty: 50, unitCost: 0.02, makeBuy: 'BUY' },
  { partNumber: 'BOLT-1', description: 'Bolt', uom: 'EA', grossQty: 40, unitCost: 0.05, makeBuy: 'BUY' },
];

describe('computeNetting', () => {
  it('nets gross against available + in-transit', () => {
    const supply = new Map<string, MrpSupply>([
      ['RES-1', { available: 30, inTransit: 10 }], // 100 - 40 = 60 short
      ['CAP-1', { available: 60, inTransit: 0 }], // covered → 0
    ]);
    const { rows } = computeNetting(demand, supply);
    const byPn = Object.fromEntries(rows.map((r) => [r.partNumber, r]));
    expect(byPn['RES-1'].net).toBe(60);
    expect(byPn['CAP-1'].net).toBe(0);
    expect(byPn['BOLT-1'].net).toBe(40); // no supply
  });

  it('computes shortage value and summary', () => {
    const supply = new Map<string, MrpSupply>([['CAP-1', { available: 60, inTransit: 0 }]]);
    const { rows, summary } = computeNetting(demand, supply);
    expect(summary.parts).toBe(3);
    expect(summary.shortageParts).toBe(2); // RES + BOLT
    // RES 100×0.01=1.00, BOLT 40×0.05=2.00 → 3.00
    expect(summary.totalShortageValue).toBe(3);
    // shortages sorted first, highest value first → BOLT before RES
    expect(rows[0].partNumber).toBe('BOLT-1');
    expect(rows[rows.length - 1].partNumber).toBe('CAP-1'); // covered last
  });

  it('treats missing supply as zero', () => {
    const { rows } = computeNetting(demand, new Map());
    expect(rows.every((r) => r.net === r.gross)).toBe(true);
  });
});
