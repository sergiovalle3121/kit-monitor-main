/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones MODERNAS de Excel (matrices dinámicas + texto), registradas en el mismo
 * motor compartido que el resto de personalizadas (ver `formulaEngine.ts`). Cubren el
 * hueco más visible frente a Excel 365: `@formulajs/formulajs@2.9.3` no trae
 * `SORT`/`SORTBY`/`FILTER`/`SEQUENCE`/`TAKE`/`DROP`/`TEXTBEFORE`/`TEXTAFTER`/`TEXTSPLIT`
 * (y su `UNIQUE`/`TRANSPOSE` no son fieles a la semántica de Excel). El parser resuelve
 * NUESTRA versión antes que el built-in (ver el parche de `getFunction`), así que estas
 * ganan.
 *
 * Modelo de datos: el parser evalúa cada argumento ANTES de llamar a la función. Un
 * rango llega como **matriz 2D** (filas × columnas); un escalar, como valor suelto. Estas
 * funciones DEVUELVEN matrices 2D (estilo Excel) que componen con `SUM`/`INDEX`/`TEXTJOIN`
 * y que el «spilling» de la rejilla (fase aparte) derramará a las celdas vecinas.
 *
 * Límite del motor (documentado): el parser NO hace broadcasting de operadores sobre
 * rangos (`A1:A10>5` colapsa a un escalar), por eso `FILTER` recibe una **máscara ya
 * evaluada** (rango/array de verdadero-falso o 1/0), no una comparación de rango.
 */
import { flatten, toNum } from './formulaEngine';

// ── Normalización de formas ──────────────────────────────────────────────────
/** Cualquier argumento → matriz 2D (filas × columnas). Escalar → `[[v]]`; 1D → columna. */
export function to2D(arg: any): any[][] {
  if (Array.isArray(arg)) {
    if (arg.length === 0) return [[]];
    if (Array.isArray(arg[0])) return arg as any[][];
    return (arg as any[]).map((v) => [v]);
  }
  return [[arg]];
}
function dims(a: any[][]): [number, number] { return [a.length, a.reduce((m, r) => Math.max(m, r.length), 0)]; }
/** Rellena filas cortas para que la matriz sea rectangular (filas × maxCols). */
function rectify(a: any[][], fill: any = null): any[][] {
  const cols = a.reduce((m, r) => Math.max(m, r.length), 0);
  return a.map((r) => (r.length === cols ? r : [...r, ...Array(cols - r.length).fill(fill)]));
}
function transpose(a: any[][]): any[][] {
  const [r, c] = dims(a);
  const out: any[][] = [];
  for (let j = 0; j < c; j++) { const row: any[] = []; for (let i = 0; i < r; i++) row.push(a[i]?.[j] ?? null); out.push(row); }
  return out;
}
/** Coerción a booleano estilo Excel (números ≠ 0, "TRUE"/"FALSE", 1/0). */
function truthy(v: any): boolean {
  if (v === true) return true;
  if (v === false || v == null || v === '') return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toUpperCase();
    if (s === 'TRUE' || s === 'VERDADERO') return true;
    if (s === 'FALSE' || s === 'FALSO' || s === '') return false;
    const n = Number(v); return isNaN(n) ? true : n !== 0;
  }
  return !!v;
}
/** Clave de fila para comparar igualdad (texto sin distinguir mayúsculas, como Excel). */
function keyOf(row: any[]): string { return JSON.stringify(row.map((v) => (typeof v === 'string' ? v.toLowerCase() : v))); }
/** Comparación de orden estilo Excel: números < texto; vacíos al final. */
function cmp(a: any, b: any): number {
  const ea = a == null || a === '', eb = b == null || b === '';
  if (ea && eb) return 0;
  if (ea) return 1; if (eb) return -1; // vacíos al final
  const na = toNum(a), nb = toNum(b);
  if (na !== null && nb !== null) return na - nb;
  if (na !== null) return -1; if (nb !== null) return 1; // números antes que texto
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}
function cellStr(v: any): string { return v == null ? '' : String(v); }

// ── Matrices dinámicas ────────────────────────────────────────────────────────

