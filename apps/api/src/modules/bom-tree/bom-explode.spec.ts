import {
  explodeBom,
  ExplodeLine,
  ExplodeMaterial,
} from './bom-explode';

// ── Test graph (3 levels) ────────────────────────────────────────────────────
//  TOP (make) ─┬─ SUB ×2 (make) ─┬─ RES ×3 (+10% scrap)  [buy 0.01]
//              │                  └─ CAP ×1               [buy 0.02]
//              └─ BOLT ×4         [buy 0.05]
const MATERIALS: Record<string, ExplodeMaterial> = {
  TOP: { id: 'TOP', partNumber: 'TOP-1', description: 'Top assy', itemType: 'MANUFACTURED', makeBuy: 'MAKE', baseUom: 'EA', standardCost: 0 },
  SUB: { id: 'SUB', partNumber: 'SUB-1', description: 'Sub assy', itemType: 'MANUFACTURED', makeBuy: 'MAKE', baseUom: 'EA', standardCost: 0 },
  RES: { id: 'RES', partNumber: 'RES-1', description: 'Resistor', itemType: 'PURCHASED', makeBuy: 'BUY', baseUom: 'EA', standardCost: 0.01 },
  CAP: { id: 'CAP', partNumber: 'CAP-1', description: 'Capacitor', itemType: 'PURCHASED', makeBuy: 'BUY', baseUom: 'EA', standardCost: 0.02 },
  BOLT: { id: 'BOLT', partNumber: 'BOLT-1', description: 'Bolt', itemType: 'PURCHASED', makeBuy: 'BUY', baseUom: 'EA', standardCost: 0.05 },
};
const LINES: Record<string, ExplodeLine[]> = {
  TOP: [
    { materialId: 'SUB', quantity: 2, findNumber: '0010' },
    { materialId: 'BOLT', quantity: 4, findNumber: '0020' },
  ],
  SUB: [
    { materialId: 'RES', quantity: 3, scrapPct: 10, findNumber: '0010' },
    { materialId: 'CAP', quantity: 1, findNumber: '0020' },
  ],
};
const getMaterial = (id: string) => MATERIALS[id];
const getLines = (id: string) => LINES[id] ?? [];

describe('explodeBom — multilevel', () => {
  it('explodes 3 levels with accumulated quantities and scrap', () => {
    const r = explodeBom('TOP', 10, getLines, getMaterial);
    expect(r.maxDepth).toBe(2);

    const sub = r.tree.find((n) => n.materialId === 'SUB')!;
    expect(sub.extendedQty).toBe(20); // 2 × 10
    expect(sub.isAssembly).toBe(true);

    const res = sub.children.find((n) => n.materialId === 'RES')!;
    expect(res.perParentQty).toBe(3.3); // 3 × (1 + 10%)
    expect(res.extendedQty).toBe(66); // 3.3 × 20
    expect(res.level).toBe(2);

    const cap = sub.children.find((n) => n.materialId === 'CAP')!;
    expect(cap.extendedQty).toBe(20);
  });

  it('rolls up leaf demand (where multiple paths sum)', () => {
    const r = explodeBom('TOP', 10, getLines, getMaterial);
    const byPn = Object.fromEntries(r.flat.map((f) => [f.partNumber, f]));
    expect(byPn['RES-1'].totalQty).toBe(66);
    expect(byPn['CAP-1'].totalQty).toBe(20);
    expect(byPn['BOLT-1'].totalQty).toBe(40);
    // Only leaves appear in the flat demand (no SUB/TOP assemblies).
    expect(byPn['SUB-1']).toBeUndefined();
  });

  it('rolls up cost: RES 0.66 + CAP 0.40 + BOLT 2.00 = 3.06', () => {
    const r = explodeBom('TOP', 10, getLines, getMaterial);
    expect(r.totalCost).toBe(3.06);
    const sub = r.tree.find((n) => n.materialId === 'SUB')!;
    expect(sub.extendedCost).toBe(1.06); // rolled from its children
  });

  it('scales linearly with the requested build qty', () => {
    const r1 = explodeBom('TOP', 1, getLines, getMaterial);
    const r10 = explodeBom('TOP', 10, getLines, getMaterial);
    expect(r10.totalCost).toBeCloseTo(r1.totalCost * 10, 6);
  });

  it('returns empty for an unknown root', () => {
    const r = explodeBom('NOPE', 5, getLines, getMaterial);
    expect(r.tree).toEqual([]);
    expect(r.totalCost).toBe(0);
  });
});

describe('explodeBom — cycle safety', () => {
  it('cuts a self-referential branch and reports the cycle', () => {
    const mats: Record<string, ExplodeMaterial> = {
      A: { id: 'A', partNumber: 'A', description: 'A', itemType: 'MANUFACTURED', makeBuy: 'MAKE', baseUom: 'EA', standardCost: 0 },
      B: { id: 'B', partNumber: 'B', description: 'B', itemType: 'MANUFACTURED', makeBuy: 'MAKE', baseUom: 'EA', standardCost: 0 },
    };
    const lines: Record<string, ExplodeLine[]> = {
      A: [{ materialId: 'B', quantity: 1 }],
      B: [{ materialId: 'A', quantity: 1 }],
    };
    const r = explodeBom('A', 1, (id) => lines[id] ?? [], (id) => mats[id]);
    expect(r.cycles).toContain('A');
    // It does not throw / infinite-loop.
    const b = r.tree.find((n) => n.materialId === 'B')!;
    const aAgain = b.children.find((n) => n.materialId === 'A')!;
    expect(aAgain.cyclic).toBe(true);
    expect(aAgain.children).toEqual([]);
  });
});
