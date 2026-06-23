/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de bonos con cupón (PRICE/YIELD/DURATION/COUP*), contra los ejemplos DOCUMENTADOS por
 * Microsoft, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/bonds.spec.ts
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
const evDate = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.result instanceof Date ? r.result.toISOString().slice(0, 10) : (r.error ? `ERR:${r.error}` : r.result); };

// ── Ejemplos documentados por Microsoft ──────────────────────────────────────────
approx(ev('=PRICE("2008-02-15","2017-11-15",0.0575,0.065,100,2,0)'), 94.63436, 'PRICE = 94.63436');
approx(ev('=YIELD("2008-02-15","2016-11-15",0.0575,95.04287,100,2,0)'), 0.065, 'YIELD = 0.065', 1e-5);
approx(ev('=DURATION("2008-01-01","2016-01-01",0.08,0.09,2,1)'), 5.993775, 'DURATION = 5.993775');
approx(ev('=MDURATION("2008-01-01","2016-01-01",0.08,0.09,2,1)'), 5.735675, 'MDURATION = 5.73567', 1e-3);
eq(ev('=COUPNUM("2007-01-25","2008-11-15",2,1)'), 4, 'COUPNUM = 4');
eq(ev('=COUPDAYS("2007-01-25","2008-11-15",2,1)'), 181, 'COUPDAYS = 181');
eq(ev('=COUPDAYBS("2007-01-25","2008-11-15",2,1)'), 71, 'COUPDAYBS = 71');
eq(ev('=COUPDAYSNC("2007-01-25","2008-11-15",2,1)'), 110, 'COUPDAYSNC = 110');
eq(evDate('=COUPNCD("2007-01-25","2008-11-15",2,1)'), '2007-05-15', 'COUPNCD = 2007-05-15');
eq(evDate('=COUPPCD("2007-01-25","2008-11-15",2,1)'), '2006-11-15', 'COUPPCD = 2006-11-15');

// ── Coherencia interna: PRICE↔YIELD son inversas ─────────────────────────────────
{
  const pr = ev('=PRICE("2020-01-01","2030-01-01",0.04,0.05,100,2,0)') as number;
  approx(ev(`=YIELD("2020-01-01","2030-01-01",0.04,${pr},100,2,0)`), 0.05, 'YIELD invierte a PRICE');
}
// A la par (cupón = rendimiento) el precio es 100.
approx(ev('=PRICE("2020-01-01","2030-01-01",0.05,0.05,100,2,0)'), 100, 'cupón=rendimiento → precio 100', 1e-3);
// MDURATION < DURATION.
{
  const d = ev('=DURATION("2020-01-01","2030-01-01",0.05,0.06,2,0)') as number;
  const md = ev('=MDURATION("2020-01-01","2030-01-01",0.05,0.06,2,0)') as number;
  eq(md < d && md > 0, true, 'MDURATION < DURATION');
}
// Errores de dominio.
eq(ev('=PRICE("2020-01-01","2010-01-01",0.05,0.06,100,2)'), '#NUM!', 'liquidación ≥ vencimiento → #NUM!');
eq(ev('=COUPNUM("2020-01-01","2030-01-01",3)'), '#NUM!', 'frecuencia inválida → #NUM!');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ bonds: ${passed}/${total} aserciones verdes.`);