/** UNIQUE(array; [por_columna]; [solo_una_vez]) — valores/filas distintos (case-insensitive). */
export function UNIQUE(params: any[]): any {
  const a = rectify(to2D(params[0]));
  const byCol = truthy(params[1]);
  const exactlyOnce = truthy(params[2]);
  const rows = byCol ? transpose(a) : a;
  const seen = new Map<string, { row: any[]; count: number }>();
  for (const r of rows) { const k = keyOf(r); const e = seen.get(k); if (e) e.count++; else seen.set(k, { row: r, count: 1 }); }
  let kept = [...seen.values()];
  if (exactlyOnce) kept = kept.filter((e) => e.count === 1);
  const res = kept.map((e) => e.row);
  if (!res.length) return '#CALC!';
  return byCol ? transpose(res) : res;
}

/** SORT(array; [índice_orden]; [orden]; [por_columna]) — ordena filas (o columnas). */
export function SORT(params: any[]): any {
  const a = rectify(to2D(params[0]));
  const idx = Math.max(1, Math.trunc(toNum(params[1]) ?? 1));
  const order = (toNum(params[2]) ?? 1) < 0 ? -1 : 1;
  const byCol = truthy(params[3]);
  const mat = byCol ? transpose(a) : a;
  const k = idx - 1;
  const sorted = [...mat].sort((x, y) => order * cmp(x[k], y[k]));
  return byCol ? transpose(sorted) : sorted;
}

/** SORTBY(array; por1; [orden1]; por2; [orden2]; …) — ordena por vectores externos. */
export function SORTBY(params: any[]): any {
  const a = rectify(to2D(params[0]));
  const keys: { col: any[]; order: number }[] = [];
  for (let i = 1; i < params.length; i += 2) {
    const by = flatten(params[i]);
    const order = (toNum(params[i + 1]) ?? 1) < 0 ? -1 : 1;
    keys.push({ col: by, order });
  }
  const order = a.map((_, i) => i);
  order.sort((x, y) => { for (const k of keys) { const c = k.order * cmp(k.col[x], k.col[y]); if (c) return c; } return 0; });
  return order.map((i) => a[i]);
}

/** FILTER(array; máscara; [si_vacío]) — conserva filas/columnas donde la máscara es verdadera. */
export function FILTER(params: any[]): any {
  const a = rectify(to2D(params[0]));
  const mask = flatten(params[1]).map(truthy);
  const ifEmpty = params[2];
  const [r, c] = dims(a);
  let out: any[][];
  if (mask.length === r && mask.length !== c) out = a.filter((_, i) => mask[i]);
  else if (mask.length === c && mask.length !== r) out = a.map((row) => row.filter((_, j) => mask[j]));
  else if (mask.length === r) out = a.filter((_, i) => mask[i]); // cuadrada → por filas
  else out = a.filter((_, i) => mask[i]);
  out = out.filter((row) => row.length > 0);
  if (!out.length) return ifEmpty !== undefined ? ifEmpty : '#CALC!';
  return out;
}

/** SEQUENCE(filas; [cols]; [inicio]; [paso]) — matriz de números consecutivos (por filas). */
export function SEQUENCE(params: any[]): any {
  const rows = Math.max(0, Math.trunc(toNum(params[0]) ?? 1));
  const cols = Math.max(0, Math.trunc(toNum(params[1]) ?? 1));
  const start = toNum(params[2]) ?? 1;
  const step = toNum(params[3]) ?? 1;
  if (!rows || !cols) return '#CALC!';
  const out: any[][] = [];
  let v = start;
  for (let i = 0; i < rows; i++) { const row: any[] = []; for (let j = 0; j < cols; j++) { row.push(v); v += step; } out.push(row); }
  return out;
}

/** TAKE(array; filas; [cols]) — primeras/últimas filas y columnas (negativo = desde el final). */
export function TAKE(params: any[]): any {
  let rows = rectify(to2D(params[0]));
  const nr = params[1] === undefined || params[1] === '' ? null : toNum(params[1]);
  const nc = params[2] === undefined || params[2] === '' ? null : toNum(params[2]);
  if (nr !== null) rows = nr >= 0 ? rows.slice(0, nr) : rows.slice(Math.max(0, rows.length + nr));
  if (nc !== null) rows = rows.map((r) => (nc >= 0 ? r.slice(0, nc) : r.slice(Math.max(0, r.length + nc))));
  return rows.length && rows[0]?.length ? rows : '#CALC!';
}

