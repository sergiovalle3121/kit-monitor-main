/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de la familia LAMBDA (expansión pura + motor REAL):
 *   cd apps/web && npx tsx src/components/office/sheets/lambdaExpand.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';
import { expandLambda, decodeLambda } from './lambdaExpand';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// ── Expansión pura: invocación directa (los tokens simples no se envuelven en paréntesis) ──────
eq(expandLambda('LAMBDA(x,x+1)(5)'), '(5+1)', 'invocación directa simple');
eq(expandLambda('LAMBDA(x,y,x*y)(3,4)'), '(3*4)', 'dos parámetros');
eq(expandLambda('LAMBDA(r,SUM(r))(A1:A3)'), '(SUM(A1:A3))', 'rango sin envolver en paréntesis');
eq(expandLambda('LAMBDA(x,x*2)(2+3)'), '((2+3)*2)', 'argumento expresión → paréntesis');
eq(expandLambda('1+LAMBDA(n,n*n)(4)'), '1+(4*4)', 'lambda en medio de una fórmula');
// Lambda como argumento → literal codificado (no debe tocar lo de fuera).
{
  const enc = expandLambda('MAP(A1:A3,LAMBDA(x,x*2))');
  eq(enc.startsWith('MAP(A1:A3,"§LMB§') && enc.endsWith('")'), true, 'lambda-argumento se codifica como literal');
  const lit = enc.slice(enc.indexOf('"') + 1, enc.lastIndexOf('"')); // contenido SIN las comillas
  eq(lit.includes('"'), false, 'el literal codificado no contiene comillas internas');
  eq(decodeLambda(lit), { names: ['x'], body: 'x*2' }, 'decodeLambda recupera params y cuerpo');
}
eq(expandLambda('SUM(A1:A3)'), 'SUM(A1:A3)', 'sin lambda → intacto');
eq(expandLambda('"texto LAMBDA(x,x)"'), '"texto LAMBDA(x,x)"', 'no toca dentro de comillas');

// ── Motor REAL ────────────────────────────────────────────────────────────────
const Parser: any = (FP as any).Parser;
const grid: Record<string, any> = {
  '0_0': 1, '1_0': 2, '2_0': 3, '3_0': 4, '4_0': 5,            // A1:A5 = 1..5
  '0_1': 10, '1_1': 20, '2_1': 30,                              // B1:B3 = 10,20,30
  '0_2': 1, '0_3': 2, '0_4': 3, '1_2': 4, '1_3': 5, '1_4': 6,  // C1:E2 = [[1,2,3],[4,5,6]]
};
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// Invocación directa (con refs externos vivos).
eq(ev('=LAMBDA(x,x+1)(5)'), 6, 'directo: incrementa');
eq(ev('=LAMBDA(a,b,a*b)(6,7)'), 42, 'directo: producto');
eq(ev('=LAMBDA(r,SUM(r))(A1:A5)'), 15, 'directo: SUM de un rango pasado como argumento');
eq(ev('=LAMBDA(x,x+A1)(10)'), 11, 'directo: el cuerpo ve refs externos (A1=1)');

// MAP — envuelto en SUM/INDEX porque compone matrices 2D.
eq(ev('=SUM(MAP(A1:A5,LAMBDA(x,x*2)))'), 30, 'MAP x*2 sobre 1..5, sumado = 30');
eq(ev('=SUM(MAP(A1:A3,B1:B3,LAMBDA(a,b,a+b)))'), 66, 'MAP de dos matrices (1+10..3+30) = 66');
eq(ev('=INDEX(MAP(A1:A5,LAMBDA(x,x*x)),3,1)'), 9, 'MAP x*x, elemento (3) = 9');

// REDUCE / SCAN.
eq(ev('=REDUCE(0,A1:A5,LAMBDA(a,v,a+v))'), 15, 'REDUCE suma = 15');
eq(ev('=REDUCE(1,A1:A5,LAMBDA(a,v,a*v))'), 120, 'REDUCE producto = 5! = 120');
eq(ev('=SUM(SCAN(0,A1:A5,LAMBDA(a,v,a+v)))'), 35, 'SCAN sumas parciales 1,3,6,10,15 → 35');
eq(ev('=INDEX(SCAN(0,A1:A5,LAMBDA(a,v,a+v)),4,1)'), 10, 'SCAN acumulado en pos 4 = 10');

// BYROW / BYCOL sobre C1:E2 = [[1,2,3],[4,5,6]].
eq(ev('=SUM(BYROW(C1:E2,LAMBDA(r,SUM(r))))'), 21, 'BYROW SUM por fila (6+15) = 21');
eq(ev('=INDEX(BYROW(C1:E2,LAMBDA(r,SUM(r))),2,1)'), 15, 'BYROW fila 2 = 15');
eq(ev('=SUM(BYCOL(C1:E2,LAMBDA(c,SUM(c))))'), 21, 'BYCOL SUM por columna (5+7+9) = 21');
eq(ev('=INDEX(BYCOL(C1:E2,LAMBDA(c,MAX(c))),1,2)'), 5, 'BYCOL MAX de la columna 2 = 5');

// MAKEARRAY — tabla de multiplicar 3×3, índices 1-based.
eq(ev('=SUM(MAKEARRAY(3,3,LAMBDA(i,j,i*j)))'), 36, 'MAKEARRAY i*j 3×3 sumado = 36');
eq(ev('=INDEX(MAKEARRAY(3,3,LAMBDA(i,j,i*j)),3,3)'), 9, 'MAKEARRAY celda (3,3) = 9');

// Composición: MAP con cuerpo que usa IF y texto.
eq(ev('=SUM(MAP(A1:A5,LAMBDA(x,IF(x>2,x,0))))'), 12, 'MAP con IF (3+4+5) = 12');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ lambdaExpand: ${passed}/${total} aserciones verdes.`);
