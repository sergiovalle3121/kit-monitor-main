import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  ContractStatus,
} from './contract-state';

describe('contract state machine', () => {
  it('allows activation and expiry', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'EXPIRED')).toBe(true);
  });

  it('allows renewal from expired back to active', () => {
    expect(canTransition('EXPIRED', 'ACTIVE')).toBe(true);
  });

  it('allows termination from active or expired', () => {
    expect(canTransition('ACTIVE', 'TERMINATED')).toBe(true);
    expect(canTransition('EXPIRED', 'TERMINATED')).toBe(true);
  });

  it('allows cancelling a draft', () => {
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('DRAFT', 'EXPIRED')).toBe(false);
    expect(canTransition('TERMINATED', 'ACTIVE')).toBe(false);
  });

  it('treats TERMINATED and CANCELLED as terminal', () => {
    (['TERMINATED', 'CANCELLED'] as ContractStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('TERMINATED', 'ACTIVE')).toThrow(
      /Cannot move a contract/,
    );
    expect(() => assertTransition('DRAFT', 'ACTIVE')).not.toThrow();
  });
});
