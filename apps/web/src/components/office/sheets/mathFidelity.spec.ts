/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de fidelidad matemática (LOG/CEILING/FLOOR con argumento opcional por defecto):
 *   cd apps/web && npx tsx src/components/office/sheets/mathFidelity.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string) => { if (typeof a === 'number' && Math.abs(a - b) < 1e-9) passed++; else fails.push(`${m} — esp ${b}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
parser.on('callCellValue', (_c: any, _o: any, d: any) => d(0));
parser.on('callRangeValue', (_s: any, _e: any, _o: any, d: any) => d([[0]]));
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── LOG: base 10 por defecto, base explícita intacta ─────────────────────────────
approx(ev('=LOG(100)'), 2, 'LOG(100) = 2 (base 10 por defecto)');
approx(ev('=LOG(1000)'), 3, 'LOG(1000) = 3');
approx(ev('=LOG(8,2)'), 3, 'LOG(8,2) = 3 (base explícita intacta)');
approx(ev('=LOG(1)'), 0, 'LOG(1) = 0');
approx(ev('=LOG(2.5,2.5)'), 1, 'LOG(x,x) = 1');

// ── CEILING: cifra 1 por defecto, cifra explícita intacta ────────────────────────
approx(ev('=CEILING(4.3)'), 5, 'CEILING(4.3) = 5 (cifra 1 por defecto)');
approx(ev('=CEILING(4.0)'), 4, 'CEILING(4.0) = 4 (ya es entero)');
approx(ev('=CEILING(6.7,2)'), 8, 'CEILING(6.7,2) = 8 (cifra explícita intacta)');
approx(ev('=CEILING(2.5,1)'), 3, 'CEILING(2.5,1) = 3');

// ── FLOOR: cifra 1 por defecto, cifra explícita intacta ──────────────────────────
approx(ev('=FLOOR(4.7)'), 4, 'FLOOR(4.7) = 4 (cifra 1 por defecto)');
approx(ev('=FLOOR(4.0)'), 4, 'FLOOR(4.0) = 4');
approx(ev('=FLOOR(7,3)'), 6, 'FLOOR(7,3) = 6 (cifra explícita intacta)');
approx(ev('=FLOOR(2.9,1)'), 2, 'FLOOR(2.9,1) = 2');

// ── Composición ──────────────────────────────────────────────────────────────────
approx(ev('=CEILING(SUM(1.1,1.1,1.1))'), 4, 'CEILING compone con SUM (3.3 → 4)');
approx(ev('=LOG(POWER(10,5))'), 5, 'LOG(10^5) = 5');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ mathFidelity: ${passed}/${total} aserciones verdes.`);
