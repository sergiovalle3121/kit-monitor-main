/* eslint-disable @typescript-eslint/no-explicit-any */
/** XLOOKUP/XMATCH modos de coincidencia y búsqueda. npx tsx src/components/office/sheets/xlookupModes.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── Exacto (def.) sigue igual ──
eq(ev('=XLOOKUP("b",{"a";"b";"c"},{1;2;3})'), 2, 'XLOOKUP exacto');
eq(ev('=XMATCH("b",{"a","b","c"})'), 2, 'XMATCH exacto');
eq(ev('=XLOOKUP(99,{1;2;3},{1;2;3})'), '#N/A', 'no encontrado → #N/A');
eq(ev('=XLOOKUP(99,{1;2;3},{1;2;3},"NF")'), 'NF', 'no encontrado → ifNotFound');

// ── Aproximado -1 / 1 (ya existían, no se rompen) ──
eq(ev('=XLOOKUP(25,{10;20;30},{"a";"b";"c"},"NF",-1)'), 'b', 'modo -1: inferior próximo');
eq(ev('=XLOOKUP(25,{10;20;30},{"a";"b";"c"},"NF",1)'), 'c', 'modo 1: superior próximo');
eq(ev('=XMATCH(25,{10,20,30},-1)'), 2, 'XMATCH -1');
eq(ev('=XMATCH(25,{10,20,30},1)'), 3, 'XMATCH 1');

// ── Modo 2: comodín (lo NUEVO) ──
eq(ev('=XLOOKUP("ap*",{"banana";"apple"},{10;20},"NF",2)'), 20, 'XLOOKUP comodín → apple');
eq(ev('=XLOOKUP("c?t",{"coat";"cat"},{1;2},"NF",2)'), 2, 'XLOOKUP comodín c?t');
eq(ev('=XLOOKUP("z*",{"a";"b"},{1;2},"NF",2)'), 'NF', 'comodín sin match → ifNotFound');
eq(ev('=XMATCH("ap*",{"banana","apple"},2)'), 2, 'XMATCH comodín → 2');
eq(ev('=XMATCH("b?n*",{"banana","apple"},2)'), 1, 'XMATCH comodín → banana');

// ── search_mode -1: de fin a inicio (última coincidencia) ──
eq(ev('=XLOOKUP("x",{"x";"y";"x"},{1;2;3},"NF",0,-1)'), 3, 'XLOOKUP inverso → última x');
eq(ev('=XLOOKUP("x",{"x";"y";"x"},{1;2;3},"NF",0,1)'), 1, 'XLOOKUP directo → primera x');
eq(ev('=XMATCH("x",{"x","y","x"},0,-1)'), 3, 'XMATCH inverso → 3');
eq(ev('=XMATCH("x",{"x","y","x"},0,1)'), 1, 'XMATCH directo → 1');

// ── Combinación: comodín + inverso ──
eq(ev('=XMATCH("*a*",{"alfa","beta","gamma"},2,-1)'), 3, 'comodín + inverso → última que contiene a');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
