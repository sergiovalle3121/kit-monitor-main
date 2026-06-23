/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones escalares de Excel que `@formulajs/formulajs@2.9.3` **no trae o devuelve rotas**
 * (auditadas con el motor REAL): `ADDRESS`, `DOLLAR`, `FIXED`, `T`, `N`, `BASE`, `DECIMAL`,
 * `TIMEVALUE`. Se registran en `CUSTOM_FUNCTIONS`, que el parche de `getFunction` resuelve ANTES
 * del fallback a formulajs (`evaluateByOperator`), así que nuestra versión fiel gana (misma técnica
 * que `TEXT` §«formulaEngine»).
 */
import { toNum, isErrorValue, errorCode } from './formulaEngine';

function colName(c: number): string { let s = ''; c += 1; while (c > 0) { const r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); } return s; }
function truthy(v: any): boolean { if (v === false || v == null || v === '') return false; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return !/^(false|falso|0)$/i.test(v.trim()); return !!v; }
const quoteSheet = (sn: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(sn) ? sn : `'${sn.replace(/'/g, "''")}'`);

/** Redondea a `dec` decimales con «mitad lejos del cero» (como Excel); `dec` negativo a la izquierda. */
function roundTo(num: number, dec: number): number {
  const f = Math.pow(10, Math.abs(dec));
  const a = Math.abs(num);
  const r = dec >= 0 ? Math.round(a * f) / f : Math.round(a / f) * f;
  return num < 0 ? -r : r;
}
/** Parte entera con separadores de millar + `decimals` decimales (valor NO negativo). */
function groupThousands(absNum: number, decimals: number): string {
  const fixed = absNum.toFixed(Math.max(0, decimals));
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

/** ADDRESS(fila; col; [abs]; [a1]; [hoja]) → referencia textual («$C$2», «Hoja1!C$2», «R2C3»). */
export function ADDRESS(params: any[]): any {
  const row = Math.trunc(toNum(params[0]) ?? 0);
  const col = Math.trunc(toNum(params[1]) ?? 0);
  if (row < 1 || col < 1) return '#VALUE!';
  const abs = params[2] === undefined || params[2] === null ? 1 : (toNum(params[2]) ?? 1);
  const a1 = params[3] === undefined || params[3] === null ? true : truthy(params[3]);
  const sheet = params[4] != null && params[4] !== '' ? `${quoteSheet(String(params[4]))}!` : '';
  const rowAbs = abs === 1 || abs === 2;
  const colAbs = abs === 1 || abs === 3;
  if (a1) return `${sheet}${colAbs ? '$' : ''}${colName(col - 1)}${rowAbs ? '$' : ''}${row}`;
  const rp = rowAbs ? `R${row}` : `R[${row}]`;
  const cp = colAbs ? `C${col}` : `C[${col}]`;
  return `${sheet}${rp}${cp}`;
}

/** DOLLAR(número; [decimales]) → texto de moneda; negativos entre paréntesis, como Excel. */
export function DOLLAR(params: any[]): any {
  const num = toNum(params[0]); if (num === null) return '#VALUE!';
  const dec = params[1] === undefined || params[1] === null ? 2 : Math.trunc(toNum(params[1]) ?? 2);
  const r = roundTo(num, dec);
  const body = '$' + groupThousands(Math.abs(r), Math.max(0, dec));
  return r < 0 ? `(${body})` : body;
}

/** FIXED(número; [decimales]; [sin_miles]) → texto con decimales fijos; negativos con signo «-». */
export function FIXED(params: any[]): any {
  const num = toNum(params[0]); if (num === null) return '#VALUE!';
  const dec = params[1] === undefined || params[1] === null ? 2 : Math.trunc(toNum(params[1]) ?? 2);
  const noCommas = truthy(params[2]);
  const r = roundTo(num, dec);
  const d = Math.max(0, dec);
  const body = noCommas ? Math.abs(r).toFixed(d) : groupThousands(Math.abs(r), d);
  return (r < 0 ? '-' : '') + body;
}

/** T(valor) → el valor si es texto; si no, "". Los errores se propagan. */
export function T(params: any[]): any {
  const v = params[0];
  if (isErrorValue(v)) return errorCode(v);
  return typeof v === 'string' ? v : '';
}

/** N(valor) → número (núm→núm, lógico→1/0, fecha→nº de serie, texto→0). Propaga errores. */
export function N(params: any[]): any {
  const v = params[0];
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Date) return Math.floor((v.getTime() - Date.UTC(1899, 11, 30)) / 86400000);
  if (isErrorValue(v)) return errorCode(v);
  return 0;
}

