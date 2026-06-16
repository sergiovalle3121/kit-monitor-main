import {
  assertTransition,
  canTransition,
  checklistComplete,
  isTerminal,
  nextStates,
  pendingItems,
} from './changeover-state';

describe('changeover-state', () => {
  it('follows OPEN → IN_PROGRESS → COMPLETED', () => {
    expect(canTransition('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransition('OPEN', 'COMPLETED')).toBe(false); // must start first
  });

  it('allows cancel from any non-terminal state', () => {
    expect(canTransition('OPEN', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });

  it('COMPLETED and CANCELLED are terminal', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(nextStates('COMPLETED')).toEqual([]);
  });

  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition('COMPLETED', 'IN_PROGRESS')).toThrow(
      /No se puede mover/,
    );
  });

  it('reports checklist completeness and pending labels', () => {
    expect(checklistComplete([])).toBe(true); // vacuously
    const items = [
      { key: 'a', label: 'Cargar programa', done: true },
      { key: 'b', label: 'Montar feeders', done: false },
    ];
    expect(checklistComplete(items)).toBe(false);
    expect(pendingItems(items)).toEqual(['Montar feeders']);
  });
});
