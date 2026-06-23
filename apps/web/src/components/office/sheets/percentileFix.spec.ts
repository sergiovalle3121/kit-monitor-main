/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de PERCENTILE/QUARTILE inclusivos (corrección de interpolación), vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/percentileFix.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-9) passed++; else fails.push(`${m} — esp ${b}, obt ${JSON.stringify(a)}`); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const grid: Record<string, any> = { '0_0': 1, '1_0': 2, '2_0': 3, '3_0': 4 };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── PERCENTILE inclusivo: interpolación p·(n−1) ──────────────────────────────────
approx(ev('=PERCENTILE({1,2,3,4},0.25)'), 1.75, 'PERCENTILE 0.25 = 1.75 (antes 1.25)');
approx(ev('=PERCENTILE({1,2,3,4},0.5)'), 2.5, 'PERCENTILE 0.5 = 2.5');
approx(ev('=PERCENTILE({1,2,3,4},0.75)'), 3.25, 'PERCENTILE 0.75 = 3.25');
approx(ev('=PERCENTILE({15,20,35,40,50},0.3)'), 23, 'PERCENTILE 0.3 = 23');
approx(ev('=PERCENTILE.INC({1,2,3,4},0.25)'), 1.75, 'PERCENTILE.INC = PERCENTILE');
approx(ev('=PERCENTILE(A1:A4,0.25)'), 1.75, 'PERCENTILE sobre un rango real');
approx(ev('=PERCENTILE({5},0.9)'), 5, 'PERCENTILE de un solo valor');
eq(ev('=PERCENTILE({1,2,3,4},1.5)'), '#NUM!', 'PERCENTILE p fuera de [0,1] → #NUM!');

// ── QUARTILE inclusivo ───────────────────────────────────────────────────────────
approx(ev('=QUARTILE({1,2,3,4},1)'), 1.75, 'QUARTILE Q1 = 1.75');
approx(ev('=QUARTILE({1,2,3,4},2)'), 2.5, 'QUARTILE Q2 = mediana');
approx(ev('=QUARTILE.INC({1,2,3,4},3)'), 3.25, 'QUARTILE.INC Q3 = 3.25');
eq(ev('=QUARTILE({1,2,3,4},0)'), 1, 'QUARTILE Q0 = mínimo');
eq(ev('=QUARTILE({1,2,3,4},4)'), 4, 'QUARTILE Q4 = máximo');
eq(ev('=QUARTILE({1,2,3,4},5)'), '#NUM!', 'QUARTILE q fuera de [0,4] → #NUM!');

// ── Coherencia: QUARTILE(·,2) = PERCENTILE(·,0.5) = MEDIAN ────────────────────────
eq(ev('=QUARTILE({1,2,3,4},2)') === ev('=MEDIAN({1,2,3,4})'), true, 'QUARTILE Q2 == MEDIAN');
eq(ev('=PERCENTILE({1,2,3,4},0.25)') === ev('=QUARTILE({1,2,3,4},1)'), true, 'PERCENTILE 0.25 == QUARTILE Q1');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ percentileFix: ${passed}/${total} aserciones verdes.`);
