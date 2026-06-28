/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec for AXOS slicers and timeline filters. */
import { applySlicers, applySlicersToPivotConfig, axosDateValue, makeSlicer, makeTimeline, rowPassesTimeline, uniqueValuesForRange } from './slicer';
import { buildPivot, type PivotConfig } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (v: any, m: string) => { if (v) passed++; else fails.push(`${m} — expected truthy`); };
const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });

const sheet: any = { celldata: [
  cell(0, 0, 'Region'), cell(0, 1, 'Fecha'), cell(0, 2, 'Ventas'),
  cell(1, 0, 'Norte'), cell(1, 1, '2026-01-10'), cell(1, 2, 100),
  cell(2, 0, 'Sur'), cell(2, 1, '2026-02-05'), cell(2, 2, 200),
  cell(3, 0, 'Norte'), cell(3, 1, '2026-03-15'), cell(3, 2, 50),
  cell(4, 0, 'Oeste'), cell(4, 1, '2026-04-20'), cell(4, 2, 300),
] };

eq(uniqueValuesForRange(sheet, 'A1:C5', 0), ['Norte', 'Oeste', 'Sur'], 'unique values are sorted and de-duplicated');
ok(axosDateValue(46022)! > 0, 'Excel serial dates are comparable');
eq(rowPassesTimeline('2026-02-05', { from: '2026-02-01', to: '2026-03-01' }), true, 'date inside timeline passes');
eq(rowPassesTimeline('2026-04-20', { from: '2026-02-01', to: '2026-03-01' }), false, 'date outside timeline is rejected');

const filtered = JSON.parse(JSON.stringify(sheet));
const slicer = makeSlicer('A1:C5', 0, 'Region');
slicer.selected = ['Norte'];
const timeline = makeTimeline('A1:C5', 1, 'Fecha');
timeline.from = '2026-01-01';
timeline.to = '2026-02-28';
filtered.slicers = [slicer];
filtered.timelines = [timeline];
eq(applySlicers(filtered), 3, 'slicer AND timeline hide non-matching rows');
eq(filtered.config.rowhidden, { 2: 0, 3: 0, 4: 0 }, 'rowhidden metadata is persisted for hidden rows');

const cfg: PivotConfig = { range: 'A1:C5', sheetIndex: 0, rows: ['Region'], cols: [], values: [{ field: 'Ventas', agg: 'sum' }], showColTotals: true, showRowTotals: false };
const pivotCfg = applySlicersToPivotConfig(sheet, cfg, [slicer]);
eq(pivotCfg.filters, [{ field: 'Region', include: ['Norte'] }], 'value slicer maps to pivot value filter');
const pivot = buildPivot(sheet, pivotCfg);
eq(pivot.matrix.some((row) => row.some((x) => x.v === 'Sur')), false, 'pivot excludes rows filtered by slicer');
eq(pivot.matrix.some((row) => row.some((x) => x.v === 'Norte')), true, 'pivot keeps included slicer value');

console.log(`\nSLICER SPEC: ${passed} OK, ${fails.length} failures`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} failures`); }
console.log('✓ AXOS slicer/timeline assertions pass.');
