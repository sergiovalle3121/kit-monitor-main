/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  buildFormulaDependencyGraph,
  buildFormulaRecalculationDiagnostics,
  buildFormulaRecalculationPlan,
  formatFormulaDependencySummary,
  formatFormulaRecalculationDiagnostics,
} from './formulaDependencies';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: any, b: any, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);
const cell = (v: any, f?: string) => ({ v, m: String(v ?? ''), ...(f ? { f } : {}), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });

const workbook = { sheets: [
  { name: 'Main', celldata: [
    { r: 0, c: 0, v: cell(1) },
    { r: 0, c: 1, v: cell(2, '=A1+Rates!A1') },
    { r: 0, c: 2, v: cell(3, '=B1+Missing!A1') },
    { r: 1, c: 0, v: cell(4, '=A3') },
    { r: 2, c: 0, v: cell(5, '=A2') },
    { r: 1, c: 1, v: cell(6, '=SUM(B1:C1)') },
    { r: 2, c: 1, v: cell(7, '=HYPERLINK("https://example.com/A1", A1)') },
  ] },
  { name: 'Rates', celldata: [
    { r: 0, c: 0, v: cell(10, '=Main!A1') },
  ] },
] };

const graph = buildFormulaDependencyGraph(workbook);
eq(graph.nodes.map((node) => node.id), ['0!A2', '0!A3', '0!B1', '0!B2', '0!B3', '0!C1', '1!A1'], 'ordena nodos fórmula');
ok(graph.edges.some((edge) => edge.from === '0!C1' && edge.to === '0!B1'), 'detecta dependencia local');
ok(graph.edges.some((edge) => edge.from === '0!B1' && edge.to === '1!A1'), 'detecta dependencia entre hojas');
ok(graph.edges.some((edge) => edge.from === '0!B2' && edge.to === '0!B1'), 'expande rangos hacia fórmulas');
ok(graph.cycles.some((cycle) => cycle.includes('0!A2') && cycle.includes('0!A3')), 'detecta ciclo indirecto');
eq(graph.missingReferences, ['Missing!A1'], 'detecta hoja faltante');
ok(graph.externalReferences.length === 0, 'ignora URLs dentro de strings de fórmulas');
const blockedPlan = buildFormulaRecalculationPlan(graph);
ok(blockedPlan.ready === false, 'plan bloqueado por ciclo/referencia faltante');
ok(blockedPlan.blockedByCycles.includes('0!A2') && blockedPlan.blockedByCycles.includes('0!A3'), 'plan reporta fórmulas bloqueadas por ciclo');
ok(formatFormulaDependencySummary(graph).includes('bloqueado'), 'formatea resumen bloqueado');
const diagnostics = buildFormulaRecalculationDiagnostics(workbook);
eq(diagnostics.totalFormulas, 7, 'diagnostico cuenta formulas');
eq(diagnostics.cycleCount, 1, 'diagnostico cuenta ciclos');
ok(diagnostics.blockedCells.some((cell) => cell.label === 'Main!A2'), 'diagnostico lista celda bloqueada');
ok(diagnostics.warnings.some((warning) => warning.includes('hojas faltantes')), 'diagnostico advierte refs faltantes');
ok(formatFormulaRecalculationDiagnostics(diagnostics).includes('Plan de recalculo'), 'formatea diagnostico de recalculo');

const acyclic = buildFormulaDependencyGraph({ sheets: [{ name: 'Plan', celldata: [
  { r: 0, c: 0, v: cell(1) },
  { r: 0, c: 1, v: cell(2, '=A1') },
  { r: 0, c: 2, v: cell(3, '=B1+1') },
] }] });
const readyPlan = buildFormulaRecalculationPlan(acyclic);
eq(readyPlan.order, ['0!B1', '0!C1'], 'plan recalcula dependencias antes de dependientes');
ok(readyPlan.ready === true && readyPlan.blockedByCycles.length === 0, 'plan listo sin ciclos ni faltantes');
const readyDiagnostics = buildFormulaRecalculationDiagnostics({ sheets: [{ name: 'Plan', celldata: [
  { r: 0, c: 0, v: cell(1) },
  { r: 0, c: 1, v: cell(2, '=A1') },
  { r: 0, c: 2, v: cell(3, '=B1+1') },
] }] });
ok(readyDiagnostics.ready && readyDiagnostics.orderedCells.map((item) => item.label).join(',') === 'Plan!B1,Plan!C1', 'diagnostico listo ordena labels');
ok(readyDiagnostics.warnings.some((warning) => warning.includes('listo')), 'diagnostico listo emite warning positivo');

const externalWorkbook = buildFormulaDependencyGraph({ sheets: [{ name: 'Main', celldata: [
  { r: 0, c: 0, v: cell(1, '=[Budget.xlsx]Ops!B2+1') },
] }] });
eq(externalWorkbook.externalReferences, ['[Budget.xlsx]Ops!B2'], 'detecta referencia externa de workbook');
eq(externalWorkbook.missingReferences, [], 'no trata referencia externa como hoja faltante local');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${total}`);
