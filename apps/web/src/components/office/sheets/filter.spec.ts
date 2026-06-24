/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec del autofiltro. npx tsx src/components/office/sheets/filter.spec.ts */
import { buildFilter, matchesCriterion, rawOf } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });
const sheet: any = { celldata: [
  cell(0, 0, 'Region'), cell(0, 1, 'Ventas'),
  cell(1, 0, 'Norte'), cell(1, 1, 100),
  cell(2, 0, 'Sur'), cell(2, 1, 200),
  cell(3, 0, 'Norte'), cell(3, 1, 50),
  cell(4, 0, 'Sur'), cell(4, 1, 300),
] };
const valAt = (cd: any[], r: number, c: number) => { const x = cd.find((y: any) => y.r === r && y.c === c); return x ? rawOf(x) : null; };

// matchesCriterion
eq(matchesCriterion(100, '>', '50'), true, '100 > 50');
eq(matchesCriterion(5, '=', '5'), true, '5 = 5 numérico');
eq(matchesCriterion('abc', 'contains', 'B'), true, 'contiene (case-insensitive)');
eq(matchesCriterion('', 'empty', ''), true, 'vacío');
eq(matchesCriterion('x', 'notempty', ''), true, 'no vacío');
eq(matchesCriterion('Sur', '!=', 'Norte'), true, 'Sur != Norte');

// Filtro por igualdad de texto.
{
  const res = buildFilter(sheet, { range: 'A1:B5', hasHeader: true, criteria: [{ colRel: 0, op: '=', value: 'Norte' }] })!;
  eq(res.matched, 2, 'Region=Norte → 2 filas');
  eq(valAt(res.celldata, 0, 0), 'Region', 'cabecera conservada');
  eq([valAt(res.celldata, 1, 0), valAt(res.celldata, 1, 1)], ['Norte', 100], 'fila 1 = Norte/100');
  eq([valAt(res.celldata, 2, 0), valAt(res.celldata, 2, 1)], ['Norte', 50], 'fila 2 = Norte/50');
}

// Filtro numérico.
{
  const res = buildFilter(sheet, { range: 'A1:B5', hasHeader: true, criteria: [{ colRel: 1, op: '>=', value: '200' }] })!;
  eq(res.matched, 2, 'Ventas>=200 → 2 filas');
}

// AND de criterios.
{
  const res = buildFilter(sheet, { range: 'A1:B5', hasHeader: true, criteria: [{ colRel: 0, op: '=', value: 'Sur' }, { colRel: 1, op: '>', value: '200' }] })!;
  eq(res.matched, 1, 'Sur AND Ventas>200 → 1 fila');
  eq(valAt(res.celldata, 1, 1), 300, 'la fila es Sur/300');
}

// OR de criterios (autofiltro personalizado de Excel: Y/O).
{
  const res = buildFilter(sheet, { range: 'A1:B5', hasHeader: true, conjunction: 'OR', criteria: [{ colRel: 1, op: '<', value: '60' }, { colRel: 1, op: '>', value: '250' }] })!;
  eq(res.matched, 2, 'Ventas<60 OR Ventas>250 → 2 filas (50 y 300)');
}

// Comodines de Excel en `=` / `!=` (`*` secuencia, `?` un carácter, `~` escapa).
eq(matchesCriterion('Norte', '=', 'N*'), true, 'comodín N* casa Norte');
eq(matchesCriterion('Sur', '=', 'N*'), false, 'comodín N* no casa Sur');
eq(matchesCriterion('Norte', '=', '?orte'), true, 'comodín ?orte casa Norte');
eq(matchesCriterion('Norte', '=', '?orto'), false, 'comodín ?orto no casa Norte');
eq(matchesCriterion('Norte', '!=', 'S*'), true, '!= S* es verdadero para Norte');
eq(matchesCriterion('a*b', '=', 'a~*b'), true, '~* casa un asterisco literal');
eq(matchesCriterion('axb', '=', 'a~*b'), false, '~* no casa cualquier carácter');
eq(matchesCriterion('Norte', '=', 'Norte'), true, 'sin comodín → comparación exacta intacta');

// beginsWith / endsWith (insensible a mayúsculas).
eq(matchesCriterion('Norte', 'beginsWith', 'nor'), true, 'beginsWith insensible');
eq(matchesCriterion('Norte', 'beginsWith', 'sur'), false, 'beginsWith negativo');
eq(matchesCriterion('Norte', 'endsWith', 'TE'), true, 'endsWith insensible');
eq(matchesCriterion('Norte', 'endsWith', 'no'), false, 'endsWith negativo');

// Comodín dentro de buildFilter.
{
  const res = buildFilter(sheet, { range: 'A1:B5', hasHeader: true, criteria: [{ colRel: 0, op: '=', value: 'N*' }] })!;
  eq(res.matched, 2, 'Region = N* → 2 filas (Norte)');
}

console.log(`\nFILTER SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de autofiltro pasan.');
