/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de orden multinivel, subtotales y sparklines. npx tsx src/components/office/sheets/data.spec.ts */
import { sortRangeMulti, applySubtotals, buildSparkline, applySparkline, rawOf } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const cell = (r: number, c: number, val: any) => ({ r, c, v: { v: val, m: String(val), ct: { fa: 'General', t: typeof val === 'number' ? 'n' : 's' } } });
const at = (sheet: any, r: number, c: number) => { const cd = sheet.celldata.find((x: any) => x.r === r && x.c === c); return cd ? rawOf(cd) : null; };

// ── Orden multinivel ─────────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [
    cell(0, 0, 'A'), cell(0, 1, 'B'),
    cell(1, 0, 2), cell(1, 1, 'x'),
    cell(2, 0, 1), cell(2, 1, 'y'),
    cell(3, 0, 2), cell(3, 1, 'a'),
    cell(4, 0, 1), cell(4, 1, 'b'),
  ] };
  sortRangeMulti(sheet, { range: 'A1:B5', hasHeader: true, keys: [{ colRel: 0, order: 'asc' }, { colRel: 1, order: 'asc' }] });
  eq([at(sheet, 1, 0), at(sheet, 1, 1)], [1, 'b'], 'fila 1 = (1,b)');
  eq([at(sheet, 2, 0), at(sheet, 2, 1)], [1, 'y'], 'fila 2 = (1,y)');
  eq([at(sheet, 3, 0), at(sheet, 3, 1)], [2, 'a'], 'fila 3 = (2,a)');
  eq([at(sheet, 4, 0), at(sheet, 4, 1)], [2, 'x'], 'fila 4 = (2,x)');
}

// ── Subtotales ───────────────────────────────────────────────────────────────
{
  const sheet: any = { celldata: [
    cell(0, 0, 'Region'), cell(0, 1, 'Ventas'),
    cell(1, 0, 'Norte'), cell(1, 1, 100),
    cell(2, 0, 'Norte'), cell(2, 1, 200),
    cell(3, 0, 'Sur'), cell(3, 1, 150),
    cell(4, 0, 'Sur'), cell(4, 1, 300),
  ] };
  const inserted = applySubtotals(sheet, { range: 'A1:B5', hasHeader: true, groupColRel: 0, valueColRels: [1], fn: 'sum' });
  eq(inserted, 3, 'inserta 3 filas (2 subtotales + total)');
  eq(at(sheet, 3, 0), 'Norte — Total', 'subtotal Norte etiqueta');
  eq(at(sheet, 3, 1), 300, 'subtotal Norte = 300');
  eq(at(sheet, 6, 0), 'Sur — Total', 'subtotal Sur etiqueta');
  eq(at(sheet, 6, 1), 450, 'subtotal Sur = 450');
  eq(at(sheet, 7, 0), 'Total general', 'total general etiqueta');
  eq(at(sheet, 7, 1), 750, 'total general = 750');
}

// ── Sparklines ───────────────────────────────────────────────────────────────
eq(buildSparkline([1, 2, 3, 4, 5, 6, 7, 8]), '▁▂▃▄▅▆▇█', 'barras escalonadas');
eq(buildSparkline([5, 5, 5]), '▁▁▁', 'serie constante');
eq(buildSparkline([3, -2, 0], 'winloss'), '▲▼·', 'win/loss');
{
  const sheet: any = { celldata: [cell(0, 0, 1), cell(0, 1, 2), cell(0, 2, 3)] };
  applySparkline(sheet, 'A1:C1', 'E1', 'bars');
  eq(at(sheet, 0, 4), '▁▅█', 'sparkline escrito en E1');
}

console.log(`\nDATA SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de datos (orden/subtotales/spark) pasan.');