/** BASE(número; base; [longitud_mín]) → texto en base 2–36 (mayúsculas), con relleno de ceros. */
export function BASE(params: any[]): any {
  const num = Math.trunc(toNum(params[0]) ?? NaN);
  const radix = Math.trunc(toNum(params[1]) ?? 0);
  if (!Number.isFinite(num) || num < 0 || radix < 2 || radix > 36) return '#NUM!';
  let s = num.toString(radix).toUpperCase();
  const min = Math.max(0, Math.trunc(toNum(params[2]) ?? 0));
  if (s.length < min) s = '0'.repeat(min - s.length) + s;
  return s;
}

/** DECIMAL(texto; base) → número a partir de su representación en base 2–36 (sin distinguir may.). */
export function DECIMAL(params: any[]): any {
  const text = String(params[0] ?? '').trim().toUpperCase();
  const radix = Math.trunc(toNum(params[1]) ?? 0);
  if (radix < 2 || radix > 36 || text === '') return '#NUM!';
  let n = 0;
  for (const ch of text) {
    const d = ch >= '0' && ch <= '9' ? ch.charCodeAt(0) - 48 : ch >= 'A' && ch <= 'Z' ? ch.charCodeAt(0) - 55 : -1;
    if (d < 0 || d >= radix) return '#NUM!';
    n = n * radix + d;
  }
  return n;
}

/** TIMEVALUE(texto) → fracción de día (0–1) de una hora «HH:MM[:SS] [AM/PM]». */
export function TIMEVALUE(params: any[]): any {
  const s = String(params[0] ?? '').trim();
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|A\.M\.|P\.M\.)?/i.exec(s);
  if (!m) return '#VALUE!';
  let h = +m[1]; const mi = +m[2]; const se = m[3] ? +m[3] : 0;
  const ap = (m[4] || '').toUpperCase();
  if (ap.startsWith('P') && h < 12) h += 12;
  if (ap.startsWith('A') && h === 12) h = 0;
  if (h > 23 || mi > 59 || se > 59) return '#VALUE!';
  return (h * 3600 + mi * 60 + se) / 86400;
}

// ── Alias de `T(` / `N(` ───────────────────────────────────────────────────────
// El lexer del parser NO acepta nombres de función de UNA letra (`T`, `N`): los confunde con una
// referencia de columna y la fórmula revienta con `#ERROR!` ANTES de resolver la función. Se
// renombran por preprocesado a nombres SIN ambigüedad (5 letras → no son columnas, máx. XFD), que
// el parser sí acepta, y se registran bajo esos alias.
const ALIAS: Record<string, string> = { T: 'AXOST', N: 'AXOSN' };

/** Renombra las llamadas `T(`/`N(` (token completo, fuera de comillas) a sus alias internos. */
export function aliasScalarFns(expr: string): string {
  if (typeof expr !== 'string' || !/[TN]\s*\(/.test(expr)) return expr;
  let out = '', i = 0, inStr = false;
  while (i < expr.length) {
    const ch = expr[i];
    if (inStr) { out += ch; if (ch === '"') { if (expr[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; } i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    const prev = out[out.length - 1];
    const prevIdent = prev != null && /[A-Za-z0-9_.$!]/.test(prev);
    if ((ch === 'T' || ch === 'N') && !prevIdent) {
      let j = i + 1; while (expr[j] === ' ') j++;
      if (expr[j] === '(') { out += ALIAS[ch]; i++; continue; } // sustituye sólo la letra; conserva «(»
    }
    out += ch; i++;
  }
  return out;
}

/** Registro para fusionar en CUSTOM_FUNCTIONS (T/N bajo sus alias internos). */
export const SCALAR_FUNCTIONS: Record<string, (params: any[]) => any> = {
  ADDRESS, DOLLAR, FIXED, BASE, DECIMAL, TIMEVALUE, AXOST: T, AXOSN: N,
};
