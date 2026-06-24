/* eslint-disable @typescript-eslint/no-explicit-any */
/** Familia de criterios con comodines. npx tsx src/components/office/sheets/criteriaIf.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { const ok = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : String(a) === String(b); if (ok) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── COUNTIF: comodines (lo roto) ──
eq(ev('=COUNTIF({"apple","apricot","banana"},"ap*")'), 2, 'COUNTIF ap*');
eq(ev('=COUNTIF({"a","ab","abc"},"a*")'), 3, 'COUNTIF a* (todas)');
eq(ev('=COUNTIF({"cat","cot","cut"},"c?t")'), 3, 'COUNTIF c?t');
eq(ev('=COUNTIF({"cat","coat"},"c?t")'), 1, 'COUNTIF c?t anclado (coat no)');
eq(ev('=COUNTIF({"a?b","axb"},"a~?b")'), 1, 'COUNTIF con ~? literal');
// ── COUNTIF: operadores (no debe romperse) ──
eq(ev('=COUNTIF({1,2,3,4,5},">3")'), 2, 'COUNTIF >3');
eq(ev('=COUNTIF({1,2,3,4,5},"<=2")'), 2, 'COUNTIF <=2');
eq(ev('=COUNTIF({1,2,3},"<>2")'), 2, 'COUNTIF <>2');
eq(ev('=COUNTIF({5,5,6},5)'), 2, 'COUNTIF número exacto');
eq(ev('=COUNTIF({"x","","y"},"")'), 1, 'COUNTIF vacío');
eq(ev('=COUNTIF({"x","","y"},"<>")'), 2, 'COUNTIF no vacío');
eq(ev('=COUNTIF({"Apple","apple"},"apple")'), 2, 'COUNTIF insensible a may.');

// ── SUMIF ──
eq(ev('=SUMIF({"a","ab","b"},"a*",{1,2,3})'), 3, 'SUMIF a* → 1+2');
eq(ev('=SUMIF({1,2,3,4},">2")'), 7, 'SUMIF sin rango de suma (>2 → 3+4)');
eq(ev('=SUMIF({"x","y","x"},"x",{10,20,30})'), 40, 'SUMIF texto exacto');

// ── AVERAGEIF ──
eq(ev('=AVERAGEIF({"x","xy","z"},"x*",{10,20,99})'), 15, 'AVERAGEIF x* → (10+20)/2');
eq(ev('=AVERAGEIF({1,2,3},">5")'), '#DIV/0!', 'AVERAGEIF sin coincidencias → #DIV/0!');

// ── COUNTIFS / SUMIFS / AVERAGEIFS (AND multi-criterio) ──
eq(ev('=COUNTIFS({"a","ab","b"},"a*",{1,2,3},">1")'), 1, 'COUNTIFS ap* Y >1 → solo "ab"');
eq(ev('=SUMIFS({10,20,30},{"a","ab","b"},"a*",{1,2,3},">1")'), 20, 'SUMIFS suma sólo "ab"');
eq(ev('=AVERAGEIFS({10,20,30},{"a","a","b"},"a")'), 15, 'AVERAGEIFS a → (10+20)/2');

// ── MAXIFS / MINIFS ──
eq(ev('=MAXIFS({5,9,2},{"a","a","b"},"a")'), 9, 'MAXIFS sobre grupo a');
eq(ev('=MINIFS({5,9,2},{"a","a","b"},"a")'), 5, 'MINIFS sobre grupo a');
eq(ev('=MAXIFS({5,9,2},{"x","y","z"},"q")'), 0, 'MAXIFS sin coincidencias → 0');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
