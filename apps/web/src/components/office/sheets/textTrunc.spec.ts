/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría del truncamiento de argumentos enteros en funciones de texto:
 *   cd apps/web && npx tsx src/components/office/sheets/textTrunc.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
parser.on('callCellValue', (_c: any, _o: any, d: any) => d(0));
parser.on('callRangeValue', (_s: any, _e: any, _o: any, d: any) => d([[0]]));
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── Argumentos fraccionarios se truncan (como Excel) ─────────────────────────────
eq(ev('=REPT("ab",2.9)'), 'abab', 'REPT trunca 2.9 → 2 (antes #ERROR!)');
eq(ev('=RIGHT("hello",2.9)'), 'lo', 'RIGHT trunca 2.9 → 2 (antes "llo")');
eq(ev('=LEFT("hello",2.9)'), 'he', 'LEFT trunca 2.9 → 2');
eq(ev('=MID("hello",1.9,2.9)'), 'he', 'MID trunca 1.9→1 y 2.9→2');
eq(ev('=ROMAN(4.9)'), 'IV', 'ROMAN trunca 4.9 → 4 (antes basura)');

// ── Argumentos enteros: comportamiento idéntico al motor ─────────────────────────
eq(ev('=REPT("x",3)'), 'xxx', 'REPT con entero intacto');
eq(ev('=RIGHT("hello",2)'), 'lo', 'RIGHT con entero intacto');
eq(ev('=LEFT("hello")'), 'h', 'LEFT sin argumento → 1');
eq(ev('=RIGHT("hello")'), 'o', 'RIGHT sin argumento → 1');
eq(ev('=MID("hello",2,3)'), 'ell', 'MID con enteros intacto');
eq(ev('=ROMAN(2024)'), 'MMXXIV', 'ROMAN con entero intacto');
eq(ev('=LEFT("abc",10)'), 'abc', 'LEFT con n mayor que la longitud');
eq(ev('=REPT("ab",0)'), '', 'REPT 0 veces → vacío');

// ── Composición ──────────────────────────────────────────────────────────────────
eq(ev('=LEFT("abcdef",LEN("abc")*1.5)'), 'abcd', 'LEFT con longitud calculada (4.5 → 4)');
eq(ev('=REPT("=",ROUND(4.6,0))'), '=====', 'REPT con conteo calculado');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ textTrunc: ${passed}/${total} aserciones verdes.`);
