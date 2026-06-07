import { assertTransition, canTransition, isTerminal, nextStates } from './wo-state';

describe('wo-state (pure)', () => {
  it('follows LIBERADO→MONTADO→EN EJECUCIÓN→COMPLETADO', () => {
    expect(canTransition('RELEASED', 'STAGED')).toBe(true);
    expect(canTransition('STAGED', 'IN_EXECUTION')).toBe(true);
    expect(canTransition('IN_EXECUTION', 'COMPLETED')).toBe(true);
  });

  it('allows pulling material back (STAGED → RELEASED)', () => {
    expect(canTransition('STAGED', 'RELEASED')).toBe(true);
  });

  it('allows starting directly from RELEASED', () => {
    expect(canTransition('RELEASED', 'IN_EXECUTION')).toBe(true);
  });

  it('cannot skip from RELEASED to COMPLETED', () => {
    expect(canTransition('RELEASED', 'COMPLETED')).toBe(false);
    expect(() => assertTransition('RELEASED', 'COMPLETED')).toThrow(/No se puede mover/);
  });

  it('COMPLETED and CANCELLED are terminal', () => {
    expect(isTerminal('COMPLETED')).toBe(true);
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(nextStates('COMPLETED')).toEqual([]);
  });

  it('can cancel from any non-terminal state', () => {
    expect(canTransition('RELEASED', 'CANCELLED')).toBe(true);
    expect(canTransition('STAGED', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_EXECUTION', 'CANCELLED')).toBe(true);
  });
});
