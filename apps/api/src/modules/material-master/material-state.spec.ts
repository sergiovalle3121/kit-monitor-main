import {
  assertTransition,
  canTransition,
  defaultMakeBuy,
  isAssemblyType,
  isItemType,
  nextStates,
} from './material-state';

describe('material lifecycle state machine', () => {
  it('allows the canonical happy path DRAFT → ACTIVE → OBSOLETE', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'OBSOLETE')).toBe(true);
  });

  it('supports a temporary HOLD and resuming from it', () => {
    expect(canTransition('ACTIVE', 'HOLD')).toBe(true);
    expect(canTransition('HOLD', 'ACTIVE')).toBe(true);
    expect(canTransition('HOLD', 'OBSOLETE')).toBe(true);
  });

  it('can reactivate a retired part', () => {
    expect(canTransition('OBSOLETE', 'ACTIVE')).toBe(true);
  });

  it('rejects illegal jumps (DRAFT cannot go straight to HOLD)', () => {
    expect(canTransition('DRAFT', 'HOLD')).toBe(false);
    expect(() => assertTransition('DRAFT', 'HOLD')).toThrow();
  });

  it('rejects a no-op transition', () => {
    expect(() => assertTransition('ACTIVE', 'ACTIVE')).toThrow(/ya está/);
  });

  it('exposes the allowed next states', () => {
    expect(nextStates('ACTIVE').sort()).toEqual(['HOLD', 'OBSOLETE']);
    expect(nextStates('OBSOLETE')).toEqual(['ACTIVE']);
  });
});

describe('item type helpers', () => {
  it('validates item types', () => {
    expect(isItemType('PURCHASED')).toBe(true);
    expect(isItemType('NONSENSE')).toBe(false);
    expect(isItemType(null)).toBe(false);
  });

  it('derives make for manufactured/phantom and buy otherwise', () => {
    expect(defaultMakeBuy('MANUFACTURED')).toBe('MAKE');
    expect(defaultMakeBuy('PHANTOM')).toBe('MAKE');
    expect(defaultMakeBuy('PURCHASED')).toBe('BUY');
    expect(defaultMakeBuy('NON_STOCK')).toBe('BUY');
    expect(defaultMakeBuy('DOCUMENT')).toBe('BUY');
  });

  it('flags assembly types (carry a BOM/routing)', () => {
    expect(isAssemblyType('MANUFACTURED')).toBe(true);
    expect(isAssemblyType('PHANTOM')).toBe(true);
    expect(isAssemblyType('PURCHASED')).toBe(false);
  });
});
