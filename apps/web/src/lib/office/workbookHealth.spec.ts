/* eslint-disable @typescript-eslint/no-explicit-any */
import { analyzeWorkbookHealth, formatWorkbookHealthReport } from './workbookHealth';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const report = analyzeWorkbookHealth({
  sheets: [{ name: 'Ops', celldata: [
    { r: 0, c: 0, v: { f: '=AXOS_UNKNOWN(A1)', v: '#NAME?' } },
    { r: 1, c: 0, v: { f: '=VLOOKUP(A1,[Book.xlsx]S!A:B,2,FALSE)', v: 1 } },
    { r: 2, c: 0, v: { f: '=NOW()', v: 1 } },
    { r: 3, c: 0, v: { f: '=Missing!A1', v: '#REF!' } },
    { r: 4, c: 0, v: { f: '=B1/0', v: '#DIV/0!' } },
  ] }],
  comments: [{ id: 'c1', resolved: false }],
  connectors: [{ id: 'x1', type: 'work_orders', label: 'Work orders', sheetIndex: 0, range: 'A1:H5', lastRefreshedAt: '2026-06-25T00:00:00.000Z', readOnly: true }],
}, new Date('2026-06-27T12:00:00.000Z'));

eq(report.label, 'small', 'label small');
ok(report.score < 100, 'score penalizado');
ok(report.findings.some((f) => f.code === 'unknown-axos-functions' && f.severity === 'critical'), 'detecta AXOS desconocidas críticas');
ok(report.findings.some((f) => f.code === 'formula-name-errors' && f.severity === 'critical' && f.message.includes('Ops!A1')), 'detecta #NAME visibles');
ok(report.findings.some((f) => f.code === 'formula-ref-errors' && f.severity === 'critical' && f.message.includes('Ops!A4')), 'detecta #REF visibles');
ok(report.findings.some((f) => f.code === 'formula-div-zero-errors' && f.severity === 'warning' && f.message.includes('Ops!A5')), 'detecta #DIV/0 visibles');
ok(report.findings.some((f) => f.code === 'external-references'), 'detecta referencias externas');
ok(report.findings.some((f) => f.code === 'volatile-formulas'), 'detecta volátiles');
ok(report.findings.some((f) => f.code === 'open-comments'), 'detecta comentarios abiertos');
ok(report.findings.some((f) => f.code === 'stale-connectors'), 'detecta conectores stale');
ok(formatWorkbookHealthReport(report).includes('Salud del workbook'), 'formatea reporte');

eq(analyzeWorkbookHealth({ sheets: [], approval: { status: 'approved', approvedBy: 'QA' } }).score, 100, 'aprobado sin hallazgos score 100');
ok(analyzeWorkbookHealth({ sheets: [], approval: { status: 'rejected', notes: 'Falta soporte' } }).findings.some((f) => f.code === 'approval-rejected'), 'detecta rechazo de aprobación');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
