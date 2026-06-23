/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones financieras de **valores con descuento** (sin calendario de cupones): `DISC`,
 * `PRICEDISC`, `YIELDDISC`, `INTRATE`, `RECEIVED`, `ACCRINTM`. En `@formulajs/formulajs@2.9.3`
 * revientan con fechas en texto (`#ERROR!`). Todas se reducen a una **fracción de año** con la
 * convención de cómputo (`basis` 0–4), que aquí se implementa fiel a Excel.
 *
 * `basis`: 0 = 30/360 NASD (por defecto), 1 = real/real, 2 = real/360, 3 = real/365,
 * 4 = 30/360 europeo.
 */
import { toNum } from './formulaEngine';

const DAYMS = 86400000;
function toDate(v: any): Date | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAYMS);
  if (typeof v === 'string') { const s = v.trim(); const n = Number(s); if (s !== '' && !isNaN(n)) return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * DAYMS); const d = new Date(s); return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  return null;
}
const ymd = (d: Date): [number, number, number] => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInYear = (y: number): number => (isLeap(y) ? 366 : 365);
const lastDayOfMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isLastFeb = (d: Date): boolean => { const [y, m, dd] = ymd(d); return m === 2 && dd === lastDayOfMonth(y, 2); };
const actualDays = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAYMS);

/** Días 30/360 (NASD US o europeo) entre dos fechas, según las reglas de Excel. */
function days360(d1: Date, d2: Date, european: boolean): number {
  const [y1, m1] = ymd(d1); let dd1 = ymd(d1)[2]; const [y2, m2] = ymd(d2); let dd2 = ymd(d2)[2];
  if (european) { if (dd1 === 31) dd1 = 30; if (dd2 === 31) dd2 = 30; }
  else {
    if (isLastFeb(d1)) { if (isLastFeb(d2)) dd2 = 30; dd1 = 30; }
    if (dd2 === 31 && (dd1 === 30 || dd1 === 31)) dd2 = 30;
    if (dd1 === 31) dd1 = 30;
  }
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (dd2 - dd1);
}

/** Fracción de año entre dos fechas con la convención `basis` (0–4). null si las fechas son inválidas. */
export function yearFrac(a: Date, b: Date, basis: number): number | null {
  if (a.getTime() === b.getTime()) return 0;
  let s = a, e = b, sign = 1;
  if (s.getTime() > e.getTime()) { s = b; e = a; sign = -1; }
  switch (basis) {
    case 0: return sign * days360(s, e, false) / 360;
    case 4: return sign * days360(s, e, true) / 360;
    case 2: return sign * actualDays(s, e) / 360;
    case 3: return sign * actualDays(s, e) / 365;
    case 1: {
      const [y1] = ymd(s); const [y2] = ymd(e);
      const days = actualDays(s, e);
      if (y1 === y2) return sign * days / daysInYear(y1);
      let total = 0; for (let y = y1; y <= y2; y++) total += daysInYear(y);
      return sign * days / (total / (y2 - y1 + 1));
    }
    default: return null;
  }
}

/** Resuelve (settlement, maturity, basis) → fracción de año, o un código de error. */
function frac(p: any[], basisIdx: number): number | string {
  const s = toDate(p[0]); const m = toDate(p[1]);
  if (!s || !m) return '#VALUE!';
  if (s.getTime() >= m.getTime()) return '#NUM!';
  const basis = p[basisIdx] === undefined ? 0 : Math.trunc(toNum(p[basisIdx]) ?? 0);
  const yf = yearFrac(s, m, basis);
  return yf === null || yf <= 0 ? '#NUM!' : yf;
}

/** DISC(liquidación; vencimiento; precio; amortización; [base]) — tasa de descuento. */
function DISC(p: any[]): any { const yf = frac(p, 4); if (typeof yf === 'string') return yf; const pr = toNum(p[2]) ?? 0, red = toNum(p[3]) ?? 0; if (red === 0) return '#DIV/0!'; return ((red - pr) / red) / yf; }
/** PRICEDISC(liquidación; vencimiento; descuento; amortización; [base]) — precio por 100. */
function PRICEDISC(p: any[]): any { const yf = frac(p, 4); if (typeof yf === 'string') return yf; const disc = toNum(p[2]) ?? 0, red = toNum(p[3]) ?? 0; return red - disc * red * yf; }
/** YIELDDISC(liquidación; vencimiento; precio; amortización; [base]) — rendimiento anual. */
function YIELDDISC(p: any[]): any { const yf = frac(p, 4); if (typeof yf === 'string') return yf; const pr = toNum(p[2]) ?? 0, red = toNum(p[3]) ?? 0; if (pr === 0) return '#DIV/0!'; return ((red - pr) / pr) / yf; }
/** INTRATE(liquidación; vencimiento; inversión; amortización; [base]) — tasa de interés. */
function INTRATE(p: any[]): any { const yf = frac(p, 4); if (typeof yf === 'string') return yf; const inv = toNum(p[2]) ?? 0, red = toNum(p[3]) ?? 0; if (inv === 0) return '#DIV/0!'; return ((red - inv) / inv) / yf; }
/** RECEIVED(liquidación; vencimiento; inversión; descuento; [base]) — importe al vencimiento. */
function RECEIVED(p: any[]): any { const yf = frac(p, 4); if (typeof yf === 'string') return yf; const inv = toNum(p[2]) ?? 0, disc = toNum(p[3]) ?? 0; const den = 1 - disc * yf; if (den === 0) return '#DIV/0!'; return inv / den; }
/** ACCRINTM(emisión; liquidación; tasa; valor_nominal; [base]) — interés acumulado al vencimiento. */
function ACCRINTM(p: any[]): any { const yf = frac(p, 4); if (typeof yf === 'string') return yf; const rate = toNum(p[2]) ?? 0, par = p[3] === undefined ? 1000 : (toNum(p[3]) ?? 1000); return par * rate * yf; }

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const SECURITY_FUNCTIONS: Record<string, (params: any[]) => any> = {
  DISC, PRICEDISC, YIELDDISC, INTRATE, RECEIVED, ACCRINTM,
};
