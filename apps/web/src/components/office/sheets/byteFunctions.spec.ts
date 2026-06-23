/* eslint-disable @typescript-eslint/no-explicit-any */
/** Funciones de texto por bytes. npx tsx src/components/office/sheets/byteFunctions.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// En locale de un solo byte, cada *B equivale a su versión por carácter.
eq(ev('=LENB("hello")'), 5, 'LENB = LEN');
eq(ev('=LENB("")'), 0, 'LENB vacío');
eq(ev('=LEFTB("hello",2)'), 'he', 'LEFTB = LEFT');
eq(ev('=LEFTB("hello")'), 'h', 'LEFTB sin n → 1');
eq(ev('=RIGHTB("hello",2)'), 'lo', 'RIGHTB = RIGHT');
eq(ev('=MIDB("hello",2,3)'), 'ell', 'MIDB = MID');
eq(ev('=REPLACEB("hello",2,3,"XYZ")'), 'hXYZo', 'REPLACEB = REPLACE');
eq(ev('=FINDB("l","hello")'), 3, 'FINDB = FIND (sensible a may.)');
eq(ev('=FINDB("L","hello")'), 'ERR:#VALUE!', 'FINDB no encuentra → #VALUE!');
eq(ev('=SEARCHB("L","hello")'), 3, 'SEARCHB = SEARCH (insensible a may.)');
eq(ev('=SEARCHB("ELL","hello")'), 2, 'SEARCHB subcadena (insensible a may.)');

// Coherencia: *B y su versión por carácter dan lo mismo.
eq(ev('=LEFTB("Axos",3)=LEFT("Axos",3)'), 'true', 'LEFTB ≡ LEFT');
eq(ev('=LENB("Documentos")=LEN("Documentos")'), 'true', 'LENB ≡ LEN');

// Anidamiento típico (validación de longitud de campo).
eq(ev('=IF(LENB(A1)>10,"largo","ok")'), 'ok', 'LENB en IF sobre celda vacía');
eq(ev('=MIDB("abcdef",FINDB("c","abcdef"),2)'), 'cd', 'composición MIDB+FINDB');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
