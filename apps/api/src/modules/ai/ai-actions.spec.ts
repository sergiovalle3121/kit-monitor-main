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

describe('ACTIONS.release_quality_hold', () => {
  const def = ACTIONS.release_quality_hold;
  it('requires a positive numeric holdId (coerces strings)', () => {
    expect(def.validate({}).ok).toBe(false);
    expect(def.validate({ holdId: 0 }).ok).toBe(false);
    expect(def.validate({ holdId: '42' })).toMatchObject({
      ok: true,
      params: { holdId: 42 },
    });
  });
  it('is gated by QUALITY_APPROVE', () => {
    expect(def.requiredPermission).toBe('QUALITY_APPROVE');
  });
});

describe('ACTIONS.create_purchase_requisition', () => {
  const def = ACTIONS.create_purchase_requisition;
  it('requires partNumber and a positive quantity', () => {
    expect(def.validate({ quantity: 5 }).ok).toBe(false);
    expect(def.validate({ partNumber: 'ABC' }).ok).toBe(false);
    expect(def.validate({ partNumber: 'ABC', quantity: 0 }).ok).toBe(false);
    expect(def.validate({ partNumber: 'ABC', quantity: '10' })).toMatchObject({
      ok: true,
      params: { partNumber: 'ABC', quantity: 10 },
    });
  });
});

describe('ACTIONS.create_production_plan', () => {
  const def = ACTIONS.create_production_plan;
  it('requires model, line 1–7, quantity and a valid shift', () => {
    expect(def.validate({ line: 1, quantity: 1, shift: 'T1' }).ok).toBe(false);
    expect(
      def.validate({ model: 'M', line: 9, quantity: 1, shift: 'T1' }).ok,
    ).toBe(false);
    expect(
      def.validate({ model: 'M', line: 3, quantity: 1, shift: 'T9' }).ok,
    ).toBe(false);
    expect(
      def.validate({ model: 'M', line: '3', quantity: '50', shift: 't2' }),
    ).toMatchObject({
      ok: true,
      params: { model: 'M', line: 3, quantity: 50, shift: 'T2' },
    });
  });
});

describe('ACTIONS.assign_ehs_incident_owner', () => {
  const def = ACTIONS.assign_ehs_incident_owner;
  it('requires incidentId and owner', () => {
    expect(def.validate({ owner: 'Ana' }).ok).toBe(false);
    expect(def.validate({ incidentId: 'I-1' }).ok).toBe(false);
    expect(def.validate({ incidentId: 'I-1', owner: 'Ana' })).toMatchObject({
      ok: true,
      params: { incidentId: 'I-1', owner: 'Ana' },
    });
  });
});

describe('ACTIONS.set_maintenance_order_status', () => {
  const def = ACTIONS.set_maintenance_order_status;
  it('requires orderId and a valid status (normalized)', () => {
    expect(def.validate({ status: 'COMPLETED' }).ok).toBe(false);
    expect(def.validate({ orderId: 'o1', status: 'BOGUS' }).ok).toBe(false);
    expect(def.validate({ orderId: 'o1', status: 'completed' })).toMatchObject({
      ok: true,
      params: { orderId: 'o1', status: 'COMPLETED' },
    });
  });
});

describe('ACTIONS.create_safety_incident', () => {
  const def = ACTIONS.create_safety_incident;
  it('requires a 3–200 char title and keeps optional fields', () => {
    expect(def.validate({}).ok).toBe(false);
    expect(def.validate({ title: 'no' }).ok).toBe(false);
    expect(
      def.validate({ title: 'Derrame en pasillo B', area: 'Almacén' }),
    ).toMatchObject({
      ok: true,
      params: { title: 'Derrame en pasillo B', area: 'Almacén' },
    });
  });
  it('is gated by reports:read', () => {
    expect(def.requiredPermission).toBe('reports:read');
  });
});
