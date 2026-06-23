/* eslint-disable @typescript-eslint/no-explicit-any */
/** Fidelidad de PROPER. npx tsx src/components/office/sheets/properFidelity.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// Básico: primera letra de cada palabra en mayúscula, resto en minúscula.
eq(ev('=PROPER("hello WORLD")'), 'Hello World', 'multi-palabra baja el resto');
eq(ev('=PROPER("HELLO")'), 'Hello', 'todo mayúsculas → Tipo título');
eq(ev('=PROPER("john smith")'), 'John Smith', 'nombres');

// El quid: mayúscula DESPUÉS de un apóstrofo (Excel lo hace).
eq(ev('=PROPER("o\'brien")'), "O'Brien", "apóstrofo: O'Brien");
eq(ev('=PROPER("o\'brien mcdonald")'), "O'Brien Mcdonald", "apóstrofo + palabra normal");
eq(ev('=PROPER("they\'re here")'), "They'Re Here", "quirk Excel: They'Re");

// Mayúscula tras un dígito y tras un guion.
eq(ev('=PROPER("abc2def")'), 'Abc2Def', 'mayúscula tras dígito');
eq(ev('=PROPER("mary-jane")'), 'Mary-Jane', 'mayúscula tras guion');
eq(ev('=PROPER("a1b2c3")'), 'A1B2C3', 'letras sueltas entre dígitos');

// Acentos / ñ (Unicode-aware).
eq(ev('=PROPER("ángel muñoz")'), 'Ángel Muñoz', 'acentos y ñ');
eq(ev('=PROPER("JOSÉ")'), 'José', 'baja acentuadas');

// Bordes.
eq(ev('=PROPER("")'), '', 'cadena vacía');
eq(ev('=PROPER("123 main st")'), '123 Main St', 'empieza por dígito');
eq(ev('=PROPER("  spaced  out  ")'), '  Spaced  Out  ', 'espacios preservados');
eq(ev('=PROPER(PROPER("o\'brien"))'), "O'Brien", 'idempotente');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
