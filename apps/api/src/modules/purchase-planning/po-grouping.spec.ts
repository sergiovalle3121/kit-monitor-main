import { groupBySupplier, ShortageLine, UNASSIGNED_SUPPLIER } from './po-grouping';

const lines: ShortageLine[] = [
  { materialId: '1', partNumber: 'RES-1', description: 'Resistor', uom: 'EA', qty: 60, unitCost: 0.01, value: 0.6, supplierName: 'Yageo' },
  { materialId: '2', partNumber: 'CAP-1', description: 'Cap', uom: 'EA', qty: 20, unitCost: 0.02, value: 0.4, supplierName: 'Yageo' },
  { materialId: '3', partNumber: 'BOLT-1', description: 'Bolt', uom: 'EA', qty: 40, unitCost: 0.5, value: 20, supplierName: 'Bossard' },
  { materialId: '4', partNumber: 'X-1', description: 'Sin AVL', uom: 'EA', qty: 5, unitCost: 1, value: 5, supplierName: '' },
];

describe('groupBySupplier', () => {
  it('groups lines into one draft per supplier with summed value', () => {
    const drafts = groupBySupplier(lines, 'TOP-1');
    const yageo = drafts.find((d) => d.supplierName === 'Yageo')!;
    expect(yageo.lineCount).toBe(2);
    expect(yageo.totalValue).toBe(1); // 0.6 + 0.4
    expect(yageo.parts.map((p) => p.partNumber).sort()).toEqual(['CAP-1', 'RES-1']);
  });

  it('puts unmatched lines under "Por asignar"', () => {
    const drafts = groupBySupplier(lines, 'TOP-1');
    const un = drafts.find((d) => d.supplierName === UNASSIGNED_SUPPLIER)!;
    expect(un.lineCount).toBe(1);
    expect(un.parts[0].partNumber).toBe('X-1');
  });

  it('sorts by value desc with unassigned last', () => {
    const drafts = groupBySupplier(lines, 'TOP-1');
    expect(drafts[0].supplierName).toBe('Bossard'); // 20 > 1
    expect(drafts[drafts.length - 1].supplierName).toBe(UNASSIGNED_SUPPLIER);
  });

  it('includes a parts breakdown in the notes (PO has no line items)', () => {
    const drafts = groupBySupplier(lines, 'TOP-1');
    const bossard = drafts.find((d) => d.supplierName === 'Bossard')!;
    expect(bossard.notes).toContain('BOLT-1');
    expect(bossard.notes).toContain('MRP');
  });
});
