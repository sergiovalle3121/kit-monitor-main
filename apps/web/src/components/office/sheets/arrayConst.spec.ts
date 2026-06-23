/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de constantes de matriz `{…}` (expansión pura + motor REAL):
 *   cd apps/web && npx tsx src/components/office/sheets/arrayConst.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';
import { expandArrayConst, decodeArrayConst } from './arrayConst';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// ── Expansión pura ────────────────────────────────────────────────────────────
{
  const e = expandArrayConst('SUM({1,2,3})');
  eq(e.startsWith('SUM(ARRCONST("§ARR§') && e.endsWith('"))'), true, 'fila → ARRCONST(...)');
  const lit = e.slice(e.indexOf('"') + 1, e.lastIndexOf('"'));
  eq(decodeArrayConst(lit), [[1, 2, 3]], 'fila decodifica a 1×3');
}
{
  const lit = (s: string) => { const e = expandArrayConst(s); return e.slice(e.indexOf('"') + 1, e.lastIndexOf('"')); };
  eq(decodeArrayConst(lit('SUM({1;2;3})')), [[1], [2], [3]], 'columna → 3×1');
  eq(decodeArrayConst(lit('SUM({1,2;3,4})')), [[1, 2], [3, 4]], 'matriz 2×2');
  eq(decodeArrayConst(lit('={"a","b"}')), [['a', 'b']], 'texto entre comillas');
  eq(decodeArrayConst(lit('={1,TRUE,-2.5}')), [[1, true, -2.5]], 'mezcla número/lógico/negativo');
  eq(decodeArrayConst(lit('={1,2;3}')), [[1, 2], [3, '']], 'fila corta se rellena a rectángulo');
}
eq(expandArrayConst('SUM(A1:A3)'), 'SUM(A1:A3)', 'sin llaves → intacto');
eq(expandArrayConst('"texto {1,2}"'), '"texto {1,2}"', 'no toca llaves dentro de comillas');

// ── Motor REAL ────────────────────────────────────────────────────────────────
const Parser: any = (FP as any).Parser;
const grid: Record<string, any> = { '0_0': 5, '1_0': 9, '2_0': 1, '3_0': 7, '4_0': 3 }; // A1:A5
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

eq(ev('=SUM({1,2,3})'), 6, 'SUM de fila = 6');
eq(ev('=SUM({1;2;3;4})'), 10, 'SUM de columna = 10');
eq(ev('=SUM({1,2;3,4})'), 10, 'SUM de matriz 2×2 = 10');
eq(ev('=COUNT({10,20,30,40})'), 4, 'COUNT de constante = 4');
eq(ev('=MAX({3,9,2,7})'), 9, 'MAX de constante = 9');
eq(ev('=AVERAGE({2,4,6})'), 4, 'AVERAGE de constante = 4');
eq(ev('=INDEX({10,20,30},1,2)'), 20, 'INDEX sobre constante');
eq(ev('=SUMPRODUCT({1,2,3},{4,5,6})'), 32, 'SUMPRODUCT de dos constantes = 32');
eq(ev('=TEXTJOIN("-",TRUE,{"a","b","c"})'), 'a-b-c', 'TEXTJOIN sobre constante de texto');
// Caso emblemático: buscar contra una lista en línea (no necesita «broadcasting» del motor).
eq(ev('=MATCH(7,{1,3,5,7,9},0)'), 4, 'MATCH(7,{1,3,5,7,9},0) = posición 4');
eq(ev('=INDEX({"Lun","Mar","Mié"},1,2)'), 'Mar', 'INDEX de una lista de texto en línea');
// Compone con la familia dinámica (§51 etc.).
eq(ev('=SUM(MAP({1,2,3,4},LAMBDA(x,x*x)))'), 30, 'MAP sobre una constante de matriz = 30');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ arrayConst: ${passed}/${total} aserciones verdes.`);
