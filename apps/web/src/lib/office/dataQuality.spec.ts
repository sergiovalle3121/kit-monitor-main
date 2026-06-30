/* eslint-disable @typescript-eslint/no-explicit-any */
import { applyDataVerification } from './sheetOps';
import { auditDataQuality, buildDataQualitySheet, formatDataQualityReport, upsertDataQualitySheet } from './dataQuality';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} - expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const sheet: any = {
  name: 'Inventory',
  celldata: [
    { r: 0, c: 0, v: { v: 'SKU' } },
    { r: 0, c: 1, v: { v: 'Fecha necesidad' } },
    { r: 0, c: 2, v: { v: 'Disponible' } },
    { r: 0, c: 3, v: { v: 'Formula check' } },
    { r: 1, c: 0, v: { v: 'AX-1' } },
    { r: 1, c: 1, v: { v: '2026-07-01' } },
    { r: 1, c: 2, v: { v: 10 } },
    { r: 1, c: 3, v: { v: '#REF!', f: '=A999' } },
    { r: 2, c: 0, v: { v: 'AX-1' } },
    { r: 2, c: 1, v: { v: 'not-a-date' } },
    { r: 2, c: 2, v: { v: -3 } },
    { r: 3, c: 1, v: { v: '2026-07-03' } },
    { r: 3, c: 2, v: { v: 4 } },
  ],
};
applyDataVerification(sheet, 'A4:A4', { type: 'required' });

const content = {
  sheets: [sheet],
  connectors: [
    {
      id: 'axc_inventory',
      type: 'inventory_snapshot',
      label: 'Inventory snapshot',
      sheetIndex: 0,
      range: 'A1:C4',
      lastRefreshedAt: '2026-06-20T00:00:00.000Z',
      readOnly: true,
    },
    {
      id: 'axc_failed',
      type: 'mrp_shortages',
      label: 'MRP shortages',
      sheetIndex: 0,
      range: 'A1:C4',
      lastRefreshedAt: '2026-06-29T08:00:00.000Z',
      lastStatus: 'failed',
      lastError: '500',
      readOnly: true,
    },
  ],
  unsupportedXlsxFeatures: [{ type: 'macro' }],
};

const report = auditDataQuality(content, new Date('2026-06-29T12:00:00.000Z'));
ok(report.score < 100, 'penalizes visible issues');
ok(report.critical > 0, 'counts critical issues');
ok(report.warnings > 0, 'counts warning issues');
ok(report.issues.some((issue) => issue.type === 'validation' && issue.cell === 'A4'), 'reuses data validation audit');
ok(report.issues.some((issue) => issue.type === 'formula_error' && issue.cell === 'D2'), 'includes formula errors');
ok(report.issues.some((issue) => issue.type === 'duplicate_key' && issue.field === 'SKU'), 'detects duplicate industrial keys');
ok(report.issues.some((issue) => issue.type === 'blank_required' && issue.cell === 'A4'), 'detects inferred blank required key');
ok(report.issues.some((issue) => issue.type === 'negative_quantity' && issue.cell === 'C3'), 'detects negative inventory quantity');
ok(report.issues.some((issue) => issue.type === 'invalid_date' && issue.cell === 'B3'), 'detects invalid date values');
ok(report.issues.some((issue) => issue.type === 'connector_freshness'), 'includes stale connector freshness');
ok(report.issues.some((issue) => issue.type === 'connector_failure'), 'includes failed connector state');
ok(report.issues.some((issue) => issue.type === 'unsupported_xlsx'), 'includes unsupported XLSX warnings');
ok(formatDataQualityReport(report).includes('Data quality'), 'formats report summary');

const built = buildDataQualitySheet(report, 3);
eq(built.name, 'AXOS Data Quality', 'builds data quality sheet');
eq(built.order, 3, 'preserves requested order');
ok(built.celldata.some((cell: any) => cell.v.v === 'Suggested fix'), 'includes remediation column');

const upserted = upsertDataQualitySheet(content, 'AXOS Data Quality', new Date('2026-06-29T12:00:00.000Z'));
eq(upserted.content.sheets.length, 2, 'inserts report sheet');
ok(upserted.content.sheets[1].status === 1, 'activates report sheet');
const updated = upsertDataQualitySheet(upserted.content, 'AXOS Data Quality', new Date('2026-06-29T12:00:00.000Z'));
eq(updated.content.sheets.length, 2, 'updates existing report sheet');

const cleanReport = auditDataQuality({ sheets: [{ name: 'Clean', celldata: [{ r: 0, c: 0, v: { v: 'SKU' } }, { r: 1, c: 0, v: { v: 'A' } }] }] });
eq(formatDataQualityReport(cleanReport), 'Data quality 100/100\nNo visible industrial data issues detected.', 'formats clean workbook');

const total = passed + fails.length;
if (fails.length) { console.error(`Failed ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`Passed ${passed}/${total}`);
