/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de la difusión de operadores sobre matrices, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/broadcast.spec.ts
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

// ── Comparación de rango con escalar (el patrón clave de los arrays de Excel) ─────
approx(ev('=SUM((A1:A5>2)*1)'), 3, '(A1:A5>2)*1 → 3,4,5 cuentan → 3');
approx(ev('=SUM((A1:A5=1)*1)'), 2, '(A1:A5=1)*1 → dos unos');
approx(ev('=SUMPRODUCT((A1:A5>2)*B1:B5)'), 90, 'SUMPRODUCT condicional = 10+30+50');
approx(ev('=SUMPRODUCT((A1:A5>1)*(A1:A5<5))'), 2, 'doble condición (3 y 4)');
approx(ev('=SUMPRODUCT((A1:A5>=1)*1)'), 5, 'todos cumplen → 5');

// ── Aritmética rango↔escalar y rango↔rango ───────────────────────────────────────
approx(ev('=SUM(A1:A5*2)'), 28, 'rango·escalar = 14·2');
approx(ev('=SUM(A1:A5+B1:B5)'), 164, 'suma elemento a elemento de dos rangos');
approx(ev('=SUM(B1:B5/10)'), 15, 'rango/escalar');
approx(ev('=SUMPRODUCT(A1:A5,B1:B5)'), 460, 'SUMPRODUCT nativo sigue intacto');

// ── Constantes de matriz con operadores ──────────────────────────────────────────
approx(ev('=SUM({1,2,3}+{10,20,30})'), 66, 'suma de dos constantes de matriz');
approx(ev('=SUM({1,2,3}*{1,2,3})'), 14, 'producto elemento a elemento');
approx(ev('=SUM(({1,2,3,4}>=3)*1)'), 2, 'idioma (matriz>=x)*1 → cuenta condicional');
eq(ev('=TEXTJOIN(",",1,{1,2,3}&"x")'), '1x,2x,3x', 'concatenación & difundida');

// ── Producto exterior columna × fila ─────────────────────────────────────────────
approx(ev('=SUM({1;2;3}*{10,20,30})'), 360, 'columna n×1 ⊗ fila 1×m → matriz (6·60)');

// ── Los escalares NO se rompen + corrección de lógicos en aritmética ──────────────
approx(ev('=2+3'), 5, 'escalar intacto');
approx(ev('=5*TRUE'), 5, 'lógico·número (antes #VALUE!) = 5');
approx(ev('=10-FALSE'), 10, '10 − FALSO = 10');
eq(ev('="a"&"b"'), 'ab', 'concatenación escalar intacta');
approx(ev('=SUM(A1:A5)'), 14, 'SUM de rango intacto');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ broadcast: ${passed}/${total} aserciones verdes.`);
