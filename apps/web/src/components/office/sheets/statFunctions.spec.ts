/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de estadísticas modernas (nombre con punto) + correcciones, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/statFunctions.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string, tol = 1e-4) => { if (typeof a === 'number' && Math.abs(a - b) < tol) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// A1:A5 = 1..5 ; B1:B5 = 2,4,5,4,6
const grid: Record<string, any> = { '0_0': 1, '1_0': 2, '2_0': 3, '3_0': 4, '4_0': 5, '0_1': 2, '1_1': 4, '2_1': 5, '3_1': 4, '4_1': 6 };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── Desviación / varianza modernas ──────────────────────────────────────────────
approx(ev('=STDEV.S(A1:A5)'), 1.581139, 'STDEV.S (muestra)');
approx(ev('=STDEV.P(A1:A5)'), 1.414214, 'STDEV.P (población)');
approx(ev('=VAR.S(A1:A5)'), 2.5, 'VAR.S (muestra)');
approx(ev('=VAR.P(A1:A5)'), 2, 'VAR.P (población)');

// ── Posición / rango modernas ───────────────────────────────────────────────────
eq(ev('=MODE.SNGL({1,2,2,3,4})'), 2, 'MODE.SNGL');
eq(ev('=QUARTILE.INC(A1:A5,1)'), 2, 'QUARTILE.INC Q1');
eq(ev('=PERCENTILE.INC(A1:A5,0.5)'), 3, 'PERCENTILE.INC mediana');
eq(ev('=RANK.EQ(4,A1:A5)'), 2, 'RANK.EQ (4 es el 2º mayor)');
// Variantes exclusivas / promedio que el legado NO trae.
approx(ev('=QUARTILE.EXC({1,2,3,4},1)'), 1.25, 'QUARTILE.EXC Q1 exclusivo');
approx(ev('=PERCENTILE.EXC({1,2,3,4},0.5)'), 2.5, 'PERCENTILE.EXC mediana exclusiva');
eq(ev('=QUARTILE.EXC({1,2,3,4},0)'), '#NUM!', 'QUARTILE.EXC Q0 → #NUM!');
approx(ev('=RANK.AVG(3,{1,2,3,3,5})'), 2.5, 'RANK.AVG con empate = 2.5');

// ── Distribución normal (corrección del bug NORMSDIST + familia) ─────────────────
approx(ev('=NORMSDIST(0)'), 0.5, 'NORMSDIST(0) = 0.5 (CDF, no PDF)');
approx(ev('=NORMSDIST(1.959964)'), 0.975, 'NORMSDIST(1.96) ≈ 0.975');
approx(ev('=NORM.S.DIST(0,TRUE)'), 0.5, 'NORM.S.DIST acumulada en 0');
approx(ev('=NORM.S.DIST(0,FALSE)'), 0.398942, 'NORM.S.DIST densidad en 0');
approx(ev('=NORM.DIST(0,0,1,TRUE)'), 0.5, 'NORM.DIST acumulada estándar');
approx(ev('=NORM.DIST(1,0,1,FALSE)'), 0.241971, 'NORM.DIST densidad en 1');
approx(ev('=NORM.S.INV(0.975)'), 1.959964, 'NORM.S.INV(0.975) ≈ 1.96');
approx(ev('=NORM.INV(0.5,10,2)'), 10, 'NORM.INV mediana = media');

// ── Otras distribuciones modernas (delegación verificada) ────────────────────────
approx(ev('=BINOM.DIST(2,10,0.5,FALSE)'), 0.043945, 'BINOM.DIST puntual');
approx(ev('=POISSON.DIST(2,3,FALSE)'), 0.224042, 'POISSON.DIST puntual');
approx(ev('=FORECAST.LINEAR(6,B1:B5,A1:A5)'), 6.6, 'FORECAST.LINEAR');
approx(ev('=CONFIDENCE.NORM(0.05,1,100)'), 0.196, 'CONFIDENCE.NORM');

// ── Compone con otras (no rompe los nombres legados) ─────────────────────────────
approx(ev('=STDEV(A1:A5)'), 1.581139, 'el nombre legado STDEV sigue intacto');
eq(ev('=ROUND(NORM.S.DIST(1.96,TRUE)*1000,0)'), 975, 'NORM.S.DIST compone con ROUND');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ statFunctions: ${passed}/${total} aserciones verdes.`);
