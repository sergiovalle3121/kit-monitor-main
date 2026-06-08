/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Operaciones puras sobre el modelo de datos de Fortune-Sheet (celldata) para la
 * capa de profundidad «tipo Excel»: formato condicional avanzado, ordenar, quitar
 * duplicados, texto en columnas, notas de celda y buscar/reemplazar.
 *
 * Todas reciben/mutan una hoja ya clonada (el editor clona antes de llamar) y se
 * apoyan en el motor y el render de Fortune-Sheet (sin dependencias nuevas).
 */
import { parseRange } from './charts';

type Cell = { r: number; c: number; v: any };

export const rawOf = (cd: Cell): any => {
  const v = cd?.v;
  return v && typeof v === 'object' ? (v.v ?? v.m) : v;
};
const toNum = (raw: any): number | null => {
  if (typeof raw === 'number') return raw;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
};
function ensureObj(cd: Cell): any {
  if (cd.v && typeof cd.v === 'object') {
    cd.v.ct = cd.v.ct || { fa: 'General', t: typeof cd.v.v === 'number' ? 'n' : 's' };
    return cd.v;
  }
  const v = { v: cd.v, m: String(cd.v ?? ''), ct: { fa: 'General', t: typeof cd.v === 'number' ? 'n' : 's' } };
  cd.v = v;
  return v;
}
const ICONS = ['🔴', '🟡', '🟢', '⬆️', '➡️', '⬇️', '▲', '▬', '▼', '★', '☆'];
const stripIcon = (m: string) => {
  let s = m;
  for (const ic of ICONS) if (s.startsWith(ic + ' ')) { s = s.slice(ic.length + 1); break; }
  return s;
};
const hexToRgb = (h: string) => { const x = h.replace('#', ''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; };
const lerp = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = hexToRgb(a); const [r2, g2, b2] = hexToRgb(b);
  const k = Math.max(0, Math.min(1, t));
  const to = (x: number) => x.toString(16).padStart(2, '0');
  return `#${to(Math.round(r1 + (r2 - r1) * k))}${to(Math.round(g1 + (g2 - g1) * k))}${to(Math.round(b1 + (b2 - b1) * k))}`;
};
const textOn = (bg: string) => { const [r, g, b] = hexToRgb(bg); return (0.299 * r + 0.587 * g + 0.114 * b) < 140 ? '#ffffff' : '#111827'; };

export type CondKind = 'compare' | 'scale2' | 'scale3' | 'top' | 'bottom' | 'duplicates' | 'iconset' | 'clear';
export interface CondPayload {
  kind: CondKind; range: string; sheetIndex: number;
  op?: string; value?: string; color?: string;            // compare / top / bottom / duplicates
  c1?: string; c2?: string; c3?: string;                  // escalas de color
  n?: number;                                             // top/bottom N
  icons?: string[];                                       // conjunto de iconos
}

/** Aplica (hornea) formato condicional sobre las celdas del rango. */
export function applyConditional(sheet: any, p: CondPayload): boolean {
  const rng = parseRange(p.range); if (!rng || !sheet) return false;
  sheet.celldata = sheet.celldata || [];
  const inR = (r: number, c: number) => r >= rng.r1 && r <= rng.r2 && c >= rng.c1 && c <= rng.c2;
  const at: { cd: Cell; raw: any; n: number | null }[] = [];
  for (const cd of sheet.celldata) if (inR(cd.r, cd.c)) at.push({ cd, raw: rawOf(cd), n: toNum(rawOf(cd)) });
  const nums = at.filter((x) => x.n != null).map((x) => x.n as number);
  const style = (cd: Cell, bg?: string, fc?: string, icon?: string) => {
    const v = ensureObj(cd);
    if (bg !== undefined) v.bg = bg;
    if (fc !== undefined) v.fc = fc;
    if (icon !== undefined) v.m = `${icon} ${stripIcon(String(v.m ?? v.v ?? ''))}`;
  };

  switch (p.kind) {
    case 'clear':
      for (const { cd } of at) { const v = ensureObj(cd); delete v.bg; delete v.fc; if (v.m) v.m = stripIcon(String(v.m)); }
      break;
    case 'scale2':
    case 'scale3': {
      if (!nums.length) break;
      const min = Math.min(...nums), max = Math.max(...nums), mid = (min + max) / 2;
      const c1 = p.c1 || '#f8696b', c2 = p.c2 || (p.kind === 'scale2' ? '#63be7b' : '#ffeb84'), c3 = p.c3 || '#63be7b';
      for (const x of at) {
        if (x.n == null) continue;
        const color = p.kind === 'scale2'
          ? lerp(c1, c2, (x.n - min) / (max - min || 1))
          : (x.n <= mid ? lerp(c1, c2, (x.n - min) / ((mid - min) || 1)) : lerp(c2, c3, (x.n - mid) / ((max - mid) || 1)));
        style(x.cd, color, textOn(color));
      }
      break;
    }
    case 'top':
    case 'bottom': {
      if (!nums.length) break;
      const k = Math.max(1, p.n || 3);
      const sorted = [...nums].sort((a, b) => (p.kind === 'top' ? b - a : a - b));
      const threshold = sorted[Math.min(k, sorted.length) - 1];
      const color = p.color || '#ffd54f';
      for (const x of at) { if (x.n == null) continue; if (p.kind === 'top' ? x.n >= threshold : x.n <= threshold) style(x.cd, color, textOn(color)); }
      break;
    }
    case 'duplicates': {
      const counts = new Map<string, number>();
      for (const x of at) { if (x.raw === '' || x.raw == null) continue; const key = String(x.raw); counts.set(key, (counts.get(key) || 0) + 1); }
      const color = p.color || '#f8696b';
      for (const x of at) { if (x.raw === '' || x.raw == null) continue; if ((counts.get(String(x.raw)) || 0) > 1) style(x.cd, color, textOn(color)); }
      break;
    }
    case 'iconset': {
      if (!nums.length) break;
      const min = Math.min(...nums), max = Math.max(...nums), t1 = min + (max - min) / 3, t2 = min + 2 * (max - min) / 3;
      const icons = p.icons && p.icons.length === 3 ? p.icons : ['🔴', '🟡', '🟢'];
      for (const x of at) { if (x.n == null) continue; style(x.cd, undefined, undefined, x.n <= t1 ? icons[0] : x.n <= t2 ? icons[1] : icons[2]); }
      break;
    }
    case 'compare': {
      const cmp = p.value ?? '';
      const num = parseFloat(cmp);
      const matches = (raw: any) => {
        if (p.op === 'contains') return String(raw ?? '').toLowerCase().includes(cmp.toLowerCase());
        const n = typeof raw === 'number' ? raw : parseFloat(raw);
        if (Number.isNaN(n)) return p.op === '=' ? String(raw) === cmp : p.op === '!=' ? String(raw) !== cmp : false;
        switch (p.op) {
          case '>': return n > num; case '>=': return n >= num;
          case '<': return n < num; case '<=': return n <= num;
          case '=': return n === num; case '!=': return n !== num;
          default: return false;
        }
      };
      const color = p.color || '#dcfce7';
      for (const x of at) { if (x.raw === '' || x.raw == null) continue; if (matches(x.raw)) style(x.cd, color, textOn(color)); }
      break;
    }
  }
  return true;
}

