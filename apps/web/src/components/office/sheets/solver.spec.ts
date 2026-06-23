/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría del Solver (Nelder–Mead) — PURA:
 *   cd apps/web && npx tsx src/components/office/sheets/solver.spec.ts
 */
import { solve, type SolverVar } from './solver';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const near = (a: any, b: number, m: string, eps = 1e-2) => { if (typeof a === 'number' && Math.abs(a - b) < eps) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

// Hoja: pone valores en celdas variables y una fórmula objetivo.
function makeSheet(cells: { ref: string; v?: number; f?: string }[]): any {
  const colToNum = (s: string) => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const parse = (ref: string) => { const m = /^([A-Z]+)(\d+)$/.exec(ref)!; return { r: +m[2] - 1, c: colToNum(m[1]) }; };
  return { celldata: cells.map((x) => { const p = parse(x.ref); return { r: p.r, c: p.c, v: x.f ? { f: x.f, v: 0, m: '0' } : { v: x.v, m: String(x.v) } }; }) };
}
const valAt = (s: any, ref: string) => { const colToNum = (t: string) => { let n = 0; for (const ch of t) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }; const m = /^([A-Z]+)(\d+)$/.exec(ref)!; const r = +m[2] - 1, c = colToNum(m[1]); const cd = s.celldata.find((x: any) => x.r === r && x.c === c); return cd?.v?.v ?? cd?.v; };

// ── Min de paraboloide: B1 = (A1-3)^2 + (C1-5)^2 → mínimo en A1=3, C1=5 (obj 0) ──
{
  const s = makeSheet([{ ref: 'A1', v: 0 }, { ref: 'C1', v: 0 }, { ref: 'B1', f: '=POWER(A1-3,2)+POWER(C1-5,2)' }]);
  const r = solve(s, 'B1', 'min', 0, [{ cell: 'A1' }, { cell: 'C1' }]);
  ok(r.ok, 'min paraboloide: converge');
  near(valAt(s, 'A1'), 3, 'min: A1 ≈ 3');
  near(valAt(s, 'C1'), 5, 'min: C1 ≈ 5');
  near(r.objective, 0, 'min: objetivo ≈ 0');
}

// ── Max de parábola invertida: B1 = 10 - (A1-2)^2 → máximo en A1=2 (obj 10) ──
{
  const s = makeSheet([{ ref: 'A1', v: 0 }, { ref: 'B1', f: '=10-POWER(A1-2,2)' }]);
  const r = solve(s, 'B1', 'max', 0, [{ cell: 'A1' }]);
  ok(r.ok, 'max: converge');
  near(valAt(s, 'A1'), 2, 'max: A1 ≈ 2');
  near(r.objective, 10, 'max: objetivo ≈ 10');
}

// ── Valor objetivo multivariable: B1 = A1+C1 = 100 con A1=C1 «equilibrado» desde 0,0 → suma 100 ──
{
  const s = makeSheet([{ ref: 'A1', v: 0 }, { ref: 'C1', v: 0 }, { ref: 'B1', f: '=A1+C1' }]);
  const r = solve(s, 'B1', 'value', 100, [{ cell: 'A1' }, { cell: 'C1' }]);
  ok(r.ok, 'valor: converge');
  near((valAt(s, 'A1') as number) + (valAt(s, 'C1') as number), 100, 'valor: A1+C1 ≈ 100');
}

// ── Con límites: minimizar (A1-3)^2 pero A1 ∈ [5,10] → A1=5 (recorte), obj=4 ──
{
  const s = makeSheet([{ ref: 'A1', v: 8 }, { ref: 'B1', f: '=POWER(A1-3,2)' }]);
  const vars: SolverVar[] = [{ cell: 'A1', min: 5, max: 10 }];
  const r = solve(s, 'B1', 'min', 0, vars);
  ok(r.ok, 'límites: converge');
  near(valAt(s, 'A1'), 5, 'límites: A1 recortado a 5');
  near(r.objective, 4, 'límites: objetivo = (5-3)^2 = 4');
}

// ── Errores ──────────────────────────────────────────────────────────────────
{
  ok(!solve(makeSheet([{ ref: 'B1', v: 3 }]), 'B1', 'min', 0, [{ cell: 'A1' }]).ok, 'objetivo sin fórmula → error');
  ok(!solve(makeSheet([{ ref: 'B1', f: '=A1' }]), 'B1', 'min', 0, []).ok, 'sin variables → error');
}

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ solver: ${passed}/${total} aserciones verdes.`);