/** DROP(array; filas; [cols]) — descarta filas/columnas del inicio (o del final si negativo). */
export function DROP(params: any[]): any {
  let rows = rectify(to2D(params[0]));
  const nr = params[1] === undefined || params[1] === '' ? 0 : (toNum(params[1]) ?? 0);
  const nc = params[2] === undefined || params[2] === '' ? null : toNum(params[2]);
  rows = nr >= 0 ? rows.slice(nr) : rows.slice(0, Math.max(0, rows.length + nr));
  if (nc !== null) rows = rows.map((r) => (nc >= 0 ? r.slice(nc) : r.slice(0, Math.max(0, r.length + nc))));
  return rows.length && rows[0]?.length ? rows : '#CALC!';
}

/** TRANSPOSE(array) — intercambia filas por columnas (fiel a Excel, 2D). */
export function TRANSPOSE(params: any[]): any { return transpose(rectify(to2D(params[0]))); }

// ── Texto moderno ─────────────────────────────────────────────────────────────

/** Normaliza el argumento de delimitador (escalar o array) a lista de cadenas no vacías. */
function delimsOf(arg: any): string[] {
  const flat = flatten(arg).map((d) => (d == null ? '' : String(d))).filter((d) => d !== '');
  return flat.length ? flat : [];
}
/** Todas las posiciones (inicio,len) de CUALQUIER delimitador en `text`, en orden, sin solapar. */
function allMatches(text: string, dels: string[], ci: boolean): { start: number; len: number }[] {
  if (!dels.length) return [];
  const hay = ci ? text.toLowerCase() : text;
  const dd = ci ? dels.map((d) => d.toLowerCase()) : dels;
  const res: { start: number; len: number }[] = [];
  for (let i = 0; i < text.length;) {
    let hit = false;
    for (let k = 0; k < dd.length; k++) {
      const d = dd[k];
      if (d && hay.startsWith(d, i)) { res.push({ start: i, len: dels[k].length }); i += dels[k].length; hit = true; break; }
    }
    if (!hit) i++;
  }
  return res;
}
/** Trozos de `text` separados por cualquier delimitador (conserva vacíos). */
function splitBy(text: string, dels: string[], ci: boolean): string[] {
  const ms = allMatches(text, dels, ci);
  if (!ms.length) return [text];
  const out: string[] = []; let prev = 0;
  for (const m of ms) { out.push(text.slice(prev, m.start)); prev = m.start + m.len; }
  out.push(text.slice(prev));
  return out;
}
/** Elige la ocurrencia `inst` (1-based; negativa = desde el final) del delimitador. */
function pickMatch(text: string, dels: string[], inst: number, ci: boolean, matchEnd: boolean) {
  const ms = allMatches(text, dels, ci);
  if (matchEnd) ms.push({ start: text.length, len: 0 });
  if (inst === 0) inst = 1;
  return inst > 0 ? ms[inst - 1] : ms[ms.length + inst];
}

/** TEXTBEFORE(texto; delim; [instancia]; [no_distinguir_may]; [coincidir_fin]; [si_no_existe]). */
export function TEXTBEFORE(params: any[]): any {
  const text = cellStr(params[0]);
  const dels = delimsOf(params[1]);
  const inst = Math.trunc(toNum(params[2]) ?? 1);
  const ci = (toNum(params[3]) ?? 0) === 1;
  const matchEnd = (toNum(params[4]) ?? 0) === 1;
  const ifNot = params[5];
  if (!dels.length) return ifNot !== undefined ? ifNot : '#N/A';
  const m = pickMatch(text, dels, inst, ci, matchEnd);
  if (!m) return ifNot !== undefined ? ifNot : '#N/A';
  return text.slice(0, m.start);
}

