/* eslint-disable @typescript-eslint/no-explicit-any */
/** Fidelidad de CONVERT con temperaturas. npx tsx src/components/office/sheets/convertTemp.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-6) passed++; else fails.push(`${m} — esp ${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// Temperatura (antes daba #VALUE!).
approx(ev('=CONVERT(100,"C","F")'), 212, 'C→F');
approx(ev('=CONVERT(212,"F","C")'), 100, 'F→C');
approx(ev('=CONVERT(0,"C","K")'), 273.15, 'C→K');
approx(ev('=CONVERT(273.15,"K","C")'), 0, 'K→C');
approx(ev('=CONVERT(32,"F","K")'), 273.15, 'F→K');
approx(ev('=CONVERT(100,"C","C")'), 100, 'misma unidad');
approx(ev('=CONVERT(0,"cel","fah")'), 32, 'alias en minúscula cel→fah');
approx(ev('=CONVERT(-40,"C","F")'), -40, '−40 coincide en ambas escalas');

// Conversiones NO de temperatura: se delegan a formulajs (siguen correctas).
approx(ev('=CONVERT(1,"lbm","kg")'), 0.45359237, 'masa lbm→kg (delegado)');
approx(ev('=ROUND(CONVERT(1,"m","ft"),5)'), 3.28084, 'longitud m→ft (delegado)');
approx(ev('=CONVERT(1,"hr","mn")'), 60, 'tiempo hora→minuto (delegado)');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total}:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ convertTemp: ${passed}/${total} aserciones verdes.`);
