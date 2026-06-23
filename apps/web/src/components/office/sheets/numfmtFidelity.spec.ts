/* eslint-disable @typescript-eslint/no-explicit-any */
/** Fidelidad de formato de número (científico/fracción). npx tsx src/components/office/sheets/numfmtFidelity.spec.ts */
import { formatNumber } from '@/lib/office/sheetOps';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (String(a) === String(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// ── Científico: dígitos de exponente según el patrón ──
eq(formatNumber(1234.567, '0.0e+0'), '1.2E+3', 'e+0 → 1 dígito de exponente');
eq(formatNumber(1234.567, '0.00E+00'), '1.23E+03', 'E+00 → 2 dígitos (sin regresión)');
eq(formatNumber(1234.567, '0.0E+000'), '1.2E+003', 'E+000 → 3 dígitos');
eq(formatNumber(0.0001234, '0.00E+00'), '1.23E-04', 'exponente negativo');
eq(formatNumber(5, '0.0E+0'), '5.0E+0', 'magnitud 0');
eq(formatNumber(1e10, '0.0E+0'), '1.0E+10', 'exponente de 2 dígitos cabe aunque el patrón pida 1');

// ── Fracción: espacio del hueco de entero cuando la parte entera es 0 ──
eq(formatNumber(0.5, '# ?/?'), ' 1/2', '# ?/? con 0.5 → espacio + 1/2');
eq(formatNumber(0.125, '# ??/??'), ' 1/8', '# ??/?? con 0.125 → espacio + 1/8');
eq(formatNumber(2.5, '# ?/?'), '2 1/2', 'parte entera presente (sin regresión)');
eq(formatNumber(0.5, '?/?'), '1/2', '?/? sin hueco de entero → sin espacio');
eq(formatNumber(0.75, '# ?/?'), ' 3/4', 'otra fracción < 1');
eq(formatNumber(3, '# ?/?'), '3', 'entero exacto');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
