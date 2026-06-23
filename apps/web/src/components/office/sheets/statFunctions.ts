/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones estadísticas con **nombre moderno (con punto)** de Excel 2010+ y correcciones de
 * fidelidad. Dos huecos detectados auditando el motor REAL:
 *
 *  1) **Nombres con punto** (`STDEV.S`, `VAR.P`, `NORM.DIST`, `RANK.EQ`, `QUARTILE.INC`…): el
 *     fallback a formulajs (`evaluate-by-operator`) hace `symbol.split('.')` y busca un objeto
 *     ANIDADO (`formulajs.NORM.S.DIST`) que no existe → `#NAME?`. formulajs sólo registra los
 *     nombres LEGADOS planos (`STDEV`, `NORMDIST`…). Registramos los nombres con punto en
 *     `CUSTOM_FUNCTIONS` (que `getFunction` resuelve ANTES del fallback) delegando en el legado
 *     verificado.
 *  2) **`NORMSDIST` roto**: formulajs devuelve la **densidad (PDF)**, no la **acumulada (CDF)**
 *     (`NORMSDIST(0)`→0.3989 en vez de 0.5). Lo corregimos y añadimos la familia normal estándar.
 *
 * Además, variantes que el legado no trae: `QUARTILE.EXC`/`PERCENTILE.EXC` (interpolación
 * exclusiva, base `n+1`) y `RANK.AVG` (rango promedio en empates).
 */
import * as formulajs from '@formulajs/formulajs';
import { flatten, toNum } from './formulaEngine';

// ── Normal estándar (erf de Abramowitz-Stegun 7.1.26; error < 1.5e-7) ──────────
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1; x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}
const normCdf = (z: number): number => 0.5 * (1 + erf(z / Math.SQRT2));
const normPdf = (z: number): number => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);

/** Delegación a una función LEGADA de formulajs (misma firma), con los params tal cual. */
function delegate(name: string): (params: any[]) => any {
  const fn = (formulajs as any)[name];
  return (params: any[]) => (typeof fn === 'function' ? fn.apply(formulajs, params) : '#NAME?');
}

/** Vector numérico ordenado a partir del primer argumento (rango/matriz). */
function sortedNums(arg: any): number[] {
  return flatten(arg).map(toNum).filter((x): x is number => x !== null).sort((a, b) => a - b);
}

/** Percentil EXCLUSIVO (Excel `PERCENTILE.EXC`): posición `p·(n+1)`, interpolada. */
function percentileExc(arg: any, p: number): any {
  const a = sortedNums(arg); const n = a.length;
  if (n === 0 || p <= 0 || p >= 1) return '#NUM!';
  const rank = p * (n + 1);
  if (rank < 1 || rank > n) return '#NUM!';
  const lo = Math.floor(rank); const frac = rank - lo;
  return lo >= n ? a[n - 1] : a[lo - 1] + frac * (a[lo] - a[lo - 1]);
}

/** RANK.AVG: rango con promedio en empates (orden 0/omitido = descendente). */
function rankAvg(params: any[]): any {
  const x = toNum(params[0]); if (x === null) return '#VALUE!';
  const nums = flatten(params[1]).map(toNum).filter((v): v is number => v !== null);
  const asc = params[2] !== undefined && params[2] !== null && truthyNum(params[2]);
  let less = 0, eq = 0;
  for (const v of nums) { if (v === x) eq++; else if (asc ? v < x : v > x) less++; }
  if (eq === 0) return '#N/A';
  return less + 1 + (eq - 1) / 2;
}
function truthyNum(v: any): boolean { const n = toNum(v); return n !== null ? n !== 0 : !!v; }
function truthy(v: any): boolean { if (v === true) return true; if (v === false || v == null || v === '') return false; if (typeof v === 'string') return !/^(false|falso|0)$/i.test(v.trim()); return !!v; }

/** Registro para fusionar en CUSTOM_FUNCTIONS (nombres con punto + correcciones). */
export const STAT_FUNCTIONS: Record<string, (params: any[]) => any> = {
  // Desviación / varianza (idénticas al legado verificado).
  'STDEV.S': delegate('STDEV'), 'STDEV.P': delegate('STDEVP'),
  'VAR.S': delegate('VAR'), 'VAR.P': delegate('VARP'),
  'COVARIANCE.P': delegate('COVAR'), 'COVARIANCE.S': delegate('COVARIANCES'),
  // Posición / rango.
  'MODE.SNGL': delegate('MODE'),
  'QUARTILE.INC': delegate('QUARTILE'), 'PERCENTILE.INC': delegate('PERCENTILE'),
  'PERCENTRANK.INC': delegate('PERCENTRANK'), 'RANK.EQ': delegate('RANK'),
  'QUARTILE.EXC': (p) => percentileExc(p[0], (toNum(p[1]) ?? 0) / 4),
  'PERCENTILE.EXC': (p) => percentileExc(p[0], toNum(p[1]) ?? 0),
  'RANK.AVG': rankAvg,
  // Distribuciones (delegación al legado verificado).
  'NORM.INV': delegate('NORMINV'), 'NORM.S.INV': delegate('NORMSINV'),
  'LOGNORM.INV': delegate('LOGNORMINV'), 'LOGNORM.DIST': delegate('LOGNORMDIST'),
  'BINOM.DIST': delegate('BINOMDIST'), 'NEGBINOM.DIST': delegate('NEGBINOMDIST'),
  'POISSON.DIST': delegate('POISSON'), 'EXPON.DIST': delegate('EXPONDIST'),
  'WEIBULL.DIST': delegate('WEIBULL'), 'CONFIDENCE.NORM': delegate('CONFIDENCE'),
  'FORECAST.LINEAR': delegate('FORECAST'),
  // Familia normal — implementación CORRECTA (formulajs `NORMSDIST` devuelve la PDF, no la CDF).
  NORMSDIST: (p) => normCdf(toNum(p[0]) ?? 0),
  'NORM.S.DIST': (p) => (truthy(p[1]) ? normCdf(toNum(p[0]) ?? 0) : normPdf(toNum(p[0]) ?? 0)),
  'NORM.DIST': (p) => {
    const x = toNum(p[0]) ?? 0, mean = toNum(p[1]) ?? 0, sd = toNum(p[2]) ?? 1;
    if (sd <= 0) return '#NUM!';
    const z = (x - mean) / sd;
    return truthy(p[3]) ? normCdf(z) : normPdf(z) / sd;
  },
};
