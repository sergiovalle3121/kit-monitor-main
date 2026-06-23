/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones de **bonos con cupón** de Excel: las de calendario de cupones (`COUPNCD`, `COUPPCD`,
 * `COUPNUM`, `COUPDAYS`, `COUPDAYBS`, `COUPDAYSNC`) y, sobre ellas, `PRICE`, `YIELD`, `DURATION`,
 * `MDURATION`. En `@formulajs/formulajs@2.9.3` revientan (`#ERROR!`). Verificadas contra los
 * ejemplos documentados por Microsoft (p. ej. `PRICE(2008-02-15, 2017-11-15, 5.75%, 6.5%, 100, 2)`
 * = 94.63436).
 *
 * `basis`: 0 = 30/360 NASD (def.), 1 = real/real, 2 = real/360, 3 = real/365, 4 = 30/360 europeo.
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
const lastDom = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
const actual = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAYMS);

function days360(d1: Date, d2: Date, european: boolean): number {
  const [y1, m1] = ymd(d1); let dd1 = ymd(d1)[2]; const [y2, m2] = ymd(d2); let dd2 = ymd(d2)[2];
  const eom1 = m1 === 2 && dd1 === lastDom(y1, 2);
  if (european) { if (dd1 === 31) dd1 = 30; if (dd2 === 31) dd2 = 30; }
  else { if (eom1) { const eom2 = m2 === 2 && dd2 === lastDom(y2, 2); if (eom2) dd2 = 30; dd1 = 30; } if (dd2 === 31 && (dd1 === 30 || dd1 === 31)) dd2 = 30; if (dd1 === 31) dd1 = 30; }
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (dd2 - dd1);
}
/** Cómputo de días entre dos fechas según `basis` (para A, DSC dentro de un periodo de cupón). */
function dayCount(a: Date, b: Date, basis: number): number {
  if (basis === 0) return days360(a, b, false);
  if (basis === 4) return days360(a, b, true);
  return actual(a, b); // 1, 2, 3
}

/** Suma `months` meses a `base` conservando el fin de mes (calendario de cupones desde vencimiento). */
function addMonths(base: Date, months: number): Date {
  const [y, m, d] = ymd(base);
  const eom = d === lastDom(y, m);
  const tot = y * 12 + (m - 1) + months;
  const ny = Math.floor(tot / 12); const nm = (tot % 12 + 12) % 12 + 1;
  const dim = lastDom(ny, nm);
  return new Date(Date.UTC(ny, nm - 1, eom ? dim : Math.min(d, dim)));
}

interface Sched { pcd: Date; ncd: Date; n: number }
/** Calendario de cupones: cupón previo (≤ liquidación), siguiente (> liquidación) y nº restante. */
function schedule(settle: Date, maturity: Date, freq: number): Sched {
  const step = 12 / freq;
  let i = 0; let cd = maturity; let ncd = maturity;
  while (cd.getTime() > settle.getTime()) { ncd = cd; i++; cd = addMonths(maturity, -step * i); }
  return { pcd: cd, ncd, n: i };
}
/** Días del periodo de cupón que contiene la liquidación (E), según `basis`. */
function coupDays(s: Sched, freq: number, basis: number): number {
  return basis === 0 || basis === 4 ? 360 / freq : actual(s.pcd, s.ncd);
}

function args(p: any[], freqIdx: number, basisIdx: number): { s: Date; m: Date; freq: number; basis: number } | string {
  const s = toDate(p[0]); const m = toDate(p[1]);
  if (!s || !m) return '#VALUE!';
  if (s.getTime() >= m.getTime()) return '#NUM!';
  const freq = Math.trunc(toNum(p[freqIdx]) ?? 0);
  if (![1, 2, 4].includes(freq)) return '#NUM!';
  const basis = p[basisIdx] === undefined ? 0 : Math.trunc(toNum(p[basisIdx]) ?? 0);
  if (basis < 0 || basis > 4) return '#NUM!';
  return { s, m, freq, basis };
}

// ── Funciones de calendario ────────────────────────────────────────────────────
function COUPNUM(p: any[]): any { const a = args(p, 2, 3); if (typeof a === 'string') return a; return schedule(a.s, a.m, a.freq).n; }
function COUPDAYBS(p: any[]): any { const a = args(p, 2, 3); if (typeof a === 'string') return a; return dayCount(schedule(a.s, a.m, a.freq).pcd, a.s, a.basis); }
function COUPDAYSNC(p: any[]): any { const a = args(p, 2, 3); if (typeof a === 'string') return a; return dayCount(a.s, schedule(a.s, a.m, a.freq).ncd, a.basis); }
function COUPDAYS(p: any[]): any { const a = args(p, 2, 3); if (typeof a === 'string') return a; return coupDays(schedule(a.s, a.m, a.freq), a.freq, a.basis); }
function COUPNCD(p: any[]): any { const a = args(p, 2, 3); if (typeof a === 'string') return a; return schedule(a.s, a.m, a.freq).ncd; }
function COUPPCD(p: any[]): any { const a = args(p, 2, 3); if (typeof a === 'string') return a; return schedule(a.s, a.m, a.freq).pcd; }

