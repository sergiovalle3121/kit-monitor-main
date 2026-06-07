import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  CycleCountStatus,
} from './count-state';

describe('cycle count state machine', () => {
  it('allows the counting path', () => {
    expect(canTransition('OPEN', 'COUNTED')).toBe(true);
    expect(canTransition('COUNTED', 'RECONCILED')).toBe(true);
    expect(canTransition('COUNTED', 'ADJUSTED')).toBe(true);
  });

  it('allows cancelling an open count', () => {
    expect(canTransition('OPEN', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('OPEN', 'RECONCILED')).toBe(false);
    expect(canTransition('RECONCILED', 'COUNTED')).toBe(false);
  });

  it('treats RECONCILED, ADJUSTED and CANCELLED as terminal', () => {
    (['RECONCILED', 'ADJUSTED', 'CANCELLED'] as CycleCountStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('RECONCILED', 'COUNTED')).toThrow(
      /Cannot move a cycle count/,
    );
    expect(() => assertTransition('OPEN', 'COUNTED')).not.toThrow();
  });
});
