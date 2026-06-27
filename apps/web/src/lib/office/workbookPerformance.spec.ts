/* eslint-disable @typescript-eslint/no-explicit-any */
import { estimateWorkbookStats, shouldEmitWorkbook, stableWorkbookString, workbookPerformanceLabel, workbookSignature } from './workbookPerformance';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const content = {
  sheets: [{
    name: 'Hoja 1',
    celldata: [
      { r: 0, c: 0, v: { v: 1, m: '1', ct: { fa: 'General', t: 'n' } } },
      { r: 0, c: 1, v: { v: 2, m: '2', f: '=A1*2', bg: '#ecfdf5' } },
      { r: 1, c: 0, v: 'texto' },
    ],
    dataVerification: { '0_0': { type: 'required' }, '0_1': { type: 'custom_formula', value1: '=VALUE>0' } },
  }],
  charts: [{ id: 'c1' }],
  pivots: [{ id: 'p1' }],
  comments: [{ id: 'm1' }],
  connectors: [{ id: 'x1' }],
};

{
  const a = stableWorkbookString({ b: 1, a: { z: 2, y: 3 } });
  const b = stableWorkbookString({ a: { y: 3, z: 2 }, b: 1 });
  eq(a, b, 'stableWorkbookString ordena claves de forma determinística');
  eq(workbookSignature({ b: 1, a: 2 }), workbookSignature({ a: 2, b: 1 }), 'signature ignora orden de claves');
}

{
  const state: { signature?: string } = {};
  ok(shouldEmitWorkbook(content, state), 'primer payload debe emitirse');
  ok(!shouldEmitWorkbook(JSON.parse(JSON.stringify(content)), state), 'payload idéntico no debe emitirse dos veces');
  const changed = JSON.parse(JSON.stringify(content));
  changed.sheets[0].celldata[0].v.v = 42;
  ok(shouldEmitWorkbook(changed, state), 'payload cambiado debe emitirse');
}

{
  const stats = estimateWorkbookStats(content);
  eq(stats.sheets, 1, 'cuenta hojas');
  eq(stats.cells, 3, 'cuenta celdas');
  eq(stats.formulas, 1, 'cuenta fórmulas');
  eq(stats.styledCells, 2, 'cuenta celdas con estilo/formato');
  eq(stats.validations, 2, 'cuenta validaciones');
  eq(stats.comments, 1, 'cuenta comentarios');
  eq(stats.charts, 1, 'cuenta charts');
  eq(stats.pivots, 1, 'cuenta pivots');
  eq(stats.connectors, 1, 'cuenta conectores');
  eq(workbookPerformanceLabel(stats), 'small', 'workbook pequeño');
  eq(workbookPerformanceLabel({ ...stats, cells: 5_000 }), 'medium', 'umbral medium por celdas');
  eq(workbookPerformanceLabel({ ...stats, cells: 25_000 }), 'large', 'umbral large por celdas');
  eq(workbookPerformanceLabel({ ...stats, cells: 100_000 }), 'industrial', 'umbral industrial por celdas');
}


const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
