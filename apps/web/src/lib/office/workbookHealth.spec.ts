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
    { r: 3, c: 0, v: { f: '=B4/0', v: '#DIV/0!' } },
    { r: 4, c: 0, v: { f: '=Missing!A1', v: '#REF!' } },
  ] }],
  comments: [{ id: 'c1', resolved: false }],
  connectors: [{ id: 'x1', type: 'inventory_snapshot', label: 'Inventory snapshot', sheetIndex: 0, range: 'A1:G5', lastRefreshedAt: '2026-06-19T00:00:00.000Z', readOnly: true, lastRefreshSource: 'local', lastRefreshWarnings: ['sample'] }],
}, new Date('2026-06-27T12:00:00.000Z'));

eq(report.label, 'small', 'label small');
ok(report.score < 100, 'score penalizado');
ok(report.findings.some((f) => f.code === 'unknown-axos-functions' && f.severity === 'critical'), 'detecta AXOS desconocidas críticas');
ok(report.findings.some((f) => f.code === 'external-references'), 'detecta referencias externas');
ok(report.findings.some((f) => f.code === 'volatile-formulas'), 'detecta volátiles');
ok(report.findings.some((f) => f.code === 'open-comments'), 'detecta comentarios abiertos');
ok(report.findings.some((f) => f.code === 'formula-div-zero-errors'), 'detecta #DIV/0 visibles');
ok(report.findings.some((f) => f.code === 'formula-ref-errors' && f.severity === 'critical'), 'detecta #REF visibles críticos');
ok(report.findings.some((f) => f.code === 'stale-connectors'), 'detecta conectores stale');
ok(report.findings.some((f) => f.code === 'invalid-connector-params'), 'detecta parámetros inválidos de conectores');
ok(report.findings.some((f) => f.code === 'connector-local-fallback'), 'detecta fallback local de conectores');
ok(report.findings.some((f) => f.code === 'connector-refresh-warnings'), 'detecta warnings backend de conectores');
ok(formatWorkbookHealthReport(report).includes('Salud del workbook'), 'formatea reporte');

const apiReport = analyzeWorkbookHealth({ sheets: [], connectors: [{ id: 'api1', type: 'oee_by_line', label: 'OEE by line', sheetIndex: 0, range: 'A1:F5', lastRefreshedAt: '2026-06-27T11:50:00.000Z', readOnly: true, lastRefreshSource: 'api' }], charts: [{}] }, new Date('2026-06-27T12:00:00.000Z'));
ok(apiReport.findings.some((f) => f.code === 'connector-api-provenance'), 'reporta procedencia API saludable');


const auditReport = analyzeWorkbookHealth({
  sheets: [],
  connectors: [{ id: 'api1', type: 'oee_by_line', label: 'OEE by line', sheetIndex: 0, range: 'A1:F5', lastRefreshedAt: '2026-06-27T11:50:00.000Z', readOnly: true, lastRefreshSource: 'api' }],
  connectorAudit: [{ id: 'a1', connectorId: 'api1', connectorType: 'oee_by_line', label: 'OEE by line', sheetIndex: 0, range: 'A1:F5', status: 'fallback', source: 'local', refreshedAt: '2026-06-27T11:51:00.000Z', warnings: ['API timeout'] }],
  charts: [{}],
}, new Date('2026-06-27T12:00:00.000Z'));
ok(auditReport.findings.some((f) => f.code === 'connector-refresh-audit-fallback'), 'detecta fallback en auditoría de conectores');
ok(auditReport.findings.some((f) => f.code === 'connector-refresh-audit-warnings'), 'detecta warnings en auditoría de conectores');

eq(analyzeWorkbookHealth({ sheets: [] }).score, 100, 'sin hallazgos score 100');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
