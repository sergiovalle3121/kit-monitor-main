/* eslint-disable @typescript-eslint/no-explicit-any */
/** Fidelidad de DEC2HEX (mayúsculas). npx tsx src/components/office/sheets/hexFidelity.spec.ts */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// Excel devuelve el hexadecimal en MAYÚSCULAS.
eq(ev('=DEC2HEX(31)'), '1F', 'DEC2HEX(31) = 1F');
eq(ev('=DEC2HEX(26)'), '1A', 'DEC2HEX(26) = 1A');
eq(ev('=DEC2HEX(255,4)'), '00FF', 'con relleno de ceros (places)');
eq(ev('=DEC2HEX(-1)'), 'FFFFFFFFFF', 'negativo en complemento a dos (10 dígitos)');
eq(ev('=DEC2HEX(0)'), '0', 'cero');
eq(ev('=DEC2HEX(2748)'), 'ABC', 'todas las letras en mayúsculas');
// Sin letras → idéntico (no se altera).
eq(ev('=DEC2HEX(16)'), '10', 'sin letras, intacto');
// Roundtrip: HEX2DEC acepta el resultado en mayúsculas.
eq(ev('=HEX2DEC(DEC2HEX(123))'), 123, 'roundtrip DEC2HEX→HEX2DEC');

// BIN2HEX y OCT2HEX también en mayúsculas (mismo defecto que DEC2HEX).
eq(ev('=BIN2HEX(11111111)'), 'FF', 'BIN2HEX(11111111) = FF');
eq(ev('=BIN2HEX(1111,4)'), '000F', 'BIN2HEX con relleno');
eq(ev('=BIN2HEX(10)'), '2', 'BIN2HEX sin letras, intacto');
eq(ev('=OCT2HEX(777)'), '1FF', 'OCT2HEX(777) = 1FF');
eq(ev('=OCT2HEX(10)'), '8', 'OCT2HEX(10) = 8');
eq(ev('=HEX2DEC(BIN2HEX(11111111))'), 255, 'roundtrip BIN2HEX→HEX2DEC');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total}:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ hexFidelity: ${passed}/${total} aserciones verdes.`);
