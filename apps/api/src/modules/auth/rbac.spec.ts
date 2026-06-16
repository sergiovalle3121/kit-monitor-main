import { permissionsFor, ROLE_PERMISSIONS, ALL_PERMISSIONS, AppRole, isOwnerEmail } from './rbac';

/**
 * RBAC matrix guard tests. These lock in the shop-floor authorization rules the
 * platform depends on: who may publish plans, authorize WOs, consume material,
 * hold/disposition quality. A regression here is a real security change.
 */
describe('rbac shop-floor matrix', () => {
  const has = (role: AppRole, perm: string) =>
    permissionsFor(role).includes(perm);

  it('operator can execute production and report defects, but NOT publish/authorize/consume-config', () => {
    expect(has('operator', 'production:execute')).toBe(true);
    expect(has('operator', 'quality:report')).toBe(true);
    expect(has('operator', 'materials:read')).toBe(true);
    // Operators must not publish plans, authorize WOs, or stage material.
    expect(has('operator', 'planning:publish')).toBe(false);
    expect(has('operator', 'production:authorize')).toBe(false);
    expect(has('operator', 'materials:stage')).toBe(false);
    expect(has('operator', 'quality:disposition')).toBe(false);
  });

  it('production-side roles may pull production:report (genealogy/as-built); materialist may not', () => {
    expect(has('operator', 'production:report')).toBe(true);
    expect(has('production_supervisor', 'production:report')).toBe(true);
    expect(has('quality_engineer', 'production:report')).toBe(true);
    expect(has('plant_manager', 'production:report')).toBe(true);
    expect(has('planner', 'production:report')).toBe(true);
    expect(has('materialist', 'production:report')).toBe(false);
  });

  it('materialist can stage material but NOT execute production', () => {
    expect(has('materialist', 'materials:stage')).toBe(true);
    expect(has('materialist', 'materials:request')).toBe(true);
    expect(has('materialist', 'production:execute')).toBe(false);
    expect(has('materialist', 'quality:disposition')).toBe(false);
  });

  it('only planner/plant_manager may publish a plan', () => {
    expect(has('planner', 'planning:publish')).toBe(true);
    expect(has('plant_manager', 'planning:publish')).toBe(true);
    expect(has('operator', 'planning:publish')).toBe(false);
    expect(has('materialist', 'planning:publish')).toBe(false);
    expect(has('quality_engineer', 'planning:publish')).toBe(false);
  });

  it('only supervisor/plant_manager may authorize a WO to an operator', () => {
    expect(has('production_supervisor', 'production:authorize')).toBe(true);
    expect(has('plant_manager', 'production:authorize')).toBe(true);
    expect(has('operator', 'production:authorize')).toBe(false);
    expect(has('planner', 'production:authorize')).toBe(false);
  });

  it('only quality may place a quality hold', () => {
    expect(has('quality_engineer', 'quality:hold')).toBe(true);
    expect(has('plant_manager', 'quality:hold')).toBe(true);
    expect(has('mrb_member', 'quality:hold')).toBe(false);
    expect(has('operator', 'quality:hold')).toBe(false);
    expect(has('production_supervisor', 'quality:hold')).toBe(false);
  });

  it('only quality_engineer / mrb_member / plant_manager may disposition', () => {
    expect(has('quality_engineer', 'quality:disposition')).toBe(true);
    expect(has('mrb_member', 'quality:disposition')).toBe(true);
    expect(has('plant_manager', 'quality:disposition')).toBe(true);
    expect(has('operator', 'quality:disposition')).toBe(false);
    expect(has('materialist', 'quality:disposition')).toBe(false);
  });

  it('industrial_engineer may write engineering (line layout/routing)', () => {
    expect(has('industrial_engineer', 'engineering:write')).toBe(true);
    expect(has('industrial_engineer', 'production:read')).toBe(true);
    expect(has('operator', 'engineering:write')).toBe(false);
  });

  it('cycle_count_analyst may reconcile inventory only', () => {
    expect(has('cycle_count_analyst', 'inventory:reconcile')).toBe(true);
    expect(has('cycle_count_analyst', 'production:execute')).toBe(false);
  });

  it('every role resolves to an array (no undefined roles in the matrix)', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as AppRole[]) {
      expect(Array.isArray(permissionsFor(role))).toBe(true);
    }
  });

  // Owner/Admin must carry the FULL permission set in the JWT so the frontend
  // (which gates the UI on the permissions array) never locks the owner out.
  it('admin resolves to the full permission set (not empty)', () => {
    const adminPerms = permissionsFor('admin');
    expect(adminPerms.length).toBeGreaterThan(0);
    expect(adminPerms.length).toBe(ALL_PERMISSIONS.length);
    // representative permissions from every area must be present
    for (const p of [
      'planning:publish', 'production:execute', 'production:authorize',
      'materials:stage', 'quality:hold', 'quality:disposition',
      'inventory:reconcile', 'maintenance:write', 'auth:write', 'settings:write',
    ]) {
      expect(adminPerms).toContain(p);
    }
  });

  it('admin holds a superset of every other role’s permissions', () => {
    const adminPerms = new Set(permissionsFor('admin'));
    for (const role of Object.keys(ROLE_PERMISSIONS) as AppRole[]) {
      if (role === 'admin') continue;
      for (const p of permissionsFor(role)) {
        expect(adminPerms.has(p)).toBe(true);
      }
    }
  });

  it('recognizes the project owner email', () => {
    expect(isOwnerEmail('sergiovallezarate@gmail.com')).toBe(true);
    expect(isOwnerEmail('SergioValleZarate@Gmail.com')).toBe(true);
    expect(isOwnerEmail('random@x.com')).toBe(false);
  });
});
