/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de validación de datos (lista, número, longitud, texto, fecha). npx tsx … */
import { buildDataVerification, applyDataVerification, clearDataVerification, dvSatisfies, markInvalidCells, type DvConfig } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const cell = (r: number, c: number, v: any) => ({ r, c, v: { v, m: String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } } });
const at = (sheet: any, r: number, c: number) => sheet.celldata.find((x: any) => x.r === r && x.c === c)?.v;

// ── buildDataVerification: forma de la entrada ───────────────────────────────
{
  const e = buildDataVerification({ type: 'dropdown', value1: 'Sí, No , Pendiente, ' });
  eq(e.type, 'dropdown', 'lista → type dropdown');
  eq(e.value1, 'Sí,No,Pendiente', 'lista normaliza espacios y vacíos');
  eq(e.type2, null, 'lista no usa type2');

  const num = buildDataVerification({ type: 'number', operator: 'between', value1: '1', value2: '10', hintText: 'Entre 1 y 10' });
  eq(num.type2, 'between', 'número entre → type2 between');
  eq(num.value2, '10', 'between conserva value2');
  eq(num.hintShow, true, 'con hint → hintShow true');
  eq(num.hintText, 'Entre 1 y 10', 'hint text');

  const gt = buildDataVerification({ type: 'number', operator: 'moreThanThe', value1: '5' });
  eq(gt.value2, '', 'operador de un valor deja value2 vacío');
  eq(gt.hintShow, false, 'sin hint → hintShow false');
  eq(gt.prohibitInput, false, 'prohibitInput por defecto false');
  eq(buildDataVerification({ type: 'number', operator: 'gt' as any, value1: '5', prohibitInput: true }).prohibitInput, true, 'prohibitInput respetado');
}

// ── dvSatisfies: número / entero / decimal ───────────────────────────────────
{
  const c: DvConfig = { type: 'number', operator: 'between', value1: '1', value2: '10' };
  ok(dvSatisfies(c, 5), '5 ∈ [1,10]');
  ok(!dvSatisfies(c, 11), '11 ∉ [1,10]');
  ok(dvSatisfies(c, ''), 'vacío = válido');
  ok(!dvSatisfies(c, 'abc'), 'texto no numérico inválido');
  ok(dvSatisfies({ type: 'number_integer', operator: 'moreThanThe', value1: '0' }, 4), 'entero 4 > 0');
  ok(!dvSatisfies({ type: 'number_integer', operator: 'moreThanThe', value1: '0' }, 4.5), '4.5 no es entero');
  ok(!dvSatisfies({ type: 'number_decimal', operator: 'greaterOrEqualTo', value1: '0' }, 4), '4 no es decimal');
  ok(dvSatisfies({ type: 'number_decimal', operator: 'greaterOrEqualTo', value1: '0' }, 4.5), '4.5 es decimal ≥ 0');
  ok(dvSatisfies({ type: 'number', operator: 'notBetween', value1: '1', value2: '10' }, 20), '20 ∉ [1,10] (notBetween)');
  ok(dvSatisfies({ type: 'number', operator: 'lessThanOrEqualTo', value1: '10' }, 10), '10 ≤ 10');
}

// ── dvSatisfies: lista / texto / longitud ────────────────────────────────────
{
  const list: DvConfig = { type: 'dropdown', value1: 'Sí, No, Pendiente' };
  ok(dvSatisfies(list, 'Sí'), 'Sí ∈ lista');
  ok(!dvSatisfies(list, 'Quizá'), 'Quizá ∉ lista');
  ok(dvSatisfies({ type: 'text_content', operator: 'include', value1: 'AX' }, 'AXOS'), 'AXOS contiene AX');
  ok(!dvSatisfies({ type: 'text_content', operator: 'exclude', value1: 'X' }, 'AXOS'), 'AXOS no debe contener X');
  ok(dvSatisfies({ type: 'text_length', operator: 'lessThanOrEqualTo', value1: '5' }, 'hola'), 'longitud 4 ≤ 5');
  ok(!dvSatisfies({ type: 'text_length', operator: 'lessThanOrEqualTo', value1: '3' }, 'hola'), 'longitud 4 > 3');
}

// ── dvSatisfies: fecha ───────────────────────────────────────────────────────
{
  const c: DvConfig = { type: 'date', operator: 'between', value1: '2024-01-01', value2: '2024-12-31' };
  ok(dvSatisfies(c, '2024-06-15'), 'fecha dentro del rango');
  ok(!dvSatisfies(c, '2025-01-01'), 'fecha fuera del rango');
  ok(!dvSatisfies(c, 'no-fecha'), 'texto no fecha inválido');
  ok(dvSatisfies({ type: 'date', operator: 'laterThan', value1: '2024-01-01' }, '2024-02-01'), 'fecha posterior');
  ok(!dvSatisfies({ type: 'date', operator: 'earlierThan', value1: '2024-01-01' }, '2024-02-01'), 'no anterior');
}

// ── applyDataVerification / clear sobre la hoja ──────────────────────────────
{
  const sheet: any = { celldata: [] };
  const n = applyDataVerification(sheet, 'A1:A3', { type: 'dropdown', value1: 'a,b,c' });
  eq(n, 3, '3 celdas validadas');
  eq(sheet.dataVerification['0_0'].type, 'dropdown', 'entrada en 0_0');
  eq(sheet.dataVerification['2_0'].value1, 'a,b,c', 'entrada en 2_0');
  const cl = clearDataVerification(sheet, 'A1:A2');
  eq(cl, 2, '2 validaciones quitadas');
  ok(sheet.dataVerification['0_0'] == null, '0_0 quitada');
  ok(sheet.dataVerification['2_0'] != null, '2_0 conservada');
}

// ── markInvalidCells: rodear datos no válidos ────────────────────────────────
{
  const sheet: any = { celldata: [cell(0, 0, 5), cell(1, 0, 50), cell(2, 0, 'x'), cell(3, 0, '')] };
  const n = markInvalidCells(sheet, 'A1:A4', { type: 'number', operator: 'between', value1: '1', value2: '10' });
  eq(n, 2, '50 y "x" no válidos (vacío no cuenta)');
  ok(at(sheet, 0, 0).bg == null, '5 válido, sin marca');
  eq(at(sheet, 1, 0).bg, '#fde2e1', '50 marcado en rojo');
  eq(at(sheet, 2, 0).bg, '#fde2e1', '"x" marcado en rojo');
}

console.log(`\nVALIDATION SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de validación de datos pasan.');
