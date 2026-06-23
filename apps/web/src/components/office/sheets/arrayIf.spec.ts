/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría del IF consciente de matrices, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/arrayIf.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-9) passed++; else fails.push(`${m} — esp ${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// A1:A5 = 3,1,4,1,5 ; B1:B5 = 10,20,30,40,50
const grid: Record<string, any> = { '0_0': 3, '1_0': 1, '2_0': 4, '3_0': 1, '4_0': 5, '0_1': 10, '1_1': 20, '2_1': 30, '3_1': 40, '4_1': 50 };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── IF escalar: idéntico al motor (delegación a formulajs) ────────────────────────
eq(ev('=IF(TRUE,1,2)'), 1, 'IF escalar verdadero');
eq(ev('=IF(FALSE,1,2)'), 2, 'IF escalar falso');
eq(ev('=IF(1>2,"a","b")'), 'b', 'IF con comparación escalar');
eq(ev('=IF(5,10,20)'), 10, 'IF con número no nulo');
eq(ev('=IF(FALSE,1)'), false, 'IF sin rama falsa → FALSO');
eq(ev('=IF(A1>2,"sí","no")'), 'sí', 'IF sobre una celda');

// ── IF con condición-matriz: selección elemento a elemento ───────────────────────
approx(ev('=SUM(IF(A1:A5>2,A1:A5,0))'), 12, 'suma de los que cumplen (3+4+5)');
approx(ev('=SUM(IF(A1:A5>2,B1:B5,0))'), 90, 'devuelve B donde A>2 (10+30+50)');
approx(ev('=SUM(IF(A1:A5=1,1,0))'), 2, 'cuenta condicional con IF');
approx(ev('=SUM(IF(A1:A5>2,1))'), 3, 'IF sin rama falsa, condición-matriz');
approx(ev('=SUM(IF(A1:A5>2,A1:A5,B1:B5))'), 72, 'elige A o B por elemento (3+20+4+40+5)');
approx(ev('=SUMPRODUCT(IF(A1:A5>2,1,0))'), 3, 'IF con SUMPRODUCT');
approx(ev('=SUM(IF({1,0,1,0},{10,20,30,40},0))'), 40, 'IF con dos constantes de matriz');
eq(ev('=INDEX(IF(A1:A5>2,"hi","lo"),2,1)'), 'lo', 'IF de texto, elemento (A2=1 → "lo")');
// Anidado con AND-style vía producto de condiciones.
approx(ev('=SUM(IF((A1:A5>1)*(A1:A5<5),A1:A5,0))'), 7, 'IF con doble condición (3+4)');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ arrayIf: ${passed}/${total} aserciones verdes.`);
