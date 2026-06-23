/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Writer .xlsx con **estilos** vía ExcelJS (MIT). SheetJS (edición comunitaria) NO escribe estilos
 * (relleno, fuente, color, alineación) al exportar; ExcelJS sí. Aquí se construye el libro de ExcelJS a
 * partir del modelo de Fortune-Sheet (`celldata` + `config`) conservando: valores tipados, **fórmulas**,
 * **formato de número**, **fuente** (negrita/cursiva/color/tamaño/familia/subrayado/tachado), **relleno**
 * de fondo, **alineación** (horizontal/vertical/ajuste), **anchos de columna**, **altos de fila**,
 * **combinaciones**, **paneles inmovilizados** y **nombres definidos**, en varias hojas.
 *
 * La LECTURA sigue en SheetJS (`xlsx.ts`); este módulo sólo sustituye los BYTES de salida del .xlsx.
 * Función pura: recibe el módulo `ExcelJS` ya cargado, así se puede probar sin navegador.
 */
import type { NamedRange } from './sheetOps';
import { cellValue, namesToDefined } from './xlsx';

type FortuneSheet = {
  name?: string;
  celldata?: { r: number; c: number; v: any }[];
  config?: any; frozen?: any; order?: number;
};

/** `#rrggbb` (o `rrggbb`) → `FFRRGGBB` (ARGB de ExcelJS). `null` si no es color válido. */
export function toArgb(hex: any): string | null {
  if (typeof hex !== 'string') return null;
  const h = hex.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(h)) return ('FF' + h).toUpperCase();
  if (/^[0-9a-fA-F]{8}$/.test(h)) return h.toUpperCase();
  return null;
}

// Fortune ht/vt → ExcelJS alignment. ht: 0=centro,1=izq,2=der ; vt: 0=medio,1=arriba,2=abajo.
const H_ALIGN: Record<number, string> = { 0: 'center', 1: 'left', 2: 'right' };
const V_ALIGN: Record<number, string> = { 0: 'middle', 1: 'top', 2: 'bottom' };

/** Estilo ExcelJS (font/fill/alignment) a partir de las claves de estilo de una celda Fortune. */
export function cellStyle(o: any): any {
  if (!o || typeof o !== 'object') return {};
  const style: any = {};
  const font: any = {};
  if (o.bl) font.bold = true;
  if (o.it) font.italic = true;
  if (o.un) font.underline = true;
  if (o.cl) font.strike = true;
  if (typeof o.fs === 'number') font.size = o.fs;
  if (typeof o.ff === 'string' && o.ff) font.name = o.ff;
  const fc = toArgb(o.fc);
  if (fc) font.color = { argb: fc };
  if (Object.keys(font).length) style.font = font;
  const bg = toArgb(o.bg);
  if (bg) style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
  const align: any = {};
  if (o.ht != null && H_ALIGN[o.ht]) align.horizontal = H_ALIGN[o.ht];
  if (o.vt != null && V_ALIGN[o.vt]) align.vertical = V_ALIGN[o.vt];
  if (o.tb === 2 || o.tb === '2') align.wrapText = true;
  if (Object.keys(align).length) style.alignment = align;
  return style;
}

/** px de ancho de columna Fortune → unidades de ancho de ExcelJS (caracteres). */
const pxToColWidth = (px: number) => Math.max(1, Math.round(((px - 5) / 7) * 100) / 100);
/** px de alto de fila Fortune → puntos (ExcelJS). */
const pxToPointHeight = (px: number) => Math.round(px * 0.75 * 100) / 100;