// ── Ordenar / duplicados / texto en columnas / notas ─────────────────────────
interface RangeOp { range: string; sheetIndex: number }

function partition(sheet: any, rng: { r1: number; c1: number; r2: number; c2: number }) {
  const all: Cell[] = sheet.celldata || [];
  const inR = (cd: Cell) => cd.r >= rng.r1 && cd.r <= rng.r2 && cd.c >= rng.c1 && cd.c <= rng.c2;
  return { outside: all.filter((cd) => !inR(cd)), within: all.filter(inR) };
}

export function sortRange(sheet: any, p: RangeOp & { colRel: number; order: 'asc' | 'desc'; hasHeader: boolean }): boolean {
  const rng = parseRange(p.range); if (!rng) return false;
  const { outside, within } = partition(sheet, rng);
  const startR = p.hasHeader ? rng.r1 + 1 : rng.r1;
  const header = p.hasHeader ? within.filter((cd) => cd.r === rng.r1) : [];
  const byRow = new Map<number, Cell[]>();
  for (const cd of within) { if (cd.r < startR) continue; (byRow.get(cd.r) ?? byRow.set(cd.r, []).get(cd.r)!).push(cd); }
  const sortCol = rng.c1 + p.colRel;
  const rows = [...byRow.values()];
  const keyOf = (cells: Cell[]) => { const cell = cells.find((cd) => cd.c === sortCol); return cell ? rawOf(cell) : null; };
  rows.sort((a, b) => {
    const ka = keyOf(a), kb = keyOf(b); const na = Number(ka), nb = Number(kb);
    let cmp: number;
    if (!Number.isNaN(na) && !Number.isNaN(nb) && ka !== '' && ka != null && kb !== '' && kb != null) cmp = na - nb;
    else cmp = String(ka ?? '').localeCompare(String(kb ?? ''));
    return p.order === 'desc' ? -cmp : cmp;
  });
  const out = [...header]; let rr = startR;
  for (const cells of rows) { for (const cd of cells) out.push({ ...cd, r: rr }); rr++; }
  sheet.celldata = [...outside, ...out];
  return true;
}

export function removeDuplicates(sheet: any, p: RangeOp & { hasHeader: boolean }): number {
  const rng = parseRange(p.range); if (!rng) return -1;
  const { outside, within } = partition(sheet, rng);
  const startR = p.hasHeader ? rng.r1 + 1 : rng.r1;
  const header = p.hasHeader ? within.filter((cd) => cd.r === rng.r1) : [];
  const byRow = new Map<number, Cell[]>();
  for (const cd of within) { if (cd.r < startR) continue; (byRow.get(cd.r) ?? byRow.set(cd.r, []).get(cd.r)!).push(cd); }
  const rows = [...byRow.values()];
  const seen = new Set<string>(); const uniq: Cell[][] = [];
  for (const cells of rows) {
    const sig = JSON.stringify(cells.slice().sort((a, b) => a.c - b.c).map((cd) => [cd.c, rawOf(cd)]));
    if (seen.has(sig)) continue; seen.add(sig); uniq.push(cells);
  }
  const out = [...header]; let rr = startR;
  for (const cells of uniq) { for (const cd of cells) out.push({ ...cd, r: rr }); rr++; }
  sheet.celldata = [...outside, ...out];
  return rows.length - uniq.length;
}

export function textToColumns(sheet: any, p: RangeOp & { delimiter: string }): boolean {
  const rng = parseRange(p.range); if (!rng) return false;
  sheet.celldata = sheet.celldata || [];
  const map = new Map<string, Cell>();
  for (const cd of sheet.celldata) map.set(`${cd.r}_${cd.c}`, cd);
  const delim = p.delimiter || ',';
  for (let r = rng.r1; r <= rng.r2; r++) {
    const src = map.get(`${r}_${rng.c1}`);
    if (!src) continue;
    const parts = String(rawOf(src) ?? '').split(delim);
    parts.forEach((part, i) => {
      const key = `${r}_${rng.c1 + i}`;
      const val = part.trim();
      const cell = map.get(key) || { r, c: rng.c1 + i, v: null };
      cell.v = { v: val, m: val, ct: { fa: 'General', t: 's' } };
      map.set(key, cell);
    });
  }
  sheet.celldata = [...map.values()];
  return true;
}

export function setCellNote(sheet: any, cellRef: string, text: string): boolean {
  const rng = parseRange(cellRef); if (!rng) return false;
  const r = rng.r1, c = rng.c1;
  sheet.celldata = sheet.celldata || [];
  let cd = sheet.celldata.find((x: Cell) => x.r === r && x.c === c);
  if (!cd) { cd = { r, c, v: { v: '', m: '', ct: { fa: 'General', t: 's' } } }; sheet.celldata.push(cd); }
  const v = ensureObj(cd);
  if (text.trim()) v.ps = { left: 0, top: 0, width: 160, height: 80, value: text.trim(), isShow: false };
  else delete v.ps;
  return true;
}

