import { consolidateReview, ReviewInput } from './line-review';

function input(over: Partial<ReviewInput> = {}): ReviewInput {
  return {
    score: 88,
    grade: 'A',
    blockers: [],
    readinessPct: 100,
    balancePct: 90,
    circulation: { clearancePct: 95, tightPairs: 0 },
    continuity: { continuityPct: 100, issues: [], hasFlow: true },
    cohesion: { cohesionPct: 100, issues: [], multiLine: true },
    density: { utilizationPct: 40, issues: [] },
    ...over,
  };
}

describe('consolidateReview (Fase 49)', () => {
  it('summarises a clean layout as releasable with no findings', () => {
    const r = consolidateReview(input());
    expect(r.grade).toBe('A');
    expect(r.releasable).toBe(true);
    expect(r.findings).toEqual([]);
    expect(r.indices).toMatchObject({
      readinessPct: 100, balancePct: 90, circulationPct: 95,
      continuityPct: 100, cohesionPct: 100, utilizationPct: 40,
    });
  });

  it('orders findings blockers-first, then circulation/continuity/cohesion/density', () => {
    const r = consolidateReview(input({
      grade: 'C',
      blockers: ['2 traslape(s)'],
      circulation: { clearancePct: 60, tightPairs: 3 },
      continuity: { continuityPct: 70, issues: ['1 conexión(es) en contraflujo (van contra la secuencia)'], hasFlow: true },
      cohesion: { cohesionPct: 80, issues: ['1 estación(es) intercaladas en otra línea'], multiLine: true },
      density: { utilizationPct: 20, issues: ['2 zona(s) congestionada(s) (≥80% ocupadas)'] },
    }));
    expect(r.findings).toEqual([
      '2 traslape(s)',
      '3 par(es) de objetos demasiado juntos',
      '1 conexión(es) en contraflujo (van contra la secuencia)',
      '1 estación(es) intercaladas en otra línea',
      '2 zona(s) congestionada(s) (≥80% ocupadas)',
    ]);
    expect(r.releasable).toBe(false); // grade C
  });

  it('skips continuity findings when there is no flow drawn', () => {
    const r = consolidateReview(input({
      continuity: { continuityPct: 0, issues: ['No hay conexiones de flujo dibujadas'], hasFlow: false },
    }));
    expect(r.findings).not.toContain('No hay conexiones de flujo dibujadas');
    expect(r.indices.continuityPct).toBeNull();
  });

  it('skips cohesion findings for a single-line layout', () => {
    const r = consolidateReview(input({
      cohesion: { cohesionPct: 100, issues: ['Línea L-A muy dispersa (10% de aprovechamiento)'], multiLine: false },
    }));
    expect(r.findings).toEqual([]);
    expect(r.indices.cohesionPct).toBeNull();
  });

  it('drops the density "nothing placed" note and de-duplicates findings', () => {
    const r = consolidateReview(input({
      blockers: ['Ninguna estación colocada', 'Aprovechamiento bajo del piso (5%)'],
      density: { utilizationPct: 5, issues: ['No hay nada colocado que evaluar', 'Aprovechamiento bajo del piso (5%)'] },
    }));
    expect(r.findings).toEqual(['Ninguna estación colocada', 'Aprovechamiento bajo del piso (5%)']);
    expect(r.findings).not.toContain('No hay nada colocado que evaluar');
  });

  it('tolerates missing (null) analyses', () => {
    const r = consolidateReview({
      score: 0, grade: 'D', blockers: ['Ninguna estación colocada'],
      readinessPct: 0, balancePct: null,
      circulation: null, continuity: null, cohesion: null, density: null,
    });
    expect(r.findings).toEqual(['Ninguna estación colocada']);
    expect(r.indices).toMatchObject({
      circulationPct: null, continuityPct: null, cohesionPct: null, utilizationPct: null,
    });
  });
});
