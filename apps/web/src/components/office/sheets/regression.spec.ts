/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de la familia de regresión (TREND/GROWTH/SLOPE/INTERCEPT/FORECAST), vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/regression.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string, tol = 1e-4) => { if (typeof a === 'number' && Math.abs(a - b) < tol) passed++; else fails.push(`${m} — esp ${b}, obt ${JSON.stringify(a)}`); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// A1:A5 (y) = 2,4,5,4,5 ; B1:B5 (x) = 1,2,3,4,5  → recta y = 0.6x + 2.2
const grid: Record<string, any> = { '0_0': 2, '1_0': 4, '2_0': 5, '3_0': 4, '4_0': 5, '0_1': 1, '1_1': 2, '2_1': 3, '3_1': 4, '4_1': 5 };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── SLOPE / INTERCEPT / FORECAST ─────────────────────────────────────────────────
approx(ev('=SLOPE(A1:A5,B1:B5)'), 0.6, 'SLOPE = 0.6');
approx(ev('=INTERCEPT(A1:A5,B1:B5)'), 2.2, 'INTERCEPT = 2.2');
approx(ev('=INTERCEPT({2,4,6},{1,2,3})'), 0, 'INTERCEPT con constante de matriz fila (antes #VALUE!)');
approx(ev('=FORECAST(6,A1:A5,B1:B5)'), 5.8, 'FORECAST(6) = 5.8');
approx(ev('=FORECAST.LINEAR(6,A1:A5,B1:B5)'), 5.8, 'FORECAST.LINEAR = FORECAST');

// ── TREND (matriz, compone con INDEX/SUM) ────────────────────────────────────────
approx(ev('=INDEX(TREND(A1:A5,B1:B5,{6,7}),1,1)'), 5.8, 'TREND new_x=6 → 5.8');
approx(ev('=INDEX(TREND(A1:A5,B1:B5,{6,7}),1,2)'), 6.4, 'TREND new_x=7 → 6.4');
approx(ev('=SUM(TREND(A1:A5,B1:B5,{6,7}))'), 12.2, 'TREND suma = 12.2');
approx(ev('=INDEX(TREND(A1:A5),1,1)'), 2.8, 'TREND sin x ni new_x (x = 1,2,…) → 2.8');
// const=FALSE: recta por el origen, y={1,2,3} x={1,2,3} → m=1, b=0 → TREND(10)=10.
approx(ev('=INDEX(TREND({1,2,3},{1,2,3},{10},FALSE),1,1)'), 10, 'TREND por el origen');

// ── GROWTH (exponencial) ─────────────────────────────────────────────────────────
approx(ev('=INDEX(GROWTH({1,2,4,8},{1,2,3,4},{5}),1,1)'), 16, 'GROWTH exponencial → 16');
approx(ev('=INDEX(GROWTH({1,2,4,8}),4,1)'), 8, 'GROWTH ajusta los conocidos');
eq(ev('=GROWTH({1,-2,4})'), '#NUM!', 'GROWTH con y ≤ 0 → #NUM!');

// ── LOGEST: coeficientes {m, b} de y = b·mˣ (rota en formulajs) ───────────────────
approx(ev('=INDEX(LOGEST({1,2,4,8}),1,1)'), 2, 'LOGEST m = 2 (y = 0.5·2ˣ)');
approx(ev('=INDEX(LOGEST({1,2,4,8}),1,2)'), 0.5, 'LOGEST b = 0.5');
approx(ev('=INDEX(LOGEST({6,12,24},{1,2,3}),1,2)'), 3, 'LOGEST b = 3 (y = 3·2ˣ)');
eq(ev('=LOGEST({1,-2,4})'), '#NUM!', 'LOGEST con y ≤ 0 → #NUM!');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ regression: ${passed}/${total} aserciones verdes.`);
