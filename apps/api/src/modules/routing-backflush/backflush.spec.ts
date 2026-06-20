import { computeBackflush, totalBackflushQty } from './backflush';

const mats = [
  { materialId: 'a', partNumber: 'RES-1', description: 'Resistor', qtyPerUnit: 3, uom: 'EA' },
  { materialId: 'b', partNumber: 'CAP-1', description: 'Cap', qtyPerUnit: 1.5, uom: 'EA' },
];

describe('computeBackflush', () => {
  it('multiplies qty/unit by units produced', () => {
    const lines = computeBackflush(mats, 10);
    expect(lines.find((l) => l.partNumber === 'RES-1')!.consumeQty).toBe(30);
    expect(lines.find((l) => l.partNumber === 'CAP-1')!.consumeQty).toBe(15);
  });

  it('returns 0 consume for non-positive units', () => {
    expect(computeBackflush(mats, 0).every((l) => l.consumeQty === 0)).toBe(true);
    expect(computeBackflush(mats, -5).every((l) => l.consumeQty === 0)).toBe(true);
  });

  it('sums total backflush quantity', () => {
    expect(totalBackflushQty(computeBackflush(mats, 2))).toBe(9); // 6 + 3
  });
});
