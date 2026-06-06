import {
  canTransition,
  assertTransition,
  isTerminal,
  MaterialRequestStatus,
} from './request-state';

describe('material request state machine', () => {
  it('allows the production → warehouse happy path', () => {
    expect(canTransition('pending', 'authorized')).toBe(true);
    expect(canTransition('authorized', 'fulfilled')).toBe(true);
  });

  it('allows rejection and cancellation of a pending request', () => {
    expect(canTransition('pending', 'rejected')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
  });

  it('forbids skipping authorization', () => {
    expect(canTransition('pending', 'fulfilled')).toBe(false);
  });

  it('treats rejected/fulfilled/cancelled as terminal', () => {
    (['rejected', 'fulfilled', 'cancelled'] as MaterialRequestStatus[]).forEach(
      (s) => {
        expect(isTerminal(s)).toBe(true);
        expect(canTransition(s, 'authorized')).toBe(false);
      },
    );
  });

  it('assertTransition throws with a descriptive message on illegal moves', () => {
    expect(() => assertTransition('rejected', 'authorized')).toThrow(
      /Cannot move a material request/,
    );
    expect(() => assertTransition('pending', 'authorized')).not.toThrow();
  });
});
