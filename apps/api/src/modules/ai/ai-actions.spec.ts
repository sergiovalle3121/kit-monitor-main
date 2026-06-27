import { ACTIONS } from './ai-actions';

describe('ACTIONS.create_maintenance_order', () => {
  const def = ACTIONS.create_maintenance_order;

  it('requires a title of 3–200 chars', () => {
    expect(def.validate({}).ok).toBe(false);
    expect(def.validate({ title: 'ab' }).ok).toBe(false);
    expect(def.validate({ title: 'x'.repeat(201) }).ok).toBe(false);
  });

  it('normalizes type/priority to upper-case and keeps optional fields', () => {
    const r = def.validate({
      title: '  Cambiar termopar zona 3 ',
      type: 'corrective',
      priority: 'high',
      assetId: 'A-1',
    });
    expect(r.ok).toBe(true);
    expect(r.params).toMatchObject({
      title: 'Cambiar termopar zona 3',
      type: 'CORRECTIVE',
      priority: 'HIGH',
      assetId: 'A-1',
    });
  });

  it('rejects invalid type or priority', () => {
    expect(def.validate({ title: 'Orden', type: 'BOGUS' }).ok).toBe(false);
    expect(def.validate({ title: 'Orden', priority: 'URGENT' }).ok).toBe(false);
  });

  it('summarizes the proposal for the confirmation card', () => {
    const s = def.summarize({ title: 'Cambiar filtro', priority: 'HIGH' });
    expect(s).toContain('Cambiar filtro');
    expect(s).toContain('HIGH');
  });

  it('requires the maintenance:write permission', () => {
    expect(def.requiredPermission).toBe('maintenance:write');
  });
});