/** TEXTAFTER(texto; delim; [instancia]; [no_distinguir_may]; [coincidir_fin]; [si_no_existe]). */
export function TEXTAFTER(params: any[]): any {
  const text = cellStr(params[0]);
  const dels = delimsOf(params[1]);
  const inst = Math.trunc(toNum(params[2]) ?? 1);
  const ci = (toNum(params[3]) ?? 0) === 1;
  const matchEnd = (toNum(params[4]) ?? 0) === 1;
  const ifNot = params[5];
  if (!dels.length) return ifNot !== undefined ? ifNot : '#N/A';
  const m = pickMatch(text, dels, inst, ci, matchEnd);
  if (!m) return ifNot !== undefined ? ifNot : '#N/A';
  return text.slice(m.start + m.len);
}

/** TEXTSPLIT(texto; delim_col; [delim_fila]; [ignorar_vacíos]; [no_distinguir_may]; [relleno]) → matriz 2D. */
export function TEXTSPLIT(params: any[]): any {
  const text = cellStr(params[0]);
  const colDel = delimsOf(params[1]);
  const rowDel = params[2] == null || params[2] === '' ? null : delimsOf(params[2]);
  const ignoreEmpty = truthy(params[3]);
  const ci = (toNum(params[4]) ?? 0) === 1;
  const pad = params[5] !== undefined ? params[5] : '#N/A';
  const rowsText = rowDel && rowDel.length ? splitBy(text, rowDel, ci) : [text];
  let grid = rowsText.map((rt) => (colDel.length ? splitBy(rt, colDel, ci) : [rt]));
  if (ignoreEmpty) {
    grid = grid.map((r) => r.filter((c) => c !== '')).filter((r) => r.length);
    if (!grid.length) grid = [['']];
  }
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  return grid.map((r) => (r.length === cols ? r : [...r, ...Array(cols - r.length).fill(pad)]));
}

/** ARRAYTOTEXT(array; [formato]) — 0 = conciso ("a, b, c"); 1 = estricto ("{...}"). */
export function ARRAYTOTEXT(params: any[]): any {
  const a = to2D(params[0]);
  const strict = (toNum(params[1]) ?? 0) === 1;
  if (!strict) return a.map((r) => r.map(cellStr).join(', ')).join(', ');
  const body = a.map((r) => r.map((v) => (typeof v === 'string' ? `"${v}"` : cellStr(v))).join(',')).join(';');
  return `{${body}}`;
}

/** VALUETOTEXT(valor; [formato]) — texto de un valor (estricto entrecomilla texto). */
export function VALUETOTEXT(params: any[]): any {
  const v = params[0];
  if (Array.isArray(v)) return ARRAYTOTEXT(params);
  const strict = (toNum(params[1]) ?? 0) === 1;
  return strict && typeof v === 'string' ? `"${v}"` : cellStr(v);
}

// ── Apilar / remodelar matrices ───────────────────────────────────────────────

/** VSTACK(a; b; …) — apila verticalmente; rellena columnas faltantes con #N/A. */
export function VSTACK(params: any[]): any {
  const mats = params.filter((p) => p !== undefined).map((p) => rectify(to2D(p)));
  const cols = mats.reduce((m, a) => Math.max(m, a.reduce((mm, r) => Math.max(mm, r.length), 0)), 0);
  const out: any[][] = [];
  for (const a of mats) for (const r of a) out.push(r.length === cols ? r : [...r, ...Array(cols - r.length).fill('#N/A')]);
  return out.length ? out : '#CALC!';
}

/** HSTACK(a; b; …) — apila horizontalmente; rellena filas faltantes con #N/A. */
export function HSTACK(params: any[]): any {
  const mats = params.filter((p) => p !== undefined).map((p) => rectify(to2D(p)));
  const rows = mats.reduce((m, a) => Math.max(m, a.length), 0);
  const out: any[][] = Array.from({ length: rows }, () => [] as any[]);
  for (const a of mats) {
    const c = a.reduce((mm, r) => Math.max(mm, r.length), 0);
    for (let i = 0; i < rows; i++) {
      const r = a[i] ?? [];
      const padded = r.length === c ? r : [...r, ...Array(c - r.length).fill('#N/A')];
      out[i].push(...padded);
    }
  }
  return out.length ? out : '#CALC!';
}

