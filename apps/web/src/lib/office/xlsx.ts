/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Bridge between Fortune-sheet's data model and SheetJS (`xlsx`, Apache-2.0)
 * for faithful .xlsx / .csv round-trips. `xlsx` is imported dynamically so the
 * ~900 KB engine only loads when the user actually imports/exports.
 */

type FortuneSheet = {
  name?: string;
  celldata?: { r: number; c: number; v: any }[];
  row?: number;
  column?: number;
  order?: number;
  config?: any;
  status?: number;
};

/** Pull the concrete value out of a Fortune-sheet cell (which may be a `{v,m,ct}` object). */
function cellValue(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v.v ?? v.m ?? null;
  return v;
}

function sheetToAoa(sheet: FortuneSheet): any[][] {
  const aoa: any[][] = [];
  for (const cell of sheet.celldata ?? []) {
    const val = cellValue(cell.v);
    if (val === null) continue;
    (aoa[cell.r] ??= [])[cell.c] = val;
  }
  return aoa;
}

function aoaToSheet(name: string, aoa: any[][], order: number): FortuneSheet {
  const celldata: { r: number; c: number; v: any }[] = [];
  let maxR = 0;
  let maxC = 0;
  aoa.forEach((row, r) => {
    if (!row) return;
    row.forEach((val, c) => {
      if (val === null || val === undefined || val === '') return;
      const t = typeof val === 'number' ? 'n' : typeof val === 'boolean' ? 'b' : 's';
      celldata.push({ r, c, v: { v: val, m: String(val), ct: { fa: 'General', t } } });
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);
    });
  });
  return {
    name: (name || 'Hoja').slice(0, 31),
    celldata,
    order,
    row: Math.max(100, maxR + 10),
    column: Math.max(26, maxC + 5),
    config: {},
    status: order === 0 ? 1 : 0,
  };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const safeName = (s: string) => (s || 'hoja').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'hoja';

export async function exportSheets(sheets: FortuneSheet[], title: string, format: 'xlsx' | 'csv') {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const list = sheets?.length ? sheets : [{ name: 'Hoja 1', celldata: [] }];
  list.forEach((s, i) => {
    const ws = XLSX.utils.aoa_to_sheet(sheetToAoa(s));
    XLSX.utils.book_append_sheet(wb, ws, (s.name || `Hoja ${i + 1}`).slice(0, 31));
  });
  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${safeName(title)}.csv`);
  } else {
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeName(title)}.xlsx`);
  }
}

export async function importSheets(file: File): Promise<FortuneSheet[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets = wb.SheetNames.map((name, i) => {
    const aoa = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: true, defval: null });
    return aoaToSheet(name, aoa as any[][], i);
  });
  return sheets.length ? sheets : [aoaToSheet('Hoja 1', [], 0)];
}
