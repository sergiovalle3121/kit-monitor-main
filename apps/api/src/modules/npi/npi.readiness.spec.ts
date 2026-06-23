import {
  AVL_COVERAGE_OK,
  evaluateReadiness,
  LINE_BALANCE_OK,
  LINE_COMPLETENESS_OK,
  ReadinessSignals,
} from './npi.readiness';

const get = (r: ReturnType<typeof evaluateReadiness>, key: string) =>
  r.criteria.find((c) => c.key === key)!;

describe('npi.readiness · evaluateReadiness', () => {
  it('is gateReady only when every criterion is READY', () => {
    const signals: ReadinessSignals = {
      bomStatus: 'APPROVED',
      faiStatus: 'PASS',
      lineBalancePct: 0.9,
      lineCompletenessPct: 1,
      stdTimeComplete: true,
      avlCoverage: 1,
    };
    const r = evaluateReadiness(signals);
    expect(r.gateReady).toBe(true);
    expect(r.readyCount).toBe(5);
    expect(r.notReadyCount).toBe(0);
    expect(r.unknownCount).toBe(0);
    expect(r.blockers).toEqual([]);
    expect(r.unknowns).toEqual([]);
  });

  it('reports every signal as UNKNOWN when nothing is resolvable (never assumed good)', () => {
    const r = evaluateReadiness({});
    expect(r.gateReady).toBe(false);
    expect(r.unknownCount).toBe(5);
    expect(r.readyCount).toBe(0);
    expect(r.unknowns).toEqual(['bom', 'fai', 'line', 'standardTime', 'avl']);
    // explicit nulls behave exactly like missing
    expect(
      evaluateReadiness({
        bomStatus: null,
        faiStatus: null,
        lineBalancePct: null,
        lineCompletenessPct: null,
        stdTimeComplete: null,
        avlCoverage: null,
      }),
    ).toMatchObject({ unknownCount: 5, gateReady: false });
  });

  it('grades the BOM criterion', () => {
    expect(get(evaluateReadiness({ bomStatus: 'ACTIVE' }), 'bom').status).toBe(
      'READY',
    );
    expect(
      get(evaluateReadiness({ bomStatus: 'APPROVED' }), 'bom').status,
    ).toBe('READY');
    expect(get(evaluateReadiness({ bomStatus: 'DRAFT' }), 'bom').status).toBe(
      'NOT_READY',
    );
    expect(
      get(evaluateReadiness({ bomStatus: 'PENDING_REVIEW' }), 'bom').status,
    ).toBe('NOT_READY');
    expect(get(evaluateReadiness({}), 'bom').status).toBe('UNKNOWN');
  });

  it('grades the FAI criterion (only PASS is ready)', () => {
    expect(get(evaluateReadiness({ faiStatus: 'PASS' }), 'fai').status).toBe(
      'READY',
    );
    expect(get(evaluateReadiness({ faiStatus: 'FAIL' }), 'fai').status).toBe(
      'NOT_READY',
    );
    expect(get(evaluateReadiness({ faiStatus: 'PENDING' }), 'fai').status).toBe(
      'NOT_READY',
    );
    expect(get(evaluateReadiness({}), 'fai').status).toBe('UNKNOWN');
  });

  it('folds line balance + completeness with NOT_READY dominating UNKNOWN', () => {
    // both good
    expect(
      get(
        evaluateReadiness({ lineBalancePct: 0.9, lineCompletenessPct: 1 }),
        'line',
      ).status,
    ).toBe('READY');
    // balance below threshold → NOT_READY even if completeness unknown
    expect(get(evaluateReadiness({ lineBalancePct: 0.5 }), 'line').status).toBe(
      'NOT_READY',
    );
    // balance ok but completeness unresolved → UNKNOWN (not assumed good)
    expect(get(evaluateReadiness({ lineBalancePct: 0.9 }), 'line').status).toBe(
      'UNKNOWN',
    );
    // nothing resolved → UNKNOWN
    expect(get(evaluateReadiness({}), 'line').status).toBe('UNKNOWN');
    // exactly at threshold is READY (inclusive)
    expect(
      get(
        evaluateReadiness({
          lineBalancePct: LINE_BALANCE_OK,
          lineCompletenessPct: LINE_COMPLETENESS_OK,
        }),
        'line',
      ).status,
    ).toBe('READY');
  });

  it('grades standard time from the boolean signal', () => {
    expect(
      get(evaluateReadiness({ stdTimeComplete: true }), 'standardTime').status,
    ).toBe('READY');
    expect(
      get(evaluateReadiness({ stdTimeComplete: false }), 'standardTime').status,
    ).toBe('NOT_READY');
    expect(get(evaluateReadiness({}), 'standardTime').status).toBe('UNKNOWN');
  });

  it('grades AVL coverage against the threshold', () => {
    expect(
      get(evaluateReadiness({ avlCoverage: AVL_COVERAGE_OK }), 'avl').status,
    ).toBe('READY');
    expect(get(evaluateReadiness({ avlCoverage: 0.5 }), 'avl').status).toBe(
      'NOT_READY',
    );
    expect(get(evaluateReadiness({ avlCoverage: null }), 'avl').status).toBe(
      'UNKNOWN',
    );
  });

  it('collects blockers and unknowns side by side', () => {
    const r = evaluateReadiness({
      bomStatus: 'DRAFT', // blocker
      faiStatus: 'PASS', // ready
      // line unknown
      stdTimeComplete: false, // blocker
      // avl unknown
    });
    expect(r.gateReady).toBe(false);
    expect(r.blockers).toEqual(['bom', 'standardTime']);
    expect(r.unknowns).toEqual(['line', 'avl']);
    expect(r.readyCount).toBe(1);
  });
});
