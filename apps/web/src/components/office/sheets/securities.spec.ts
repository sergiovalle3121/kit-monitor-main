/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de valores con descuento (DISC/PRICEDISC/…), vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/securities.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string, tol = 1e-4) => { if (typeof a === 'number' && Math.abs(a - b) < tol) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
parser.on('callCellValue', (_c: any, _o: any, d: any) => d(0));
parser.on('callRangeValue', (_s: any, _e: any, _o: any, d: any) => d([[0]]));
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// Jan 1 → Jul 1 2024: fracción 30/360 = 0.5 (base por defecto).
approx(ev('=DISC("2024-01-01","2024-07-01",95,100)'), 0.1, 'DISC tasa de descuento');
approx(ev('=PRICEDISC("2024-01-01","2024-07-01",0.05,100)'), 97.5, 'PRICEDISC precio');
approx(ev('=YIELDDISC("2024-01-01","2024-07-01",95,100)'), 0.105263, 'YIELDDISC rendimiento');
approx(ev('=INTRATE("2024-01-01","2024-07-01",95,100)'), 0.105263, 'INTRATE tasa');
approx(ev('=RECEIVED("2024-01-01","2024-07-01",95,0.05)'), 97.435897, 'RECEIVED importe al vencimiento');
approx(ev('=ACCRINTM("2024-01-01","2024-07-01",0.05,1000)'), 25, 'ACCRINTM interés acumulado');

// Distintas bases de cómputo (act/365 → 182/365; act/360 → 182/360).
approx(ev('=ACCRINTM("2024-01-01","2024-07-01",0.05,1000,3)'), 1000 * 0.05 * 182 / 365, 'ACCRINTM base act/365');
approx(ev('=ACCRINTM("2024-01-01","2024-07-01",0.05,1000,2)'), 1000 * 0.05 * 182 / 360, 'ACCRINTM base act/360');
// Base europea 30/360 (4): Jan 1 → Jul 1 también 180/360 = 0.5.
approx(ev('=PRICEDISC("2024-01-01","2024-07-01",0.05,100,4)'), 97.5, 'PRICEDISC base europea');

// Errores de dominio.
eq(ev('=DISC("2024-07-01","2024-01-01",95,100)'), '#NUM!', 'liquidación ≥ vencimiento → #NUM!');
eq(ev('=IFERROR(DISC("2024-07-01","2024-01-01",95,100),-1)'), -1, 'IFERROR captura el #NUM!');
eq(ev('=ROUND(PRICEDISC("2024-01-01","2024-07-01",0.05,100),2)'), 97.5, 'PRICEDISC compone con ROUND');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ securities: ${passed}/${total} aserciones verdes.`);
