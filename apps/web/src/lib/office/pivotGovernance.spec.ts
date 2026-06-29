/* eslint-disable @typescript-eslint/no-explicit-any */
import { analyzePivotDraft, analyzeStoredPivots, formatPivotRefreshReport, refreshStoredPivots, type StoredPivotDefinition } from './pivotGovernance';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: any, b: any, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);

const cell = (v: any) => ({ v, m: String(v ?? ''), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });
function sheet(name: string, rows: any[][]) {
  const celldata: any[] = [];
  rows.forEach((row, r) => row.forEach((value, c) => celldata.push({ r, c, v: cell(value) })));
  return { name, celldata, row: 50, column: 10, config: {} };
}

const sheets = [
  sheet('Raw', [
    ['Linea', 'Turno', 'Scrap'],
    ['L1', 'A', 5],
    ['L1', 'B', 7],
    ['L2', 'A', 3],
  ]),
  sheet('Pivot Scrap', [['old']]),
];
const pivots: StoredPivotDefinition[] = [
  { id: 'pv1', sheetName: 'Pivot Scrap', config: { sheetIndex: 0, range: 'A1:C4', rows: ['Linea'], cols: ['Turno'], values: [{ field: 'Scrap', agg: 'sum' }] } },
  { id: 'pv2', sheetName: 'Missing Target', config: { sheetIndex: 0, range: 'A1:C4', rows: ['Linea'], cols: [], values: [{ field: 'Scrap', agg: 'sum' }] } },
  { id: 'pv3', sheetName: 'Pivot Scrap', config: { sheetIndex: 9, range: 'A1:C4', rows: ['Linea'], cols: [], values: [{ field: 'Scrap', agg: 'sum' }] } },
];

const analysis = analyzeStoredPivots(sheets, pivots);
eq([analysis.updated, analysis.skipped], [1, 2], 'analysis cuenta actualizadas/omitidas');
eq(analysis.findings.map((finding) => finding.status), ['updated', 'missing-target', 'missing-source'], 'analysis clasifica problemas');
ok(sheets[1].celldata[0].v.v === 'old', 'analysis no muta hojas');

const refreshed = refreshStoredPivots(sheets, pivots);
eq([refreshed.report.updated, refreshed.report.skipped], [1, 2], 'refresh cuenta actualizadas/omitidas');
ok(refreshed.sheets !== sheets, 'refresh devuelve copia');
ok(refreshed.sheets[1].celldata.some((c: any) => c.v?.v === 'L1'), 'refresh reescribe resultado pivot');
ok(sheets[1].celldata[0].v.v === 'old', 'refresh no muta input original');
ok(formatPivotRefreshReport(refreshed.report).includes('1 actualizada'), 'formatea resumen humano');
ok(formatPivotRefreshReport({ updated: 0, skipped: 0, findings: [] }) === 'No hay tablas dinámicas guardadas.', 'resumen vacío');

const draftReady = analyzePivotDraft(sheets, pivots[0].config, { maxRows: 3, maxCols: 2 });
ok(draftReady.status === 'ready', 'draft preview listo para config valida');
ok(draftReady.canCreate, 'draft valido permite crear');
ok(draftReady.preview.rows.length === 3, 'draft preview limita filas');
ok(draftReady.preview.truncatedColumns, 'draft preview reporta columnas truncadas');
ok(draftReady.summary.includes('Preview listo'), 'draft listo resume dimensiones');

const draftMissing = analyzePivotDraft(sheets, { ...pivots[0].config, rows: ['Linea', 'Fantasma'] });
ok(draftMissing.status === 'invalid-source', 'draft con campo faltante invalida fuente');
ok(!draftMissing.canCreate, 'draft con campo faltante bloquea crear');
ok(draftMissing.missingFields.some((field) => field.field === 'Fantasma' && field.zone === 'rows'), 'draft lista campo faltante');

const draftNeedsFields = analyzePivotDraft(sheets, { ...pivots[0].config, rows: [], cols: [], values: [] });
ok(draftNeedsFields.status === 'needs-fields', 'draft sin layout pide campos');
ok(!draftNeedsFields.canCreate, 'draft sin layout bloquea crear');

const draftFilteredOut = analyzePivotDraft(sheets, { ...pivots[0].config, filters: [{ field: 'Linea', include: ['L9'] }] });
ok(draftFilteredOut.status === 'warnings', 'draft con filtro sin filas reporta advertencia');
ok(draftFilteredOut.canCreate, 'draft con solo encabezados permite crear con aviso');
ok(draftFilteredOut.warnings.some((warning) => warning.includes('filtros')), 'draft conserva warning de filtros vacios');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${total}`);
