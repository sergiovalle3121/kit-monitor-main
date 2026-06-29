/* eslint-disable @typescript-eslint/no-explicit-any */
import { deriveSheetSelectionStats, deriveSheetSummary, deriveWorkbookHealth, formatSheetRange } from './workbookHealth';
import { scanXlsxCompatibility } from './xlsxCompatibility';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: any, b: any, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const workbook: any = {
  sheets: [{ name: 'Ops', celldata: [
    { r: 0, c: 0, v: { v: 10, m: '10', ct: { t: 'n' } } },
    { r: 0, c: 1, v: { v: 20, m: '20', ct: { t: 'n' } } },
    { r: 1, c: 0, v: { f: '=SUM(A1:B1)', v: 30, m: '30' } },
  ], dataVerification: { A1: { type: 'number' } }, config: { merge: { A3: { r: 2, c: 0, rs: 1, cs: 2 } } }, axosProtection: { ranges: [{ range: 'A1:B1', locked: true }] } }],
  charts: [{ id: 'c1' }], pivots: [{ id: 'p1' }], names: [{ name: 'Revenue', range: 'Ops!A1:B1' }],
  comments: [{ id: 'cm1', sheetIndex: 0, range: 'A1:B1', resolved: false, assignee: 'QA' }, { id: 'cm2', sheetIndex: 0, range: 'A2', resolved: true }],
  approvals: [{ status: 'pending' }, { status: 'approved' }], exportWarnings: ['controlled copy watermark missing'], sharedWith: [{ email: 'qa@example.com', access: 'view' }],
  connectors: [{ id: 'x1', type: 'inventory_snapshot', label: 'Inventory', sheetIndex: 0, range: 'A1:G5', lastRefreshedAt: '2026-06-28T00:00:00.000Z', readOnly: true, status: 'failed', lastError: 'Timeout' }],
};

eq(formatSheetRange({ r1: 0, c1: 0, r2: 9, c2: 2 }), 'A1:C10', 'formatea rango A1');
const stats = deriveSheetSelectionStats(workbook.sheets[0], 'A1:B1', workbook.comments);
eq(stats.count, 2, 'cuenta valores en selección');
eq(stats.nums, 2, 'cuenta números');
eq(stats.sum, 30, 'suma selección');
eq(stats.average, 15, 'promedio selección');
ok(stats.protected, 'detecta rango protegido');
ok(stats.comments === 1, 'detecta comentarios del rango');
const summary = deriveSheetSummary(workbook);
eq(summary.sheets, 1, 'summary hojas');
eq(summary.formulas, 1, 'summary fórmulas');
eq(summary.charts, 1, 'summary charts');
eq(summary.pivots, 1, 'summary pivots');
eq(summary.validations, 1, 'summary validations');
eq(summary.protectedRanges, 1, 'summary protection');
eq(summary.protectedSheets, 0, 'summary hojas protegidas');
eq(summary.unprotectedFormulas, 1, 'summary fórmulas sin proteger');
eq(summary.failedQueries, 1, 'summary consultas fallidas');
const health = deriveWorkbookHealth(workbook, new Date('2026-06-28T01:00:00.000Z'));
eq(health.connectors, 1, 'health conectores');
eq(health.openComments, 1, 'health comentarios abiertos');
eq(health.resolvedComments, 1, 'health comentarios resueltos');
eq(health.assignedComments, 1, 'health comentarios asignados');
eq(health.pendingApprovals, 1, 'health aprobaciones pendientes');
eq(health.exportWarnings, 1, 'health export warnings');
eq(health.sharingStatus, 'shared', 'health sharing status');
ok(health.findings.some((f) => f.code === 'failed-queries'), 'health consultas fallidas');
ok(health.score <= 100, 'health score válido');
const compat = scanXlsxCompatibility({ ...workbook, macros: true, unsupportedXlsxFeatures: ['ole'] });
ok(compat.features.some((f) => f.key === 'macros' && f.severity === 'unsupported'), 'detecta macros no soportadas');
ok(compat.unsupportedCount >= 2, 'cuenta incompatibilidades XLSX');
ok(compat.score < 100, 'penaliza score XLSX');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ sheet workbench: ${passed}/${total}`);
