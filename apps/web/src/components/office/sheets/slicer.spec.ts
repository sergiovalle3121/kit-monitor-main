import { strict as assert } from 'node:assert';
import { applySlicers, applySlicersToPivotConfig, dateFilteredValues, matchesAxosDateFilter, slicerValues, type AxosSlicer, type AxosTimelineFilter } from './slicer';
import { buildPivot, type PivotConfig } from '@/lib/office/sheetOps';

const cell = (v: unknown) => ({ v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });
const sheet = {
  name: 'Datos',
  config: {},
  celldata: [
    ['Linea', 'Fecha', 'Defecto', 'Scrap'],
    ['L1', '2026-01-05', 'Rayón', 3],
    ['L2', '2026-01-15', 'Golpe', 5],
    ['L1', '2026-02-01', 'Golpe', 7],
    ['L3', '2026-03-01', 'Rayón', 11],
  ].flatMap((row, r) => row.map((v, c) => ({ r, c, v: cell(v) }))),
};

assert.deepEqual(slicerValues(sheet, 'A1:D5', 0), ['L1', 'L2', 'L3'], 'unique values are sorted and deduped');
assert.equal(matchesAxosDateFilter(cell('2026-01-15'), { from: '2026-01-01', to: '2026-01-31' }), true, 'date helper accepts values inside range');
assert.equal(matchesAxosDateFilter(cell('2026-02-01'), { from: '2026-01-01', to: '2026-01-31' }), false, 'date helper rejects values outside range');
assert.deepEqual(dateFilteredValues(sheet, 'A1:D5', 1, { from: '2026-01-01', to: '2026-01-31' }), ['2026-01-05', '2026-01-15'], 'date filter returns visible date values');

const filteredSheet = JSON.parse(JSON.stringify(sheet));
filteredSheet.slicers = [{ id: 'sl_line', range: 'A1:D5', colRel: 0, header: 'Linea', selected: ['L1'] } satisfies AxosSlicer];
filteredSheet.timelines = [{ id: 'tl_date', range: 'A1:D5', colRel: 1, header: 'Fecha', from: '2026-01-01', to: '2026-01-31' } satisfies AxosTimelineFilter];
assert.equal(applySlicers(filteredSheet), 3, 'slicer plus timeline hides rows that fail either filter');
assert.deepEqual(filteredSheet.config.rowhidden, { 2: 0, 3: 0, 4: 0 }, 'hidden rows are persisted in Fortune rowhidden shape');

const cfg: PivotConfig = { range: 'A1:D5', sheetIndex: 0, rows: ['Linea'], cols: [], values: [{ field: 'Scrap', agg: 'sum' }] };
const pivotCfg = applySlicersToPivotConfig(sheet, cfg, { slicers: filteredSheet.slicers, timelines: filteredSheet.timelines, pivotId: 'pv1' });
assert.deepEqual(pivotCfg.filters, [
  { field: 'Linea', include: ['L1'] },
  { field: 'Fecha', include: ['2026-01-05', '2026-01-15'] },
], 'slicers project into non-mutating pivot include filters');
assert.equal(cfg.filters, undefined, 'original pivot config is not mutated');

const pivot = buildPivot(sheet, pivotCfg);
const flat = pivot.matrix.flat().map((c) => c.v);
assert.ok(flat.includes('L1'), 'filtered pivot keeps included row field');
assert.ok(!flat.includes('L2'), 'filtered pivot excludes slicer-rejected row field');
assert.ok(flat.includes(3), 'filtered pivot aggregates only date-window matching L1 scrap');

console.log('slicer.spec.ts passed');
