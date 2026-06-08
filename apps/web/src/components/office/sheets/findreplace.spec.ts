/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de buscar/reemplazar pro. npx tsx src/components/office/sheets/findreplace.spec.ts */
import { findMatches, replaceAll, rawOf } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });
const mk = () => [
  { name: 'H1', celldata: [cell(0, 0, 'Hola'), cell(1, 0, 'hola mundo'), cell(0, 1, 'HOLA'), cell(0, 2, 42)] },
  { name: 'H2', celldata: [cell(0, 0, 'hola')] },
];

eq(findMatches(mk(), 'hola', { caseSensitive: false }).length, 4, 'sin distinguir mayúsc → 4 (ignora número)');
eq(findMatches(mk(), 'hola', { caseSensitive: true }).length, 2, 'distinguir mayúsc → 2');
eq(findMatches(mk(), 'hola', { wholeCell: true }).length, 3, 'celda completa → 3 (excluye "hola mundo")');
eq(findMatches(mk(), 'hola', { sheetIndex: 0 }).length, 3, 'alcance hoja 0 → 3');
eq(findMatches(mk(), 'mu.do', { regex: true }).length, 1, 'regex mu.do → 1');
eq(findMatches(mk(), '(', { regex: true }).length, 0, 'regex inválida → 0 (sin lanzar)');

// Reemplazo: 'o' → '0' distinguiendo mayúsculas.
{
  const sheets = mk();
  const n = replaceAll(sheets, 'o', '0', { caseSensitive: true });
  eq(n, 4, 'reemplazos: Hola(1)+hola mundo(2)+HOLA(0)+hola(1) = 4');
  eq(rawOf(sheets[0].celldata[0]), 'H0la', 'A1 → H0la');
  eq(rawOf(sheets[0].celldata[2]), 'HOLA', 'HOLA intacto (mayúscula)');
}

// Reemplazo con regex y celda completa.
{
  const sheets = mk();
  const n = replaceAll(sheets, 'hola', 'X', { wholeCell: true, caseSensitive: false });
  eq(n, 3, 'reemplaza solo celdas == hola (3)');
  eq(rawOf(sheets[0].celldata[1]), 'hola mundo', '"hola mundo" intacto');
}

console.log(`\nFINDREPLACE SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de buscar/reemplazar pasan.');
