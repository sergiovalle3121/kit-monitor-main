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
const ICONS = ['🔴', '🟡', '🟢', '⬆️', '↗️', '➡️', '↘️', '⬇️', '▲', '▬', '▼', '★', '☆', '▁', '▃', '▅', '▆', '▇'];
const stripIcon = (m: string) => {
  let s = m.replace(/^[█░]+\s/, ''); // quita barra de datos previa
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

export type CondKind = 'compare' | 'scale2' | 'scale3' | 'top' | 'bottom' | 'duplicates' | 'unique' | 'iconset' | 'databar' | 'clear';
export interface CondPayload {
  kind: CondKind; range: string; sheetIndex: number;
  op?: string; value?: string; value2?: string; color?: string;  // compare / top / bottom / duplicates / between
  c1?: string; c2?: string; c3?: string;                  // escalas de color
  n?: number;                                             // top/bottom N (o porcentaje si percent)
  percent?: boolean;                                      // top/bottom por porcentaje
  icons?: string[];                                       // conjunto de iconos (2..5)
  reverse?: boolean;                                      // invertir el orden de los iconos
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
      const k = p.percent
        ? Math.max(1, Math.min(nums.length, Math.ceil(nums.length * (p.n || 10) / 100)))
        : Math.max(1, p.n || 3);
      const sorted = [...nums].sort((a, b) => (p.kind === 'top' ? b - a : a - b));
      const threshold = sorted[Math.min(k, sorted.length) - 1];
      const color = p.color || '#ffd54f';
      for (const x of at) { if (x.n == null) continue; if (p.kind === 'top' ? x.n >= threshold : x.n <= threshold) style(x.cd, color, textOn(color)); }
      break;
    }
    case 'duplicates':
    case 'unique': {
      const counts = new Map<string, number>();
      for (const x of at) { if (x.raw === '' || x.raw == null) continue; const key = String(x.raw); counts.set(key, (counts.get(key) || 0) + 1); }
      const color = p.color || (p.kind === 'unique' ? '#dcfce7' : '#f8696b');
      const wantDup = p.kind === 'duplicates';
      for (const x of at) { if (x.raw === '' || x.raw == null) continue; const cnt = counts.get(String(x.raw)) || 0; if (wantDup ? cnt > 1 : cnt === 1) style(x.cd, color, textOn(color)); }
      break;
    }
    case 'iconset': {
      if (!nums.length) break;
      let icons = (p.icons && p.icons.length >= 2) ? p.icons.slice() : ['🔴', '🟡', '🟢'];
      if (p.reverse) icons = icons.slice().reverse();
      const k = icons.length;
      const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1;
      const pick = (n: number) => { const idx = Math.min(k - 1, Math.max(0, Math.floor(((n - min) / span) * k))); return icons[idx]; };
      for (const x of at) { if (x.n == null) continue; style(x.cd, undefined, undefined, pick(x.n)); }
      break;
    }
    case 'databar': {
      if (!nums.length) break;
      const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1, width = 10;
      const color = p.color || '#3b82f6';
      for (const x of at) {
        if (x.n == null) continue;
        const filled = Math.max(0, Math.min(width, Math.round(((x.n - min) / span) * width)));
        const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
        const v = ensureObj(x.cd);
        v.m = `${bar} ${stripIcon(String(v.m ?? v.v ?? ''))}`;
        v.fc = color;
      }
      break;
    }
    case 'compare': {
      const cmp = p.value ?? '';
      const num = parseFloat(cmp);
      const lc = cmp.toLowerCase();
      const matches = (raw: any) => {
        const s = String(raw ?? '').toLowerCase();
        if (p.op === 'contains') return s.includes(lc);
        if (p.op === 'notcontains') return !s.includes(lc);
        if (p.op === 'beginsWith') return s.startsWith(lc);
        if (p.op === 'endsWith') return s.endsWith(lc);
        if (p.op === 'between' || p.op === 'notbetween') {
          const lo = parseFloat(p.value ?? ''), hi = parseFloat(p.value2 ?? '');
          const nn = typeof raw === 'number' ? raw : parseFloat(raw);
          if (Number.isNaN(nn) || Number.isNaN(lo) || Number.isNaN(hi)) return false;
          const inside = nn >= Math.min(lo, hi) && nn <= Math.max(lo, hi);
          return p.op === 'between' ? inside : !inside;
        }
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
export interface FindOpts { caseSensitive?: boolean; wholeCell?: boolean; regex?: boolean; sheetIndex?: number }

/** Construye el RegExp de búsqueda según las opciones (regex, celda completa, mayúsc.). */
export function buildFindRegex(query: string, opts: FindOpts = {}): RegExp | null {
  if (!query) return null;
  const flags = opts.caseSensitive ? 'g' : 'gi';
  let body = opts.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (opts.wholeCell) body = `^(?:${body})$`;
  try { return new RegExp(body, flags); } catch { return null; }
}

/** Busca coincidencias de texto en las hojas (sin mutar). Soporta regex/celda completa/alcance. */
export function findMatches(sheets: any[], query: string, opts: FindOpts = {}): MatchAddr[] {
  const out: MatchAddr[] = [];
  const rx = buildFindRegex(query, opts); if (!rx) return out;
  sheets.forEach((sheet, si) => {
    if (opts.sheetIndex != null && opts.sheetIndex !== si) return;
    for (const cd of sheet?.celldata ?? []) {
      const raw = rawOf(cd); if (raw == null) continue;
      rx.lastIndex = 0;
      if (rx.test(String(raw))) out.push({ sheetIndex: si, r: cd.r, c: cd.c, addr: `${colName(cd.c)}${cd.r + 1}` });
    }
  });
  return out;
}

/** Reemplaza todas las coincidencias (muta las hojas clonadas). Devuelve el conteo. */
export function replaceAll(sheets: any[], query: string, replacement: string, opts: FindOpts = {}): number {
  const rx = buildFindRegex(query, opts); if (!rx) return 0;
  let count = 0;
  sheets.forEach((sheet, si) => {
    if (opts.sheetIndex != null && opts.sheetIndex !== si) return;
    for (const cd of sheet?.celldata ?? []) {
      const raw = rawOf(cd); if (raw == null || typeof raw === 'number') continue;
      const s = String(raw);
      rx.lastIndex = 0;
      if (!rx.test(s)) continue;
      rx.lastIndex = 0;
      count += (s.match(rx) || []).length;
      const next = s.replace(rx, replacement);
      const v = ensureObj(cd); v.v = next; v.m = next;
    }
  });
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
export interface PivotValueField { field: string; agg: AggFn; label?: string; showAs?: 'normal' | 'pctTotal' }
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
export interface PivotCellOut { v: string | number | null; t: PivotCellType; bold?: boolean; num?: boolean; pct?: boolean }
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
  const warnMissing = (kind: string, fields: string[]) => {
    for (const field of fields) warnings.push(`Campo ${kind} inválido o no encontrado: ${field}`);
  };
  warnMissing('de fila', cfg.rows.filter((f) => idxOf(f) < 0));
  warnMissing('de columna', cfg.cols.filter((f) => idxOf(f) < 0));
  const configuredValues = cfg.values.length ? cfg.values : [{ field: headers[headers.length - 1] ?? '', agg: 'count' as AggFn }];
  warnMissing('de valor', configuredValues.filter((vf) => idxOf(vf.field) < 0).map((vf) => vf.field));
  const values = configuredValues.filter((vf) => idxOf(vf.field) >= 0);
  if (!values.length) {
    return { matrix: [], nRows: 0, nCols: 0, warnings: [...warnings, 'No hay campos de valor válidos para construir la tabla dinámica.'] };
  }
  const rowFields = cfg.rows.filter((f) => idxOf(f) >= 0);
  const colFields = cfg.cols.filter((f) => idxOf(f) >= 0);
  if (!rows.length) warnings.push('El rango no contiene filas de datos.');

  // Filtros por valor.
  let recs = rows;
  for (const f of cfg.filters ?? []) {
    const ci = idxOf(f.field);
    if (ci < 0) {
      warnings.push(`Filtro omitido porque el campo no existe: ${f.field}`);
      continue;
    }
    if (!f.include?.length) {
      warnings.push(`Filtro omitido porque no incluye valores permitidos: ${f.field}`);
      continue;
    }
    const inc = new Set(f.include.map(String));
    recs = recs.filter((row) => inc.has(String(row[ci] ?? '')));
  }
  if (rows.length && !recs.length) warnings.push('Los filtros no dejaron filas de datos para la tabla dinámica.');

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
  // «Mostrar valores como»: % del total general del campo.
  const grandByVf = new Map<PivotValueField, number>();
  for (const vf of values) grandByVf.set(vf, aggAt(recs, vf) ?? 0);
  const showAs = (v: number | null, vf: PivotValueField): { v: number | null; pct: boolean } => {
    if (v == null) return { v: null, pct: false };
    if (vf.showAs === 'pctTotal') { const g = grandByVf.get(vf) || 0; return { v: g ? roundNice(v / g) : 0, pct: true }; }
    return { v, pct: false };
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
      const s = showAs(aggAt(recsFor(dc.ck), dc.vf), dc.vf);
      row.push({ v: s.v, t: type === 'value' ? 'value' : type, num: s.v != null, pct: s.pct, bold: type !== 'value' });
    }
    for (const vf of totalCols) {
      const s = showAs(aggAt(totalRecs, vf), vf);
      row.push({ v: s.v, t: type === 'value' ? 'value' : type, num: s.v != null, pct: s.pct, bold: true });
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

  // Fila de total general. También se emite para datos vacíos/filtrados,
  // de modo que el resultado conserve cabeceras y diagnósticos visibles.
  if (showColTotals) {
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
      const fa = cell.pct ? '0.0%' : 'General';
      const m = cell.v == null ? '' : (cell.pct && isNum ? formatNumber(cell.v, '0.0%') : String(cell.v));
      const v: any = { v: cell.v ?? '', m, ct: { fa, t: isNum ? 'n' : 's' } };
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
const WEEKDAYS_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']; // ddd (getUTCDay: 0=domingo)
const WEEKDAYS_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']; // dddd

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

// Quita las etiquetas entre corchetes de un formato: condiciones [>=100], colores
// [Red]/[Color 12] y locale de moneda [$€-409] (de la que SÍ conserva el símbolo €).
const stripFmtTags = (seg: string): string => seg
  .replace(/\[(?:>=?|<=?|=|<>)[^\]]*\]/g, '')
  .replace(/\[(?:red|black|green|blue|cyan|magenta|yellow|white|color\s*\d+)\]/gi, '')
  .replace(/\[\$([^\]\-]*)(?:-[^\]]*)?\]/g, '$1');
// Extrae el patrón numérico (#0?,.) de una sección, ignorando literales entrecomillados.
const extractNumericPattern = (section: string): string => {
  const cleaned = section.replace(/"[^"]*"/g, '').replace(/\\./g, '');
  const matches = cleaned.match(/[#0?][#0?,. ]*[#0?],*|[#0?],*/g);
  if (!matches) return '0';
  return matches.reduce((a, b) => ((b.match(/[#0?]/g)?.length ?? 0) > (a.match(/[#0?]/g)?.length ?? 0) ? b : a), matches[0]).replace(/ /g, '');
};
// Número con agrupación + decimales + relleno de ceros a la izquierda (minInt dígitos).
const renderPlain = (value: number, minInt: number, dec: number, grouped: boolean): string => {
  let s = groupNum(value, dec, grouped);
  if (minInt > 1) {
    const m = /^(\d[\d,]*)(\.\d+)?$/.exec(s);
    if (m) {
      const digits = m[1].replace(/,/g, '');
      if (digits.length < minInt) {
        const padded = digits.padStart(minInt, '0');
        s = (grouped ? padded.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : padded) + (m[2] ?? '');
      }
    }
  }
  return s;
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
    const s = value.trim();
    // Solo intenta parsear cadenas con pinta de fecha/hora (evita "Item 1", "Q1"…).
    const dateLike = /^\d{1,4}[-/.]\d{1,2}([-/.]\d{1,4})?(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(s)
      || /^\d{1,2}:\d{2}(:\d{2})?$/.test(s)
      || /\d{4}-\d{2}-\d{2}T/.test(s);
    if (!dateLike) return null;
    const t = Date.parse(s); if (!Number.isNaN(t)) return new Date(t);
  }
  return null;
}
function formatDate(d: Date, code: string): string {
  const Y = d.getUTCFullYear(), Mo = d.getUTCMonth(), D = d.getUTCDate(), Wd = d.getUTCDay();
  const H = d.getUTCHours(), Mi = d.getUTCMinutes(), S = d.getUTCSeconds();
  const p2 = (x: number) => String(x).padStart(2, '0');
  // Reloj de 12 horas si el código trae AM/PM (o A/P): la 'h' cuenta 1–12.
  const hasAmPm = /(AM\/PM|A\/P)/i.test(code);
  const h12 = ((H % 12) === 0) ? 12 : (H % 12);
  // Tokeniza en literales (comillas/símbolos), el marcador AM/PM y runs de la misma letra.
  const tokens: { type: 'lit' | 'fmt' | 'ampm'; v: string }[] = [];
  for (let i = 0; i < code.length;) {
    const am = /^(AM\/PM|A\/P)/i.exec(code.slice(i));
    if (am) { tokens.push({ type: 'ampm', v: am[1] }); i += am[1].length; continue; }
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
    if (t.type === 'ampm') {
      const lower = t.v[0] === t.v[0].toLowerCase();
      const s = t.v.length <= 3 ? (H >= 12 ? 'P' : 'A') : (H >= 12 ? 'PM' : 'AM'); // A/P vs AM/PM
      return lower ? s.toLowerCase() : s;
    }
    const f = t.v.toLowerCase();
    if (/^y+$/.test(f)) return f.length <= 2 ? p2(Y % 100) : String(Y);
    if (/^m+$/.test(f)) {
      if (f.length >= 4) return MONTHS_FULL[Mo];
      if (f.length === 3) return MONTHS_ES[Mo];
      if (isMinute(idx)) return f.length >= 2 ? p2(Mi) : String(Mi);
      return f.length >= 2 ? p2(Mo + 1) : String(Mo + 1);
    }
    if (/^d+$/.test(f)) {
      if (f.length >= 4) return WEEKDAYS_FULL[Wd];  // dddd → día de la semana completo
      if (f.length === 3) return WEEKDAYS_ES[Wd];   // ddd  → día abreviado
      return f.length >= 2 ? p2(D) : String(D);     // dd/d → día del mes
    }
    if (/^h+$/.test(f)) { const hh = hasAmPm ? h12 : H; return f.length >= 2 ? p2(hh) : String(hh); }
    if (/^s+$/.test(f)) return f.length >= 2 ? p2(S) : String(S);
    return t.v;
  }).join('');
}
function toFraction(n: number, maxDen = 99): string {
  const sign = n < 0 ? '-' : ''; const x = Math.abs(n);
  const whole = Math.floor(x); const frac = x - whole;
  if (frac < 1e-9) return `${sign}${whole}`;
  let bestN = 1, bestD = 1, bestErr = Infinity;
  for (let d = 1; d <= maxDen; d++) { const nn = Math.round(frac * d); const err = Math.abs(frac - nn / d); if (err < bestErr && nn > 0) { bestErr = err; bestN = nn; bestD = d; } }
  return whole > 0 ? `${sign}${whole} ${bestN}/${bestD}` : `${sign}${bestN}/${bestD}`;
}

// Renderiza una sección (ya sin etiquetas) para un valor NO negativo, intercalando los
// literales del formato (texto entrecomillado, símbolos, paréntesis) con el número. La
// PRIMERA tirada de marcadores (#0?) se sustituye por el número; `$`→símbolo de moneda;
// `%` escala ×100; `\x` y "..." son literales. Soporta porcentaje, científico, fracción,
// relleno de ceros y escalado por comas finales (miles).
function renderNumericSection(absN: number, section: string, cur: string, forcedSign: string): string {
  const cleaned = section.replace(/"[^"]*"/g, '').replace(/\\./g, '');
  const hasPlaceholder = /[#0?]/.test(cleaned);
  const isPercent = /%/.test(cleaned);
  const isSci = /[eE]\+?0/.test(cleaned);
  const isFrac = /[#?0]\s*\/\s*[#?0]/.test(cleaned);
  let numStr = '';
  if (hasPlaceholder) {
    const value = isPercent ? absN * 100 : absN;
    if (isSci) {
      const dec = (cleaned.split(/[eE]/)[0].split('.')[1]?.match(/0/g)?.length) ?? 2;
      // Dígitos del exponente = nº de ceros tras `E+`/`E-` en el patrón (Excel: `0.0e+0`→1, `0.00E+00`→2).
      const expDigits = cleaned.match(/[eE][+-]?(0+)/)?.[1].length ?? 2;
      const e = value.toExponential(dec);
      const mm = /^(-?\d(?:\.\d+)?)e([+-])(\d+)$/i.exec(e);
      numStr = mm ? `${mm[1]}E${mm[2]}${mm[3].padStart(expDigits, '0')}` : e.toUpperCase();
    } else if (isFrac) {
      numStr = toFraction(value);
      // Excel: con parte entera 0 y un hueco de entero en el patrón (`# ?/?`), el lugar del entero
      // se muestra como espacio (la fracción queda alineada). Sin hueco de entero (`?/?`), sin espacio.
      if (value < 1 && /[#0?]\s+[#0?]*\/[#0?]/.test(section)) numStr = ' ' + numStr;
    } else {
      const rawPat = extractNumericPattern(section);
      const trailingCommas = rawPat.match(/,+$/)?.[0].length ?? 0; // comas finales = escalado ×1000
      const pat = rawPat.replace(/,+$/, '');
      const dotIdx = pat.indexOf('.');
      const intPat = dotIdx >= 0 ? pat.slice(0, dotIdx) : pat;
      const fracPat = dotIdx >= 0 ? pat.slice(dotIdx + 1) : '';
      const dec = (fracPat.match(/[0#]/g) ?? []).length;
      const minInt = Math.max(1, (intPat.match(/0/g) ?? []).length);
      const grouped = /,/.test(intPat);
      numStr = renderPlain(value / Math.pow(1000, trailingCommas), minInt, dec, grouped);
    }
  }
  let out = '', placed = false, i = 0;
  while (i < section.length) {
    const ch = section[i];
    if (ch === '"') { const end = section.indexOf('"', i + 1); out += end < 0 ? section.slice(i + 1) : section.slice(i + 1, end); i = end < 0 ? section.length : end + 1; continue; }
    if (ch === '\\') { if (i + 1 < section.length) out += section[i + 1]; i += 2; continue; }
    if (ch === '$') { out += cur; i++; continue; }
    if (/[#0?]/.test(ch)) {
      let j = i; while (j < section.length && /[#0?.,]/.test(section[j])) j++;
      if (isSci) while (j < section.length && /[eE+\-0#]/.test(section[j])) j++;
      if (isFrac) while (j < section.length && /[#?0/ ]/.test(section[j])) j++;
      if (!placed) { out += forcedSign + numStr; placed = true; }
      i = j; continue;
    }
    out += ch; i++;
  }
  return out;
}

/** Formatea un valor según un código tipo Excel. Subconjunto práctico y robusto:
 *  secciones (positivo;negativo;cero;texto), literales («0" kg"»), relleno de ceros,
 *  porcentaje, científico, fracción, moneda/contable, escalado por miles y fechas. */
export function formatNumber(value: any, code: string, opts: NumFmtOpts = {}): string {
  const cur = opts.currency ?? '$';
  if (code == null || code === '' || code === 'General' || code === '@') return value == null ? '' : String(value);
  const seg = code.split(';')[0];
  const looksDate = /[ymdhs]/i.test(seg) && !/[#0]/.test(seg.replace(/"[^"]*"/g, ''));
  if (looksDate) { const d = toDate(value); if (d) return formatDate(d, code); }
  const sections = code.split(';');
  const n = toNumStrict(value);
  if (n == null) {
    // Sección de texto (4ª) con @ como marcador del propio texto.
    if (sections.length >= 4) {
      const t = stripFmtTags(sections[3]);
      if (/@/.test(t)) return t.replace(/"([^"]*)"/g, '$1').replace(/@/g, value == null ? '' : String(value));
    }
    return value == null ? '' : String(value);
  }
  const secs = sections.map(stripFmtTags);
  let section: string, forcedSign = '';
  if (n < 0) { if (sections.length >= 2) section = secs[1]; else { section = secs[0]; forcedSign = '-'; } }
  else if (n === 0 && sections.length >= 3) section = secs[2];
  else section = secs[0];
  return renderNumericSection(Math.abs(n), section, cur, forcedSign);
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

// ── Dar formato como tabla (encabezado + filas con bandas + autofiltro) ───────
export interface TableStyleOpts {
  range: string;
  hasHeader?: boolean;   // primera fila = encabezado (def. true)
  banded?: boolean;      // filas con bandas alternas (def. true)
  withFilter?: boolean;  // autofiltro en el encabezado (def. true)
  withBorders?: boolean; // borde fino en toda la tabla (def. true)
  totalRow?: boolean;    // última fila en negrita como totales (def. false)
  headerBg?: string; headerFc?: string; band1?: string; band2?: string;
}
/** Estilos de tabla predefinidos (encabezado + bandas). */
export const TABLE_STYLES: { id: string; label: string; headerBg: string; headerFc: string; band1: string; band2: string }[] = [
  { id: 'blue', label: 'Azul', headerBg: '#2563eb', headerFc: '#ffffff', band1: '#ffffff', band2: '#eff6ff' },
  { id: 'green', label: 'Verde', headerBg: '#059669', headerFc: '#ffffff', band1: '#ffffff', band2: '#ecfdf5' },
  { id: 'gray', label: 'Gris', headerBg: '#374151', headerFc: '#ffffff', band1: '#ffffff', band2: '#f3f4f6' },
  { id: 'orange', label: 'Naranja', headerBg: '#ea580c', headerFc: '#ffffff', band1: '#ffffff', band2: '#fff7ed' },
  { id: 'minimal', label: 'Claro', headerBg: '#e5e7eb', headerFc: '#111827', band1: '#ffffff', band2: '#f9fafb' },
];

/** Aplica un estilo de tabla a un rango (encabezado, bandas, autofiltro y bordes). Devuelve celdas con estilo. */
export function applyTableStyle(sheet: any, opts: TableStyleOpts): number {
  const rng = parseRange(opts.range); if (!rng || !sheet) return 0;
  sheet.celldata = sheet.celldata || [];
  const hasHeader = opts.hasHeader !== false;
  const banded = opts.banded !== false;
  const headerBg = opts.headerBg ?? '#2563eb';
  const headerFc = opts.headerFc ?? '#ffffff';
  const band1 = opts.band1 ?? '#ffffff';
  const band2 = opts.band2 ?? '#eff6ff';
  const map = new Map<string, Cell>();
  for (const cd of sheet.celldata) map.set(`${cd.r}_${cd.c}`, cd);
  const area = (rng.r2 - rng.r1 + 1) * (rng.c2 - rng.c1 + 1);
  const createEmpty = area <= 8000; // las bandas necesitan celdas; evita inflar rangos enormes
  let count = 0;
  for (let r = rng.r1; r <= rng.r2; r++) {
    const isHeader = hasHeader && r === rng.r1;
    const isTotal = !!opts.totalRow && r === rng.r2 && r !== rng.r1 && !isHeader;
    const dataIdx = r - rng.r1 - (hasHeader ? 1 : 0); // índice de fila de datos (0-based)
    for (let c = rng.c1; c <= rng.c2; c++) {
      let cd = map.get(`${r}_${c}`);
      if (!cd) { if (!createEmpty) continue; cd = { r, c, v: { v: '', m: '', ct: { fa: 'General', t: 's' } } }; sheet.celldata.push(cd); map.set(`${r}_${c}`, cd); }
      const v = ensureObj(cd);
      if (isHeader) { v.bg = headerBg; v.fc = headerFc; v.bl = 1; }
      else if (isTotal) { v.bg = band1; v.bl = 1; delete v.fc; }
      else { v.bl = 0; delete v.fc; if (banded) v.bg = (dataIdx % 2 === 0 ? band1 : band2); else v.bg = band1; }
      count++;
    }
  }
  if (opts.withBorders !== false) {
    sheet.config = sheet.config || {};
    sheet.config.borderInfo = sheet.config.borderInfo || [];
    sheet.config.borderInfo.push({ rangeType: 'range', borderType: 'border-all', color: '#d1d5db', style: 1, range: [{ row: [rng.r1, rng.r2], column: [rng.c1, rng.c2] }] });
  }
  if (opts.withFilter !== false && hasHeader) {
    sheet.filter_select = { row: [rng.r1, rng.r2], column: [rng.c1, rng.c2] };
    sheet.filter = sheet.filter || {};
  }
  return count;
}

// ── Autofiltro nativo en su sitio (flechas de filtro en el encabezado) ────────
/**
 * Activa el **autofiltro nativo** de Fortune-Sheet sobre el rango (flechas desplegables en la fila de
 * encabezado, con filtrado en su sitio). Escribe `sheet.filter_select` + `sheet.filter` — el **mismo
 * mecanismo** que «Dar formato como tabla», aquí en un solo clic y sin tocar estilos. Una hoja sólo
 * admite un autofiltro a la vez (como Excel), así que reemplaza el anterior.
 */
export function setAutoFilter(sheet: any, range: string): boolean {
  const rng = parseRange(range); if (!rng || !sheet) return false;
  sheet.filter_select = { row: [rng.r1, rng.r2], column: [rng.c1, rng.c2] };
  sheet.filter = sheet.filter || {};
  return true;
}

/** Quita el autofiltro nativo de la hoja. Devuelve `true` si había uno. */
export function clearAutoFilter(sheet: any): boolean {
  if (!sheet || (sheet.filter_select == null && sheet.filter == null)) return false;
  delete sheet.filter_select; delete sheet.filter;
  return true;
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

// ── Rellenar series (autollenado) ─────────────────────────────────────────────
const WEEKDAYS_FILL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const seqIndex = (seq: string[], val: string) => seq.indexOf(String(val).trim().toLowerCase());

/** Continúa una serie a partir de la semilla y devuelve los `count` valores siguientes. */
export function fillSeries(seed: any[], count: number): any[] {
  const out: any[] = [];
  if (count <= 0) return out;
  const clean = seed.filter((v) => v != null && v !== '');
  if (!clean.length) return out;

  // 1) Numérica: progresión aritmética (paso = diferencia media o 1).
  const nums = clean.map(toNumStrict);
  if (nums.every((n) => n != null)) {
    const ns = nums as number[];
    let step = 1;
    if (ns.length >= 2) { let s = 0; for (let i = 1; i < ns.length; i++) s += ns[i] - ns[i - 1]; step = s / (ns.length - 1); }
    let last = ns[ns.length - 1];
    for (let i = 0; i < count; i++) { last += step; out.push(Number.isInteger(step) && Number.isInteger(ns[0]) ? Math.round(last) : roundNice(last)); }
    return out;
  }

  // 2) Meses (completos o abreviados) / días de la semana (es); conserva el estilo.
  for (const seq of [MONTHS_FULL, MONTHS_ES, WEEKDAYS_FILL]) {
    if (clean.every((v) => seqIndex(seq, v) >= 0)) {
      let idx = seqIndex(seq, clean[clean.length - 1]);
      const cap = /^[A-ZÁÉÍÓÚ]/.test(String(clean[clean.length - 1]));
      for (let i = 0; i < count; i++) { idx = (idx + 1) % seq.length; const w = seq[idx]; out.push(cap ? w.charAt(0).toUpperCase() + w.slice(1) : w); }
      return out;
    }
  }

  // 3) Fechas (paso en días).
  const dates = clean.map(toDate);
  if (dates.every((d) => d != null)) {
    const ds = dates as Date[];
    let stepDays = 1;
    if (ds.length >= 2) stepDays = Math.round((ds[ds.length - 1].getTime() - ds[0].getTime()) / 86400000 / (ds.length - 1)) || 1;
    let last = ds[ds.length - 1].getTime();
    const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
    for (let i = 0; i < count; i++) { last += stepDays * 86400000; out.push(iso(last)); }
    return out;
  }

  // 4) Texto con número final ("Item 1" → "Item 2"…).
  const m = /^(.*?)(\d+)\s*$/.exec(String(clean[clean.length - 1]));
  if (m) {
    let n = parseInt(m[2], 10);
    for (let i = 0; i < count; i++) { n += 1; out.push(`${m[1]}${n}`); }
    return out;
  }

  // 5) Repetir el patrón de la semilla.
  for (let i = 0; i < count; i++) out.push(clean[i % clean.length]);
  return out;
}

/** Rellena una serie a partir de un rango semilla hacia abajo o a la derecha. */
export function applyFill(sheet: any, p: { seedRange: string; direction: 'down' | 'right'; count: number }): number {
  const rng = parseRange(p.seedRange); if (!rng || !sheet) return 0;
  sheet.celldata = sheet.celldata || [];
  const map = new Map<string, Cell>();
  for (const cd of sheet.celldata) map.set(`${cd.r}_${cd.c}`, cd);
  const down = p.direction === 'down';
  const lines = down ? (rng.c2 - rng.c1 + 1) : (rng.r2 - rng.r1 + 1);
  let written = 0;
  for (let li = 0; li < lines; li++) {
    const seed: any[] = [];
    if (down) { for (let r = rng.r1; r <= rng.r2; r++) seed.push(rawOf(map.get(`${r}_${rng.c1 + li}`) as any)); }
    else { for (let c = rng.c1; c <= rng.c2; c++) seed.push(rawOf(map.get(`${rng.r1 + li}_${c}`) as any)); }
    const next = fillSeries(seed, p.count);
    next.forEach((val, i) => {
      const r = down ? rng.r2 + 1 + i : rng.r1 + li;
      const c = down ? rng.c1 + li : rng.c2 + 1 + i;
      const t = typeof val === 'number' ? 'n' : 's';
      let cd = map.get(`${r}_${c}`);
      if (!cd) { cd = { r, c, v: null }; sheet.celldata.push(cd); map.set(`${r}_${c}`, cd); }
      cd.v = { v: val, m: String(val), ct: { fa: 'General', t } };
      written++;
    });
  }
  return written;
}

// ── Transponer rango (pegado especial) ────────────────────────────────────────
/** Copia un rango transponiendo filas↔columnas en una celda destino (preserva estilo). */
export function transposeRange(sheet: any, srcRange: string, destCell: string): boolean {
  const src = parseRange(srcRange); const dst = parseRange(destCell);
  if (!src || !dst || !sheet) return false;
  sheet.celldata = sheet.celldata || [];
  const map = new Map<string, Cell>();
  for (const cd of sheet.celldata) map.set(`${cd.r}_${cd.c}`, cd);
  const writes: Cell[] = [];
  for (let r = src.r1; r <= src.r2; r++) {
    for (let c = src.c1; c <= src.c2; c++) {
      const srcCd = map.get(`${r}_${c}`);
      const nr = dst.r1 + (c - src.c1);
      const nc = dst.c1 + (r - src.r1);
      if (srcCd) writes.push({ r: nr, c: nc, v: clone(srcCd.v) });
    }
  }
  const occupied = new Set(writes.map((w) => `${w.r}_${w.c}`));
  sheet.celldata = [...sheet.celldata.filter((cd: Cell) => !occupied.has(`${cd.r}_${cd.c}`)), ...writes];
  return true;
}
const clone = (x: any): any => (x == null ? x : JSON.parse(JSON.stringify(x)));

// ── Pegado especial (valores / formatos / todo) ───────────────────────────────
export type PasteMode = 'all' | 'values' | 'formats';
const STYLE_KEYS = ['bg', 'fc', 'bl', 'it', 'ht', 'vt', 'tb', 'fs'];
const asObj = (v: any): any => (v && typeof v === 'object' ? { ...v } : { v: v ?? '', m: v == null ? '' : String(v), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });

/** Copia un rango a una celda destino con modo todo/valores/formatos (pegado especial). */
export function copyRange(sheet: any, srcRange: string, destCell: string, mode: PasteMode = 'all'): boolean {
  const src = parseRange(srcRange); const dst = parseRange(destCell);
  if (!src || !dst || !sheet) return false;
  sheet.celldata = sheet.celldata || [];
  const map = new Map<string, Cell>();
  for (const cd of sheet.celldata) map.set(`${cd.r}_${cd.c}`, cd);
  const h = src.r2 - src.r1, w = src.c2 - src.c1;
  const writes: Cell[] = [];
  for (let dr = 0; dr <= h; dr++) {
    for (let dc = 0; dc <= w; dc++) {
      const srcCd = map.get(`${src.r1 + dr}_${src.c1 + dc}`);
      const dstCd = map.get(`${dst.r1 + dr}_${dst.c1 + dc}`);
      const nr = dst.r1 + dr, nc = dst.c1 + dc;
      if (mode === 'all') {
        if (srcCd) writes.push({ r: nr, c: nc, v: clone(srcCd.v) });
      } else if (mode === 'values') {
        if (!srcCd) continue;
        const s = asObj(srcCd.v); const base = dstCd ? asObj(dstCd.v) : {};
        writes.push({ r: nr, c: nc, v: { ...base, v: s.v, m: s.m, ct: s.ct } });
      } else { // formats
        const out = dstCd ? asObj(dstCd.v) : { v: '', m: '', ct: { fa: 'General', t: 's' } };
        const s = srcCd ? asObj(srcCd.v) : {};
        for (const k of STYLE_KEYS) { if (s[k] != null) out[k] = s[k]; else delete out[k]; }
        if (s.ct?.fa) out.ct = { ...(out.ct || {}), fa: s.ct.fa };
        writes.push({ r: nr, c: nc, v: out });
      }
    }
  }
  const occupied = new Set(writes.map((x) => `${x.r}_${x.c}`));
  sheet.celldata = [...sheet.celldata.filter((cd: Cell) => !occupied.has(`${cd.r}_${cd.c}`)), ...writes];
  return true;
}

// ── Autofiltro (no destructivo) ───────────────────────────────────────────────
export type FilterOp = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'notcontains' | 'beginsWith' | 'endsWith' | 'empty' | 'notempty';
export interface FilterCriterion { colRel: number; op: FilterOp; value: string }

/**
 * Convierte un patrón con comodines de Excel (`*` = cualquier secuencia, `?` = un carácter, `~`
 * escapa al siguiente comodín) en un `RegExp` anclado e insensible a mayúsculas.
 */
function wildcardToRegExp(pattern: string): RegExp {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let body = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~' && i + 1 < pattern.length) body += esc(pattern[++i]);
    else if (ch === '*') body += '.*';
    else if (ch === '?') body += '.';
    else body += esc(ch);
  }
  return new RegExp(`^${body}$`, 'i');
}

/** ¿`raw` cumple el criterio? Numérico cuando ambos lados son números. */
export function matchesCriterion(raw: any, op: FilterOp, value: string): boolean {
  const sraw = raw == null ? '' : String(raw);
  if (op === 'empty') return sraw.trim() === '';
  if (op === 'notempty') return sraw.trim() !== '';
  if (op === 'contains') return sraw.toLowerCase().includes(value.toLowerCase());
  if (op === 'notcontains') return !sraw.toLowerCase().includes(value.toLowerCase());
  if (op === 'beginsWith') return sraw.toLowerCase().startsWith(value.toLowerCase());
  if (op === 'endsWith') return sraw.toLowerCase().endsWith(value.toLowerCase());
  // `=`/`!=` admiten comodines de Excel (`*`, `?`); sin comodines, comparación exacta (intacta).
  const wild = (op === '=' || op === '!=') && (value.includes('*') || value.includes('?'));
  if (wild) { const hit = wildcardToRegExp(value).test(sraw); return op === '=' ? hit : !hit; }
  const n = typeof raw === 'number' ? raw : Number(sraw); const nv = Number(value);
  const bothNum = sraw !== '' && value !== '' && !Number.isNaN(n) && !Number.isNaN(nv);
  switch (op) {
    case '=': return bothNum ? n === nv : sraw === value;
    case '!=': return bothNum ? n !== nv : sraw !== value;
    case '>': return bothNum ? n > nv : sraw > value;
    case '>=': return bothNum ? n >= nv : sraw >= value;
    case '<': return bothNum ? n < nv : sraw < value;
    case '<=': return bothNum ? n <= nv : sraw <= value;
    default: return false;
  }
}

/**
 * Filtra un rango por uno o varios criterios y devuelve celldata para una hoja nueva. La unión por
 * defecto es `AND` (todas); `conjunction: 'OR'` exige que se cumpla **alguna** (autofiltro
 * personalizado de Excel: dos criterios unidos por Y/O).
 */
export function buildFilter(sheet: any, p: { range: string; hasHeader: boolean; criteria: FilterCriterion[]; conjunction?: 'AND' | 'OR' }): { celldata: any[]; matched: number; nCols: number } | null {
  const rng = parseRange(p.range); if (!rng || !sheet) return null;
  const map = new Map<string, any>();
  for (const cd of sheet.celldata ?? []) map.set(`${cd.r}_${cd.c}`, cd);
  const nCols = rng.c2 - rng.c1 + 1;
  const startR = p.hasHeader ? rng.r1 + 1 : rng.r1;
  const out: any[] = [];
  let rr = 0;
  const pushRow = (srcR: number, header: boolean) => {
    for (let c = rng.c1; c <= rng.c2; c++) {
      const cd = map.get(`${srcR}_${c}`);
      if (!cd && !header) continue;
      const base = cd ? clone(cd.v) : { v: '', m: '', ct: { fa: 'General', t: 's' } };
      const v = base && typeof base === 'object' ? base : { v: base, m: String(base ?? ''), ct: { fa: 'General', t: 's' } };
      if (header) v.bl = 1;
      out.push({ r: rr, c: c - rng.c1, v });
    }
    rr++;
  };
  if (p.hasHeader) pushRow(rng.r1, true);
  let matched = 0;
  for (let r = startR; r <= rng.r2; r++) {
    const test = (cr: FilterCriterion) => matchesCriterion(rawOf(map.get(`${r}_${rng.c1 + cr.colRel}`) as any), cr.op, cr.value);
    const ok = !p.criteria.length || (p.conjunction === 'OR' ? p.criteria.some(test) : p.criteria.every(test));
    if (!ok) continue;
    pushRow(r, false); matched++;
  }
  return { celldata: out, matched, nCols };
}

// ── Combinar / separar celdas ─────────────────────────────────────────────────
/** Solapamiento de un registro de combinación `m` con el rectángulo dado. */
function mergeOverlaps(m: any, r1: number, c1: number, r2: number, c2: number): boolean {
  const mr2 = m.r + (m.rs || 1) - 1, mc2 = m.c + (m.cs || 1) - 1;
  return m.r <= r2 && mr2 >= r1 && m.c <= c2 && mc2 >= c1;
}

/**
 * Combina el rango en una sola celda (ancla = esquina superior izquierda), como «Combinar y centrar»
 * de Excel. Escribe el registro `config.merge["r_c"] = { r, c, rs, cs }` — el **mismo formato** que el
 * roundtrip XLSX, así que Fortune-Sheet lo renderiza al recargar y se exporta a `.xlsx` sin pérdida.
 * Cualquier combinación previa que se solape se retira primero. El contenido del ancla se conserva; el
 * de las celdas cubiertas queda **oculto** por la combinación (no se borra → separar lo recupera).
 * Devuelve `false` si el rango es una sola celda (nada que combinar).
 */
export function mergeCells(sheet: any, range: string): boolean {
  const rng = parseRange(range); if (!rng || !sheet) return false;
  const { r1, c1, r2, c2 } = rng;
  if (r1 === r2 && c1 === c2) return false;
  sheet.config = sheet.config || {};
  const merge: Record<string, any> = sheet.config.merge || {};
  for (const k of Object.keys(merge)) { const m = merge[k]; if (m && mergeOverlaps(m, r1, c1, r2, c2)) delete merge[k]; }
  merge[`${r1}_${c1}`] = { r: r1, c: c1, rs: r2 - r1 + 1, cs: c2 - c1 + 1 };
  sheet.config.merge = merge;
  return true;
}

/** Separa toda combinación que intersecte el rango. Devuelve cuántas se separaron. */
export function unmergeCells(sheet: any, range: string): number {
  const rng = parseRange(range); const merge = sheet?.config?.merge;
  if (!rng || !merge) return 0;
  const { r1, c1, r2, c2 } = rng; let n = 0;
  for (const k of Object.keys(merge)) { const m = merge[k]; if (m && mergeOverlaps(m, r1, c1, r2, c2)) { delete merge[k]; n++; } }
  return n;
}

// ── Rangos con nombre ─────────────────────────────────────────────────────────
export interface NamedRange { name: string; range: string; sheetIndex: number }

/** Valida un nombre de rango (estilo Excel). Devuelve mensaje de error o null. */
export function validateRangeName(name: string, existing: string[] = []): string | null {
  const n = (name || '').trim();
  if (!n) return 'El nombre no puede estar vacío.';
  if (n.length > 255) return 'Nombre demasiado largo.';
  if (!/^[A-Za-z_À-ſ][A-Za-z0-9_.À-ſ]*$/.test(n)) return 'Use letras, dígitos, _ o . (empiece con letra o _).';
  if (/^[A-Za-z]{1,3}[0-9]+$/.test(n)) return 'No puede tener forma de referencia de celda (ej. A1).';
  if (/^[RC][0-9]*$/i.test(n)) return 'Nombre reservado (R/C).';
  if (existing.some((e) => e.toLowerCase() === n.toLowerCase())) return 'Ya existe un nombre igual.';
  return null;
}

/** Referencia A1 cualificada con la hoja (entrecomillada si hace falta). */
export function qualifiedRef(nr: NamedRange, sheetNames: string[]): string {
  const sn = sheetNames[nr.sheetIndex] || `Hoja ${nr.sheetIndex + 1}`;
  const sheet = /^[A-Za-z_][A-Za-z0-9_]*$/.test(sn) ? sn : `'${sn.replace(/'/g, "''")}'`;
  return `${sheet}!${nr.range}`;
}

/** Resuelve un texto a rango: si coincide con un nombre, usa su rango/hoja. */
export function resolveNamedRange(input: string, names: NamedRange[], fallbackSheet: number): { range: string; sheetIndex: number } | null {
  const t = (input || '').trim();
  const hit = names.find((n) => n.name.toLowerCase() === t.toLowerCase());
  if (hit) return { range: hit.range, sheetIndex: hit.sheetIndex };
  if (parseRange(t)) return { range: t, sheetIndex: fallbackSheet };
  return null;
}

// ── Impresión / diseño de impresión ───────────────────────────────────────────
export interface PrintOpts {
  range?: string; title?: string; header?: string; footer?: string;
  orientation?: 'portrait' | 'landscape'; gridlines?: boolean; fitToWidth?: boolean;
}
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** Genera un documento HTML imprimible del área indicada (respeta valores y estilos básicos). */
export function buildPrintHtml(sheet: any, opts: PrintOpts = {}): string {
  const rangeStr = opts.range && parseRange(opts.range) ? opts.range : (usedRange(sheet) || 'A1:A1');
  const rng = parseRange(rangeStr)!;
  const map = new Map<string, any>();
  for (const cd of sheet?.celldata ?? []) map.set(`${cd.r}_${cd.c}`, cd.v);
  const align = (ht: any) => (ht === 1 ? 'left' : ht === 2 ? 'right' : ht === 0 ? 'center' : '');
  const gl = opts.gridlines !== false;
  let body = '';
  for (let r = rng.r1; r <= rng.r2; r++) {
    body += '<tr>';
    for (let c = rng.c1; c <= rng.c2; c++) {
      const v = map.get(`${r}_${c}`);
      const obj = v && typeof v === 'object' ? v : null;
      const raw = obj ? (obj.m ?? obj.v ?? '') : (v ?? '');
      const st: string[] = [];
      if (obj?.bg) st.push(`background:${obj.bg}`);
      if (obj?.fc) st.push(`color:${obj.fc}`);
      if (obj?.bl) st.push('font-weight:600');
      if (obj?.it) st.push('font-style:italic');
      const a = align(obj?.ht); if (a) st.push(`text-align:${a}`);
      else if (typeof (obj?.v) === 'number') st.push('text-align:right');
      body += `<td style="${st.join(';')}">${escHtml(String(raw))}</td>`;
    }
    body += '</tr>';
  }
  const titleHtml = opts.title ? `<h1>${escHtml(opts.title)}</h1>` : '';
  const headerHtml = opts.header ? `<div class="hf header">${escHtml(opts.header)}</div>` : '';
  const footerHtml = opts.footer ? `<div class="hf footer">${escHtml(opts.footer)}</div>` : '';
  const border = gl ? '1px solid #cbd5e1' : 'none';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(opts.title || 'Impresión')}</title>
<style>
@page { size: A4 ${opts.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 0; }
h1 { font-size: 18px; margin: 0 0 8px; }
.hf { color: #64748b; font-size: 11px; padding: 4px 0; }
.footer { border-top: 1px solid #e2e8f0; margin-top: 8px; }
table { border-collapse: collapse; ${opts.fitToWidth ? 'width:100%;' : ''} font-size: 12px; }
td { border: ${border}; padding: 3px 6px; white-space: nowrap; vertical-align: top; }
</style></head><body>${headerHtml}${titleHtml}<table>${body}</table>${footerHtml}</body></html>`;
}

// ── Validación de datos (dataVerification nativa de Fortune-Sheet) ────────────
// El motor de Fortune-Sheet valida en la entrada (rechaza o avisa con mensaje en
// español) según estas estructuras; aquí construimos la entrada y replicamos la
// lógica de forma pura para poder marcar celdas no válidas existentes.

export type DvType = 'dropdown' | 'checkbox' | 'number' | 'number_integer' | 'number_decimal' | 'text_length' | 'text_content' | 'date' | 'required' | 'custom_formula';
export type DvOperator =
  | 'between' | 'notBetween' | 'equal' | 'notEqualTo'
  | 'moreThanThe' | 'lessThan' | 'greaterOrEqualTo' | 'lessThanOrEqualTo'  // número / longitud
  | 'include' | 'exclude'                                                   // texto
  | 'earlierThan' | 'noEarlierThan' | 'laterThan' | 'noLaterThan';          // fecha

export interface DvConfig {
  type: DvType;
  operator?: DvOperator;
  value1?: string;
  value2?: string;
  fromRange?: boolean;       // (lista) value1 es una referencia de rango (A1:A10), no una lista literal
  prohibitInput?: boolean;   // rechazar entradas inválidas (estilo «Detener»)
  hintText?: string;         // mensaje de entrada al seleccionar la celda
}

export interface DvEntry {
  type: string; type2: string | null; value1: string; value2: string; validity: string;
  remote: boolean; prohibitInput: boolean; hintShow: boolean; hintText: string; checked: boolean;
}

const DV_TWO_VALUE = new Set<DvOperator>(['between', 'notBetween']);
/** Operadores válidos por tipo (para que la UI ofrezca solo los aplicables). */
export const DV_OPERATORS: Record<DvType, DvOperator[]> = {
  dropdown: [], checkbox: [],
  number: ['between', 'notBetween', 'equal', 'notEqualTo', 'moreThanThe', 'lessThan', 'greaterOrEqualTo', 'lessThanOrEqualTo'],
  number_integer: ['between', 'notBetween', 'equal', 'notEqualTo', 'moreThanThe', 'lessThan', 'greaterOrEqualTo', 'lessThanOrEqualTo'],
  number_decimal: ['between', 'notBetween', 'equal', 'notEqualTo', 'moreThanThe', 'lessThan', 'greaterOrEqualTo', 'lessThanOrEqualTo'],
  text_length: ['between', 'notBetween', 'equal', 'notEqualTo', 'moreThanThe', 'lessThan', 'greaterOrEqualTo', 'lessThanOrEqualTo'],
  text_content: ['include', 'exclude', 'equal'],
  date: ['between', 'notBetween', 'equal', 'notEqualTo', 'earlierThan', 'noEarlierThan', 'laterThan', 'noLaterThan'],
  required: [],
  custom_formula: [],
};

/** Construye una entrada `dataVerification` de Fortune-Sheet a partir de una config. */
export function buildDataVerification(cfg: DvConfig): DvEntry {
  const value1 = cfg.type === 'dropdown'
    ? (cfg.fromRange ? (cfg.value1 ?? '').trim() : (cfg.value1 ?? '').split(',').map((s) => s.trim()).filter(Boolean).join(','))
    : (cfg.value1 ?? '').trim();
  const needsTwo = cfg.operator != null && DV_TWO_VALUE.has(cfg.operator);
  const type2 = (cfg.type === 'dropdown' || cfg.type === 'checkbox' || cfg.type === 'required' || cfg.type === 'custom_formula') ? null : (cfg.operator ?? 'between');
  const hintText = (cfg.hintText ?? '').trim();
  return {
    type: cfg.type, type2,
    value1, value2: needsTwo ? (cfg.value2 ?? '').trim() : '',
    validity: '', remote: false,
    prohibitInput: !!cfg.prohibitInput,
    hintShow: hintText.length > 0, hintText,
    checked: false,
  };
}

/** Aplica la validación a todas las celdas del rango. Devuelve cuántas celdas se marcaron. */
export function applyDataVerification(sheet: any, range: string, cfg: DvConfig): number {
  const rng = parseRange(range); if (!rng || !sheet) return 0;
  sheet.dataVerification = sheet.dataVerification || {};
  const entry = buildDataVerification(cfg);
  let n = 0;
  for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) { sheet.dataVerification[`${r}_${c}`] = { ...entry }; n++; }
  return n;
}

/** Quita la validación de las celdas del rango. Devuelve cuántas se quitaron. */
export function clearDataVerification(sheet: any, range: string): number {
  const rng = parseRange(range); if (!rng || !sheet?.dataVerification) return 0;
  let n = 0;
  for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) { const k = `${r}_${c}`; if (sheet.dataVerification[k]) { delete sheet.dataVerification[k]; n++; } }
  return n;
}

function cmpNumber(n: number, op: DvOperator | undefined, v1: number, v2: number): boolean {
  switch (op) {
    case 'between': return n >= Math.min(v1, v2) && n <= Math.max(v1, v2);
    case 'notBetween': return !(n >= Math.min(v1, v2) && n <= Math.max(v1, v2));
    case 'equal': return n === v1;
    case 'notEqualTo': return n !== v1;
    case 'moreThanThe': return n > v1;
    case 'lessThan': return n < v1;
    case 'greaterOrEqualTo': return n >= v1;
    case 'lessThanOrEqualTo': return n <= v1;
    default: return true;
  }
}

function splitTopLevelArgs(src: string): string[] {
  const args: string[] = [];
  let cur = '', depth = 0, quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) { cur += ch; if (ch === quote && src[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim() || src.endsWith(',')) args.push(cur.trim());
  return args;
}

function stripOuterParens(src: string): string {
  let s = src.trim();
  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0, wraps = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      if (s[i] === ')') depth--;
      if (depth === 0 && i < s.length - 1) { wraps = false; break; }
    }
    if (!wraps) break;
    s = s.slice(1, -1).trim();
  }
  return s;
}

function literalValue(src: string, raw: any): string | number | boolean {
  const s = stripOuterParens(src);
  if (/^VALUE$/i.test(s)) return raw == null ? '' : raw;
  if (/^LEN\(VALUE\)$/i.test(s)) return String(raw ?? '').length;
  if (/^ISNUMBER\(VALUE\)$/i.test(s)) return Number.isFinite(Number(raw));
  if (/^ISTEXT\(VALUE\)$/i.test(s)) return !Number.isFinite(Number(raw));
  const quoted = s.match(/^["'](.*)["']$/);
  if (quoted) return quoted[1];
  const n = Number(s);
  if (s !== '' && Number.isFinite(n)) return n;
  return s;
}

function compareFormula(leftRaw: string, op: string, rightRaw: string, raw: any): boolean {
  const left = literalValue(leftRaw, raw);
  const right = literalValue(rightRaw, raw);
  const ln = Number(left), rn = Number(right);
  const numeric = Number.isFinite(ln) && Number.isFinite(rn) && String(left).trim() !== '' && String(right).trim() !== '';
  const l = numeric ? ln : String(left);
  const r = numeric ? rn : String(right);
  switch (op) {
    case '>=': return l >= r;
    case '<=': return l <= r;
    case '<>': case '!=': return l !== r;
    case '=': case '==': return l === r;
    case '>': return l > r;
    case '<': return l < r;
    default: return false;
  }
}

export function customFormulaSatisfies(formula: string | undefined, raw: any): boolean {
  const expr = stripOuterParens(String(formula ?? '').trim().replace(/^=/, ''));
  if (!expr) return true;
  const fn = expr.match(/^(AND|OR|NOT)\((.*)\)$/i);
  if (fn) {
    const name = fn[1].toUpperCase();
    const args = splitTopLevelArgs(fn[2]);
    if (name === 'AND') return args.every((arg) => customFormulaSatisfies(arg, raw));
    if (name === 'OR') return args.some((arg) => customFormulaSatisfies(arg, raw));
    if (name === 'NOT') return !customFormulaSatisfies(args[0], raw);
  }
  if (/^ISNUMBER\(VALUE\)$/i.test(expr)) return Number.isFinite(Number(raw));
  if (/^ISTEXT\(VALUE\)$/i.test(expr)) return !Number.isFinite(Number(raw));
  const m = expr.match(/^(.+?)\s*(>=|<=|<>|!=|==|=|>|<)\s*(.+)$/);
  if (!m) return false;
  return compareFormula(m[1], m[2], m[3], raw);
}

/** Comprueba (puro) si un valor cumple la regla. Refleja la lógica del motor. Vacío = válido salvo regla obligatoria. */
export function dvSatisfies(cfg: DvConfig, raw: any): boolean {
  const s = raw && typeof raw === 'object' ? (raw.v ?? raw.m ?? '') : raw;
  const str = s == null ? '' : String(s);
  if (cfg.type === 'required') return str.trim() !== '';
  if (str.trim() === '') return true; // celdas vacías no se marcan (como Excel)
  const op = cfg.operator;
  const v1s = (cfg.value1 ?? '').trim();
  switch (cfg.type) {
    case 'checkbox': return true;
    case 'custom_formula': return customFormulaSatisfies(cfg.value1, s);
    case 'dropdown': {
      if (cfg.fromRange) return true; // la lista vive en un rango; el motor la valida, aquí no resolvemos sin la hoja
      const list = v1s.split(',').map((x) => x.trim()).filter(Boolean);
      return str.split(',').every((i) => list.includes(i.trim()));
    }
    case 'number': case 'number_integer': case 'number_decimal': {
      const n = Number(str);
      if (!Number.isFinite(n)) return false;
      if (cfg.type === 'number_integer' && n % 1 !== 0) return false;
      if (cfg.type === 'number_decimal' && n % 1 === 0) return false;
      return cmpNumber(n, op, Number(v1s), Number(cfg.value2 ?? ''));
    }
    case 'text_content':
      if (op === 'include') return str.includes(v1s);
      if (op === 'exclude') return !str.includes(v1s);
      if (op === 'equal') return str === v1s;
      return true;
    case 'text_length':
      return cmpNumber(str.length, op, Number(v1s), Number(cfg.value2 ?? ''));
    case 'date': {
      const d = toDate(str); if (!d) return false;
      const t = d.getTime();
      const d1 = toDate(v1s); const d2 = toDate((cfg.value2 ?? '').trim());
      const t1 = d1 ? d1.getTime() : NaN; const t2 = d2 ? d2.getTime() : NaN;
      switch (op) {
        case 'between': return Number.isFinite(t1) && Number.isFinite(t2) && t >= Math.min(t1, t2) && t <= Math.max(t1, t2);
        case 'notBetween': return !(Number.isFinite(t1) && Number.isFinite(t2) && t >= Math.min(t1, t2) && t <= Math.max(t1, t2));
        case 'equal': return t === t1;
        case 'notEqualTo': return t !== t1;
        case 'earlierThan': return t < t1;
        case 'noEarlierThan': return t >= t1;
        case 'laterThan': return t > t1;
        case 'noLaterThan': return t <= t1;
        default: return true;
      }
    }
  }
  return true;
}

/** Marca con relleno rojo las celdas del rango que NO cumplen la regla (como «rodear datos no válidos» de Excel). */
export function markInvalidCells(sheet: any, range: string, cfg: DvConfig): number {
  const rng = parseRange(range); if (!rng || !sheet) return 0;
  sheet.celldata = sheet.celldata || [];
  const inR = (r: number, c: number) => r >= rng.r1 && r <= rng.r2 && c >= rng.c1 && c <= rng.c2;
  let n = 0;
  for (const cd of sheet.celldata) {
    if (!inR(cd.r, cd.c)) continue;
    const raw = rawOf(cd);
    if ((raw === '' || raw == null) && cfg.type !== 'required') continue;
    if (!dvSatisfies(cfg, raw)) { const v = ensureObj(cd); v.bg = '#fde2e1'; v.fc = '#b91c1c'; n++; }
  }
  return n;
}