/** Rellena una worksheet de ExcelJS a partir de una hoja Fortune (valores + estilos + layout). */
export function fillWorksheet(ws: any, sheet: FortuneSheet): void {
  let maxR = 0, maxC = 0;
  for (const cd of sheet.celldata ?? []) {
    const o = cd.v;
    const cell = ws.getCell(cd.r + 1, cd.c + 1);
    const f = o && typeof o === 'object' && o.f ? String(o.f).replace(/^=/, '') : undefined;
    const raw = cellValue(o);
    if (f) cell.value = raw != null && raw !== '' ? { formula: f, result: raw } : { formula: f };
    else if (raw != null && raw !== '') cell.value = raw;
    const fa = o && typeof o === 'object' ? o.ct?.fa : undefined;
    if (fa && fa !== 'General') cell.numFmt = fa;
    const st = cellStyle(o);
    if (st.font) cell.font = st.font;
    if (st.fill) cell.fill = st.fill;
    if (st.alignment) cell.alignment = st.alignment;
    if (cd.r > maxR) maxR = cd.r;
    if (cd.c > maxC) maxC = cd.c;
  }
  // Anchos de columna (config.columnlen: { col: px }).
  const colLen = sheet.config?.columnlen;
  if (colLen && typeof colLen === 'object') {
    for (const k of Object.keys(colLen)) { const c = Number(k); if (colLen[k] > 0) ws.getColumn(c + 1).width = pxToColWidth(colLen[k]); }
  }
  // Altos de fila (config.rowlen: { row: px }).
  const rowLen = sheet.config?.rowlen;
  if (rowLen && typeof rowLen === 'object') {
    for (const k of Object.keys(rowLen)) { const r = Number(k); if (rowLen[k] > 0) ws.getRow(r + 1).height = pxToPointHeight(rowLen[k]); }
  }
  // Combinaciones (config.merge: { "r_c": { r, c, rs, cs } }).
  const merge = sheet.config?.merge;
  if (merge && typeof merge === 'object') {
    for (const k of Object.keys(merge)) {
      const m = merge[k]; if (!m) continue;
      const r1 = m.r + 1, c1 = m.c + 1, r2 = m.r + (m.rs || 1), c2 = m.c + (m.cs || 1);
      if (r2 > r1 || c2 > c1) { try { ws.mergeCells(r1, c1, r2, c2); } catch { /* solapamiento → ignora */ } }
    }
  }
  // Paneles inmovilizados (sheet.frozen: { type, range:{row_focus,column_focus} }).
  const fz = sheet.frozen;
  if (fz && typeof fz === 'object') {
    const ySplit = (fz.range?.row_focus ?? (fz.type && /row|both|rangeRow/.test(String(fz.type)) ? 0 : -1)) + 1;
    const xSplit = (fz.range?.column_focus ?? (fz.type && /column|both|rangeColumn/.test(String(fz.type)) ? 0 : -1)) + 1;
    if (ySplit > 0 || xSplit > 0) ws.views = [{ state: 'frozen', xSplit: Math.max(0, xSplit), ySplit: Math.max(0, ySplit) }];
  }
}

/** Construye el libro ExcelJS completo (varias hojas + nombres definidos). */
export function buildStyledWorkbook(ExcelJS: any, sheets: FortuneSheet[], names?: NamedRange[]): any {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Axos OS';
  const list = sheets?.length ? sheets : [{ name: 'Hoja 1', celldata: [] }];
  const used = new Set<string>();
  for (const sheet of list) {
    let nm = (sheet.name || 'Hoja').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Hoja';
    while (used.has(nm.toLowerCase())) nm = (nm.slice(0, 28) + '_' + (used.size + 1)).slice(0, 31);
    used.add(nm.toLowerCase());
    fillWorksheet(wb.addWorksheet(nm), sheet);
  }
  // Nombres definidos: ref `Hoja!$A$1:$B$2` → name.
  const defined = namesToDefined(names, list.map((s) => s.name || ''));
  for (const d of defined) { try { wb.definedNames.add(d.Ref, d.Name); } catch { /* ref inválida → ignora */ } }
  return wb;
}

/** Bytes .xlsx con estilos (para descarga y para el test de fidelidad). */
export async function styledXlsxBuffer(ExcelJS: any, sheets: FortuneSheet[], names?: NamedRange[]): Promise<ArrayBuffer> {
  const wb = buildStyledWorkbook(ExcelJS, sheets, names);
  return wb.xlsx.writeBuffer();
}
