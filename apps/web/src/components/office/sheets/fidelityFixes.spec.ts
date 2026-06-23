/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de correcciones de fidelidad (ROUND, SUBSTITUTE), vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/fidelityFixes.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-9) passed++; else fails.push(`${m} — esp ${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
parser.on('callCellValue', (_c: any, _o: any, d: any) => d(0));
parser.on('callRangeValue', (_s: any, _e: any, _o: any, d: any) => d([[0]]));
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── ROUND: mitad lejos del cero + corrección de coma flotante ────────────────────
approx(ev('=ROUND(2.5,0)'), 3, 'ROUND(2.5,0) = 3');
approx(ev('=ROUND(-2.5,0)'), -3, 'ROUND(-2.5,0) = -3 (mitad lejos del cero)');
approx(ev('=ROUND(2.45,1)'), 2.5, 'ROUND(2.45,1) = 2.5');
approx(ev('=ROUND(-2.45,1)'), -2.5, 'ROUND(-2.45,1) = -2.5');
approx(ev('=ROUND(1.005,2)'), 1.01, 'ROUND(1.005,2) = 1.01 (coma flotante)');
approx(ev('=ROUND(2.675,2)'), 2.68, 'ROUND(2.675,2) = 2.68 (coma flotante)');
approx(ev('=ROUND(12345,-2)'), 12300, 'ROUND(12345,-2) = 12300');
approx(ev('=ROUND(-12345,-2)'), -12300, 'ROUND(-12345,-2) = -12300');
approx(ev('=ROUND(3.14159,2)'), 3.14, 'ROUND(3.14159,2) = 3.14');
approx(ev('=ROUND(2.4999,0)'), 2, 'ROUND(2.4999,0) = 2');
approx(ev('=ROUND(0,2)'), 0, 'ROUND(0,2) = 0');
// Compone con otras.
approx(ev('=ROUND(SUM(1.115,2.225),2)'), 3.34, 'ROUND compone con SUM');

// ── SUBSTITUTE: instancia correcta ───────────────────────────────────────────────
eq(ev('=SUBSTITUTE("aaa","a","b",2)'), 'aba', 'SUBSTITUTE 2ª ocurrencia = "aba"');
eq(ev('=SUBSTITUTE("aaa","a","b")'), 'bbb', 'SUBSTITUTE todas = "bbb"');
eq(ev('=SUBSTITUTE("a-b-c-d","-","+",3)'), 'a-b-c+d', 'SUBSTITUTE 3ª ocurrencia');
eq(ev('=SUBSTITUTE("a-b-c-d","-","+")'), 'a+b+c+d', 'SUBSTITUTE todas las ocurrencias');
eq(ev('=SUBSTITUTE("hello","x","y")'), 'hello', 'SUBSTITUTE sin coincidencia → intacto');
eq(ev('=SUBSTITUTE("2024-01-15","-","/")'), '2024/01/15', 'SUBSTITUTE de fecha');
eq(ev('=SUBSTITUTE("aaa","a","b",5)'), 'aaa', 'SUBSTITUTE con instancia > nº ocurrencias → intacto');
eq(ev('=LEN(SUBSTITUTE("a a a"," ",""))'), 3, 'SUBSTITUTE compone con LEN (quita espacios)');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ fidelityFixes: ${passed}/${total} aserciones verdes.`);
