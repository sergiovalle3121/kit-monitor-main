/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de la difusión de funciones escalares sobre matrices, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/scalarBroadcast.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-9) passed++; else fails.push(`${m} — esp ${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
// A1:A5 = 3.2,1.7,4.9,1.1,5.5 ; B1:B5 = 10,20,30,40,50
const grid: Record<string, any> = {};
[3.2, 1.7, 4.9, 1.1, 5.5].forEach((v, i) => { grid[`${i}_0`] = v; grid[`${i}_1`] = (i + 1) * 10; });
const parser = new Parser();
parser.on('callCellValue', (c: any, _o: any, d: any) => d(grid[`${c.row.index}_${c.column.index}`] ?? 0));
parser.on('callRangeValue', (s: any, e: any, _o: any, d: any) => { const out: any[][] = []; for (let r = s.row.index; r <= e.row.index; r++) { const row: any[] = []; for (let c = s.column.index; c <= e.column.index; c++) row.push(grid[`${r}_${c}`] ?? null); out.push(row); } d(out); });
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── Las funciones escalares NO cambian con argumentos escalares ───────────────────
approx(ev('=ROUND(3.456,2)'), 3.46, 'ROUND escalar intacto');
eq(ev('=ABS(-5)'), 5, 'ABS escalar intacto');
eq(ev('=TEXT(0.5,"0%")'), '50%', 'TEXT escalar intacto');
eq(ev('=LEN("hola")'), 4, 'LEN escalar intacto');
approx(ev('=SQRT(144)'), 12, 'SQRT escalar intacto');
eq(ev('=LEFT("hello",3)'), 'hel', 'LEFT escalar intacto');

// ── Difusión sobre matrices (la nueva capacidad) ─────────────────────────────────
approx(ev('=SUM(ROUND(A1:A5,0))'), 17, 'ROUND difundido (3+2+5+1+6)');
approx(ev('=SUM(ABS({-1,-2,3,-4}))'), 10, 'ABS difundido');
approx(ev('=SUM(INT(A1:A5))'), 14, 'INT difundido (3+1+4+1+5)');
approx(ev('=SUM(ROUND(B1:B5*1.1,0))'), 165, 'ROUND sobre rango·escalar = 11+22+33+44+55');
approx(ev('=SUM(POWER({1,2,3,4},2))'), 30, 'POWER difundido (1+4+9+16)');
approx(ev('=SUM(MOD({10,11,12},3))'), 3, 'MOD rango↔escalar (1+2+0)');
approx(ev('=SUM(SQRT({4,9,16}))'), 9, 'SQRT difundido (2+3+4)');
approx(ev('=SUM(LEN({"a","bb","ccc"}))'), 6, 'LEN difundido (1+2+3)');
eq(ev('=TEXTJOIN(",",1,TEXT({1,2,3},"000"))'), '001,002,003', 'TEXT difundido con formato');
eq(ev('=TEXTJOIN("",1,UPPER({"a","b","c"}))'), 'ABC', 'UPPER difundido');
eq(ev('=TEXTJOIN(",",1,LEFT({"hello","world"},3))'), 'hel,wor', 'LEFT difundido (texto + longitud)');
approx(ev('=SUMPRODUCT(ROUND(A1:A5,0),B1:B5)'), 560, 'ROUND difundido compone con SUMPRODUCT (30+40+150+40+300)');

// ── Combina con operadores (§69) e IF (§70) ──────────────────────────────────────
approx(ev('=SUM(IF(A1:A5>2,ROUND(A1:A5,0),0))'), 14, 'ROUND difundido dentro de IF matricial (3+5+6)');
approx(ev('=SUM(ABS(A1:A5-3))'), 7.8, 'ABS(rango−escalar): |0.2|+|−1.3|+|1.9|+|−1.9|+|2.5|');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ scalarBroadcast: ${passed}/${total} aserciones verdes.`);
