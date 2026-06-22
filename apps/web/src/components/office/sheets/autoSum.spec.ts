/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de Autosuma — PURA:
 *   cd apps/web && npx tsx src/components/office/sheets/autoSum.spec.ts
 */
import { autoSumPlan } from './autoSum';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// Columna A1:A5 → SUMA en A6.
{
  const p = autoSumPlan('A1:A5', 'SUM')!;
  eq(p.formula, '=SUM(A1:A5)', 'columna: fórmula');
  eq(p.targetCell, 'A6', 'columna: resultado debajo (A6)');
}
// Fila B2:E2 → PROMEDIO a la derecha en F2.
{
  const p = autoSumPlan('B2:E2', 'AVERAGE')!;
  eq(p.formula, '=AVERAGE(B2:E2)', 'fila: fórmula');
  eq(p.targetCell, 'F2', 'fila: resultado a la derecha (F2)');
}
// Bloque B2:D4 → debajo de la primera columna (B5).
{
  const p = autoSumPlan('B2:D4', 'MAX')!;
  eq(p.targetCell, 'B5', 'bloque: resultado debajo de la 1ª columna (B5)');
}
// Columna grande con otra letra: C1:C10 → C11.
{
  const p = autoSumPlan('C1:C10', 'COUNT')!;
  eq(p.targetCell, 'C11', 'columna larga: C11');
  eq(p.formula, '=COUNT(C1:C10)', 'COUNT');
}
// Columna que cruza el límite de letra: Z1:Z3 → Z4; AA1:AA2 → AA3.
{
  eq(autoSumPlan('Z1:Z3', 'SUM')!.targetCell, 'Z4', 'columna Z → Z4');
  eq(autoSumPlan('AA1:AA2', 'MIN')!.targetCell, 'AA3', 'columna AA → AA3');
}
// Rango inválido → null.
ok(autoSumPlan('xyz', 'SUM') === null, 'rango inválido → null');

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ autoSum: ${passed}/${total} aserciones verdes.`);
