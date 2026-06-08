/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Puente entre el modelo de Fortune-Sheet (celldata) y SheetJS (`xlsx`, Apache-2.0)
 * para round-trips .xlsx / .csv de alta fidelidad: valores tipados, **fórmulas**,
 * **formatos de número**, **combinaciones** y **anchos de columna**, en ambos
 * sentidos. `xlsx` se importa dinámicamente (~900 KB) solo al importar/exportar.
 *
 * Nota de fidelidad: SheetJS (edición comunitaria) **no escribe estilos** (relleno,
 * fuente, color) al .xlsx; sí conserva número-formato (`z`), fórmulas (`f`),
 * combinaciones y anchos. Los estilos visuales se mantienen dentro de AXOS.
 */

type FortuneCellV = { v?: any; m?: string; f?: string; ct?: { fa?: string; t?: string } } | any;
type FortuneSheet = {
  name?: string;
  celldata?: { r: number; c: number; v: any }[];
  row?: number; column?: number; order?: number; config?: any; status?: number;
};

/** Valor concreto de una celda Fortune (objeto `{v,m,ct}` o primitivo). */
export function cellValue(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return v.v ?? v.m ?? null;
  return v;
}

// ── Mapeo puro de celda Fortune → celda SheetJS (sin dependencias) ────────────
export interface XlsxCell { t: string; v?: any; f?: string; z?: string }
export function cellToXlsx(cv: FortuneCellV): XlsxCell | null {
  const raw = cellValue(cv);
  const obj = cv && typeof cv === 'object' ? cv : null;
  const f = obj?.f ? String(obj.f).replace(/^=/, '') : undefined;
  const fa = obj?.ct?.fa;
  const z = fa && fa !== 'General' ? fa : undefined;
  let cell: XlsxCell;
  if (typeof raw === 'number') cell = { t: 'n', v: raw };
  else if (typeof raw === 'boolean') cell = { t: 'b', v: raw };
  else if (raw == null) { if (!f) return null; cell = { t: 'n' }; }
  else cell = { t: 's', v: String(raw) };
  if (f) cell.f = f;
  if (z) cell.z = z;
  return cell;
}

// ── Mapeo puro de celda SheetJS → valor Fortune ───────────────────────────────
export function xlsxToFortuneV(cell: any): any {
  if (!cell) return null;
  const t = cell.t;
  const v = cell.v;
  const fa = cell.z && cell.z !== 'General' ? String(cell.z) : 'General';
  const out: any = { v, m: cell.w != null ? String(cell.w) : (v != null ? String(v) : ''), ct: { fa, t: t === 'n' ? 'n' : t === 'b' ? 'b' : 's' } };
  if (cell.f) out.f = `=${cell.f}`;
  return out;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const safeName = (s: string) => (s || 'hoja').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'hoja';

// ── Fortune → worksheet SheetJS ───────────────────────────────────────────────
export function fortuneToWs(XLSX: any, sheet: FortuneSheet): any {
  const ws: any = {};
  let maxR = 0, maxC = 0;
  for (const cd of sheet.celldata ?? []) {
    const cell = cellToXlsx(cd.v);
    if (!cell) continue;
    ws[XLSX.utils.encode_cell({ r: cd.r, c: cd.c })] = cell;
    if (cd.r > maxR) maxR = cd.r; if (cd.c > maxC) maxC = cd.c;
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  // Anchos de columna (config.columnlen: { colIndex: px }).
  const colLen = sheet.config?.columnlen;
  if (colLen && typeof colLen === 'object') {
    ws['!cols'] = Array.from({ length: maxC + 1 }, (_, c) => (colLen[c] ? { wpx: colLen[c] } : {}));
  }
  // Combinaciones (config.merge: { "r_c": { r, c, rs, cs } }).
  const merge = sheet.config?.merge;
  if (merge && typeof merge === 'object') {
    const merges: any[] = [];
    for (const k of Object.keys(merge)) {
      const m = merge[k]; if (!m) continue;
      merges.push({ s: { r: m.r, c: m.c }, e: { r: m.r + (m.rs || 1) - 1, c: m.c + (m.cs || 1) - 1 } });
    }
    if (merges.length) ws['!merges'] = merges;
  }
  return ws;
}

// ── worksheet SheetJS → Fortune ───────────────────────────────────────────────
export function wsToFortune(XLSX: any, ws: any, name: string, order: number): FortuneSheet {
  const ref = ws['!ref'] || 'A1';
  const range = XLSX.utils.decode_range(ref);
  const celldata: { r: number; c: number; v: any }[] = [];
  let maxR = 0, maxC = 0;
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell || (cell.v == null && !cell.f)) continue;
      celldata.push({ r, c, v: xlsxToFortuneV(cell) });
      if (r > maxR) maxR = r; if (c > maxC) maxC = c;
    }
  }
  const config: any = {};
  // Anchos de columna.
  if (Array.isArray(ws['!cols'])) {
    const columnlen: Record<number, number> = {};
    ws['!cols'].forEach((col: any, i: number) => { const w = col?.wpx ?? (col?.wch ? Math.round(col.wch * 7) : null); if (w) columnlen[i] = Math.round(w); });
    if (Object.keys(columnlen).length) config.columnlen = columnlen;
  }
  // Combinaciones.
  if (Array.isArray(ws['!merges']) && ws['!merges'].length) {
    const merge: Record<string, any> = {};
    for (const m of ws['!merges']) { const r = m.s.r, c = m.s.c; merge[`${r}_${c}`] = { r, c, rs: m.e.r - m.s.r + 1, cs: m.e.c - m.s.c + 1 }; }
    config.merge = merge;
  }
  return {
    name: (name || 'Hoja').slice(0, 31), celldata, order,
    row: Math.max(100, maxR + 10), column: Math.max(26, maxC + 5),
    config, status: order === 0 ? 1 : 0,
  };
}

export interface CsvOpts { delimiter?: string; bom?: boolean }
export async function exportSheets(sheets: FortuneSheet[], title: string, format: 'xlsx' | 'csv', csv: CsvOpts = {}) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const list = sheets?.length ? sheets : [{ name: 'Hoja 1', celldata: [] }];
  list.forEach((s, i) => {
    const ws = fortuneToWs(XLSX, s);
    XLSX.utils.book_append_sheet(wb, ws, (s.name || `Hoja ${i + 1}`).slice(0, 31));
  });
  if (format === 'csv') {
    const text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: csv.delimiter || ',' });
    const prefix = csv.bom === false ? '' : '﻿';
    download(new Blob([prefix + text], { type: 'text/csv;charset=utf-8' }), `${safeName(title)}.csv`);
  } else {
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${safeName(title)}.xlsx`);
  }
}

export async function importSheets(file: File): Promise<FortuneSheet[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellNF: true, cellStyles: true });
  const sheets = wb.SheetNames.map((name: string, i: number) => wsToFortune(XLSX, wb.Sheets[name], name, i));
  return sheets.length ? sheets : [wsToFortune(XLSX, { '!ref': 'A1' }, 'Hoja 1', 0)];
}
