import {
  FIELD_SPECS,
  suggestMapping,
  validateRow,
  validateRows,
} from './import-logic';

describe('suggestMapping', () => {
  it('auto-maps headers by alias (case/space/underscore insensitive)', () => {
    const headers = ['Part Number', 'Descripción', 'Std_Cost', 'unknown'];
    const m = suggestMapping('MATERIAL', headers);
    expect(m.partNumber).toBe('Part Number');
    expect(m.description).toBe('Descripción');
    expect(m.standardCost).toBe('Std_Cost');
  });

  it('maps SAP-ish field names for BOM', () => {
    const m = suggestMapping('BOM', ['TopItem', 'IDNRK', 'MENGE', 'POSNR']);
    expect(m.parentPartNumber).toBe('TopItem');
    expect(m.componentPartNumber).toBe('IDNRK');
    expect(m.quantity).toBe('MENGE');
    expect(m.findNumber).toBe('POSNR');
  });
});

describe('validateRow — MATERIAL', () => {
  const mapping = { partNumber: 'pn', description: 'desc', itemType: 'type', standardCost: 'cost' };

  it('accepts a valid row and coerces types', () => {
    const r = validateRow('MATERIAL', { pn: 'RES-1', desc: 'Resistor', type: 'purchased', cost: '0.01' }, mapping, 0);
    expect(r.valid).toBe(true);
    expect(r.data.partNumber).toBe('RES-1');
    expect(r.data.itemType).toBe('PURCHASED'); // upper-cased
    expect(r.data.standardCost).toBe(0.01);
  });

  it('flags missing required fields', () => {
    const r = validateRow('MATERIAL', { pn: '', desc: 'x' }, mapping, 1);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === 'partNumber')).toBe(true);
  });

  it('flags a non-numeric cost and an invalid enum', () => {
    const r = validateRow('MATERIAL', { pn: 'A', desc: 'B', type: 'WIDGET', cost: 'abc' }, mapping, 2);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.field === 'standardCost')).toBe(true);
    expect(r.errors.some((e) => e.field === 'itemType')).toBe(true);
  });
});

describe('validateRows — BOM summary', () => {
  it('summarizes valid vs error rows (does not import garbage silently)', () => {
    const mapping = { parentPartNumber: 'p', componentPartNumber: 'c', quantity: 'q' };
    const { summary } = validateRows('BOM', [
      { p: 'TOP', c: 'SUB', q: '2' },
      { p: 'TOP', c: '', q: '1' }, // missing component
      { p: 'TOP', c: 'BOLT', q: 'x' }, // bad qty
    ], mapping);
    expect(summary.total).toBe(3);
    expect(summary.valid).toBe(1);
    expect(summary.errors).toBe(2);
  });
});

describe('FIELD_SPECS', () => {
  it('marks the natural keys as required', () => {
    expect(FIELD_SPECS.MATERIAL.find((f) => f.field === 'partNumber')?.required).toBe(true);
    expect(FIELD_SPECS.BOM.find((f) => f.field === 'parentPartNumber')?.required).toBe(true);
    expect(FIELD_SPECS.ROUTING.find((f) => f.field === 'sequence')?.required).toBe(true);
  });
});
