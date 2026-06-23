/* eslint-disable @typescript-eslint/no-explicit-any */
/** SEARCH con comodines + core wildcard. npx tsx src/components/office/sheets/wildcard.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';
import { excelWildcardToRegExp, hasWildcard, wildcardMatch } from './wildcard';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── SEARCH sin comodines sigue como antes (insensible a may., con inicio) ──
eq(ev('=SEARCH("o","hello world")'), 5, 'literal: primera o');
eq(ev('=SEARCH("o","hello world",6)'), 8, 'literal con inicio');
eq(ev('=SEARCH("WORLD","hello world")'), 7, 'insensible a mayúsculas');
eq(ev('=SEARCH("z","abc")'), '#VALUE!', 'no encontrado → #VALUE!');

// ── Comodines (lo nuevo) ──
eq(ev('=SEARCH("b?d","abcd")'), 2, '? = un carácter');
eq(ev('=SEARCH("a*d","xabcd")'), 2, '* = secuencia');
eq(ev('=SEARCH("c*","abcde")'), 3, '* al final');
eq(ev('=SEARCH("?b","aXb")'), 2, '?b casa «Xb» en pos 2');
eq(ev('=SEARCH("??x","ax")'), '#VALUE!', '?? exige dos caracteres antes de x');
eq(ev('=SEARCH("a?c","abc")'), 1, '? casa con b');
eq(ev('=ISNUMBER(SEARCH("x?z","xyz"))'), true, 'ISNUMBER de coincidencia');
eq(ev('=SEARCH("h*o","hello")'), 1, '* intermedio greedy');

// ── Escapes con ~ ──
eq(ev('=SEARCH("~?","ab?c")'), 3, '~? = literal ?');
eq(ev('=SEARCH("~*","a*b")'), 2, '~* = literal *');
eq(ev('=SEARCH("~~","a~b")'), 2, '~~ = literal ~');
eq(ev('=SEARCH("?","abc")'), 1, '? sin escape casa el primer carácter');

// ── Inicio inválido ──
eq(ev('=SEARCH("a","abc",0)'), '#VALUE!', 'inicio 0 → #VALUE!');
eq(ev('=SEARCH("a","abc",10)'), '#VALUE!', 'inicio > longitud → #VALUE!');

// ── Núcleo expuesto (para reutilizar en COUNTIF/MATCH) ──
eq(hasWildcard('ap*'), true, 'hasWildcard con *');
eq(hasWildcard('a~*b'), false, 'hasWildcard ignora * escapado');
eq(hasWildcard('plain'), false, 'hasWildcard sin comodín');
eq(wildcardMatch('apple', 'ap*'), true, 'wildcardMatch ap* casa apple');
eq(wildcardMatch('apple', 'AP*'), true, 'wildcardMatch insensible a may.');
eq(wildcardMatch('banana', 'ap*'), false, 'wildcardMatch no casa banana');
eq(wildcardMatch('cat', 'c?t'), true, 'wildcardMatch c?t casa cat');
eq(wildcardMatch('coat', 'c?t'), false, 'wildcardMatch anclado (no parcial)');
eq(excelWildcardToRegExp('a.b').test('axb'), false, 'literal . no es comodín');
eq(excelWildcardToRegExp('a.b').test('a.b'), true, 'literal . casa punto real');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
