import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  IncidentStatus,
} from './incident-state';

describe('EHS incident state machine', () => {
  it('allows the investigation path', () => {
    expect(canTransition('REPORTED', 'INVESTIGATING')).toBe(true);
    expect(canTransition('INVESTIGATING', 'ACTION_PENDING')).toBe(true);
    expect(canTransition('ACTION_PENDING', 'CLOSED')).toBe(true);
  });

  it('allows quick close of a trivial report', () => {
    expect(canTransition('REPORTED', 'CLOSED')).toBe(true);
  });

  it('allows rework from action_pending back to investigating', () => {
    expect(canTransition('ACTION_PENDING', 'INVESTIGATING')).toBe(true);
  });

  it('allows cancellation while open', () => {
    expect(canTransition('REPORTED', 'CANCELLED')).toBe(true);
    expect(canTransition('INVESTIGATING', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('REPORTED', 'ACTION_PENDING')).toBe(false);
    expect(canTransition('CLOSED', 'INVESTIGATING')).toBe(false);
  });

  it('treats CLOSED and CANCELLED as terminal', () => {
    (['CLOSED', 'CANCELLED'] as IncidentStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('CLOSED', 'REPORTED')).toThrow(
      /Cannot move a safety incident/,
    );
    expect(() => assertTransition('REPORTED', 'INVESTIGATING')).not.toThrow();
  });
});
