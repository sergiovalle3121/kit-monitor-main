import { formatSheetGovernanceSummary, summarizeSheetGovernance } from './sheetGovernanceSummary';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} - expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const now = new Date('2026-06-29T00:00:00.000Z');

const clean = summarizeSheetGovernance({ sheets: [] }, now);
eq(clean.status, 'ready', 'clean workbook is ready');
eq(clean.score, 95, 'clean draft workbook keeps the existing publish-gate info penalty');
ok(formatSheetGovernanceSummary(clean).includes('Sheets governance ready'), 'formats ready status');

const review = summarizeSheetGovernance({
  sheets: [{ name: 'Ops', celldata: [{ r: 0, c: 0, v: { f: '=A2/0', v: '#DIV/0!' } }] }],
  comments: [
    { id: 'c1', range: 'A1', text: 'Check scrap', resolved: false, assignedTo: 'quality@axos.local' },
    { id: 'c2', range: 'B1', text: 'Done', resolved: true },
  ],
}, now);
eq(review.status, 'review', 'open comments and warnings require review');
eq(review.openComments, 1, 'counts open comments');
eq(review.resolvedComments, 1, 'counts resolved comments');
eq(review.assignedComments, 1, 'counts assigned comments');
ok(review.messages.some((message) => message.includes('open comment')), 'mentions open comments');

const blocked = summarizeSheetGovernance({
  sheets: [{ name: 'ERP', axosProtection: { ranges: [{ range: 'A1:C3', locked: false, connectorId: 'axc_1' }] } }],
  connectors: [{ id: 'axc_1', type: 'inventory_snapshot', label: 'Inventory', sheetIndex: 0, range: 'A1:C3' }],
  macros: true,
}, now);
eq(blocked.status, 'blocked', 'unsupported XLSX and unprotected connector block governance');
eq(blocked.unprotectedConnectors, 1, 'counts unprotected connector');
eq(blocked.xlsxUnsupported, 1, 'counts unsupported XLSX items');
ok(formatSheetGovernanceSummary(blocked).includes('Sheets governance blocked'), 'formats blocked status');

const total = passed + fails.length;
if (fails.length) {
  console.error(`FAIL ${passed}/${total}`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS ${passed}/${total}`);