/** Aplana por filas (o columnas si `scanByCol`); `ignore`: 1 vacíos, 2 errores, 3 ambos. */
function scanFlatten(a: any[][], ignore: number, scanByCol: boolean): any[] {
  const src = scanByCol ? transpose(a) : a;
  const flat: any[] = [];
  for (const row of src) for (const v of row) flat.push(v);
  return flat.filter((v) => {
    const isEmpty = v == null || v === '';
    const isErr = typeof v === 'string' && /^#[A-Z/0-9]+[!?]$/.test(v);
    if ((ignore === 1 || ignore === 3) && isEmpty) return false;
    if ((ignore === 2 || ignore === 3) && isErr) return false;
    return true;
  });
}
/** TOCOL(array; [ignorar]; [por_columna]) — aplana a una sola columna. */
export function TOCOL(params: any[]): any {
  const flat = scanFlatten(rectify(to2D(params[0])), Math.trunc(toNum(params[1]) ?? 0), truthy(params[2]));
  return flat.length ? flat.map((v) => [v]) : '#CALC!';
}
/** TOROW(array; [ignorar]; [por_columna]) — aplana a una sola fila. */
export function TOROW(params: any[]): any {
  const flat = scanFlatten(rectify(to2D(params[0])), Math.trunc(toNum(params[1]) ?? 0), truthy(params[2]));
  return flat.length ? [flat] : '#CALC!';
}

/** CHOOSEROWS(array; fila1; …) — selecciona filas (1-based, negativo = desde el final). */
export function CHOOSEROWS(params: any[]): any {
  const a = rectify(to2D(params[0]));
  const picks = params.slice(1).flatMap((p) => flatten(p)).map((n) => Math.trunc(toNum(n) ?? 0)).filter((n) => n !== 0);
  const out = picks.map((n) => a[n > 0 ? n - 1 : a.length + n]).filter((r) => r !== undefined);
  return out.length ? out : '#VALUE!';
}
/** CHOOSECOLS(array; col1; …) — selecciona columnas (1-based, negativo = desde el final). */
export function CHOOSECOLS(params: any[]): any {
  const a = rectify(to2D(params[0]));
  const cols = a[0]?.length ?? 0;
  const picks = params.slice(1).flatMap((p) => flatten(p)).map((n) => Math.trunc(toNum(n) ?? 0)).filter((n) => n !== 0);
  const out = a.map((r) => picks.map((n) => r[n > 0 ? n - 1 : cols + n]));
  return out.length && out[0].length ? out : '#VALUE!';
}

/** EXPAND(array; filas; [cols]; [relleno]) — crece la matriz al tamaño dado con relleno. */
export function EXPAND(params: any[]): any {
  const a = rectify(to2D(params[0]));
  const rows = params[1] == null || params[1] === '' ? a.length : Math.trunc(toNum(params[1]) ?? a.length);
  const cols = params[2] == null || params[2] === '' ? (a[0]?.length ?? 1) : Math.trunc(toNum(params[2]) ?? (a[0]?.length ?? 1));
  const pad = params[3] !== undefined ? params[3] : '#N/A';
  const out: any[][] = [];
  for (let i = 0; i < rows; i++) { const row: any[] = []; for (let j = 0; j < cols; j++) row.push(a[i]?.[j] !== undefined ? a[i][j] : pad); out.push(row); }
  return out;
}

/** WRAPROWS(vector; ancho; [relleno]) — envuelve un vector en filas de `ancho`. */
export function WRAPROWS(params: any[]): any {
  const vec = flatten(params[0]);
  const w = Math.max(1, Math.trunc(toNum(params[1]) ?? 1));
  const pad = params[2] !== undefined ? params[2] : '#N/A';
  const out: any[][] = [];
  for (let i = 0; i < vec.length; i += w) { const row = vec.slice(i, i + w); while (row.length < w) row.push(pad); out.push(row); }
  return out.length ? out : '#CALC!';
}
/** WRAPCOLS(vector; alto; [relleno]) — envuelve un vector en columnas de `alto`. */
export function WRAPCOLS(params: any[]): any {
  const vec = flatten(params[0]);
  const h = Math.max(1, Math.trunc(toNum(params[1]) ?? 1));
  const pad = params[2] !== undefined ? params[2] : '#N/A';
  const ncols = Math.max(1, Math.ceil(vec.length / h));
  const out: any[][] = Array.from({ length: h }, () => [] as any[]);
  for (let c = 0; c < ncols; c++) for (let r = 0; r < h; r++) { const idx = c * h + r; out[r].push(idx < vec.length ? vec[idx] : pad); }
  return out.length ? out : '#CALC!';
}

