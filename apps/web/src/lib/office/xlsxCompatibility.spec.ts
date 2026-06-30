/* eslint-disable @typescript-eslint/no-explicit-any */
import { scanXlsxCompatibility } from './xlsxCompatibility';

let passed = 0;
const fails: string[] = [];
const ok = (condition: boolean, message: string) => { if (condition) passed++; else fails.push(message); };
const eq = (actual: any, expected: any, message: string) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else fails.push(`${message} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

function byKey(report: ReturnType<typeof scanXlsxCompatibility>, key: string) {
  const found = report.features.find((item) => item.key === key);
  if (!found) throw new Error(`Missing feature ${key}`);
  return found;
}

const defaultPrint = scanXlsxCompatibility({
  sheets: [{ name: 'Sheet1', celldata: [] }],
  printLayout: { orientation: 'portrait', paperSize: 'A4', fitToWidth: false, fitToPage: false, showGridlines: true },
});
eq(byKey(defaultPrint, 'print_layout').count, 0, 'default print layout stays quiet');

const report = scanXlsxCompatibility({
  sheets: [{
    name: 'Industrial',
    celldata: [
      { r: 0, c: 0, v: { v: 'AXOS', m: 'AXOS', hl: 'https://axos.local/office' } },
      { r: 1, c: 0, v: { v: 'Review', m: 'Review', ps: { value: 'Check source rows' } } },
      { r: 2, c: 0, v: { v: 10, m: '10', f: '=SUM(A1:A2)', ct: { fa: 'General', t: 'n' } } },
    ],
    config: {
      columnlen: { 0: 120 },
      rowlen: { 1: 32 },
      merge: { '0_0': { r: 0, c: 0, rs: 1, cs: 2 } },
    },
    filter_select: { row: [0, 4], column: [0, 2] },
    dataVerification: { '1_0': { type: 'dropdown', value1: 'A,B' } },
  }],
  tables: [{ name: 'InventoryTable', sheetIndex: 0, range: 'A1:C5' }],
  printLayout: { orientation: 'landscape', paperSize: 'Letter', fitToWidth: true, fitToPage: false, showGridlines: false },
  importWarnings: ['Dropped embedded object'],
  unsupportedXlsxFeatures: ['oleObject'],
  macros: true,
});

eq(byKey(report, 'hyperlinks').count, 1, 'hyperlinks do not count Fortune notes');
eq(byKey(report, 'cell_comments').count, 1, 'cell notes are reported separately');
eq(byKey(report, 'tables').severity, 'partial', 'structured tables need native Excel review');
eq(byKey(report, 'print_layout').severity, 'review', 'custom print layout requires review');
eq(byKey(report, 'filters').count, 1, 'autofilter is detected');
eq(byKey(report, 'dimensions').count, 2, 'row and column dimensions are detected');
eq(byKey(report, 'import_warnings').count, 1, 'import warnings are surfaced');
eq(report.unsupportedCount, 2, 'macros and unsupported objects block readiness');
ok(report.reviewCount >= 5, 'partial/review items affect readiness score');
ok(report.score < 60, 'readiness score drops for risky exports');

const total = passed + fails.length;
if (fails.length) {
  console.error(`XLSX COMPAT SPEC: ${passed}/${total}`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}
console.log(`XLSX COMPAT SPEC: ${passed}/${total} OK`);
