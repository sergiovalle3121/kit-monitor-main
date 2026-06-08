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
const colName = (c: number) => { let s = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };

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
