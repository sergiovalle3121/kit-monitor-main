import { computeClearance, ClearanceInput, ClearanceBox } from './line-clearance';

function box(over: Partial<ClearanceBox>): ClearanceBox {
  return { id: 'b', label: 'B', kind: 'station', x: 0, y: 0, w: 1000, h: 1000, ...over };
}

function input(boxes: ClearanceBox[], over: Partial<ClearanceInput> = {}): ClearanceInput {
  return { footprintW: 20000, footprintH: 10000, minClearance: 1000, boxes, ...over };
}

describe('computeClearance (Fase 43)', () => {
  it('flags a pair closer than the minimum clearance', () => {
    const r = computeClearance(
      input([
        box({ id: 'a', label: 'A', x: 3000, y: 3000 }),
        box({ id: 'b', label: 'B', x: 4500, y: 3000 }), // gap 500 in X < 1000
      ]),
    );
    expect(r.tightPairs).toHaveLength(1);
    expect(r.tightPairs[0]).toMatchObject({ a: 'a', b: 'b', gap: 500 });
    expect(r.overlaps).toHaveLength(0);
    expect(r.minGap).toBe(500);
  });

  it('does not flag a pair with adequate clearance', () => {
    const r = computeClearance(
      input([
        box({ id: 'a', label: 'A', x: 3000, y: 3000 }),
        box({ id: 'b', label: 'B', x: 5000, y: 3000 }), // gap 1000 == min → ok (not < min)
      ]),
    );
    expect(r.tightPairs).toHaveLength(0);
    expect(r.minGap).toBe(1000);
    expect(r.clearancePct).toBe(100);
  });

  it('detects overlaps separately from tight pairs', () => {
    const r = computeClearance(
      input([
        box({ id: 'a', label: 'A', x: 3000, y: 3000 }),
        box({ id: 'b', label: 'B', x: 3500, y: 3500 }), // overlaps A
      ]),
    );
    expect(r.overlaps).toHaveLength(1);
    expect(r.overlaps[0]).toMatchObject({ a: 'a', b: 'b' });
    expect(r.tightPairs).toHaveLength(0);
  });

  it('computes a diagonal corner gap', () => {
    const r = computeClearance(
      input(
        [
          box({ id: 'a', label: 'A', x: 0, y: 0, w: 1000, h: 1000 }),
          box({ id: 'b', label: 'B', x: 1300, y: 1400, w: 1000, h: 1000 }), // dx=300, dy=400 → 500
        ],
        { minClearance: 600, footprintW: 20000, footprintH: 20000 },
      ),
    );
    expect(r.tightPairs[0].gap).toBe(500);
  });

  it('flags boxes out of bounds and crowding a wall', () => {
    const r = computeClearance(
      input([
        box({ id: 'oob', label: 'OOB', x: 19500, y: 3000, w: 1000, h: 1000 }), // x+w=20500 > 20000
        box({ id: 'wall', label: 'Wall', x: 200, y: 4000, w: 1000, h: 1000 }), // 200 from left < 1000
        box({ id: 'ok', label: 'OK', x: 8000, y: 4000, w: 1000, h: 1000 }),
      ]),
    );
    expect(r.outOfBounds).toContain('oob');
    expect(r.perimeterTight).toContain('wall');
    expect(r.perimeterTight).not.toContain('ok');
    // 2 of 3 boxes flagged → 33% ok
    expect(r.clearancePct).toBe(33);
  });

  it('is safe on an empty layout', () => {
    const r = computeClearance(input([]));
    expect(r.boxCount).toBe(0);
    expect(r.clearancePct).toBe(100);
    expect(r.minGap).toBe(0);
  });

  it('ignores boxes with non-positive size', () => {
    const r = computeClearance(input([box({ id: 'z', w: 0, h: 0 }), box({ id: 'a', x: 3000 })]));
    expect(r.boxCount).toBe(1);
  });
});
