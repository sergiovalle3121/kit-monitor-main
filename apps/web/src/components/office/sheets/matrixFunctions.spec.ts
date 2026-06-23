/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de funciones matriciales + SERIESSUM + ERROR.TYPE, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/matrixFunctions.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const approx = (a: any, b: number, m: string, tol = 1e-9) => { if (typeof a === 'number' && Math.abs(a - b) < tol) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// A1:B2 = [[1,2],[3,4]] ; D1:E2 = [[5,6],[7,8]]
const grid: Record<string, any> = { '0_0': 1, '0_1': 2, '1_0': 3, '1_1': 4, '0_3': 5, '0_4': 6, '1_3': 7, '1_4': 8 };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── MMULT: [[1,2],[3,4]]·[[5,6],[7,8]] = [[19,22],[43,50]] ────────────────────────
eq(ev('=INDEX(MMULT(A1:B2,D1:E2),1,1)'), 19, 'MMULT (1,1) = 19');
eq(ev('=INDEX(MMULT(A1:B2,D1:E2),1,2)'), 22, 'MMULT (1,2) = 22');
eq(ev('=INDEX(MMULT(A1:B2,D1:E2),2,1)'), 43, 'MMULT (2,1) = 43');
eq(ev('=INDEX(MMULT(A1:B2,D1:E2),2,2)'), 50, 'MMULT (2,2) = 50');
eq(ev('=SUM(MMULT(A1:B2,D1:E2))'), 134, 'MMULT suma total = 134');
eq(ev('=MMULT(A1:B2,D1:E1)'), '#VALUE!', 'MMULT con dimensiones incompatibles → #VALUE!');

// ── MUNIT: identidad ─────────────────────────────────────────────────────────────
eq(ev('=SUM(MUNIT(3))'), 3, 'MUNIT(3) traza/suma = 3');
eq(ev('=INDEX(MUNIT(3),2,2)'), 1, 'MUNIT diagonal = 1');
eq(ev('=INDEX(MUNIT(3),1,2)'), 0, 'MUNIT fuera de diagonal = 0');

// ── MDETERM ──────────────────────────────────────────────────────────────────────
approx(ev('=MDETERM(A1:B2)'), -2, 'MDETERM [[1,2],[3,4]] = -2');
approx(ev('=MDETERM({2,0;0,3})'), 6, 'MDETERM diagonal 2×3 = 6');
approx(ev('=MDETERM({1,2,3;4,5,6;7,8,9})'), 0, 'MDETERM matriz singular = 0');

// ── MINVERSE: inv([[1,2],[3,4]]) = [[-2,1],[1.5,-0.5]] ; M·M⁻¹ = I ────────────────
approx(ev('=INDEX(MINVERSE(A1:B2),1,1)'), -2, 'MINVERSE (1,1) = -2');
approx(ev('=INDEX(MINVERSE(A1:B2),1,2)'), 1, 'MINVERSE (1,2) = 1');
approx(ev('=INDEX(MINVERSE(A1:B2),2,1)'), 1.5, 'MINVERSE (2,1) = 1.5');
approx(ev('=INDEX(MINVERSE(A1:B2),2,2)'), -0.5, 'MINVERSE (2,2) = -0.5');
approx(ev('=SUM(MMULT(A1:B2,MINVERSE(A1:B2)))'), 2, 'M·M⁻¹ = I (suma = 2)');
eq(ev('=MINVERSE({1,1;1,1})'), '#NUM!', 'MINVERSE de matriz singular → #NUM!');

// ── SERIESSUM: 1·2⁰ + 1·2¹ + 1·2² = 7 ────────────────────────────────────────────
approx(ev('=SERIESSUM(2,0,1,{1,1,1})'), 7, 'SERIESSUM(2,0,1,{1,1,1}) = 7');
approx(ev('=SERIESSUM(2,0,2,{1,1,1})'), 21, 'SERIESSUM con paso 2 = 1+4+16');

// ── ERROR.TYPE ───────────────────────────────────────────────────────────────────
eq(ev('=ERROR.TYPE(NA())'), 7, 'ERROR.TYPE(#N/A) = 7');
eq(ev('=ERROR.TYPE(1/0)'), 2, 'ERROR.TYPE(#DIV/0!) = 2');
eq(ev('=ERROR.TYPE(5)'), '#N/A', 'ERROR.TYPE de un valor no-error = #N/A');
eq(ev('=IFERROR(ERROR.TYPE(5),"sin error")'), 'sin error', 'ERROR.TYPE compone con IFERROR');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ matrixFunctions: ${passed}/${total} aserciones verdes.`);
