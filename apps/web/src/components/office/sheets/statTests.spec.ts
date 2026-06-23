/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de contrastes con nombre moderno + alias, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/statTests.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string, tol = 1e-4) => { if (typeof a === 'number' && Math.abs(a - b) < tol) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// A1:A5 = 3,4,5,6,7 ; B1:B5 = 5,6,5,8,7
const grid: Record<string, any> = { '0_0': 3, '1_0': 4, '2_0': 5, '3_0': 6, '4_0': 7, '0_1': 5, '1_1': 6, '2_1': 5, '3_1': 8, '4_1': 7 };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── Contrastes (nombre moderno delega en el legado verificado) ────────────────────
approx(ev('=T.TEST(A1:A5,B1:B5,2,1)'), 0.226782, 'T.TEST = TTEST');
approx(ev('=F.TEST(A1:A5,B1:B5)'), 1.470588, 'F.TEST = FTEST');
approx(ev('=Z.TEST(A1:A5,5)'), 0.5, 'Z.TEST = ZTEST');
approx(ev('=CHISQ.TEST({10,20},{15,15})'), 0, 'CHISQ.TEST = CHITEST');
eq(ev('=BINOM.INV(10,0.5,0.5)'), 5, 'BINOM.INV = CRITBINOM');
// Coherencia con el nombre legado.
{ const a = ev('=T.TEST(A1:A5,B1:B5,2,1)') as number; const b = ev('=TTEST(A1:A5,B1:B5,2,1)') as number; eq(a === b, true, 'T.TEST == TTEST'); }

// ── ERF.PRECISE / ERFC.PRECISE ───────────────────────────────────────────────────
approx(ev('=ERF.PRECISE(1)'), 0.842701, 'ERF.PRECISE(1)');
approx(ev('=ERFC.PRECISE(1)'), 0.157299, 'ERFC.PRECISE(1)');
approx(ev('=ERF.PRECISE(1)+ERFC.PRECISE(1)'), 1, 'ERF.PRECISE + ERFC.PRECISE = 1');

// ── CONFIDENCE.T (con la t de Student de §59) ────────────────────────────────────
approx(ev('=CONFIDENCE.T(0.05,1,10)'), 0.715357, 'CONFIDENCE.T(0.05,1,10)', 1e-3);
eq(ev('=CONFIDENCE.T(0.05,1,1)'), '#NUM!', 'CONFIDENCE.T con n<2 → #NUM!');
// CONFIDENCE.NORM (§54) y CONFIDENCE.T deben diferir (t > z para n pequeño).
{ const tConf = ev('=CONFIDENCE.T(0.05,1,10)') as number; const zConf = ev('=CONFIDENCE.NORM(0.05,1,10)') as number; eq(tConf > zConf, true, 'CONFIDENCE.T > CONFIDENCE.NORM (n pequeño)'); }

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ statTests: ${passed}/${total} aserciones verdes.`);
