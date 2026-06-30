/* eslint-disable @typescript-eslint/no-explicit-any */
import { runSheetTransform, sheetTransformResultToCelldata, type SheetTransformStep } from './sheetTransforms';

let passed = 0;
const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (actual: any, expected: any, msg: string) => {
  if (actual === expected) passed++;
  else fails.push(`${msg} -- expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

function cell(r: number, c: number, v: any) {
  return { r, c, v: { v, m: String(v ?? '') } };
}

const sheet = {
  name: 'Raw',
  celldata: [
    cell(0, 0, 'SKU'),
    cell(0, 1, 'Supplier'),
    cell(0, 2, 'Qty'),
    cell(0, 3, 'Scrap'),
    cell(0, 4, 'Date'),
    cell(0, 5, 'Cost'),
    cell(0, 6, 'Week 1'),
    cell(0, 7, 'Week 2'),
    cell(0, 8, 'Week 3'),
    cell(1, 0, ' A-100 '),
    cell(1, 1, 'North'),
    cell(1, 2, '10'),
    cell(1, 3, '1'),
    cell(1, 4, '6/29/2026'),
    cell(1, 5, '$2.50'),
    cell(1, 6, '12'),
    cell(1, 7, '14'),
    cell(1, 8, ''),
    cell(2, 0, 'A-100'),
    cell(2, 1, 'North'),
    cell(2, 2, '10'),
    cell(2, 3, '1'),
    cell(2, 4, '6/29/2026'),
    cell(2, 5, '$2.50'),
    cell(2, 6, '12'),
    cell(2, 7, '14'),
    cell(2, 8, ''),
    cell(3, 0, 'B-200'),
    cell(3, 1, 'Delta'),
    cell(3, 2, '0'),
    cell(3, 3, '0'),
    cell(3, 4, ''),
    cell(3, 5, '3.00'),
    cell(3, 6, '3'),
    cell(3, 7, ''),
    cell(3, 8, '4'),
    cell(5, 0, 'C-300'),
    cell(5, 1, 'North'),
    cell(5, 2, '5'),
    cell(5, 3, '2'),
    cell(5, 4, '2026-07-01'),
    cell(5, 5, '4'),
    cell(5, 6, ''),
    cell(5, 7, '8'),
    cell(5, 8, '9'),
  ],
};

{
  const steps: SheetTransformStep[] = [
    { type: 'trim_clean_text', columns: ['SKU'] },
    { type: 'normalize_number', columns: ['Qty', 'Scrap', 'Cost'] },
    { type: 'normalize_date', columns: ['Date'] },
    { type: 'remove_blanks', columns: ['SKU'], mode: 'any' },
    { type: 'remove_duplicates', columns: ['SKU', 'Supplier', 'Qty', 'Scrap', 'Date', 'Cost'] },
    { type: 'filter_rows', column: 'Supplier', op: '=', value: 'North' },
    { type: 'add_calculated_column', name: 'Good Qty', formula: 'difference', left: 'Qty', right: 'Scrap' },
    { type: 'sort_rows', column: 'Good Qty', order: 'desc' },
  ];
  const result = runSheetTransform(sheet, { range: 'A1:F6', sheetIndex: 0, steps });
  ok(result.ok, 'transform succeeds');
  eq(result.inputRows, 5, 'reads selected data rows');
  eq(result.outputRows, 2, 'filters blanks, duplicate, and non-North supplier');
  eq(result.stepsApplied, steps.length, 'applies every valid step');
  eq(result.headers.join('|'), 'SKU|Supplier|Qty|Scrap|Date|Cost|Good Qty', 'adds calculated header');
  eq(result.rows[0][0], 'A-100', 'trims text');
  eq(result.rows[0][4], '2026-06-29', 'normalizes date');
  eq(result.rows[0][5], 2.5, 'normalizes currency number');
  eq(result.rows[0][6], 9, 'calculates good quantity');
  eq(result.rows[1][0], 'C-300', 'keeps second North row');
}

{
  const result = runSheetTransform(sheet, {
    range: 'A1:F6',
    sheetIndex: 0,
    steps: [
      { type: 'normalize_number', columns: ['Qty'] },
      { type: 'group_by', groupBy: ['Supplier'], aggregations: [{ column: 'Qty', op: 'sum', as: 'Total Qty' }, { column: 'SKU', op: 'count', as: 'Rows' }] },
      { type: 'sort_rows', column: 'Total Qty', order: 'desc' },
    ],
  });
  eq(result.headers.join('|'), 'Supplier|Total Qty|Rows', 'group summary headers');
  eq(result.rows[0][0], 'North', 'largest supplier first');
  eq(result.rows[0][1], 25, 'sums grouped quantity');
  eq(result.rows[0][2], 3, 'counts grouped nonblank rows');
}

{
  const result = runSheetTransform(sheet, {
    range: 'A1:F6',
    sheetIndex: 0,
    steps: [
      { type: 'select_columns', columns: ['SKU', 'Missing', 'Qty'] },
      { type: 'rename_columns', renames: { SKU: 'Part Number', Qty: 'Required Qty' } },
    ],
  });
  eq(result.headers.join('|'), 'Part Number|Required Qty', 'selects and renames found columns');
  ok(result.warnings.some((warning) => warning.includes('Missing')), 'reports missing column honestly');
}

{
  const result = runSheetTransform(sheet, {
    range: 'A1:I6',
    sheetIndex: 0,
    steps: [
      { type: 'trim_clean_text', columns: ['SKU'] },
      { type: 'split_column', column: 'SKU', delimiter: '-', into: ['Part Family', 'Part Number'], removeSource: false },
    ],
  });
  eq(result.headers.slice(-2).join('|'), 'Part Family|Part Number', 'split column appends named headers');
  eq(result.rows[0].slice(-2).join('|'), 'A|100', 'split column trims generated values');
  eq(result.rows[2].slice(-2).join('|'), 'B|200', 'split column handles later rows');
}

{
  const result = runSheetTransform(sheet, {
    range: 'A1:I6',
    sheetIndex: 0,
    steps: [
      { type: 'trim_clean_text', columns: ['SKU'] },
      { type: 'unpivot_columns', keyColumns: ['SKU', 'Supplier'], valueColumns: ['Week 1', 'Week 2', 'Week 3'], nameColumn: 'Bucket', valueColumn: 'Demand', skipBlanks: true },
    ],
  });
  eq(result.headers.join('|'), 'SKU|Supplier|Bucket|Demand', 'unpivot produces long-table headers');
  eq(result.outputRows, 8, 'unpivot skips blank measure cells');
  eq(result.rows[0].join('|'), 'A-100|North|Week 1|12', 'unpivot keeps key columns and measure name');
  eq(result.rows[result.rows.length - 1].join('|'), 'C-300|North|Week 3|9', 'unpivot includes final populated bucket');
}

{
  const result = runSheetTransform(sheet, { range: 'not-a-range', sheetIndex: 0, steps: [] });
  ok(!result.ok, 'invalid range fails safely');
  ok(result.warnings.length > 0, 'invalid range has warning');
}

{
  const result = runSheetTransform(sheet, {
    range: 'A1:C2',
    sheetIndex: 0,
    steps: [{ type: 'select_columns', columns: ['SKU', 'Qty'] }],
  });
  const out = sheetTransformResultToCelldata(result, { r: 4, c: 2 });
  eq(out.nRows, 2, 'celldata includes header plus row');
  eq(out.nCols, 2, 'celldata column count');
  eq(out.celldata[0].r, 4, 'celldata origin row');
  eq(out.celldata[0].c, 2, 'celldata origin col');
  ok(out.celldata[0].v.bl === 1, 'headers are styled');
}

const total = passed + fails.length;
if (fails.length) {
  console.error(`${passed}/${total} passed`);
  for (const fail of fails) console.error(`  - ${fail}`);
  process.exit(1);
}
console.log(`${passed}/${total} passed`);
