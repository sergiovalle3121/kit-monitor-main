/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de redondeo moderno + RANDARRAY + ENCODEURL, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/mathExtras.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (cond: boolean, m: string) => { if (cond) passed++; else fails.push(m); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
parser.on('callCellValue', (_c: any, _o: any, d: any) => d(0));
parser.on('callRangeValue', (_s: any, _e: any, _o: any, d: any) => d([[0]]));
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── CEILING.MATH / FLOOR.MATH (con modo para negativos) ─────────────────────────
eq(ev('=CEILING.MATH(4.3)'), 5, 'CEILING.MATH(4.3) = 5');
eq(ev('=CEILING.MATH(6.7,2)'), 8, 'CEILING.MATH(6.7,2) = 8');
eq(ev('=CEILING.MATH(-4.3)'), -4, 'CEILING.MATH(-4.3) = -4 (hacia el cero por defecto)');
eq(ev('=CEILING.MATH(-4.3,1,1)'), -5, 'CEILING.MATH(-4.3,1,1) = -5 (modo aleja del cero)');
eq(ev('=FLOOR.MATH(4.7)'), 4, 'FLOOR.MATH(4.7) = 4');
eq(ev('=FLOOR.MATH(-4.3)'), -5, 'FLOOR.MATH(-4.3) = -5 (aleja del cero por defecto)');
eq(ev('=FLOOR.MATH(-4.3,1,1)'), -4, 'FLOOR.MATH(-4.3,1,1) = -4 (modo hacia el cero)');
eq(ev('=FLOOR.MATH(7,3)'), 6, 'FLOOR.MATH(7,3) = 6');

// ── *.PRECISE / ISO.CEILING (hacia ±∞, signo de la cifra ignorado) ──────────────
eq(ev('=CEILING.PRECISE(4.3)'), 5, 'CEILING.PRECISE(4.3) = 5');
eq(ev('=CEILING.PRECISE(-4.3)'), -4, 'CEILING.PRECISE(-4.3) = -4 (hacia +∞)');
eq(ev('=ISO.CEILING(-4.3)'), -4, 'ISO.CEILING = CEILING.PRECISE');
eq(ev('=FLOOR.PRECISE(-4.3)'), -5, 'FLOOR.PRECISE(-4.3) = -5 (hacia −∞)');
eq(ev('=CEILING.PRECISE(4.1,2)'), 6, 'CEILING.PRECISE(4.1,2) = 6');

// ── RANDARRAY: forma y rango (es aleatoria → se comprueban dimensiones y cotas) ──
eq(ev('=ROWS(RANDARRAY(3,2))'), 3, 'RANDARRAY tiene 3 filas');
eq(ev('=COLUMNS(RANDARRAY(3,2))'), 2, 'RANDARRAY tiene 2 columnas');
{ const v = ev('=INDEX(RANDARRAY(1,1,5,10),1,1)') as number; ok(typeof v === 'number' && v >= 5 && v <= 10, `RANDARRAY respeta [min,max] (obt ${v})`); }
{ const v = ev('=INDEX(RANDARRAY(1,1,1,6,TRUE),1,1)') as number; ok(Number.isInteger(v) && v >= 1 && v <= 6, `RANDARRAY entero en [1,6] (obt ${v})`); }
{ const s = ev('=SUM(RANDARRAY(5,5,0,1))') as number; ok(typeof s === 'number' && s >= 0 && s <= 25, `RANDARRAY 5×5 en [0,1] suma ${s} ≤ 25`); }

// ── ENCODEURL ────────────────────────────────────────────────────────────────────
eq(ev('=ENCODEURL("a b")'), 'a%20b', 'ENCODEURL espacio');
eq(ev('=ENCODEURL("á/?=")'), encodeURIComponent('á/?='), 'ENCODEURL caracteres especiales');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ mathExtras: ${passed}/${total} aserciones verdes.`);
