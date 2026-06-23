import { cellFlow, CellFlowNode } from './line-cellflow';

const node = (
  id: string,
  cellId: string | null,
  cx: number,
  cy: number,
): CellFlowNode => ({
  id,
  cellId,
  cx,
  cy,
});

describe('cellFlow (inter-cell flow analysis)', () => {
  const nodes: CellFlowNode[] = [
    node('a', 'c1', 0, 0),
    node('b', 'c1', 100, 0), // same cell as a
    node('c', 'c2', 300, 0), // different cell
    node('z', null, 500, 0), // no cell
  ];

  it('splits travel into intra-cell and inter-cell', () => {
    const r = cellFlow(nodes, [
      { from: 'a', to: 'b' }, // intra (c1) 100
      { from: 'b', to: 'c' }, // inter (c1→c2) 200
    ]);
    expect(r.intraCount).toBe(1);
    expect(r.interCount).toBe(1);
    expect(r.intraDistance).toBe(100);
    expect(r.interDistance).toBe(200);
    expect(r.interPct).toBeCloseTo(66.7, 0); // 200 / 300
    expect(r.interSegments[0]).toMatchObject({
      from: 'b',
      to: 'c',
      distance: 200,
    });
  });

  it('tallies links touching an uncelled station apart', () => {
    const r = cellFlow(nodes, [
      { from: 'a', to: 'b' }, // intra
      { from: 'c', to: 'z' }, // unassigned (z has no cell)
    ]);
    expect(r.intraCount).toBe(1);
    expect(r.unassignedCount).toBe(1);
    expect(r.interCount).toBe(0);
    expect(r.interPct).toBe(0);
  });

  it('is empty-safe', () => {
    expect(cellFlow([], [])).toMatchObject({
      intraCount: 0,
      interCount: 0,
      interPct: 0,
    });
  });
});
