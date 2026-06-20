import {
  assertTransition,
  canTransition,
  nextStates,
  rollupRoutingTime,
} from './routing-logic';

describe('routing status state machine', () => {
  it('allows DRAFT → ACTIVE → OBSOLETE and reactivation', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'OBSOLETE')).toBe(true);
    expect(canTransition('OBSOLETE', 'ACTIVE')).toBe(true);
  });
  it('rejects illegal/no-op transitions', () => {
    expect(canTransition('DRAFT', 'DRAFT')).toBe(false);
    expect(() => assertTransition('OBSOLETE', 'OBSOLETE')).toThrow(/ya está/);
    expect(nextStates('ACTIVE')).toEqual(['OBSOLETE']);
  });
});

describe('rollupRoutingTime', () => {
  const ops = [
    { setupTimeMin: 30, runTimePerUnitMin: 1.5 }, // SMT
    { setupTimeMin: 10, runTimePerUnitMin: 0.5 }, // AOI
    { setupTimeMin: 0, runTimePerUnitMin: 2 }, // ensamble
  ];

  it('sums setup once and run per unit', () => {
    const t = rollupRoutingTime(ops, 1);
    expect(t.totalSetupMin).toBe(40);
    expect(t.totalRunPerUnitMin).toBe(4);
    expect(t.totalForQtyMin).toBe(44); // 40 + 4×1
    expect(t.operations).toBe(3);
  });

  it('scales run time with quantity (setup stays fixed)', () => {
    const t = rollupRoutingTime(ops, 100);
    expect(t.totalForQtyMin).toBe(440); // 40 + 4×100
  });

  it('treats missing/negative times as 0 and defaults qty to 1', () => {
    const t = rollupRoutingTime([{ setupTimeMin: -5 }, {}], 0);
    expect(t.totalSetupMin).toBe(0);
    expect(t.totalRunPerUnitMin).toBe(0);
    expect(t.totalForQtyMin).toBe(0);
  });
});
