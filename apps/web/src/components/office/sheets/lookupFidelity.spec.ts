/* eslint-disable @typescript-eslint/no-explicit-any */
/** Fidelidad de INDEX (vectores de una fila). npx tsx src/components/office/sheets/lookupFidelity.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// A1:C1 = 10,20,30 (fila) ; E1:E3 = 40,50,60 (columna) ; G1:H2 = 1,2 / 3,4 (bloque 2D)
const grid: Record<string, any> = { '0_0': 10, '0_1': 20, '0_2': 30, '0_4': 40, '1_4': 50, '2_4': 60, '0_6': 1, '0_7': 2, '1_6': 3, '1_7': 4 };
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? null));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// Rango de una sola fila: el índice único es la COLUMNA (antes daba #REF!).
eq(ev('=INDEX(A1:C1,2)'), 20, 'INDEX(fila,2) = 20');
eq(ev('=INDEX(A1:C1,1,2)'), 20, 'INDEX(fila,1,2) = 20 (explícito)');
eq(ev('=INDEX(A1:C1,MATCH(30,A1:C1,0))'), 30, 'INDEX/MATCH horizontal');
eq(ev('=INDEX({10,20,30},2)'), 20, 'constante {fila} índice único');
eq(ev('=SUM(INDEX(A1:C1,0))'), 60, 'índice 0 → fila completa (10+20+30)');
eq(ev('=IFERROR(INDEX(A1:C1,9),"REF")'), 'REF', 'fuera de rango → #REF!');

// Casos que NO cambian (se delegan a formulajs, siguen correctos):
eq(ev('=INDEX(E1:E3,2)'), 50, 'columna, índice único = fila (delegado)');
eq(ev('=INDEX(E1:E3,2,1)'), 50, 'columna explícita');
eq(ev('=INDEX(G1:H2,2,1)'), 3, 'matriz 2D INDEX(2,1)');
eq(ev('=INDEX(G1:H2,1,2)'), 2, 'matriz 2D INDEX(1,2)');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total}:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ lookupFidelity: ${passed}/${total} aserciones verdes.`);