export interface MatchAddr { sheetIndex: number; r: number; c: number; addr: string }

/** Busca coincidencias de texto en todas las hojas (sin mutar). */
export function findMatches(sheets: any[], query: string, caseSensitive: boolean): MatchAddr[] {
  const out: MatchAddr[] = [];
  if (!query) return out;
  const needle = caseSensitive ? query : query.toLowerCase();
  sheets.forEach((sheet, si) => {
    for (const cd of sheet?.celldata ?? []) {
      const raw = rawOf(cd); if (raw == null) continue;
      const hay = caseSensitive ? String(raw) : String(raw).toLowerCase();
      if (hay.includes(needle)) out.push({ sheetIndex: si, r: cd.r, c: cd.c, addr: `${colName(cd.c)}${cd.r + 1}` });
    }
  });
  return out;
}

/** Reemplaza todas las coincidencias (muta las hojas clonadas). Devuelve el conteo. */
export function replaceAll(sheets: any[], query: string, replacement: string, caseSensitive: boolean): number {
  if (!query) return 0;
  let count = 0;
  const rx = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
  for (const sheet of sheets) {
    for (const cd of sheet?.celldata ?? []) {
      const raw = rawOf(cd); if (raw == null || typeof raw === 'number') continue;
      const s = String(raw);
      if (!rx.test(s)) continue;
      rx.lastIndex = 0;
      const next = s.replace(rx, replacement);
      count += (s.match(rx) || []).length;
      const v = ensureObj(cd); v.v = next; v.m = next;
    }
  }
  return count;
}

// ── Utilidades de rango/matriz ───────────────────────────────────────────────
/** Nombre de columna A1 (0→A, 26→AA…). */
export const colName = (c: number) => { let s = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const a1 = (r: number, c: number) => `${colName(c)}${r + 1}`;

/** Lee un rango de una hoja a una matriz de valores crudos (incluida cabecera). */
export function readMatrix(sheet: any, range: string): { headers: string[]; rows: any[][]; rng: { r1: number; c1: number; r2: number; c2: number } } | null {
  const rng = parseRange(range); if (!rng || !sheet) return null;
  const map = new Map<string, any>();
  for (const cd of sheet.celldata ?? []) map.set(`${cd.r}_${cd.c}`, rawOf(cd));
  const headers: string[] = [];
  for (let c = rng.c1; c <= rng.c2; c++) headers.push(String(map.get(`${rng.r1}_${c}`) ?? `Columna ${colName(c)}`));
  const rows: any[][] = [];
  for (let r = rng.r1 + 1; r <= rng.r2; r++) {
    const row: any[] = []; let any = false;
    for (let c = rng.c1; c <= rng.c2; c++) { const v = map.get(`${r}_${c}`); if (v != null && v !== '') any = true; row.push(v ?? null); }
    if (any) rows.push(row);
  }
  return { headers, rows, rng };
}

// ── Tablas dinámicas (pivot) — motor propio sobre celldata ───────────────────
export type AggFn = 'sum' | 'count' | 'counta' | 'avg' | 'min' | 'max' | 'product' | 'stdev' | 'var';
export const AGG_LABEL: Record<AggFn, string> = {
  sum: 'Suma', count: 'Cuenta', counta: 'Cuenta (no vacías)', avg: 'Promedio',
  min: 'Mín', max: 'Máx', product: 'Producto', stdev: 'Desv.Est', var: 'Varianza',
};
export interface PivotValueField { field: string; agg: AggFn; label?: string }
export interface PivotConfig {
  range: string;
  sheetIndex: number;
  rows: string[];                 // campos (cabeceras) en Filas (anidados)
  cols: string[];                 // campos en Columnas (anidados)
  values: PivotValueField[];      // campos de Valores con su agregación
  filters?: { field: string; include: string[] }[]; // filtros por valor
  showRowTotals?: boolean;        // columna(s) «Total general» a la derecha
  showColTotals?: boolean;        // fila «Total general» abajo
  showSubtotals?: boolean;        // subtotales del campo de fila más externo
}
export type PivotCellType = 'corner' | 'colhdr' | 'rowhdr' | 'value' | 'subtotal' | 'grandtotal' | 'empty';
export interface PivotCellOut { v: string | number | null; t: PivotCellType; bold?: boolean; num?: boolean }
export interface PivotResult { matrix: PivotCellOut[][]; nRows: number; nCols: number; warnings: string[] }

const toNumStrict = (raw: any): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null || raw === '') return null;
  const n = Number(raw); return Number.isNaN(n) ? null : n;
};

/** Aplica una agregación a una lista de valores crudos. */
export function aggregate(vals: any[], fn: AggFn): number {
  if (fn === 'counta') return vals.filter((v) => v != null && v !== '').length;
  const nums = vals.map(toNumStrict).filter((n): n is number => n != null);
  switch (fn) {
    case 'count': return nums.length;
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'product': return nums.length ? nums.reduce((a, b) => a * b, 1) : 0;
    case 'avg': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'min': return nums.length ? Math.min(...nums) : 0;
    case 'max': return nums.length ? Math.max(...nums) : 0;
    case 'stdev':
    case 'var': {
      if (nums.length < 2) return 0;
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const ss = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1);
      return fn === 'var' ? ss : Math.sqrt(ss);
    }
    default: return 0;
  }
}

/** Redondeo «bonito» para celdas de pivot (evita 0.30000004). */
export function roundNice(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (Number.isInteger(n)) return n;
  return Math.round(n * 1e6) / 1e6;
}

const jk = (arr: unknown): string => JSON.stringify(arr);
const cmpKey = (a: string[], b: string[]): number => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? '', y = b[i] ?? '';
    const nx = Number(x), ny = Number(y);
    const bothNum = x !== '' && y !== '' && !Number.isNaN(nx) && !Number.isNaN(ny);
    const c = bothNum ? nx - ny : String(x).localeCompare(String(y), 'es', { numeric: true });
    if (c !== 0) return c;
  }
  return 0;
};

