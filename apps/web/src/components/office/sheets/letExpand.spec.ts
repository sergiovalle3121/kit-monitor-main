/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de `LET` (preprocesado de cadena) contra el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/letExpand.spec.ts
 *
 * Verifica (1) la expansión pura (sustitución de nombres, anidamiento, respeto de comillas y
 * límites de identificador) y (2) que el parser evalúa el resultado correctamente.
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';
import { expandLet } from './letExpand';

installFormulaEngine();

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-6) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const grid: Record<string, any> = { '0_0': 30, '1_0': 10, '2_0': 20, '3_0': 10, '4_0': 30 };
const parser = new Parser();
parser.on('callCellValue', (coord: any, _o: any, done: any) => done(grid[`${coord.row.index}_${coord.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, done: any) => {
  const out: any[][] = [];
  for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); }
  done(out);
});
function ev(f: string): any { const r = parser.parse(f.replace(/^=/, '')); return r.error ? r.error : r.result; }

// ───────────────────────── Expansión pura ─────────────────────────
eq(expandLet('LET(x,5,x+1)'), '((5)+1)', 'expande LET simple');
eq(expandLet('LET(x,2,y,x*3,x+y)'), '((2)+((2)*3))', 'segundo valor usa el primer nombre');
eq(expandLet('A1+1'), 'A1+1', 'sin LET → intacto');
eq(expandLet('LET(x,5,"x vale "&x)'), '("x vale "&(5))', 'no sustituye dentro de comillas');
eq(expandLet('LET(precio,100,tasa,0.1,precio*(1+tasa))'), '((100)*(1+(0.1)))', 'varios nombres');
eq(expandLet('LET(a,1,a+LET(b,2,b+1))'), '((1)+((2)+1))', 'LET anidado en el cálculo');
// Identificador completo: «xx» no se toca cuando el nombre es «x».
eq(/\(5\)\(5\)/.test(expandLet('LET(x,5,xx+x)')), false, 'no parte identificadores más largos');

// ───────────────────────── Motor REAL ─────────────────────────
eq(ev('=LET(x,5,x+1)'), 6, 'motor: LET(x,5,x+1)=6');
eq(ev('=LET(x,A1,x*2)'), 60, 'motor: LET sobre celda A1=30 → 60');
eq(ev('=LET(x,2,y,x*3,x+y)'), 8, 'motor: nombres encadenados 2+6=8');
approx(ev('=LET(precio,100,tasa,0.1,precio*(1+tasa))'), 110, 'motor: precio con tasa ≈ 110 (IEEE-754, igual que Excel)');
eq(ev('=LET(a,1,a+LET(b,2,b+1))'), 4, 'motor: LET anidado = 4');
eq(ev('=LET(s,SUM(A1:A5),s/COUNT(A1:A5))'), 20, 'motor: media via LET = 100/5');
eq(ev('=LET(u,UNIQUE(A1:A5),COUNT(u))'), 3, 'motor: LET con función de matriz (UNIQUE)');
eq(ev('=LET(x,5,CONCATENATE("x=",x))'), 'x=5', 'motor: LET con texto, sin tocar el literal');
eq(ev('=LET(n,4,n*n)'), 16, 'motor: cuadrado via LET');

// ───────────────────────── Resumen ─────────────────────────
const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ letExpand: ${passed}/${total} aserciones verdes.`);
