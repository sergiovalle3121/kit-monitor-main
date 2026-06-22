/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de «Tabla de datos» (Data Table) — PURA:
 *   cd apps/web && npx tsx src/components/office/sheets/dataTable.spec.ts
 */
import { dataTable1, dataTable2 } from './dataTable';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

function sheet(cells: { r: number; c: number; v: any; f?: string }[]): any {
  return { celldata: cells.map((x) => ({ r: x.r, c: x.c, v: x.f ? { f: x.f, v: 0, m: '0' } : { v: x.v, m: String(x.v) } })) };
}

// ── Una variable: B1 = A1*A1, entrada A1 ─────────────────────────────────────
{
  const s = sheet([{ r: 0, c: 0, v: 0 }, { r: 0, c: 1, v: 0, f: '=A1*A1' }]);
  const res = dataTable1(s, 'B1', 'A1', [1, 2, 3, 4, 5]);
  ok(res.ok, 'una variable: ok');
  eq(res.results, [1, 4, 9, 16, 25], 'una variable: cuadrados');
}

// ── Una variable financiera: pago = PMT(A1/12, 60, -20000) variando la tasa ──
{
  const s = sheet([{ r: 0, c: 0, v: 0.1 }, { r: 0, c: 1, v: 0, f: '=A1*100' }]);
  const res = dataTable1(s, 'B1', 'A1', [0.05, 0.1, 0.15]);
  eq(res.results, [5, 10, 15], 'una variable: porcentajes');
}

// ── Dos variables: B1 = A1 + C1, fila A1, columna C1 ─────────────────────────
{
  const s = sheet([{ r: 0, c: 0, v: 0 }, { r: 0, c: 2, v: 0 }, { r: 0, c: 1, v: 0, f: '=A1+C1' }]);
  const res = dataTable2(s, 'B1', 'A1', 'C1', [1, 2], [10, 20, 30]);
  ok(res.ok, 'dos variables: ok');
  eq(res.matrix, [[11, 21, 31], [12, 22, 32]], 'dos variables: suma fila+columna');
}

// ── Dos variables multiplicativo: B1 = A1 * C1 ───────────────────────────────
{
  const s = sheet([{ r: 0, c: 0, v: 1 }, { r: 0, c: 2, v: 1 }, { r: 0, c: 1, v: 0, f: '=A1*C1' }]);
  const res = dataTable2(s, 'B1', 'A1', 'C1', [2, 3, 4], [5, 10]);
  eq(res.matrix, [[10, 20], [15, 30], [20, 40]], 'dos variables: tabla de multiplicar');
}

// ── No muta la hoja original ─────────────────────────────────────────────────
{
  const s = sheet([{ r: 0, c: 0, v: 7 }, { r: 0, c: 1, v: 0, f: '=A1*2' }]);
  dataTable1(s, 'B1', 'A1', [1, 2, 3]);
  const a1 = s.celldata.find((x: any) => x.r === 0 && x.c === 0);
  eq(a1.v.v, 7, 'no muta el valor original de la celda de entrada');
}

// ── Errores ──────────────────────────────────────────────────────────────────
{
  ok(!dataTable1(sheet([{ r: 0, c: 1, v: 3 }]), 'B1', 'A1', [1]).ok, 'sin fórmula → error');
  ok(!dataTable1(sheet([{ r: 0, c: 1, v: 0, f: '=A1' }]), 'B1', 'ZZ', [1]).ok, 'referencia inválida → error');
}

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ dataTable: ${passed}/${total} aserciones verdes.`);
