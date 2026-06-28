/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WorkbookInventorySummary {
  sheets: number;
  charts: number;
  pivots: number;
  connectors: number;
  comments: number;
  tables: number;
  names: number;
}

function inventoryCell(value: string | number, bold = false) {
  return {
    v: value,
    m: String(value),
    ct: { fa: 'General', t: typeof value === 'number' ? 'n' : 's' },
    ...(bold ? { bl: 1, bg: '#f1f5f9', fc: '#0f172a' } : {}),
  };
}

export function summarizeWorkbookInventory(content: any): WorkbookInventorySummary {
  return {
    sheets: Array.isArray(content?.sheets) ? content.sheets.length : Array.isArray(content) ? content.length : 0,
    charts: Array.isArray(content?.charts) ? content.charts.length : 0,
    pivots: Array.isArray(content?.pivots) ? content.pivots.length : 0,
    connectors: Array.isArray(content?.connectors) ? content.connectors.length : 0,
    comments: Array.isArray(content?.comments) ? content.comments.length : 0,
    tables: Array.isArray(content?.tables) ? content.tables.length : 0,
    names: Array.isArray(content?.names) ? content.names.length : 0,
  };
}

export function buildWorkbookInventorySheet(
  content: any,
  generatedAt = new Date(),
  order = 0,
  name = 'AXOS Workbook Inventory',
): { name: string; order: number; row: number; column: number; celldata: any[]; config: Record<string, unknown> } {
  const summary = summarizeWorkbookInventory(content);
  const sheets = Array.isArray(content?.sheets) ? content.sheets : Array.isArray(content) ? content : [];
  const celldata: any[] = [
    { r: 0, c: 0, v: inventoryCell('AXOS Workbook Inventory', true) },
    { r: 1, c: 0, v: inventoryCell('Generated at', true) },
    { r: 1, c: 1, v: inventoryCell(generatedAt.toISOString()) },
    { r: 3, c: 0, v: inventoryCell('Asset', true) },
    { r: 3, c: 1, v: inventoryCell('Count', true) },
  ];
  Object.entries(summary).forEach(([key, value], index) => {
    celldata.push({ r: index + 4, c: 0, v: inventoryCell(key) });
    celldata.push({ r: index + 4, c: 1, v: inventoryCell(value) });
  });
  const sheetStart = 13;
  ['Sheet', 'Rows', 'Columns', 'Cells'].forEach((header, c) => celldata.push({ r: sheetStart, c, v: inventoryCell(header, true) }));
  sheets.forEach((sheet: any, index: number) => {
    const r = sheetStart + index + 1;
    celldata.push({ r, c: 0, v: inventoryCell(sheet?.name ?? `Hoja ${index + 1}`) });
    celldata.push({ r, c: 1, v: inventoryCell(sheet?.row ?? 0) });
    celldata.push({ r, c: 2, v: inventoryCell(sheet?.column ?? 0) });
    celldata.push({ r, c: 3, v: inventoryCell(Array.isArray(sheet?.celldata) ? sheet.celldata.length : 0) });
  });
  return {
    name,
    order,
    row: Math.max(30, sheetStart + sheets.length + 5),
    column: 5,
    celldata,
    config: { columnlen: { 0: 240, 1: 120, 2: 120, 3: 120 }, frozen: { type: 'row' } },
  };
}

export function upsertWorkbookInventorySheet(
  sheets: any[],
  content: any,
  generatedAt = new Date(),
  name = 'AXOS Workbook Inventory',
): { sheets: any[]; summary: WorkbookInventorySummary } {
  const summary = summarizeWorkbookInventory(content);
  const next = sheets.map((sheet) => ({ ...sheet }));
  const index = next.findIndex((sheet) => sheet?.name === name);
  const order = index >= 0 ? (next[index]?.order ?? index) : next.length;
  const inventorySheet = buildWorkbookInventorySheet(content, generatedAt, order, name);
  if (index >= 0) next[index] = { ...next[index], ...inventorySheet };
  else next.push(inventorySheet);
  return { sheets: next.map((sheet, i) => ({ ...sheet, order: sheet.order ?? i })), summary };
}
