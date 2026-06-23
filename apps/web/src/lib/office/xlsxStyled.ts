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
  config?: any; frozen?: any; order?: number; dataVerification?: Record<string, any>;
  filter_select?: { row?: number[]; column?: number[] } | null;
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

// Validación de datos (Fortune `dataVerification`) → `cell.dataValidation` de ExcelJS.
// Operador Fortune → operador de ExcelJS (whole/decimal/textLength/date).
const DV_OP: Record<string, string> = {
  between: 'between', notBetween: 'notBetween', equal: 'equal', notEqualTo: 'notEqual',
  moreThanThe: 'greaterThan', lessThan: 'lessThan', greaterOrEqualTo: 'greaterThanOrEqual', lessThanOrEqualTo: 'lessThanOrEqual',
  earlierThan: 'lessThan', noEarlierThan: 'greaterThanOrEqual', laterThan: 'greaterThan', noLaterThan: 'lessThanOrEqual',
};
const DV_TYPE: Record<string, string> = {
  number: 'decimal', number_decimal: 'decimal', number_integer: 'whole', text_length: 'textLength', date: 'date',
};

/** `DvEntry` de Fortune → objeto `dataValidation` de ExcelJS (o `null` si no es exportable). */
export function dataValidationFor(dv: any): any {
  if (!dv || typeof dv !== 'object') return null;
  const base: any = { allowBlank: true };
  if (dv.hintShow && dv.hintText) { base.showInputMessage = true; base.prompt = String(dv.hintText); base.promptTitle = ''; }
  if (dv.prohibitInput) { base.showErrorMessage = true; base.errorStyle = 'stop'; }
  // Lista desplegable: literal `"a,b,c"` o referencia de rango.
  if (dv.type === 'dropdown') {
    const v1 = String(dv.value1 ?? '');
    const isRange = dv.remote || /^[^,]*[A-Za-z]\$?\d/.test(v1) && /:/.test(v1);
    return { ...base, type: 'list', formulae: [isRange ? v1 : `"${v1.replace(/"/g, '')}"`] };
  }
  if (dv.type === 'checkbox') return { ...base, type: 'list', formulae: ['"VERDADERO,FALSO"'] };
  const type = DV_TYPE[dv.type];
  if (!type) return null; // text_content y otros sin equivalente directo → se omiten
  const op = DV_OP[dv.type2] ?? 'between';
  const two = op === 'between' || op === 'notBetween';
  const formulae = two ? [String(dv.value1 ?? ''), String(dv.value2 ?? '')] : [String(dv.value1 ?? '')];
  return { ...base, type, operator: op, formulae };
}

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
  // Autofiltro (Fortune `filter_select: { row:[r1,r2], column:[c1,c2] }`) → `ws.autoFilter` (encabezados con flecha).
  const fs = sheet.filter_select;
  if (fs && Array.isArray(fs.row) && Array.isArray(fs.column)) {
    const [r1, r2] = fs.row, [c1, c2] = fs.column;
    if ([r1, r2, c1, c2].every((n) => typeof n === 'number')) {
      ws.autoFilter = { from: { row: r1 + 1, column: c1 + 1 }, to: { row: r2 + 1, column: c2 + 1 } };
    }
  }
  // Validación de datos (Fortune `dataVerification: { "r_c": DvEntry }`).
  const dvMap = sheet.dataVerification;
  if (dvMap && typeof dvMap === 'object') {
    for (const k of Object.keys(dvMap)) {
      const m = /^(\d+)_(\d+)$/.exec(k); if (!m) continue;
      const dv = dataValidationFor(dvMap[k]); if (!dv) continue;
      try { ws.getCell(Number(m[1]) + 1, Number(m[2]) + 1).dataValidation = dv; } catch { /* ignora */ }
    }
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

// ── LECTURA de estilos (inverso): ExcelJS → claves de estilo Fortune ──────────
// SheetJS comunitario tampoco LEE estilos, así que al importar se complementa con ExcelJS para que un
// libro con formato vuelva a entrar con sus colores/negritas (round-trip simétrico de §109).

const H_INV: Record<string, number> = { center: 0, left: 1, right: 2, justify: 1 };
const V_INV: Record<string, number> = { middle: 0, top: 1, bottom: 2 };

/** `FFRRGGBB`/`RRGGBB` (ARGB de ExcelJS) → `#rrggbb`. `null` si no es un color rgb directo. */
export function argbToHex(argb: any): string | null {
  if (typeof argb !== 'string') return null;
  const h = argb.length === 8 ? argb.slice(2) : argb.length === 6 ? argb : '';
  return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toLowerCase() : null;
}

/** Estilo de una celda ExcelJS → claves de estilo Fortune (`{bl,it,fc,bg,…}`); `{}` si no hay estilo. */
export function fortuneStyleFromCell(cell: any): any {
  if (!cell || typeof cell !== 'object') return {};
  const out: any = {};
  const font = cell.font;
  if (font) {
    if (font.bold) out.bl = 1;
    if (font.italic) out.it = 1;
    if (font.underline) out.un = 1;
    if (font.strike) out.cl = 1;
    if (typeof font.size === 'number') out.fs = font.size;
    if (typeof font.name === 'string' && font.name) out.ff = font.name;
    const fc = argbToHex(font.color?.argb);
    if (fc) out.fc = fc;
  }
  const bg = argbToHex(cell.fill?.fgColor?.argb);
  if (cell.fill?.pattern === 'solid' && bg) out.bg = bg;
  const al = cell.alignment;
  if (al) {
    if (al.horizontal && H_INV[al.horizontal] != null) out.ht = H_INV[al.horizontal];
    if (al.vertical && V_INV[al.vertical] != null) out.vt = V_INV[al.vertical];
    if (al.wrapText) out.tb = 2;
  }
  return out;
}

/**
 * Fusiona los estilos leídos por ExcelJS en las hojas Fortune ya pobladas por SheetJS (valores +
 * fórmulas). Empareja por índice de hoja y por celda (r,c). Aditivo: solo añade claves de estilo y el
 * formato de número; no toca valores ni fórmulas. Tolerante a fallos (si ExcelJS no lee algo, no rompe).
 */
export async function readStylesIntoSheets(ExcelJS: any, buffer: ArrayBuffer, sheets: FortuneSheet[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer as any); } catch { return; }
  wb.eachSheet((ws: any, id: number) => {
    const sheet = sheets[id - 1];
    if (!sheet) return;
    sheet.celldata = sheet.celldata || [];
    const index = new Map<string, any>();
    for (const cd of sheet.celldata) index.set(`${cd.r}_${cd.c}`, cd);
    ws.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
      row.eachCell({ includeEmpty: false }, (cell: any, colNumber: number) => {
        const r = rowNumber - 1, c = colNumber - 1;
        const st = fortuneStyleFromCell(cell);
        const nf = typeof cell.numFmt === 'string' && cell.numFmt !== 'General' ? cell.numFmt : undefined;
        if (!Object.keys(st).length && !nf) return;
        let cd = index.get(`${r}_${c}`);
        if (!cd) { cd = { r, c, v: { v: '', m: '', ct: { fa: 'General', t: 's' } } }; sheet.celldata!.push(cd); index.set(`${r}_${c}`, cd); }
        if (!cd.v || typeof cd.v !== 'object') cd.v = { v: cd.v ?? '', m: cd.v == null ? '' : String(cd.v), ct: { fa: 'General', t: 's' } };
        Object.assign(cd.v, st);
        if (nf) cd.v.ct = { ...(cd.v.ct || {}), fa: nf };
      });
    });
  });
}
