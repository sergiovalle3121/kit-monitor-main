import {
  assertGateTransition,
  canAdvancePhase,
  canGateTransition,
  comparePhases,
  FINAL_PHASE,
  isFinalPhase,
  isGateCleared,
  isGateTerminal,
  isNpiPhase,
  nextGateStates,
  nextPhase,
  NPI_GATE_STATUSES,
  NPI_PHASES,
  phaseIndex,
} from './npi-state';

describe('npi-state · phases', () => {
  it('keeps the legal funnel order QUOTE→DFM→EVT→DVT→PVT→MP', () => {
    expect(NPI_PHASES).toEqual(['QUOTE', 'DFM', 'EVT', 'DVT', 'PVT', 'MP']);
    expect(FINAL_PHASE).toBe('MP');
  });

  it('recognizes valid phases only', () => {
    expect(isNpiPhase('DVT')).toBe(true);
    expect(isNpiPhase('SHIP')).toBe(false);
    expect(isNpiPhase(42)).toBe(false);
  });

  it('walks to the next phase and stops at MP', () => {
    expect(nextPhase('QUOTE')).toBe('DFM');
    expect(nextPhase('PVT')).toBe('MP');
    expect(nextPhase('MP')).toBeNull();
    expect(nextPhase('NOPE')).toBeNull();
  });

  it('advances only one legal step at a time', () => {
    expect(canAdvancePhase('EVT', 'DVT')).toBe(true);
    expect(canAdvancePhase('EVT', 'PVT')).toBe(false); // skipping
    expect(canAdvancePhase('EVT', 'QUOTE')).toBe(false); // backwards
    expect(canAdvancePhase('MP', 'MP')).toBe(false); // terminal
  });

  it('reports the final phase and orders phases', () => {
    expect(isFinalPhase('MP')).toBe(true);
    expect(isFinalPhase('PVT')).toBe(false);
    expect(phaseIndex('QUOTE')).toBe(0);
    expect(phaseIndex('NOPE')).toBe(-1);
    expect(comparePhases('QUOTE', 'MP')).toBeLessThan(0);
    expect(comparePhases('MP', 'QUOTE')).toBeGreaterThan(0);
    expect(comparePhases('DFM', 'DFM')).toBe(0);
    // unknown phases sort last (never crash)
    expect(comparePhases('NOPE', 'MP')).toBeGreaterThan(0);
  });
});

describe('npi-state · gate decisions', () => {
  it('enumerates the four gate statuses', () => {
    expect(NPI_GATE_STATUSES).toEqual([
      'PENDING',
      'PASSED',
      'FAILED',
      'WAIVED',
    ]);
  });

  it('decides a pending gate to PASSED / FAILED / WAIVED', () => {
    expect(canGateTransition('PENDING', 'PASSED')).toBe(true);
    expect(canGateTransition('PENDING', 'FAILED')).toBe(true);
    expect(canGateTransition('PENDING', 'WAIVED')).toBe(true);
    expect(nextGateStates('PENDING')).toEqual(['PASSED', 'FAILED', 'WAIVED']);
  });

  it('recovers a FAILED gate but freezes PASSED / WAIVED', () => {
    expect(canGateTransition('FAILED', 'PASSED')).toBe(true);
    expect(canGateTransition('FAILED', 'WAIVED')).toBe(true);
    expect(canGateTransition('FAILED', 'PENDING')).toBe(false);
    expect(isGateTerminal('FAILED')).toBe(false);
    expect(isGateTerminal('PASSED')).toBe(true);
    expect(isGateTerminal('WAIVED')).toBe(true);
    expect(canGateTransition('PASSED', 'FAILED')).toBe(false);
  });

  it('treats PASSED and WAIVED as "cleared"', () => {
    expect(isGateCleared('PASSED')).toBe(true);
    expect(isGateCleared('WAIVED')).toBe(true);
    expect(isGateCleared('FAILED')).toBe(false);
    expect(isGateCleared('PENDING')).toBe(false);
  });

  it('assertGateTransition throws on an illegal move', () => {
    expect(() => assertGateTransition('PASSED', 'PENDING')).toThrow(
      /No se puede mover el gate/,
    );
    expect(() => assertGateTransition('PENDING', 'PASSED')).not.toThrow();
  });
});
