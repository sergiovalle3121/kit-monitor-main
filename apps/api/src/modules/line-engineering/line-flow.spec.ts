import { flowAnalysis, FlowNode, FlowLink } from './line-flow';

describe('flowAnalysis (spaghetti geometry)', () => {
  const nodes: FlowNode[] = [
    { id: 'a', station: 'EST-10', x: 0, y: 0 },
    { id: 'b', station: 'EST-20', x: 300, y: 0 },
    { id: 'c', station: 'EST-30', x: 300, y: 400 },
  ];

  it('measures travel distance, the longest hop and the average', () => {
    const links: FlowLink[] = [
      { from: 'a', to: 'b' }, // 300
      { from: 'b', to: 'c', kind: 'conveyor' }, // 400
    ];
    const r = flowAnalysis(nodes, links);
    expect(r.segmentCount).toBe(2);
    expect(r.totalDistance).toBe(700);
    expect(r.avgDistance).toBe(350);
    expect(r.longestSegment).toMatchObject({
      fromStation: 'EST-20',
      toStation: 'EST-30',
      distance: 400,
      kind: 'conveyor',
    });
    expect(r.crossings).toBe(0); // they share node 'b' → a junction, not a tangle
  });

  it('counts genuine crossings but ignores shared endpoints', () => {
    // Two diagonals of a square cross at the center; they share no endpoints.
    const square: FlowNode[] = [
      { id: 'tl', station: 'TL', x: 0, y: 0 },
      { id: 'tr', station: 'TR', x: 400, y: 0 },
      { id: 'bl', station: 'BL', x: 0, y: 400 },
      { id: 'br', station: 'BR', x: 400, y: 400 },
    ];
    const crossing = flowAnalysis(square, [
      { from: 'tl', to: 'br' },
      { from: 'tr', to: 'bl' },
    ]);
    expect(crossing.crossings).toBe(1);

    // Same four corners, but a path that shares endpoints at each turn → 0.
    const chain = flowAnalysis(square, [
      { from: 'tl', to: 'tr' },
      { from: 'tr', to: 'br' },
      { from: 'br', to: 'bl' },
    ]);
    expect(chain.crossings).toBe(0);
  });

  it('skips links whose endpoints are not both placed', () => {
    const r = flowAnalysis(nodes, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'ghost' }, // unplaced target
      { from: 'nobody', to: 'c' }, // unplaced source
    ]);
    expect(r.segmentCount).toBe(1);
    expect(r.unplacedLinks).toBe(2);
  });

  it('is empty-safe', () => {
    const r = flowAnalysis([], []);
    expect(r).toMatchObject({
      totalDistance: 0,
      segmentCount: 0,
      avgDistance: 0,
      crossings: 0,
      longestSegment: null,
    });
  });
});
