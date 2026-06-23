/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de «derramar matriz» (spill) — PURA sobre el objeto de hoja:
 *   cd apps/web && npx tsx src/components/office/sheets/arraySpill.spec.ts
 *
 * Verifica que `applySpill` evalúa la fórmula de la celda ancla sobre la hoja y escribe el
 * bloque de valores resultante (con detección de #SPILL!), usando las funciones de matriz reales.
 */
import { applySpill, evalOverSheet } from './arraySpill';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// Construye una hoja con A1:A5 = 30,10,20,10,30 y la fórmula `formula` en `anchor`.
function makeSheet(anchor: { r: number; c: number }, formula: string): any {
  const celldata: any[] = [
    { r: 0, c: 0, v: { v: 30, m: '30' } }, { r: 1, c: 0, v: { v: 10, m: '10' } },
    { r: 2, c: 0, v: { v: 20, m: '20' } }, { r: 3, c: 0, v: { v: 10, m: '10' } },
    { r: 4, c: 0, v: { v: 30, m: '30' } },
    { r: anchor.r, c: anchor.c, v: { f: formula, v: 0, m: '0' } },
  ];
  return { celldata };
}
// Lee el valor calculado de una celda por r_c.
function valAt(sheet: any, r: number, c: number): any {
  const cd = (sheet.celldata as any[]).find((x) => x.r === r && x.c === c);
  if (!cd) return undefined;
  return cd.v && typeof cd.v === 'object' ? cd.v.v : cd.v;
}

// ── evalOverSheet lee valores calculados ─────────────────────────────────────
{
  const s = makeSheet({ r: 0, c: 2 }, '=SORT(A1:A5)');
  eq(evalOverSheet(s, '=SUM(A1:A5)').result, 100, 'evalOverSheet: SUM(A1:A5)=100');
  eq(evalOverSheet(s, '=SORT(A1:A5)').result, [[10], [10], [20], [30], [30]], 'evalOverSheet: SORT 2D');
}

// ── SORT derrama una columna (C1:C5) ─────────────────────────────────────────
{
  const s = makeSheet({ r: 0, c: 2 }, '=SORT(A1:A5)');
  const res = applySpill(s, 'C1');
  ok(res.ok && res.rows === 5 && res.cols === 1, 'SORT derrama 5×1');
  eq([0, 1, 2, 3, 4].map((r) => valAt(s, r, 2)), [10, 10, 20, 30, 30], 'C1:C5 = SORT ascendente');
  // El ancla conserva la fórmula.
  const anchor = s.celldata.find((x: any) => x.r === 0 && x.c === 2);
  ok(anchor.v.f === '=SORT(A1:A5)', 'el ancla conserva la fórmula');
}

// ── UNIQUE derrama 3 valores ─────────────────────────────────────────────────
{
  const s = makeSheet({ r: 0, c: 2 }, '=UNIQUE(A1:A5)');
  const res = applySpill(s, 'C1');
  ok(res.ok && res.rows === 3, 'UNIQUE derrama 3 filas');
  eq([0, 1, 2].map((r) => valAt(s, r, 2)), [30, 10, 20], 'C1:C3 = distintos en orden');
}

// ── SEQUENCE 2×3 derrama un bloque ───────────────────────────────────────────
{
  const s = makeSheet({ r: 0, c: 2 }, '=SEQUENCE(2,3)');
  const res = applySpill(s, 'C1');
  ok(res.ok && res.rows === 2 && res.cols === 3, 'SEQUENCE derrama 2×3');
  eq([valAt(s, 0, 2), valAt(s, 0, 3), valAt(s, 0, 4)], [1, 2, 3], 'fila 1 del bloque');
  eq([valAt(s, 1, 2), valAt(s, 1, 3), valAt(s, 1, 4)], [4, 5, 6], 'fila 2 del bloque');
}

// ── #SPILL! cuando el destino está ocupado ───────────────────────────────────
{
  const s = makeSheet({ r: 0, c: 2 }, '=SORT(A1:A5)');
  s.celldata.push({ r: 2, c: 2, v: { v: 'ocupado', m: 'ocupado' } }); // C3 ocupada
  const res = applySpill(s, 'C1');
  ok(!res.ok && /SPILL/.test(res.error || ''), 'detecta #SPILL! con destino ocupado');
  eq(valAt(s, 2, 2), 'ocupado', 'no sobrescribe la celda ocupada');
}

// ── Re-derramar limpia el derrame anterior (más corto) ───────────────────────
{
  const s = makeSheet({ r: 0, c: 2 }, '=SORT(A1:A5)');
  applySpill(s, 'C1'); // 5 celdas
  // Cambia la fórmula a una más corta y vuelve a derramar.
  const anchor = s.celldata.find((x: any) => x.r === 0 && x.c === 2);
  anchor.v.f = '=UNIQUE(A1:A5)'; // 3 celdas
  applySpill(s, 'C1');
  ok(valAt(s, 3, 2) === undefined && valAt(s, 4, 2) === undefined, 're-derramar limpia las celdas sobrantes (C4,C5)');
  eq([0, 1, 2].map((r) => valAt(s, r, 2)), [30, 10, 20], 'el nuevo derrame es correcto');
}

// ── Sin fórmula → error claro ────────────────────────────────────────────────
{
  const s = makeSheet({ r: 0, c: 2 }, '=SORT(A1:A5)');
  const res = applySpill(s, 'B1'); // B1 vacía
  ok(!res.ok && /fórmula/.test(res.error || ''), 'celda sin fórmula → error');
}

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ arraySpill: ${passed}/${total} aserciones verdes.`);