// ── Expresiones regulares (Excel 365, 2024) ───────────────────────────────────

/** Compila un patrón a RegExp JS; si es inválido, lo escapa como literal. */
function buildRegex(pattern: string, ci: boolean, global: boolean): RegExp {
  let flags = 'u';
  if (ci) flags += 'i';
  if (global) flags += 'g';
  try { return new RegExp(pattern, flags); }
  catch { return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags); }
}
/** REGEXTEST(texto; patrón; [no_distinguir_may]) — ¿el texto coincide con el patrón? */
export function REGEXTEST(params: any[]): any {
  try { return buildRegex(cellStr(params[1]), (toNum(params[2]) ?? 0) === 1, false).test(cellStr(params[0])); }
  catch { return '#VALUE!'; }
}
/** REGEXREPLACE(texto; patrón; reemplazo; [ocurrencia]; [no_distinguir_may]) — 0/omitido = todas. */
export function REGEXREPLACE(params: any[]): any {
  const text = cellStr(params[0]);
  const repl = cellStr(params[2]);
  const occurrence = params[3] == null || params[3] === '' ? 0 : Math.trunc(toNum(params[3]) ?? 0);
  const ci = (toNum(params[4]) ?? 0) === 1;
  try {
    const reG = buildRegex(cellStr(params[1]), ci, true);
    if (occurrence <= 0) return text.replace(reG, repl);
    let count = 0;
    return text.replace(reG, (match: string, ...rest: any[]) => {
      count++;
      if (count !== occurrence) return match;
      return repl.replace(/\$(\d+)/g, (_: string, d: string) => { const g = rest[Number(d) - 1]; return g == null ? '' : String(g); });
    });
  } catch { return '#VALUE!'; }
}
/** REGEXEXTRACT(texto; patrón; [modo]; [no_distinguir_may]) — 0 primera, 1 todas (col), 2 grupos (fila). */
export function REGEXEXTRACT(params: any[]): any {
  const text = cellStr(params[0]);
  const pattern = cellStr(params[1]);
  const mode = params[2] == null || params[2] === '' ? 0 : Math.trunc(toNum(params[2]) ?? 0);
  const ci = (toNum(params[3]) ?? 0) === 1;
  try {
    if (mode === 1) {
      const all = [...text.matchAll(buildRegex(pattern, ci, true))].map((mm) => mm[0]);
      return all.length ? all.map((v) => [v]) : '#N/A';
    }
    const m = buildRegex(pattern, ci, false).exec(text);
    if (!m) return '#N/A';
    if (mode === 2) { const groups = m.slice(1); return groups.length ? [groups] : [[m[0]]]; }
    return m[0];
  } catch { return '#VALUE!'; }
}

/** Registro de funciones modernas (clave en MAYÚSCULAS) que se mezcla en `CUSTOM_FUNCTIONS`. */
export const MODERN_FUNCTIONS: Record<string, (params: any[]) => any> = {
  // Matrices dinámicas (filtro/orden/secuencia)
  UNIQUE, SORT, SORTBY, FILTER, SEQUENCE, TAKE, DROP, TRANSPOSE,
  // Apilar / remodelar
  VSTACK, HSTACK, TOCOL, TOROW, CHOOSEROWS, CHOOSECOLS, EXPAND, WRAPROWS, WRAPCOLS,
  // Texto moderno
  TEXTBEFORE, TEXTAFTER, TEXTSPLIT, ARRAYTOTEXT, VALUETOTEXT,
  // Expresiones regulares (Excel 365)
  REGEXTEST, REGEXREPLACE, REGEXEXTRACT,
};
