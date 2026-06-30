/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de referencias estructuradas (Tabla[Columna]) — expansión pura + motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/tableRefs.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';
import {
  analyzeTableDefReadiness,
  analyzeTableRangeReadiness,
  expandStructuredRefs,
  type TableDef,
} from './tableRefs';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// Tabla «Ventas» en Hoja1, cabecera en fila 0 (A1:C1), datos filas 1..3 (A2:C4).
// Columnas: A=Mes, B=Importe, C=Unidades.
const ventas: TableDef = { name: 'Ventas', sheetName: 'Hoja1', r1: 0, c1: 0, r2: 3, c2: 2, headers: ['Mes', 'Importe', 'Unidades'] };
const tabs = [ventas];

// ── Expansión pura ────────────────────────────────────────────────────────────
eq(expandStructuredRefs('SUM(Ventas[Importe])', tabs), 'SUM(Hoja1!B2:B4)', 'columna → rango de datos');
eq(expandStructuredRefs('SUM(Ventas[Unidades])', tabs), 'SUM(Hoja1!C2:C4)', 'otra columna');
eq(expandStructuredRefs('COUNTA(Ventas[#Encabezados])', tabs), 'COUNTA(Hoja1!A1:C1)', 'fila de encabezados');
eq(expandStructuredRefs('ROWS(Ventas[#Todo])', tabs), 'ROWS(Hoja1!A1:C4)', '#Todo = cabecera + datos');
eq(expandStructuredRefs('SUM(Ventas[])', tabs), 'SUM(Hoja1!A2:C4)', '[] = cuerpo de datos');
eq(expandStructuredRefs('SUM(Ventas[[Importe]])', tabs), 'SUM(Hoja1!B2:B4)', 'columna con dobles corchetes');
eq(expandStructuredRefs('SUM(A1:A3)', tabs), 'SUM(A1:A3)', 'sin tabla → intacto');
eq(expandStructuredRefs('"texto Ventas[Importe]"', tabs), '"texto Ventas[Importe]"', 'no toca dentro de comillas');
eq(expandStructuredRefs('OtraVentas[Importe]', tabs), 'OtraVentas[Importe]', 'no parte un identificador mayor');

// ── Motor REAL: la fórmula expandida calcula sobre la hoja ────────────────────
const Parser: any = (FP as any).Parser;
const grid: Record<string, any> = {
  '0_0': 'Mes', '0_1': 'Importe', '0_2': 'Unidades',
  '1_0': 'Ene', '1_1': 100, '1_2': 3,
  '2_0': 'Feb', '2_1': 200, '2_2': 5,
  '3_0': 'Mar', '3_1': 300, '3_2': 7,
};
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(expandStructuredRefs(f.replace(/^=/, ''), tabs)); return r.error ? r.error : r.result; };

eq(ev('=SUM(Ventas[Importe])'), 600, 'motor: SUM(Ventas[Importe]) = 600');
eq(ev('=AVERAGE(Ventas[Unidades])'), 5, 'motor: AVERAGE(Ventas[Unidades]) = 5');
eq(ev('=SUMIF(Ventas[Mes],"Feb",Ventas[Importe])'), 200, 'motor: SUMIF con dos columnas de tabla');
eq(ev('=MAX(Ventas[Importe])'), 300, 'motor: MAX de una columna');

// Table readiness preflight for the visible "format as table" workflow.
const ready = analyzeTableRangeReadiness({ range: 'A1:D20', hasHeader: true, withFilter: true });
eq(ready.status, 'ready', 'preflight: rango rectangular con encabezado listo');
eq(ready.rows, 20, 'preflight: cuenta filas');
eq(ready.columns, 4, 'preflight: cuenta columnas');
eq(ready.dataRows, 19, 'preflight: cuenta filas de datos');
eq(ready.structuredReferences, true, 'preflight: habilita referencias estructuradas con encabezado');

const blocked = analyzeTableRangeReadiness({ range: 'A1:A1', hasHeader: true });
eq(blocked.status, 'blocked', 'preflight: bloquea tabla sin datos bajo encabezado');
eq(blocked.issues.some((issue) => issue.key === 'missing_data_rows'), true, 'preflight: reporta falta de datos');

const noHeader = analyzeTableRangeReadiness({ range: 'A1:C10', hasHeader: false, withFilter: true });
eq(noHeader.status, 'review', 'preflight: sin encabezado queda en revision');
eq(noHeader.structuredReferences, false, 'preflight: sin encabezado no hay referencias estructuradas');
eq(noHeader.issues.some((issue) => issue.key === 'filter_requires_header'), true, 'preflight: autofiltro requiere encabezado');

const invalidName = analyzeTableRangeReadiness({ range: 'A1:B5', hasHeader: true, tableName: 'A1' });
eq(invalidName.status, 'blocked', 'preflight: nombre parecido a celda bloquea');
eq(invalidName.issues.some((issue) => issue.key === 'invalid_table_name'), true, 'preflight: reporta nombre invalido');

const brokenHeaders = analyzeTableDefReadiness({
  name: 'IndustrialTable',
  sheetName: 'Hoja1',
  r1: 0,
  c1: 0,
  r2: 3,
  c2: 2,
  headers: ['SKU', 'sku', ''],
});
eq(brokenHeaders.status, 'blocked', 'registro: encabezados ambiguos bloquean readiness');
eq(brokenHeaders.issues.some((issue) => issue.key === 'duplicate_headers'), true, 'registro: detecta encabezados duplicados');
eq(brokenHeaders.issues.some((issue) => issue.key === 'blank_headers'), true, 'registro: detecta encabezados vacios');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ tableRefs: ${passed}/${total} aserciones verdes.`);
