/* eslint-disable @typescript-eslint/no-explicit-any */
import { buildWorkbookInventorySheet, summarizeWorkbookInventory, upsertWorkbookInventorySheet } from './workbookInventorySheet';

let passed = 0; const fails: string[] = [];
const ok = (cond: boolean, msg: string) => { if (cond) passed++; else fails.push(msg); };
const eq = (a: unknown, b: unknown, msg: string) => { if (a === b) passed++; else fails.push(`${msg} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

const content = {
  sheets: [{ name: 'Ops', order: 0, row: 100, column: 20, celldata: [{ r: 0, c: 0, v: 1 }] }],
  charts: [{ id: 'c1' }],
  pivots: [{ id: 'p1' }],
  connectors: [{ id: 'x1' }],
  comments: [{ id: 'm1' }],
  tables: [{ name: 'T1' }],
  names: [{ name: 'NamedRange' }],
};
const summary = summarizeWorkbookInventory(content);
eq(summary.sheets, 1, 'resume sheets');
eq(summary.charts, 1, 'resume charts');
eq(summary.connectors, 1, 'resume conectores');
const sheet = buildWorkbookInventorySheet(content, new Date('2026-06-28T00:00:00.000Z'), 2);
eq(sheet.name, 'AXOS Workbook Inventory', 'crea hoja inventory');
eq(sheet.order, 2, 'respeta orden');
ok(sheet.celldata.some((cell: any) => cell.v.v === 'AXOS Workbook Inventory'), 'incluye título');
ok(sheet.celldata.some((cell: any) => cell.v.v === 'Ops'), 'incluye detalle de sheets');
const inserted = upsertWorkbookInventorySheet(content.sheets, content, new Date('2026-06-28T00:00:00.000Z'));
eq(inserted.sheets.length, 2, 'inserta hoja inventory');
const updated = upsertWorkbookInventorySheet(inserted.sheets, { ...content, sheets: inserted.sheets }, new Date('2026-06-28T00:01:00.000Z'));
eq(updated.sheets.length, 2, 'actualiza hoja existente');
ok(updated.sheets[1].celldata.some((cell: any) => cell.v.v === '2026-06-28T00:01:00.000Z'), 'actualiza timestamp');

const total = passed + fails.length;
if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`✅ ${passed}/${total}`);
