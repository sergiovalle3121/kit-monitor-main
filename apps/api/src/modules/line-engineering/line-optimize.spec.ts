import { optimizeFlowOrder, OptSlot } from './line-optimize';

const rowSlots = (n: number, pitch = 100): OptSlot[] =>
  Array.from({ length: n }, (_, k) => ({ cx: k * pitch, cy: 0 }));

describe('optimizeFlowOrder (2-opt flow minimization)', () => {
  it('shortens travel by bringing flow-connected stations together', () => {
    // 4 slots in a row. Edges a–d and b–c. In sequence order a,b,c,d the a–d
    // edge spans the whole row; swapping fixes it.
    const stations = [
      { id: 'a', sequence: 1 },
      { id: 'b', sequence: 2 },
      { id: 'c', sequence: 3 },
      { id: 'd', sequence: 4 },
    ];
    const r = optimizeFlowOrder(stations, rowSlots(4), [
      { from: 'a', to: 'd' },
      { from: 'b', to: 'c' },
    ]);
    expect(r.costBefore).toBe(400); // 300 + 100
    expect(r.costAfter).toBeLessThanOrEqual(200);
    expect(r.improvedPct).toBeGreaterThanOrEqual(50);
    // a and d end up in adjacent slots.
    const pos = (id: string) => r.order.indexOf(id);
    expect(Math.abs(pos('a') - pos('d'))).toBe(1);
    expect(Math.abs(pos('b') - pos('c'))).toBe(1);
  });

  it('leaves an already-optimal chain unchanged', () => {
    const stations = [
      { id: 'a', sequence: 1 },
      { id: 'b', sequence: 2 },
      { id: 'c', sequence: 3 },
    ];
    const r = optimizeFlowOrder(stations, rowSlots(3), [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]);
    expect(r.costAfter).toBe(r.costBefore);
    expect(r.improvedPct).toBe(0);
  });

  it('is a no-op without edges or with too few stations', () => {
    const noEdges = optimizeFlowOrder(
      [
        { id: 'a', sequence: 1 },
        { id: 'b', sequence: 2 },
      ],
      rowSlots(2),
      [],
    );
    expect(noEdges.improvedPct).toBe(0);
    expect(noEdges.order).toEqual(['a', 'b']);
    const one = optimizeFlowOrder([{ id: 'a', sequence: 1 }], rowSlots(1), []);
    expect(one.order).toEqual(['a']);
  });
});
