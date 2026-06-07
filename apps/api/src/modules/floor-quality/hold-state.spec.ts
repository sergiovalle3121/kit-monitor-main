import {
  assertTransition,
  canTransition,
  needsRework,
  requiresScar,
  requiresWaiver,
} from './hold-state';

describe('hold-state (pure)', () => {
  it('runs HELD→MRB_REVIEW→DISPOSITIONED→CLOSED', () => {
    expect(canTransition('HELD', 'MRB_REVIEW')).toBe(true);
    expect(canTransition('MRB_REVIEW', 'DISPOSITIONED')).toBe(true);
    expect(canTransition('DISPOSITIONED', 'CLOSED')).toBe(true);
  });

  it('supports the rework loop DISPOSITIONED→REWORK→REINSPECT→CLOSED/REWORK', () => {
    expect(canTransition('DISPOSITIONED', 'REWORK')).toBe(true);
    expect(canTransition('REWORK', 'REINSPECT')).toBe(true);
    expect(canTransition('REINSPECT', 'CLOSED')).toBe(true);
    expect(canTransition('REINSPECT', 'REWORK')).toBe(true);
  });

  it('cannot disposition straight from HELD (must go through MRB)', () => {
    expect(canTransition('HELD', 'DISPOSITIONED')).toBe(false);
    expect(() => assertTransition('HELD', 'DISPOSITIONED')).toThrow(/No se puede mover el hold/);
  });

  it('classifies dispositions: rework, waiver, scar', () => {
    expect(needsRework('REWORK')).toBe(true);
    expect(needsRework('REPAIR')).toBe(true);
    expect(needsRework('SCRAP')).toBe(false);
    expect(requiresWaiver('USE_AS_IS')).toBe(true);
    expect(requiresScar('RTV')).toBe(true);
    expect(requiresWaiver('SCRAP')).toBe(false);
  });
});
