import {
  classifyScan,
  computeLoadingState,
  normalizeSscc,
  type LoadingUnitLike,
} from './packing.loading';

const hu = (over: Partial<LoadingUnitLike> = {}): LoadingUnitLike => ({
  id: 'u1',
  sscc: '000000000000000017',
  status: 'PACKED',
  shipmentId: 'ship-A',
  shipmentFolio: 'SHP-2026-000001',
  type: 'CARTON',
  ...over,
});

describe('normalizeSscc', () => {
  it('passes an 18-digit SSCC through unchanged', () => {
    expect(normalizeSscc('000000000000000017')).toBe('000000000000000017');
  });

  it('strips the GS1 AI "00" from a raw 20-digit GS1-128 scan', () => {
    expect(normalizeSscc('00000000000000000017')).toBe('000000000000000017');
  });

  it('strips formatting like "(00) …" and spaces', () => {
    expect(normalizeSscc('(00) 0000 0000 0000 0000 17')).toBe(
      '000000000000000017',
    );
  });

  it('returns empty string for junk', () => {
    expect(normalizeSscc('  ')).toBe('');
    expect(normalizeSscc(null)).toBe('');
  });
});

describe('computeLoadingState', () => {
  it('reports zero units as "no packing used" (not complete)', () => {
    const s = computeLoadingState('ship-A', []);
    expect(s).toMatchObject({
      total: 0,
      loaded: 0,
      pending: 0,
      complete: false,
      hasUnits: false,
    });
  });

  it('counts loaded vs pending and is incomplete while any pend', () => {
    const s = computeLoadingState('ship-A', [
      hu({ id: 'a', status: 'LOADED' }),
      hu({ id: 'b', status: 'PACKED' }),
      hu({ id: 'c', status: 'OPEN' }),
    ]);
    expect(s.total).toBe(3);
    expect(s.loaded).toBe(1);
    expect(s.pending).toBe(2);
    expect(s.complete).toBe(false);
    expect(s.hasUnits).toBe(true);
    expect(s.units.find((u) => u.id === 'a')?.loaded).toBe(true);
  });

  it('is complete only when every unit is LOADED', () => {
    const s = computeLoadingState('ship-A', [
      hu({ id: 'a', status: 'LOADED' }),
      hu({ id: 'b', status: 'LOADED' }),
    ]);
    expect(s.complete).toBe(true);
    expect(s.pending).toBe(0);
  });
});

describe('classifyScan', () => {
  it('matches a packed unit assigned to this shipment', () => {
    expect(classifyScan(hu(), 'ship-A', '000000000000000017').result).toBe(
      'matched',
    );
  });

  it('reports a unit already loaded (idempotent re-scan)', () => {
    expect(classifyScan(hu({ status: 'LOADED' }), 'ship-A', 'x').result).toBe(
      'already',
    );
  });

  it('blocks a unit that belongs to another shipment (poka-yoke)', () => {
    const out = classifyScan(
      hu({ shipmentId: 'ship-B', shipmentFolio: 'SHP-2026-000002' }),
      'ship-A',
      'x',
    );
    expect(out.result).toBe('wrong-shipment');
    expect(out.belongsToFolio).toBe('SHP-2026-000002');
  });

  it('reports an unknown SSCC when nothing was found', () => {
    expect(classifyScan(null, 'ship-A', 'x').result).toBe('unknown');
  });
});
