/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de «Buscar objetivo» (Goal Seek) — PURA sobre el objeto de hoja:
 *   cd apps/web && npx tsx src/components/office/sheets/goalSeek.spec.ts
 *
 * Construye hojas con una fórmula que depende de una variable y comprueba que el solucionador
 * encuentra el valor de la variable que alcanza el objetivo (lineales y no lineales).
 */
import { goalSeek } from './goalSeek';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const near = (a: any, b: number, m: string, eps = 1e-3) => { if (typeof a === 'number' && Math.abs(a - b) < eps) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

// Hoja con A1 = valor (variable) y B1 = fórmula.
function sheet(aVal: number, formula: string): any {
  return { celldata: [
    { r: 0, c: 0, v: { v: aVal, m: String(aVal) } },           // A1 (variable)
    { r: 0, c: 1, v: { f: formula, v: 0, m: '0' } },           // B1 (fórmula)
  ] };
}
function aVal(s: any): number { const cd = s.celldata.find((x: any) => x.r === 0 && x.c === 0); return cd.v.v; }

// ── Lineal: B1 = A1*2+5, objetivo 50 → A1 = 22.5 ──────────────────────────────
{
  const s = sheet(10, '=A1*2+5');
  const r = goalSeek(s, 'B1', 50, 'A1');
  ok(r.ok, 'lineal: converge');
  near(r.value, 22.5, 'lineal: A1 = 22.5');
  near(aVal(s), 22.5, 'lineal: fija la variable en la hoja');
  near(r.result, 50, 'lineal: la fórmula alcanza 50');
}

// ── Cuadrática: B1 = A1*A1, objetivo 16 → A1 = ±4 ─────────────────────────────
{
  const s = sheet(3, '=A1*A1');
  const r = goalSeek(s, 'B1', 16, 'A1');
  ok(r.ok, 'cuadrática: converge');
  near(Math.abs(r.value as number), 4, 'cuadrática: |A1| = 4');
}

// ── Financiera-ish: B1 = A1*(1+0.1)^3 (interés compuesto), objetivo 1331 → A1=1000 ─
{
  const s = sheet(500, '=A1*POWER(1.1,3)');
  const r = goalSeek(s, 'B1', 1331, 'A1');
  ok(r.ok, 'compuesto: converge');
  near(r.value, 1000, 'compuesto: A1 = 1000', 1e-2);
}

// ── Con otras celdas de valor: B1 = A1*C1 (C1=4 valor), objetivo 100 → A1=25 ──
{
  const s: any = { celldata: [
    { r: 0, c: 0, v: { v: 1, m: '1' } },     // A1 variable
    { r: 0, c: 2, v: { v: 4, m: '4' } },     // C1 valor
    { r: 0, c: 1, v: { f: '=A1*C1', v: 0, m: '0' } }, // B1
  ] };
  const r = goalSeek(s, 'B1', 100, 'A1');
  ok(r.ok, 'con celda de valor: converge');
  near(r.value, 25, 'con celda de valor: A1 = 25');
}

// ── Ya en el objetivo → 0 iteraciones ────────────────────────────────────────
{
  const s = sheet(10, '=A1+5');
  const r = goalSeek(s, 'B1', 15, 'A1');
  ok(r.ok && r.iterations === 0, 'ya en el objetivo: 0 iteraciones');
}

// ── Errores claros ───────────────────────────────────────────────────────────
{
  ok(!goalSeek(sheet(1, '=A1'), 'B1', 5, 'ZZ').ok, 'referencia inválida → error');
  const noF: any = { celldata: [{ r: 0, c: 1, v: { v: 3, m: '3' } }] };
  ok(!goalSeek(noF, 'B1', 5, 'A1').ok, 'celda objetivo sin fórmula → error');
}

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ goalSeek: ${passed}/${total} aserciones verdes.`);
