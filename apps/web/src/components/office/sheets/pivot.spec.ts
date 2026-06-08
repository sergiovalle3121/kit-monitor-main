/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Spec ejecutable del motor de tablas dinámicas (pure). No usa runner externo:
 *   cd apps/web && npx tsx src/components/office/sheets/pivot.spec.ts
 * Node 22 + tsx resuelven el alias `@/` y las importaciones sin extensión.
 */
import { buildPivot, aggregate, pivotFields, fieldValues, type PivotConfig } from '@/lib/office/sheetOps';

// ── Mini harness ─────────────────────────────────────────────────────────────
let passed = 0;
const fails: string[] = [];
function ok(cond: boolean, msg: string) { if (cond) passed++; else fails.push(msg); }
function eq(a: any, b: any, msg: string) { ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); }

// ── Datos de prueba ──────────────────────────────────────────────────────────
const HEADERS = ['Region', 'Producto', 'Mes', 'Ventas', 'Unidades'];
const DATA: any[][] = [
  ['Norte', 'A', 'Ene', 100, 5],
  ['Norte', 'B', 'Ene', 200, 8],
  ['Sur', 'A', 'Ene', 150, 6],
  ['Norte', 'A', 'Feb', 120, 4],
  ['Sur', 'B', 'Feb', 300, 10],
  ['Sur', 'A', 'Feb', 80, 3],
];
function makeSheet() {
  const celldata: any[] = [];
  HEADERS.forEach((h, c) => celldata.push({ r: 0, c, v: { v: h, m: h, ct: { fa: 'General', t: 's' } } }));
  DATA.forEach((row, ri) => row.forEach((val, c) => {
    const t = typeof val === 'number' ? 'n' : 's';
    celldata.push({ r: ri + 1, c, v: { v: val, m: String(val), ct: { fa: 'General', t } } });
  }));
  return { name: 'Origen', celldata };
}
const RANGE = 'A1:E7';

// ── Helpers de lectura de la matriz ──────────────────────────────────────────
const rowByLabel = (res: any, label: string) => res.matrix.find((row: any[]) => String(row[0]?.v) === label);
const nums = (row: any[]) => row.filter((c) => c.num && typeof c.v === 'number').map((c) => c.v);

// ── 1) Agregaciones puras ────────────────────────────────────────────────────
eq(aggregate([1, 2, 3, 4], 'sum'), 10, 'aggregate sum');
eq(aggregate([1, 2, 3, 4], 'avg'), 2.5, 'aggregate avg');
eq(aggregate([1, 2, 3, 4], 'min'), 1, 'aggregate min');
eq(aggregate([1, 2, 3, 4], 'max'), 4, 'aggregate max');
eq(aggregate([1, 2, 3, 4], 'count'), 4, 'aggregate count');
eq(aggregate(['a', '', 'b', null], 'counta'), 2, 'aggregate counta');
eq(aggregate([2, 3, 4], 'product'), 24, 'aggregate product');
ok(Math.abs(aggregate([2, 4, 4, 4, 5, 5, 7, 9], 'stdev') - 2.138) < 0.01, 'aggregate stdev≈2.138');

// ── 2) pivotFields / fieldValues ─────────────────────────────────────────────
const sheet = makeSheet();
eq(pivotFields(sheet, RANGE), HEADERS, 'pivotFields = cabeceras');
eq(fieldValues(sheet, RANGE, 'Region'), ['Norte', 'Sur'], 'fieldValues Region');

// ── 3) Pivot 1D: filas=Region, valores=sum(Ventas) ──────────────────────────
{
  const cfg: PivotConfig = { range: RANGE, sheetIndex: 0, rows: ['Region'], cols: [], values: [{ field: 'Ventas', agg: 'sum' }], showColTotals: true, showRowTotals: false };
  const res = buildPivot(sheet, cfg);
  eq(nums(rowByLabel(res, 'Norte')), [420], 'Norte sum(Ventas)=420');
  eq(nums(rowByLabel(res, 'Sur')), [530], 'Sur sum(Ventas)=530');
  eq(nums(rowByLabel(res, 'Total general')), [950], 'Total general=950');
}

// ── 4) Pivot 2D: filas=Region, columnas=Mes, valores=sum(Ventas) + total fila ─
{
  const cfg: PivotConfig = { range: RANGE, sheetIndex: 0, rows: ['Region'], cols: ['Mes'], values: [{ field: 'Ventas', agg: 'sum' }], showColTotals: true, showRowTotals: true };
  const res = buildPivot(sheet, cfg);
  // Columnas de datos ordenadas: Ene, Feb (numérico/alfabético). Norte: Ene=300, Feb=120, total=420.
  eq(nums(rowByLabel(res, 'Norte')), [300, 120, 420], 'Norte por mes + total = [300,120,420]');
  eq(nums(rowByLabel(res, 'Sur')), [150, 380, 530], 'Sur por mes + total = [150,380,530]');
  eq(nums(rowByLabel(res, 'Total general')), [450, 500, 950], 'Totales por mes = [450,500,950]');
}

// ── 5) Promedio ──────────────────────────────────────────────────────────────
{
  const cfg: PivotConfig = { range: RANGE, sheetIndex: 0, rows: ['Region'], cols: [], values: [{ field: 'Ventas', agg: 'avg' }], showColTotals: false, showRowTotals: false };
  const res = buildPivot(sheet, cfg);
  eq(nums(rowByLabel(res, 'Norte')), [140], 'Norte avg(Ventas)=140');
}

// ── 6) Subtotales (filas anidadas Region→Producto) ───────────────────────────
{
  const cfg: PivotConfig = { range: RANGE, sheetIndex: 0, rows: ['Region', 'Producto'], cols: [], values: [{ field: 'Ventas', agg: 'sum' }], showSubtotals: true, showColTotals: true, showRowTotals: false };
  const res = buildPivot(sheet, cfg);
  eq(nums(rowByLabel(res, 'Norte — Total')), [420], 'Subtotal Norte=420');
  eq(nums(rowByLabel(res, 'Sur — Total')), [530], 'Subtotal Sur=530');
  eq(nums(rowByLabel(res, 'Total general')), [950], 'Total general con subtotales=950');
}

// ── 7) Filtros por valor ─────────────────────────────────────────────────────
{
  const cfg: PivotConfig = { range: RANGE, sheetIndex: 0, rows: ['Region'], cols: [], values: [{ field: 'Ventas', agg: 'sum' }], filters: [{ field: 'Region', include: ['Norte'] }], showColTotals: true, showRowTotals: false };
  const res = buildPivot(sheet, cfg);
  eq(nums(rowByLabel(res, 'Total general')), [420], 'Filtro Region=Norte → total 420');
  ok(!rowByLabel(res, 'Sur'), 'Filtro excluye Sur');
}

// ── 8) Múltiples valores ─────────────────────────────────────────────────────
{
  const cfg: PivotConfig = { range: RANGE, sheetIndex: 0, rows: ['Region'], cols: [], values: [{ field: 'Ventas', agg: 'sum' }, { field: 'Unidades', agg: 'sum' }], showColTotals: true, showRowTotals: false };
  const res = buildPivot(sheet, cfg);
  eq(nums(rowByLabel(res, 'Norte')), [420, 17], 'Norte [sum Ventas, sum Unidades] = [420,17]');
  eq(nums(rowByLabel(res, 'Sur')), [530, 19], 'Sur [sum Ventas, sum Unidades] = [530,19]');
}

// ── Resumen ──────────────────────────────────────────────────────────────────
console.log(`\nPIVOT SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} aserciones fallaron`); }
console.log('✓ Todas las aserciones del pivot pasan.');
