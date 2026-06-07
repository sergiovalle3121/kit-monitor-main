import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  InitiativeStatus,
} from './initiative-state';

describe('improvement initiative state machine', () => {
  it('allows the happy path draft → in_progress → implemented → verified → closed', () => {
    expect(canTransition('DRAFT', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'IMPLEMENTED')).toBe(true);
    expect(canTransition('IMPLEMENTED', 'VERIFIED')).toBe(true);
    expect(canTransition('VERIFIED', 'CLOSED')).toBe(true);
  });

  it('allows rework loops back to in_progress', () => {
    expect(canTransition('IMPLEMENTED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('VERIFIED', 'IN_PROGRESS')).toBe(true);
  });

  it('allows cancellation from non-terminal states', () => {
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });

  it('forbids skipping phases', () => {
    expect(canTransition('DRAFT', 'IMPLEMENTED')).toBe(false);
    expect(canTransition('IN_PROGRESS', 'CLOSED')).toBe(false);
  });

  it('treats CLOSED and CANCELLED as terminal', () => {
    (['CLOSED', 'CANCELLED'] as InitiativeStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
      expect(canTransition(s, 'IN_PROGRESS')).toBe(false);
    });
  });

  it('assertTransition throws a descriptive error on illegal moves', () => {
    expect(() => assertTransition('CLOSED', 'IN_PROGRESS')).toThrow(
      /Cannot move an improvement initiative/,
    );
    expect(() => assertTransition('DRAFT', 'IN_PROGRESS')).not.toThrow();
  });
});
