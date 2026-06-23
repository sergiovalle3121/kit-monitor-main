/* eslint-disable @typescript-eslint/no-explicit-any */
/** Comodines en MATCH/VLOOKUP/HLOOKUP. npx tsx src/components/office/sheets/lookupWildcards.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── MATCH con comodines (tipo 0) ──
eq(ev('=MATCH("ap*",{"banana","apple","apricot"},0)'), 2, 'MATCH ap* → primer "apple"');
eq(ev('=MATCH("b?n*",{"banana","apple"},0)'), 1, 'MATCH b?n* → banana');
eq(ev('=MATCH("z*",{"a","b"},0)'), '#N/A', 'MATCH sin coincidencia → #N/A');
eq(ev('=MATCH("c?t",{"coat","cat"},0)'), 2, 'MATCH c?t anclado');
// ── MATCH sin comodín / numérico NO se rompe (delegado a formulajs) ──
eq(ev('=MATCH(2,{1,2,3},0)'), 2, 'MATCH numérico exacto');
eq(ev('=MATCH("apple",{"banana","apple"},0)'), 2, 'MATCH texto literal');
eq(ev('=MATCH(3,{1,2,3,4},1)'), 3, 'MATCH aproximado (tipo 1)');

// ── VLOOKUP con comodines (exacto) ──
eq(ev('=VLOOKUP("ap*",{"banana",10;"apple",20},2,FALSE)'), 20, 'VLOOKUP ap* → 20');
eq(ev('=VLOOKUP("z*",{"banana",10;"apple",20},2,FALSE)'), '#N/A', 'VLOOKUP sin coincidencia → #N/A');
eq(ev('=VLOOKUP("c?t",{"coat",1;"cat",2},2,FALSE)'), 2, 'VLOOKUP c?t');
// ── VLOOKUP normal NO se rompe ──
eq(ev('=VLOOKUP("apple",{"banana",10;"apple",20},2,FALSE)'), 20, 'VLOOKUP literal exacto');
eq(ev('=VLOOKUP(2,{1,"a";2,"b"},2,FALSE)'), 'b', 'VLOOKUP numérico exacto');

// ── HLOOKUP con comodines (exacto) ──
eq(ev('=HLOOKUP("ap*",{"banana","apple";10,20},2,FALSE)'), 20, 'HLOOKUP ap* → 20');
eq(ev('=HLOOKUP("z*",{"banana","apple";10,20},2,FALSE)'), '#N/A', 'HLOOKUP sin coincidencia → #N/A');
// ── HLOOKUP normal NO se rompe ──
eq(ev('=HLOOKUP(2,{1,2;"a","b"},2,FALSE)'), 'b', 'HLOOKUP numérico exacto');

// ── Combinación INDEX/MATCH con comodín ──
eq(ev('=INDEX({100,200,300},MATCH("c*",{"alfa","beta","charlie"},0))'), 300, 'INDEX/MATCH con comodín');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
