import {
  canTransition,
  assertTransition,
  isTerminal,
  nextStates,
  MaintenanceOrderStatus,
} from './order-state';

describe('maintenance order state machine', () => {
  it('allows the work path open → in_progress → completed', () => {
    expect(canTransition('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('allows reopening from in_progress', () => {
    expect(canTransition('IN_PROGRESS', 'OPEN')).toBe(true);
  });

  it('allows cancellation while open or in progress', () => {
    expect(canTransition('OPEN', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('OPEN', 'COMPLETED')).toBe(false);
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });

  it('treats COMPLETED and CANCELLED as terminal', () => {
    (['COMPLETED', 'CANCELLED'] as MaintenanceOrderStatus[]).forEach((s) => {
      expect(isTerminal(s)).toBe(true);
      expect(nextStates(s)).toHaveLength(0);
    });
  });

  it('assertTransition throws on illegal moves', () => {
    expect(() => assertTransition('COMPLETED', 'OPEN')).toThrow(
      /Cannot move a maintenance order/,
    );
    expect(() => assertTransition('OPEN', 'IN_PROGRESS')).not.toThrow();
  });
});
