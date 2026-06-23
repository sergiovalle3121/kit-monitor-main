/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de χ²/F/t (colas e inversas) contra valores críticos conocidos, vía el motor REAL:
 *   cd apps/web && npx tsx src/components/office/sheets/distributions.spec.ts
 */
import * as FP from '@fortune-sheet/formula-parser';
import { installFormulaEngine } from './formulaEngine';

installFormulaEngine();
let passed = 0; const fails: string[] = [];
const approx = (a: any, b: number, m: string, tol = 1e-3) => { if (typeof a === 'number' && Math.abs(a - b) < tol) passed++; else fails.push(`${m} — esp ≈${b}, obt ${JSON.stringify(a)}`); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const Parser: any = (FP as any).Parser;
const parser = new Parser();
parser.on('callCellValue', (_c: any, _o: any, d: any) => d(0));
parser.on('callRangeValue', (_s: any, _e: any, _o: any, d: any) => d([[0]]));
const ev = (f: string) => { const r = parser.parse(f.replace(/^=/, '')); return r.error ? `ERR:${r.error}` : r.result; };

// ── χ² (valor crítico clásico: χ²₀.₀₅,₁ = 3.841) ─────────────────────────────────
approx(ev('=CHISQ.DIST.RT(3.841,1)'), 0.05, 'CHISQ.DIST.RT(3.841,1)');
approx(ev('=CHISQ.INV.RT(0.05,1)'), 3.841, 'CHISQ.INV.RT(0.05,1)');
approx(ev('=CHISQ.DIST(3.841,1,TRUE)'), 0.95, 'CHISQ.DIST acumulada');
approx(ev('=CHISQ.INV(0.95,1)'), 3.841, 'CHISQ.INV (cola izq)');
approx(ev('=CHISQ.DIST.RT(11.0705,5)'), 0.05, 'CHISQ.DIST.RT con 5 g.l.');
approx(ev('=CHIINV(0.05,1)'), 3.841, 'CHIINV legado corregido');
eq(ev('=CHISQ.DIST.RT(-1,1)'), '#NUM!', 'CHISQ.DIST.RT con x<0 → #NUM!');

// ── F (FINV(0.05,3,4) = 6.591) ───────────────────────────────────────────────────
approx(ev('=F.INV.RT(0.05,3,4)'), 6.5914, 'F.INV.RT(0.05,3,4)');
approx(ev('=F.DIST.RT(6.5914,3,4)'), 0.05, 'F.DIST.RT(6.5914,3,4)');
approx(ev('=F.DIST(6.5914,3,4,TRUE)'), 0.95, 'F.DIST acumulada');
approx(ev('=FINV(0.05,3,4)'), 6.5914, 'FINV legado corregido');

// ── t de Student (t₀.₀₂₅,₁₀ = 2.228) ─────────────────────────────────────────────
approx(ev('=T.DIST.2T(2.2281,10)'), 0.05, 'T.DIST.2T(2.228,10)');
approx(ev('=T.INV.2T(0.05,10)'), 2.2281, 'T.INV.2T(0.05,10)');
approx(ev('=T.DIST.RT(1.8125,10)'), 0.05, 'T.DIST.RT(1.812,10)');
approx(ev('=T.DIST(2,5,TRUE)'), 0.949, 'T.DIST acumulada');
approx(ev('=T.INV(0.95,10)'), 1.8125, 'T.INV (cola izq)');
approx(ev('=TINV(0.05,10)'), 2.2281, 'TINV legado corregido (2 colas)');
eq(ev('=T.DIST.2T(-1,10)'), '#NUM!', 'T.DIST.2T con t<0 → #NUM!');

// ── Gamma / Beta ─────────────────────────────────────────────────────────────────
approx(ev('=GAMMA.DIST(10,9,2,TRUE)'), 0.0680936, 'GAMMA.DIST acumulada');
approx(ev('=GAMMA.INV(0.5,9,2)'), 17.3380, 'GAMMA.INV (mediana)', 1e-2);
approx(ev('=GAMMADIST(10,9,2,TRUE)'), 0.0680936, 'GAMMADIST legado');
approx(ev('=GAMMALN.PRECISE(5)'), 3.178054, 'GAMMALN.PRECISE(5) = ln(24)');
approx(ev('=BETA.DIST(0.4,2,3,TRUE)'), 0.52480, 'BETA.DIST acumulada');
approx(ev('=BETA.DIST(5,2,3,TRUE,0,10)'), 0.6875, 'BETA.DIST con escalado [0,10]');
approx(ev('=BETA.INV(0.5,2,3)'), 0.385728, 'BETA.INV (mediana)', 1e-4);

// ── Discretas ────────────────────────────────────────────────────────────────────
approx(ev('=HYPGEOM.DIST(1,4,4,10,FALSE)'), 0.380952, 'HYPGEOM.DIST puntual');
approx(ev('=HYPGEOM.DIST(1,4,4,10,TRUE)'), 0.452381, 'HYPGEOM.DIST acumulada');
approx(ev('=NEGBINOM.DIST(5,3,0.5,FALSE)'), 0.082031, 'NEGBINOM.DIST puntual');
approx(ev('=PERCENTRANK.EXC({10,20,30},20)'), 0.5, 'PERCENTRANK.EXC posición exclusiva');

// ── Composición ──────────────────────────────────────────────────────────────────
eq(ev('=ROUND(CHISQ.INV.RT(0.05,1),2)'), 3.84, 'CHISQ.INV.RT compone con ROUND');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ distributions: ${passed}/${total} aserciones verdes.`);
