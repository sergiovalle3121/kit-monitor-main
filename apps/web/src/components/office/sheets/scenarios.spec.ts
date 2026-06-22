/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría del Administrador de escenarios — PURA:
 *   cd apps/web && npx tsx src/components/office/sheets/scenarios.spec.ts
 */
import { parseChanges, applyScenario, scenarioSummary, type Scenario } from './scenarios';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// Hoja: A1, A2 entradas; B1 = A1+A2 (fórmula); B2 = A1*A2 (fórmula).
function sheet(): any {
  return { celldata: [
    { r: 0, c: 0, v: { v: 1, m: '1' } },           // A1
    { r: 1, c: 0, v: { v: 1, m: '1' } },           // A2
    { r: 0, c: 1, v: { f: '=A1+A2', v: 0, m: '0' } }, // B1
    { r: 1, c: 1, v: { f: '=A1*A2', v: 0, m: '0' } }, // B2
  ] };
}
const valAt = (s: any, r: number, c: number) => { const cd = s.celldata.find((x: any) => x.r === r && x.c === c); return cd?.v?.v ?? cd?.v; };

// ── parseChanges ──────────────────────────────────────────────────────────────
eq(parseChanges('A1=100, B2=-5'), [{ cell: 'A1', value: 100 }, { cell: 'B2', value: -5 }], 'parsea asignaciones');
eq(parseChanges('a1=3.5\nb2 = 2'), [{ cell: 'A1', value: 3.5 }, { cell: 'B2', value: 2 }], 'tolera minúsculas, decimales y saltos');
eq(parseChanges('basura, A1=1, =2'), [{ cell: 'A1', value: 1 }], 'ignora pares mal formados');

// ── applyScenario ─────────────────────────────────────────────────────────────
{
  const s = sheet();
  applyScenario(s, { name: 'Alto', changes: [{ cell: 'A1', value: 10 }, { cell: 'A2', value: 5 }] });
  eq(valAt(s, 0, 0), 10, 'aplica A1=10');
  eq(valAt(s, 1, 0), 5, 'aplica A2=5');
}

// ── scenarioSummary ───────────────────────────────────────────────────────────
{
  const scns: Scenario[] = [
    { name: 'Base', changes: [{ cell: 'A1', value: 2 }, { cell: 'A2', value: 3 }] },
    { name: 'Optimista', changes: [{ cell: 'A1', value: 10 }, { cell: 'A2', value: 10 }] },
  ];
  const sum = scenarioSummary(sheet(), scns, ['B1', 'B2']);
  eq(sum.headers, ['Base', 'Optimista'], 'cabeceras = nombres de escenario');
  eq(sum.rows[0], { cell: 'B1', values: [5, 20] }, 'B1 (suma) bajo cada escenario');
  eq(sum.rows[1], { cell: 'B2', values: [6, 100] }, 'B2 (producto) bajo cada escenario');
  // No muta la hoja base.
  ok(valAt(sheet(), 0, 0) === 1, 'el resumen no muta la hoja base');
}

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ scenarios: ${passed}/${total} aserciones verdes.`);
