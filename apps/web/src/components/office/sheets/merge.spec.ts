/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de combinar/separar celdas. npx tsx src/components/office/sheets/merge.spec.ts */
import { mergeCells, unmergeCells } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// Combinar A1:C1 (una fila, tres columnas).
{
  const sheet: any = { config: {}, celldata: [] };
  ok(mergeCells(sheet, 'A1:C1') === true, 'mergeCells devuelve true');
  eq(sheet.config.merge['0_0'], { r: 0, c: 0, rs: 1, cs: 3 }, 'config.merge ancla 0_0 rs1 cs3');
  eq(Object.keys(sheet.config.merge).length, 1, 'una sola combinación');
}

// Combinar bloque B2:C3 (ancla 1_1, 2×2).
{
  const sheet: any = { config: {} };
  mergeCells(sheet, 'B2:C3');
  eq(sheet.config.merge['1_1'], { r: 1, c: 1, rs: 2, cs: 2 }, 'bloque 2×2 ancla 1_1');
}

// Una sola celda: nada que combinar.
{
  const sheet: any = { config: {} };
  ok(mergeCells(sheet, 'A1') === false, 'A1 sola → false');
  eq(sheet.config.merge, undefined, 'no se crea merge para una celda');
}

// Combinar sobre una combinación previa que se solapa → reemplaza (sin solapes).
{
  const sheet: any = { config: { merge: { '0_0': { r: 0, c: 0, rs: 1, cs: 2 } } } };
  mergeCells(sheet, 'A1:C1'); // solapa con A1:B1
  eq(Object.keys(sheet.config.merge), ['0_0'], 'la previa solapada se retira, queda la nueva');
  eq(sheet.config.merge['0_0'], { r: 0, c: 0, rs: 1, cs: 3 }, 'nueva combinación reemplaza');
}

// Separar: quita las combinaciones que intersectan el rango.
{
  const sheet: any = { config: { merge: { '0_0': { r: 0, c: 0, rs: 1, cs: 3 }, '4_4': { r: 4, c: 4, rs: 2, cs: 2 } } } };
  eq(unmergeCells(sheet, 'A1:C1'), 1, 'separar A1:C1 → 1 combinación');
  eq(Object.keys(sheet.config.merge), ['4_4'], 'la otra combinación intacta');
}

// Separar un rango amplio quita varias.
{
  const sheet: any = { config: { merge: { '0_0': { r: 0, c: 0, rs: 1, cs: 2 }, '2_0': { r: 2, c: 0, rs: 1, cs: 2 } } } };
  eq(unmergeCells(sheet, 'A1:B3'), 2, 'separar A1:B3 → 2 combinaciones');
  eq(Object.keys(sheet.config.merge).length, 0, 'no quedan combinaciones');
}

// Separar sin combinaciones → 0.
{
  const sheet: any = { config: {} };
  eq(unmergeCells(sheet, 'A1:C1'), 0, 'sin merge → 0');
}

// Roundtrip combinar → separar deja config.merge vacío.
{
  const sheet: any = { config: {} };
  mergeCells(sheet, 'A1:B2');
  eq(unmergeCells(sheet, 'A1:B2'), 1, 'roundtrip: separa la que se combinó');
  eq(Object.keys(sheet.config.merge).length, 0, 'roundtrip: queda vacío');
}

console.log(`\nMERGE SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de combinar/separar pasan.');
