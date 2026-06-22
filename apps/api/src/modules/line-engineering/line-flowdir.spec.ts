import { flowDirection, FlowDirStation } from './line-flowdir';

const at = (
  station: string,
  sequence: number,
  cx: number,
  cy: number,
): FlowDirStation => ({
  station,
  sequence,
  cx,
  cy,
});

describe('flowDirection (back-tracking analysis)', () => {
  it('reports 100% efficiency for a straight left-to-right flow', () => {
    const r = flowDirection([
      at('a', 1, 0, 0),
      at('b', 2, 100, 0),
      at('c', 3, 200, 0),
    ]);
    expect(r.hasDirection).toBe(true);
    expect(r.directionalEfficiencyPct).toBe(100);
    expect(r.backtrackCount).toBe(0);
  });

  it('flags a hop that runs back against the net direction', () => {
    // net is +x (0→300). The middle hop b→c goes back to x=50.
    const r = flowDirection([
      at('a', 1, 0, 0),
      at('b', 2, 200, 0),
      at('c', 3, 50, 0),
      at('d', 4, 300, 0),
    ]);
    expect(r.backtrackCount).toBe(1);
    expect(r.backtrackHops[0]).toMatchObject({ from: 'b', to: 'c' });
    expect(r.directionalEfficiencyPct).toBeLessThan(100);
  });

  it('does NOT flag a serpentine: sideways hops are perpendicular to the net', () => {
    // Net direction is +y (top row → bottom row). Within-row hops are ±x.
    const r = flowDirection([
      at('a', 1, 0, 0),
      at('b', 2, 200, 0), // row 1 →
      at('c', 3, 200, 100), // drop to row 2
      at('d', 4, 0, 100), // row 2 ← (serpentine, but perpendicular to +y net)
    ]);
    expect(r.backtrackCount).toBe(0);
    expect(r.directionalEfficiencyPct).toBe(100);
  });

  it('uses sequence order, not array order', () => {
    const r = flowDirection([
      at('c', 3, 200, 0),
      at('a', 1, 0, 0),
      at('b', 2, 100, 0),
    ]);
    expect(r.directionalEfficiencyPct).toBe(100);
  });

  it('is empty-safe and needs at least two placed stations', () => {
    expect(flowDirection([]).hasDirection).toBe(false);
    expect(flowDirection([at('a', 1, 0, 0)]).hasDirection).toBe(false);
  });
});
