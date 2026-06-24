import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  OutboundShipmentStatus,
} from './shipment-state';

describe('shipment state machine', () => {
  it('allows the outbound path', () => {
    expect(canTransition('PACKING', 'READY')).toBe(true);
    expect(canTransition('READY', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('allows cancellation before shipping', () => {
    expect(canTransition('PACKING', 'CANCELLED')).toBe(true);
    expect(canTransition('READY', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('PACKING', 'SHIPPED')).toBe(false);
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(canTransition('DELIVERED', 'SHIPPED')).toBe(false);
  });

  it('treats DELIVERED and CANCELLED as terminal', () => {
    (['DELIVERED', 'CANCELLED'] as OutboundShipmentStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('DELIVERED', 'SHIPPED')).toThrow(
      /Cannot move a shipment/,
    );
    expect(() => assertTransition('PACKING', 'READY')).not.toThrow();
  });
});
