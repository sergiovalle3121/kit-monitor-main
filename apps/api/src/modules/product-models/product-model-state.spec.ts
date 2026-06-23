import {
  assertTransition,
  canTransition,
  nextStates,
  PRODUCT_MODEL_STATUSES,
  ProductModelStatus,
} from './product-model-state';

describe('product model state machine', () => {
  it('exposes the three master-data statuses', () => {
    expect(PRODUCT_MODEL_STATUSES).toEqual(['DRAFT', 'ACTIVE', 'OBSOLETE']);
  });

  it('allows the happy path draft → active → obsolete', () => {
    expect(canTransition('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransition('ACTIVE', 'OBSOLETE')).toBe(true);
  });

  it('allows discarding a draft straight to obsolete', () => {
    expect(canTransition('DRAFT', 'OBSOLETE')).toBe(true);
  });

  it('allows reactivating a retired model', () => {
    expect(canTransition('OBSOLETE', 'ACTIVE')).toBe(true);
  });

  it('forbids reverting an active model back to draft', () => {
    expect(canTransition('ACTIVE', 'DRAFT')).toBe(false);
    expect(canTransition('OBSOLETE', 'DRAFT')).toBe(false);
  });

  it('rejects no-op transitions with a clear message', () => {
    PRODUCT_MODEL_STATUSES.forEach((s) => {
      expect(() => assertTransition(s, s)).toThrow(/already/);
    });
  });

  it('assertTransition throws a descriptive error on illegal moves', () => {
    expect(() => assertTransition('OBSOLETE', 'DRAFT')).toThrow(
      /Cannot move a product model/,
    );
    expect(() => assertTransition('DRAFT', 'ACTIVE')).not.toThrow();
  });

  it('nextStates lists the reachable statuses', () => {
    expect(nextStates('DRAFT')).toEqual(['ACTIVE', 'OBSOLETE']);
    expect(nextStates('ACTIVE')).toEqual(['OBSOLETE']);
    expect(nextStates('OBSOLETE')).toEqual(['ACTIVE']);
  });
});