/**
 * Construye una tabla dinámica a partir de la hoja origen y la configuración.
 * Devuelve una matriz lista para volcar a celdas (con marcas de cabecera/total).
 * Soporta filas y columnas anidadas, múltiples valores, subtotales y totales.
 */
export function buildPivot(sheet: any, cfg: PivotConfig): PivotResult {
  const warnings: string[] = [];
  const read = readMatrix(sheet, cfg.range);
  if (!read) return { matrix: [], nRows: 0, nCols: 0, warnings: ['Rango inválido. Ej.: A1:D100'] };
  const { headers, rows } = read;
  const idxOf = (name: string) => headers.indexOf(name);
  const values = cfg.values.length ? cfg.values : [{ field: headers[headers.length - 1] ?? '', agg: 'count' as AggFn }];
  const rowFields = cfg.rows.filter((f) => idxOf(f) >= 0);
  const colFields = cfg.cols.filter((f) => idxOf(f) >= 0);
  if (!rows.length) warnings.push('El rango no contiene filas de datos.');

  // Filtros por valor.
  let recs = rows;
  for (const f of cfg.filters ?? []) {
    const ci = idxOf(f.field); if (ci < 0 || !f.include?.length) continue;
    const inc = new Set(f.include.map(String));
    recs = recs.filter((row) => inc.has(String(row[ci] ?? '')));
  }

  const rowKeyOf = (rec: any[]) => rowFields.map((f) => String(rec[idxOf(f)] ?? ''));
  const colKeyOf = (rec: any[]) => colFields.map((f) => String(rec[idxOf(f)] ?? ''));

  // Buckets para agregación eficiente (una pasada O(N)).
  const cellRecs = new Map<string, any[][]>();     // rowKey \0 colKey -> recs
  const rowRecs = new Map<string, any[][]>();       // rowKey -> recs (para total de fila)
  const colRecs = new Map<string, any[][]>();       // colKey -> recs (para total de columna)
  const outerRecs = new Map<string, any[][]>();     // valor del 1er campo de fila -> recs (subtotal)
  const rowKeySet = new Map<string, string[]>();
  const colKeySet = new Map<string, string[]>();
  const push = (m: Map<string, any[][]>, k: string, rec: any[]) => { const a = m.get(k); if (a) a.push(rec); else m.set(k, [rec]); };

  for (const rec of recs) {
    const rk = rowKeyOf(rec), ck = colKeyOf(rec);
    const rkj = jk(rk), ckj = jk(ck);
    rowKeySet.set(rkj, rk); colKeySet.set(ckj, ck);
    push(cellRecs, jk([rk, ck]), rec);
    push(rowRecs, rkj, rec);
    push(colRecs, ckj, rec);
    if (rowFields.length) push(outerRecs, rk[0], rec);
  }

  const rowKeys = [...rowKeySet.values()].sort(cmpKey);
  const colKeys = colFields.length ? [...colKeySet.values()].sort(cmpKey) : [[]];
  const multiVal = values.length > 1;
  const showRowTotals = cfg.showRowTotals !== false;
  const showColTotals = cfg.showColTotals !== false;
  const showSub = !!cfg.showSubtotals && rowFields.length >= 2;

  const aggAt = (recsArr: any[][] | undefined, vf: PivotValueField): number | null => {
    if (!recsArr || !recsArr.length) return null;
    const ci = idxOf(vf.field); if (ci < 0) return null;
    return roundNice(aggregate(recsArr.map((r) => r[ci]), vf.agg));
  };

  // ── Cabeceras de columna ──────────────────────────────────────────────────
  // Columnas de datos = colKeys × values  (+ totales de fila al final).
  const leftW = Math.max(1, rowFields.length);
  const dataCols: { ck: string[]; vf: PivotValueField }[] = [];
  for (const ck of colKeys) for (const vf of values) dataCols.push({ ck, vf });
  const totalCols: PivotValueField[] = showRowTotals ? values : [];
  const nCols = leftW + dataCols.length + totalCols.length;

  // Nº de filas de cabecera: una por cada nivel de columna + (si hay varios valores) una para la etiqueta del valor.
  const colLevels = colFields.length;
  const headerRows = Math.max(1, colLevels + (multiVal || colLevels === 0 ? 1 : 0));
  const matrix: PivotCellOut[][] = [];
  const vfLabel = (vf: PivotValueField) => vf.label || `${AGG_LABEL[vf.agg]} de ${vf.field}`;

  for (let hr = 0; hr < headerRows; hr++) {
    const row: PivotCellOut[] = [];
    // Esquina superior izquierda: nombres de los campos de fila en la última fila de cabecera.
    for (let lc = 0; lc < leftW; lc++) {
      const isLast = hr === headerRows - 1;
      row.push({ v: isLast ? (rowFields[lc] ?? (rowFields.length ? '' : 'Valores')) : null, t: 'corner', bold: true });
    }
    for (const dc of dataCols) {
      let label: string | number | null = null;
      if (colLevels === 0) label = vfLabel(dc.vf);             // sin columnas: única fila = etiqueta de valor
      else if (hr < colLevels) label = dc.ck[hr] ?? '';        // niveles de columna
      else label = vfLabel(dc.vf);                              // fila extra de etiqueta de valor
      row.push({ v: label, t: 'colhdr', bold: true });
    }
    for (const vf of totalCols) {
      const isLabelRow = (colLevels === 0) || hr === headerRows - 1;
      row.push({ v: isLabelRow ? (multiVal ? `Total · ${vfLabel(vf)}` : 'Total general') : 'Total general', t: 'colhdr', bold: true });
    }
    matrix.push(row);
  }

  // ── Cuerpo ─────────────────────────────────────────────────────────────────
  const bodyRow = (label: string[], type: PivotCellType, recsFor: (ck: string[]) => any[][] | undefined, totalRecs: any[][] | undefined): PivotCellOut[] => {
    const row: PivotCellOut[] = [];
    for (let lc = 0; lc < leftW; lc++) row.push({ v: label[lc] ?? '', t: type === 'value' ? 'rowhdr' : type, bold: type !== 'value' });
    for (const dc of dataCols) {
      const v = aggAt(recsFor(dc.ck), dc.vf);
      row.push({ v: v == null ? null : v, t: type === 'value' ? 'value' : type, num: v != null, bold: type !== 'value' });
    }
    for (const vf of totalCols) {
      const v = aggAt(totalRecs, vf);
      row.push({ v: v == null ? null : v, t: type === 'value' ? 'value' : type, num: v != null, bold: true });
    }
    return row;
  };

  let prevOuter: string | null = null;
  for (let i = 0; i < rowKeys.length; i++) {
    const rk = rowKeys[i];
    const rkj = jk(rk);
    // Subtotal del grupo externo anterior, al cambiar de valor externo.
    if (showSub && prevOuter !== null && rk[0] !== prevOuter) {
      matrix.push(bodyRow(
        [`${prevOuter} — Total`], 'subtotal',
        (ck) => unionRecs(outerRecs.get(prevOuter!), colRecs.get(jk(ck))),
        outerRecs.get(prevOuter),
      ));
    }
    matrix.push(bodyRow(
      rk, 'value',
      (ck) => cellRecs.get(jk([rk, ck])),
      rowRecs.get(rkj),
    ));
    prevOuter = rowFields.length ? rk[0] : null;
  }
  // Último subtotal.
  if (showSub && prevOuter !== null) {
    matrix.push(bodyRow(
      [`${prevOuter} — Total`], 'subtotal',
      (ck) => unionRecs(outerRecs.get(prevOuter!), colRecs.get(jk(ck))),
      outerRecs.get(prevOuter),
    ));
  }

  // Fila de total general.
  if (showColTotals && rowKeys.length) {
    matrix.push(bodyRow(
      ['Total general'], 'grandtotal',
      (ck) => colRecs.get(jk(ck)),
      recs,
    ));
  }

  return { matrix, nRows: matrix.length, nCols, warnings };
}

