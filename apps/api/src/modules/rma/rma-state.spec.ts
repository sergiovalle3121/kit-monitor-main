import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  RmaStatus,
} from './rma-state';

describe('RMA case state machine', () => {
  it('allows the investigation + disposition path', () => {
    expect(canTransition('OPEN', 'INVESTIGATING')).toBe(true);
    expect(canTransition('INVESTIGATING', 'DISPOSITION')).toBe(true);
    expect(canTransition('DISPOSITION', 'CLOSED')).toBe(true);
  });

  it('allows cancellation while open or investigating', () => {
    expect(canTransition('OPEN', 'CANCELLED')).toBe(true);
    expect(canTransition('INVESTIGATING', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('OPEN', 'DISPOSITION')).toBe(false);
    expect(canTransition('DISPOSITION', 'CANCELLED')).toBe(false);
    expect(canTransition('CLOSED', 'OPEN')).toBe(false);
  });

  it('treats CLOSED and CANCELLED as terminal', () => {
    (['CLOSED', 'CANCELLED'] as RmaStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('CLOSED', 'OPEN')).toThrow(
      /Cannot move an RMA case/,
    );
    expect(() => assertTransition('OPEN', 'INVESTIGATING')).not.toThrow();
  });
});