// ── PRICE / YIELD ──────────────────────────────────────────────────────────────
/** Precio por 100 de valor nominal de un bono con cupón periódico. */
function priceCore(s: Date, m: Date, rate: number, yld: number, redemption: number, freq: number, basis: number): number {
  const sch = schedule(s, m, freq);
  const E = coupDays(sch, freq, basis);
  const N = sch.n;
  const DSC = dayCount(s, sch.ncd, basis);
  const A = dayCount(sch.pcd, s, basis);
  const coupon = 100 * rate / freq;
  const p = yld / freq;
  if (N === 1) {
    const T1 = coupon + redemption;
    const T2 = p * (DSC / E) + 1;
    return T1 / T2 - A / E * coupon;
  }
  let price = redemption / Math.pow(1 + p, N - 1 + DSC / E);
  for (let k = 1; k <= N; k++) price += coupon / Math.pow(1 + p, k - 1 + DSC / E);
  return price - A / E * coupon;
}
function PRICE(p: any[]): any {
  const a = args(p, 5, 6); if (typeof a === 'string') return a;
  const rate = toNum(p[2]), yld = toNum(p[3]), red = toNum(p[4]);
  if (rate === null || yld === null || red === null || rate < 0 || yld < 0 || red <= 0) return '#NUM!';
  return priceCore(a.s, a.m, rate, yld, red, a.freq, a.basis);
}
function YIELD(p: any[]): any {
  const a = args(p, 5, 6); if (typeof a === 'string') return a;
  const rate = toNum(p[2]), pr = toNum(p[3]), red = toNum(p[4]);
  if (rate === null || pr === null || red === null || rate < 0 || pr <= 0 || red <= 0) return '#NUM!';
  // Bisección sobre el rendimiento: precio decrece con el rendimiento.
  let lo = 0, hi = 1;
  const f = (y: number) => priceCore(a.s, a.m, rate, y, red, a.freq, a.basis);
  for (let k = 0; k < 200 && f(hi) > pr; k++) hi *= 2;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(mid) > pr) lo = mid; else hi = mid; if (hi - lo < 1e-12) break; }
  return (lo + hi) / 2;
}

// ── DURATION / MDURATION ───────────────────────────────────────────────────────
function durationCore(s: Date, m: Date, coupon: number, yld: number, freq: number, basis: number): number {
  const sch = schedule(s, m, freq);
  const E = coupDays(sch, freq, basis);
  const N = sch.n;
  const DSC = dayCount(s, sch.ncd, basis);
  const f = DSC / E; // fracción hasta el primer cupón
  const p = yld / freq;
  const c = 100 * coupon / freq;
  let num = 0, den = 0;
  for (let k = 1; k <= N; k++) {
    const t = (k - 1 + f); // periodos hasta el flujo k
    const cf = c + (k === N ? 100 : 0);
    const pv = cf / Math.pow(1 + p, t);
    num += t * pv; den += pv;
  }
  return (num / den) / freq; // en años
}
function DURATION(p: any[]): any {
  const a = args(p, 4, 5); if (typeof a === 'string') return a;
  const coupon = toNum(p[2]), yld = toNum(p[3]);
  if (coupon === null || yld === null || coupon < 0 || yld < 0) return '#NUM!';
  return durationCore(a.s, a.m, coupon, yld, a.freq, a.basis);
}
function MDURATION(p: any[]): any {
  const a = args(p, 4, 5); if (typeof a === 'string') return a;
  const coupon = toNum(p[2]), yld = toNum(p[3]);
  if (coupon === null || yld === null || coupon < 0 || yld < 0) return '#NUM!';
  return durationCore(a.s, a.m, coupon, yld, a.freq, a.basis) / (1 + yld / a.freq);
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const BOND_FUNCTIONS: Record<string, (params: any[]) => any> = {
  COUPNUM, COUPDAYBS, COUPDAYSNC, COUPDAYS, COUPNCD, COUPPCD, PRICE, YIELD, DURATION, MDURATION,
};
