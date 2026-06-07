import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  PurchaseOrderStatus,
} from './po-state';

describe('purchase order state machine', () => {
  it('allows the procurement path', () => {
    expect(canTransition('DRAFT', 'ISSUED')).toBe(true);
    expect(canTransition('ISSUED', 'ACKNOWLEDGED')).toBe(true);
    expect(canTransition('ACKNOWLEDGED', 'RECEIVED')).toBe(true);
    expect(canTransition('RECEIVED', 'CLOSED')).toBe(true);
  });

  it('allows receiving directly from issued (no ack)', () => {
    expect(canTransition('ISSUED', 'RECEIVED')).toBe(true);
  });

  it('allows cancellation before receipt', () => {
    expect(canTransition('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransition('ISSUED', 'CANCELLED')).toBe(true);
    expect(canTransition('ACKNOWLEDGED', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('DRAFT', 'RECEIVED')).toBe(false);
    expect(canTransition('RECEIVED', 'CANCELLED')).toBe(false);
    expect(canTransition('CLOSED', 'ISSUED')).toBe(false);
  });

  it('treats CLOSED and CANCELLED as terminal', () => {
    (['CLOSED', 'CANCELLED'] as PurchaseOrderStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('CLOSED', 'ISSUED')).toThrow(
      /Cannot move a purchase order/,
    );
    expect(() => assertTransition('DRAFT', 'ISSUED')).not.toThrow();
  });
});
