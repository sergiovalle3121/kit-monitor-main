import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  ReceiptStatus,
} from './receipt-state';

describe('inbound receipt state machine', () => {
  it('allows the IQC inspection path', () => {
    expect(canTransition('RECEIVED', 'INSPECTING')).toBe(true);
    expect(canTransition('INSPECTING', 'RELEASED')).toBe(true);
    expect(canTransition('INSPECTING', 'QUARANTINE')).toBe(true);
  });

  it('allows direct release when no IQC is required', () => {
    expect(canTransition('RECEIVED', 'RELEASED')).toBe(true);
  });

  it('allows quarantine disposition to released or rejected', () => {
    expect(canTransition('QUARANTINE', 'RELEASED')).toBe(true);
    expect(canTransition('QUARANTINE', 'REJECTED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('RECEIVED', 'QUARANTINE')).toBe(false);
    expect(canTransition('RELEASED', 'INSPECTING')).toBe(false);
  });

  it('treats RELEASED and REJECTED as terminal', () => {
    (['RELEASED', 'REJECTED'] as ReceiptStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('RELEASED', 'INSPECTING')).toThrow(
      /Cannot move a receipt/,
    );
    expect(() => assertTransition('RECEIVED', 'INSPECTING')).not.toThrow();
  });
});