/** Intersección de dos conjuntos de registros (por identidad de referencia). */
function unionRecs(a: any[][] | undefined, b: any[][] | undefined): any[][] {
  if (!a || !b) return [];
  const set = new Set(b);
  return a.filter((r) => set.has(r));
}

/** Convierte el resultado de un pivot en celldata de Fortune-Sheet (con estilos). */
export function pivotToCelldata(res: PivotResult, originR = 0, originC = 0): any[] {
  const out: any[] = [];
  res.matrix.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.v == null || cell.v === '') {
        if (cell.t === 'empty') return;
      }
      const isNum = cell.num && typeof cell.v === 'number';
      const m = cell.v == null ? '' : (isNum ? String(cell.v) : String(cell.v));
      const v: any = { v: cell.v ?? '', m, ct: { fa: 'General', t: isNum ? 'n' : 's' } };
      if (cell.bold) v.bl = 1;
      if (cell.t === 'corner' || cell.t === 'colhdr') { v.bg = '#1f6feb'; v.fc = '#ffffff'; }
      else if (cell.t === 'rowhdr') { v.bg = '#eef2ff'; }
      else if (cell.t === 'subtotal') { v.bg = '#e5edff'; }
      else if (cell.t === 'grandtotal') { v.bg = '#dbe7ff'; }
      if (isNum) v.ht = 2; // alinear números a la derecha
      out.push({ r: originR + r, c: originC + c, v });
    });
  });
  return out;
}

/** Rango usado (A1) que cubre todo el celldata de una hoja; null si está vacía. */
export function usedRange(sheet: any): string | null {
  const cd = sheet?.celldata ?? [];
  if (!cd.length) return null;
  let r1 = Infinity, c1 = Infinity, r2 = -1, c2 = -1;
  for (const x of cd) {
    const raw = rawOf(x); if (raw == null || raw === '') continue;
    if (x.r < r1) r1 = x.r; if (x.c < c1) c1 = x.c;
    if (x.r > r2) r2 = x.r; if (x.c > c2) c2 = x.c;
  }
  if (r2 < 0) return null;
  return `${a1(r1, c1)}:${a1(r2, c2)}`;
}

/** Lista de campos (cabeceras) de un rango, para el constructor de pivot. */
export function pivotFields(sheet: any, range: string): string[] {
  const read = readMatrix(sheet, range);
  return read ? read.headers : [];
}

