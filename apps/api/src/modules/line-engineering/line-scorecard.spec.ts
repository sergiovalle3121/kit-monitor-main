import { computeScorecard, ScorecardInput } from './line-scorecard';

function input(over: Partial<ScorecardInput> = {}): ScorecardInput {
  return {
    readinessPct: 100,
    balancePct: 90,
    directionalEfficiencyPct: 95,
    circulationPct: 88,
    overlaps: 0,
    outOfBounds: 0,
    ...over,
  };
}

describe('computeScorecard (Fase 44)', () => {
  it('grades a clean, well-balanced layout an A', () => {
    const r = computeScorecard(input());
    expect(r.grade).toBe('A');
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.dimensions).toHaveLength(4);
    expect(r.blockers).toEqual([]);
    expect(r.scored).toBe(true);
  });

  it('weights balance heaviest (30%) and renormalises over available dims', () => {
    const r = computeScorecard(input());
    const balance = r.dimensions.find((d) => d.key === 'balance')!;
    // 0.30 / (0.25+0.30+0.20+0.25=1.0) = 0.30
    expect(balance.weight).toBe(0.3);
  });

  it('drops a missing dimension and renormalises the rest', () => {
    const r = computeScorecard(input({ balancePct: null, directionalEfficiencyPct: null }));
    expect(r.dimensions.map((d) => d.key).sort()).toEqual(['circulation', 'readiness']);
    // weights 0.25 + 0.25 → renormalised to 0.5 each
    expect(r.dimensions.every((d) => d.weight === 0.5)).toBe(true);
  });

  it('reports the weakest dimensions worst-first', () => {
    const r = computeScorecard(input({ balancePct: 40, circulationPct: 55 }));
    expect(r.weakest[0]).toMatchObject({ key: 'balance', score: 40 });
    expect(r.weakest[1]).toMatchObject({ key: 'circulation', score: 55 });
  });

  it('caps an otherwise-A layout at C when there are overlaps', () => {
    const r = computeScorecard(input({ overlaps: 2 }));
    expect(r.blockers).toContain('2 traslape(s)');
    expect(r.grade).toBe('C');
  });

  it('flags off-plan objects and nothing-placed as blockers', () => {
    const r = computeScorecard(input({ readinessPct: 0, outOfBounds: 1 }));
    expect(r.blockers).toContain('1 objeto(s) fuera del plano');
    expect(r.blockers).toContain('Ninguna estación colocada');
  });

  it('is safe when no dimension can be computed', () => {
    const r = computeScorecard({
      readinessPct: null, balancePct: null, directionalEfficiencyPct: null,
      circulationPct: null, overlaps: 0, outOfBounds: 0,
    });
    expect(r.scored).toBe(false);
    expect(r.score).toBe(0);
    expect(r.grade).toBe('D');
    expect(r.dimensions).toEqual([]);
  });
});