/** Valores distintos de un campo dentro de un rango (para filtros). */
export function fieldValues(sheet: any, range: string, field: string): string[] {
  const read = readMatrix(sheet, range); if (!read) return [];
  const ci = read.headers.indexOf(field); if (ci < 0) return [];
  const set = new Set<string>();
  for (const row of read.rows) set.add(String(row[ci] ?? ''));
  return [...set].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

// ── Formatos de número (moneda, %, fecha, científico, fracción, personalizado) ─
export interface NumFmtOpts { currency?: string }
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Presets nombrados → código de formato real (estilo Excel) que entiende Fortune-Sheet. */
export const NUMFMT_PRESETS: { id: string; label: string; code: string; sample: string }[] = [
  { id: 'general', label: 'General', code: 'General', sample: '1234.5' },
  { id: 'int', label: 'Número', code: '#,##0', sample: '1,235' },
  { id: 'dec2', label: 'Número (2 dec.)', code: '#,##0.00', sample: '1,234.50' },
  { id: 'currency', label: 'Moneda', code: '$#,##0.00', sample: '$1,234.50' },
  { id: 'accounting', label: 'Contable', code: '$ #,##0.00;($ #,##0.00)', sample: '$ 1,234.50' },
  { id: 'pct0', label: 'Porcentaje', code: '0%', sample: '12%' },
  { id: 'pct2', label: 'Porcentaje (2 dec.)', code: '0.00%', sample: '12.34%' },
  { id: 'sci', label: 'Científico', code: '0.00E+00', sample: '1.23E+03' },
  { id: 'frac', label: 'Fracción', code: '# ??/??', sample: '1 1/2' },
  { id: 'date', label: 'Fecha corta', code: 'dd/mm/yyyy', sample: '15/01/2026' },
  { id: 'datel', label: 'Fecha larga', code: 'd "de" mmmm "de" yyyy', sample: '15 de enero de 2026' },
  { id: 'time', label: 'Hora', code: 'hh:mm', sample: '13:45' },
  { id: 'datetime', label: 'Fecha y hora', code: 'dd/mm/yyyy hh:mm', sample: '15/01/2026 13:45' },
];

const decimalsOf = (code: string): number => {
  const seg = code.split(';')[0];
  const frac = seg.includes('.') ? seg.split('.')[1] : '';
  return (frac.match(/[0#]/g) ?? []).length;
};
const groupNum = (n: number, dec: number, grouped: boolean): string => {
  const fixed = n.toFixed(dec);
  const [int, frac] = fixed.split('.');
  const gi = grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : int;
  return frac ? `${gi}.${frac}` : gi;
};
/** Convierte un valor (serial Excel, ISO, o Date) a Date UTC; null si no es fecha. */
export function toDate(value: any): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value < -1 || value > 600000) return null; // fuera del rango de seriales razonables
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
  }
  if (typeof value === 'string') {
    const s = value.trim(); if (!/\d/.test(s)) return null;
    const t = Date.parse(s); if (!Number.isNaN(t)) return new Date(t);
  }
  return null;
}
function formatDate(d: Date, code: string): string {
  const Y = d.getUTCFullYear(), Mo = d.getUTCMonth(), D = d.getUTCDate();
  const H = d.getUTCHours(), Mi = d.getUTCMinutes(), S = d.getUTCSeconds();
  const p2 = (x: number) => String(x).padStart(2, '0');
  // Tokeniza en literales (comillas / símbolos) y runs de la misma letra de formato.
  const tokens: { type: 'lit' | 'fmt'; v: string }[] = [];
  for (let i = 0; i < code.length;) {
    const ch = code[i];
    if (ch === '"') { const end = code.indexOf('"', i + 1); tokens.push({ type: 'lit', v: end < 0 ? code.slice(i + 1) : code.slice(i + 1, end) }); i = end < 0 ? code.length : end + 1; continue; }
    if (/[a-zA-Z]/.test(ch)) { let j = i; while (j < code.length && code[j].toLowerCase() === ch.toLowerCase()) j++; tokens.push({ type: 'fmt', v: code.slice(i, j) }); i = j; continue; }
    tokens.push({ type: 'lit', v: ch }); i++;
  }
  // 'm' es minutos si esta junto a horas (antes) o segundos (despues); si no, mes.
  const isMinute = (idx: number): boolean => {
    for (let k = idx - 1; k >= 0; k--) { const t = tokens[k]; if (t.type === 'fmt') return /^h+$/i.test(t.v); if (t.v.trim() !== '' && t.v !== ':') break; }
    for (let k = idx + 1; k < tokens.length; k++) { const t = tokens[k]; if (t.type === 'fmt') return /^s+$/i.test(t.v); if (t.v.trim() !== '' && t.v !== ':') break; }
    return false;
  };
  return tokens.map((t, idx) => {
    if (t.type === 'lit') return t.v;
    const f = t.v.toLowerCase();
    if (/^y+$/.test(f)) return f.length <= 2 ? p2(Y % 100) : String(Y);
    if (/^m+$/.test(f)) {
      if (f.length >= 4) return MONTHS_FULL[Mo];
      if (f.length === 3) return MONTHS_ES[Mo];
      if (isMinute(idx)) return f.length >= 2 ? p2(Mi) : String(Mi);
      return f.length >= 2 ? p2(Mo + 1) : String(Mo + 1);
    }
    if (/^d+$/.test(f)) return f.length >= 2 ? p2(D) : String(D);
    if (/^h+$/.test(f)) return f.length >= 2 ? p2(H) : String(H);
    if (/^s+$/.test(f)) return f.length >= 2 ? p2(S) : String(S);
    return t.v;
  }).join('');
}
function toFraction(n: number, maxDen = 99): string {
  const sign = n < 0 ? '-' : ''; const x = Math.abs(n);
  const whole = Math.floor(x); let frac = x - whole;
  if (frac < 1e-9) return `${sign}${whole}`;
  let bestN = 1, bestD = 1, bestErr = Infinity;
  for (let d = 1; d <= maxDen; d++) { const nn = Math.round(frac * d); const err = Math.abs(frac - nn / d); if (err < bestErr && nn > 0) { bestErr = err; bestN = nn; bestD = d; } }
  return whole > 0 ? `${sign}${whole} ${bestN}/${bestD}` : `${sign}${bestN}/${bestD}`;
}

/** Formatea un valor según un código tipo Excel. Subconjunto práctico y robusto. */
export function formatNumber(value: any, code: string, opts: NumFmtOpts = {}): string {
  const cur = opts.currency ?? '$';
  if (code == null || code === '' || code === 'General' || code === '@') return value == null ? '' : String(value);
  const seg = code.split(';')[0];
  const looksDate = /[ymdhs]/i.test(seg) && !/[#0]/.test(seg.replace(/"[^"]*"/g, ''));
  if (looksDate) { const d = toDate(value); if (d) return formatDate(d, code); }
  const n = toNumStrict(value);
  if (n == null) return value == null ? '' : String(value);
  if (code.includes('%')) { const dec = decimalsOf(code); return `${groupNum(n * 100, dec, code.includes(','))}%`; }
  if (/e\+?0/i.test(code)) {
    const dec = (seg.split(/[eE]/)[0].split('.')[1]?.match(/0/g)?.length) ?? 2;
    const e = n.toExponential(dec);
    const mm = /^(-?\d(?:\.\d+)?)e([+-])(\d+)$/i.exec(e);
    return mm ? `${mm[1]}E${mm[2]}${mm[3].padStart(2, '0')}` : e.toUpperCase();
  }
  if (/\?\s*\/\s*\?/.test(code)) return toFraction(n);
  const isCurrency = code.includes('$') || seg.toLowerCase().includes(cur.toLowerCase());
  const accounting = code.split(';').length > 1 && code.includes('(');
  const dec = decimalsOf(code);
  const grouped = code.includes(',') || isCurrency;
  const body = groupNum(Math.abs(n), dec, grouped);
  let s = (isCurrency ? cur + (seg.includes('$ ') ? ' ' : '') : '') + body;
  if (n < 0) s = accounting ? `(${s})` : `-${s}`;
  return s;
}

/** Aplica un código de formato de número a un rango (baked en `m`, código en `ct.fa`). */
export function applyNumberFormat(sheet: any, range: string, code: string, opts?: NumFmtOpts): number {
  const rng = parseRange(range); if (!rng || !sheet) return 0;
  sheet.celldata = sheet.celldata || [];
  const map = new Map<string, Cell>();
  for (const cd of sheet.celldata) map.set(`${cd.r}_${cd.c}`, cd);
  let count = 0;
  for (let r = rng.r1; r <= rng.r2; r++) {
    for (let c = rng.c1; c <= rng.c2; c++) {
      const cd = map.get(`${r}_${c}`); if (!cd) continue;
      const v = ensureObj(cd);
      v.ct = v.ct || {};
      v.ct.fa = code === 'General' ? 'General' : code;
      if (toNumStrict(v.v) != null) v.ct.t = 'n';
      v.m = formatNumber(v.v, code, opts);
      count++;
    }
  }
  return count;
}

// ── Estilos de celda (presets tipo Excel) + alineación / ajuste ───────────────
export interface CellStyle {
  bg?: string | null; fc?: string | null; bold?: boolean; italic?: boolean;
  align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean; fs?: number; clear?: boolean;
}
/** Galería de estilos de celda (id → estilo). */
export const CELL_STYLES: { id: string; label: string; style: CellStyle }[] = [
  { id: 'normal', label: 'Normal', style: { clear: true } },
  { id: 'title', label: 'Título', style: { bold: true, fs: 18, fc: '#0f172a' } },
  { id: 'heading', label: 'Encabezado', style: { bold: true, fs: 13, fc: '#1e3a8a', bg: '#eff6ff' } },
  { id: 'accent', label: 'Énfasis', style: { bold: true, fc: '#ffffff', bg: '#1f6feb' } },
  { id: 'total', label: 'Total', style: { bold: true, bg: '#f1f5f9' } },
  { id: 'good', label: 'Bueno', style: { fc: '#006100', bg: '#c6efce' } },
  { id: 'bad', label: 'Malo', style: { fc: '#9c0006', bg: '#ffc7ce' } },
  { id: 'neutral', label: 'Neutral', style: { fc: '#9c6500', bg: '#ffeb9c' } },
  { id: 'note', label: 'Nota', style: { italic: true, fc: '#475569', bg: '#fffbe6' } },
];
const HT: Record<string, number> = { center: 0, left: 1, right: 2 };
const VT: Record<string, number> = { middle: 0, top: 1, bottom: 2 };

/** Aplica un estilo de celda a un rango. Crea celdas vacías en áreas pequeñas. */
export function applyCellStyle(sheet: any, range: string, style: CellStyle): number {
  const rng = parseRange(range); if (!rng || !sheet) return 0;
  sheet.celldata = sheet.celldata || [];
  const map = new Map<string, Cell>();
  for (const cd of sheet.celldata) map.set(`${cd.r}_${cd.c}`, cd);
  const area = (rng.r2 - rng.r1 + 1) * (rng.c2 - rng.c1 + 1);
  const createEmpty = area <= 4000; // evita inflar el modelo en rangos enormes
  let count = 0;
  for (let r = rng.r1; r <= rng.r2; r++) {
    for (let c = rng.c1; c <= rng.c2; c++) {
      let cd = map.get(`${r}_${c}`);
      if (!cd) { if (!createEmpty) continue; cd = { r, c, v: { v: '', m: '', ct: { fa: 'General', t: 's' } } }; sheet.celldata.push(cd); map.set(`${r}_${c}`, cd); }
      const v = ensureObj(cd);
      if (style.clear) { delete v.bg; delete v.fc; delete v.bl; delete v.it; delete v.ht; delete v.vt; delete v.tb; delete v.fs; count++; continue; }
      if (style.bg !== undefined) { if (style.bg === null) delete v.bg; else v.bg = style.bg; }
      if (style.fc !== undefined) { if (style.fc === null) delete v.fc; else v.fc = style.fc; }
      if (style.bold !== undefined) v.bl = style.bold ? 1 : 0;
      if (style.italic !== undefined) v.it = style.italic ? 1 : 0;
      if (style.fs !== undefined) v.fs = style.fs;
      if (style.align) v.ht = HT[style.align];
      if (style.valign) v.vt = VT[style.valign];
      if (style.wrap !== undefined) v.tb = style.wrap ? 2 : 1; // 2 = ajustar texto
      count++;
    }
  }
  return count;
}

// ── Ordenar multinivel ───────────────────────────────────────────────────────
export interface SortKey { colRel: number; order: 'asc' | 'desc' }
const cmpVals = (ka: any, kb: any): number => {
  const na = Number(ka), nb = Number(kb);
  const bothNum = ka !== '' && ka != null && kb !== '' && kb != null && !Number.isNaN(na) && !Number.isNaN(nb);
  return bothNum ? na - nb : String(ka ?? '').localeCompare(String(kb ?? ''), 'es', { numeric: true });
};

/** Ordena un rango por varias columnas (claves) en orden de prioridad. */
export function sortRangeMulti(sheet: any, p: { range: string; hasHeader: boolean; keys: SortKey[] }): boolean {
  const rng = parseRange(p.range); if (!rng || !p.keys.length) return false;
  const { outside, within } = partition(sheet, rng);
  const startR = p.hasHeader ? rng.r1 + 1 : rng.r1;
  const header = p.hasHeader ? within.filter((cd) => cd.r === rng.r1) : [];
  const byRow = new Map<number, Cell[]>();
  for (const cd of within) { if (cd.r < startR) continue; (byRow.get(cd.r) ?? byRow.set(cd.r, []).get(cd.r)!).push(cd); }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  const keyOf = (cells: Cell[], colRel: number) => { const cell = cells.find((cd) => cd.c === rng.c1 + colRel); return cell ? rawOf(cell) : null; };
  rows.sort((a, b) => {
    for (const k of p.keys) { const c = cmpVals(keyOf(a, k.colRel), keyOf(b, k.colRel)); if (c !== 0) return k.order === 'desc' ? -c : c; }
    return 0;
  });
  const out = [...header]; let rr = startR;
  for (const cells of rows) { for (const cd of cells) out.push({ ...cd, r: rr }); rr++; }
  sheet.celldata = [...outside, ...out];
  return true;
}

// ── Subtotales por grupos ────────────────────────────────────────────────────
const styledCell = (r: number, c: number, value: any, num: boolean): Cell => ({
  r, c, v: { v: value, m: String(value ?? ''), ct: { fa: 'General', t: num ? 'n' : 's' }, bl: 1, bg: '#eef2ff' } as any,
});

/**
 * Inserta filas de subtotal por cada grupo consecutivo del campo indicado y un
 * total general. Recomienda ordenar antes por el campo de grupo. Desplaza hacia
 * abajo el contenido por debajo del rango.
 */
export function applySubtotals(sheet: any, p: { range: string; hasHeader: boolean; groupColRel: number; valueColRels: number[]; fn: AggFn }): number {
  const rng = parseRange(p.range); if (!rng) return 0;
  const all: Cell[] = sheet.celldata || [];
  const above = all.filter((cd) => cd.r < rng.r1);
  const below = all.filter((cd) => cd.r > rng.r2);
  const within = all.filter((cd) => cd.r >= rng.r1 && cd.r <= rng.r2 && cd.c >= rng.c1 && cd.c <= rng.c2);
  const startR = p.hasHeader ? rng.r1 + 1 : rng.r1;
  const header = p.hasHeader ? within.filter((cd) => cd.r === rng.r1) : [];
  const byRow = new Map<number, Cell[]>();
  for (const cd of within) { if (cd.r < startR) continue; (byRow.get(cd.r) ?? byRow.set(cd.r, []).get(cd.r)!).push(cd); }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  const groupCol = rng.c1 + p.groupColRel;
  const valCols = p.valueColRels.map((rel) => rng.c1 + rel);
  const valOf = (cells: Cell[], c: number) => { const cell = cells.find((x) => x.c === c); return cell ? rawOf(cell) : null; };

  const out: Cell[] = [...header]; let rr = startR; let inserted = 0;
  const groupVals: any[] = []; // valores del grupo actual por columna
  let curKey: any = undefined; let bucket: Cell[][] = [];
  const flush = () => {
    if (!bucket.length) return;
    for (const cells of bucket) { for (const cd of cells) out.push({ ...cd, r: rr }); rr++; }
    out.push(styledCell(rr, groupCol, `${curKey} — Total`, false));
    for (const c of valCols) out.push(styledCell(rr, c, roundNice(aggregate(bucket.map((cells) => valOf(cells, c)), p.fn)), true));
    rr++; inserted++;
    bucket = [];
  };
  for (const cells of rows) {
    const key = valOf(cells, groupCol);
    if (curKey === undefined) curKey = key;
    if (cmpVals(key, curKey) !== 0) { flush(); curKey = key; }
    bucket.push(cells);
    groupVals.push(key);
  }
  flush();
  // Total general.
  out.push(styledCell(rr, groupCol, 'Total general', false));
  for (const c of valCols) out.push(styledCell(rr, c, roundNice(aggregate(rows.map((cells) => valOf(cells, c)), p.fn)), true));
  rr++; inserted++;

  const shift = inserted;
  const shiftedBelow = below.map((cd) => ({ ...cd, r: cd.r + shift }));
  sheet.celldata = [...above, ...out, ...shiftedBelow];
  return inserted;
}

// ── Minigráficos (sparklines) en celda ───────────────────────────────────────
const SPARK_BARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
export type SparkType = 'bars' | 'winloss';
/** Construye un minigráfico unicode a partir de una serie de números. */
export function buildSparkline(values: number[], type: SparkType = 'bars'): string {
  const nums = values.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (!nums.length) return '';
  if (type === 'winloss') return nums.map((n) => (n > 0 ? '▲' : n < 0 ? '▼' : '·')).join('');
  const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1;
  return nums.map((n) => SPARK_BARS[Math.min(SPARK_BARS.length - 1, Math.round(((n - min) / span) * (SPARK_BARS.length - 1)))]).join('');
}

/** Lee los números de un rango (en orden fila→columna) y escribe el sparkline en una celda. */
export function applySparkline(sheet: any, dataRange: string, targetCell: string, type: SparkType = 'bars'): boolean {
  const rng = parseRange(dataRange); const tgt = parseRange(targetCell);
  if (!rng || !tgt || !sheet) return false;
  const map = new Map<string, any>();
  for (const cd of sheet.celldata ?? []) map.set(`${cd.r}_${cd.c}`, rawOf(cd));
  const vals: number[] = [];
  for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) { const n = toNumStrict(map.get(`${r}_${c}`)); if (n != null) vals.push(n); }
  const spark = buildSparkline(vals, type);
  sheet.celldata = sheet.celldata || [];
  let cd = sheet.celldata.find((x: Cell) => x.r === tgt.r1 && x.c === tgt.c1);
  if (!cd) { cd = { r: tgt.r1, c: tgt.c1, v: null }; sheet.celldata.push(cd); }
  const v = ensureObj(cd); v.v = spark; v.m = spark; v.ct = { fa: 'General', t: 's' };
  return true;
}
