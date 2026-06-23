/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Familia de **regresión lineal/exponencial** de Excel: `TREND`, `GROWTH`, `SLOPE`, `INTERCEPT`,
 * `FORECAST`/`FORECAST.LINEAR`. En `@formulajs/formulajs@2.9.3`, `TREND`/`GROWTH` están rotas
 * (`#VALUE!`/`#REF!`) e `INTERCEPT` falla con vectores fila (p. ej. constantes de matriz `{…}`),
 * mientras `SLOPE` sí funciona — una incoherencia. Aquí se implementan todas con mínimos cuadrados,
 * de forma consistente para rangos y constantes de matriz.
 *
 * `TREND`/`GROWTH` DEVUELVEN una matriz 2D con la forma de `nueva_x` (componen con `INDEX`/`SUM` y
 * derraman, §38). El argumento `constante=FALSO` fuerza la recta/curva por el origen.
 */
import { flatten, toNum } from './formulaEngine';
import { to2D } from './modernFunctions';

const nums = (arg: any): number[] => flatten(arg).map(toNum).filter((x): x is number => x !== null);

/** Ajuste por mínimos cuadrados `y = m·x + b`. `forceZero` ⇒ b = 0 (recta por el origen). */
function fit(ys: number[], xs: number[], forceZero: boolean): { m: number; b: number } {
  const n = Math.min(ys.length, xs.length);
  if (forceZero) { let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += xs[i] * ys[i]; sxx += xs[i] * xs[i]; } return { m: sxx === 0 ? 0 : sxy / sxx, b: 0 }; }
  const xb = xs.slice(0, n).reduce((a, c) => a + c, 0) / n;
  const yb = ys.slice(0, n).reduce((a, c) => a + c, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - xb) * (ys[i] - yb); sxx += (xs[i] - xb) ** 2; }
  const m = sxx === 0 ? 0 : sxy / sxx;
  return { m, b: yb - m * xb };
}

const truthy = (v: any): boolean => { if (v === undefined || v === null) return true; if (v === false) return false; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return !/^(false|falso|0)$/i.test(v.trim()); return !!v; };

/** Aplica `f` a cada celda de la matriz `newX` (conserva su forma). */
function mapShape(newX: any[][], f: (x: number) => number): any[][] {
  return newX.map((row) => row.map((v) => { const n = toNum(v); return n === null ? '#VALUE!' : f(n); }));
}
/** Vector de x por defecto `{1,2,…,n}` como columna. */
const defaultX = (n: number): any[][] => Array.from({ length: n }, (_, i) => [i + 1]);

function SLOPE(p: any[]): any { const y = nums(p[0]), x = nums(p[1]); if (y.length < 2 || x.length < 2) return '#DIV/0!'; return fit(y, x, false).m; }
function INTERCEPT(p: any[]): any { const y = nums(p[0]), x = nums(p[1]); if (y.length < 2 || x.length < 2) return '#DIV/0!'; return fit(y, x, false).b; }
function FORECAST(p: any[]): any {
  const x = toNum(p[0]); const y = nums(p[1]), kx = nums(p[2]);
  if (x === null || y.length < 1 || kx.length < 1) return '#VALUE!';
  const { m, b } = fit(y, kx, false); return m * x + b;
}
function TREND(p: any[]): any {
  const y = nums(p[0]);
  const kx = p[1] !== undefined && p[1] !== null ? nums(p[1]) : y.map((_, i) => i + 1);
  const { m, b } = fit(y, kx, !truthy(p[3]));
  const newX = p[2] !== undefined && p[2] !== null ? to2D(p[2]) : (p[1] !== undefined && p[1] !== null ? to2D(p[1]) : defaultX(y.length));
  return mapShape(newX, (x) => m * x + b);
}
function GROWTH(p: any[]): any {
  const y = nums(p[0]);
  if (y.some((v) => v <= 0)) return '#NUM!';
  const kx = p[1] !== undefined && p[1] !== null ? nums(p[1]) : y.map((_, i) => i + 1);
  const { m, b } = fit(y.map(Math.log), kx, !truthy(p[3]));
  const newX = p[2] !== undefined && p[2] !== null ? to2D(p[2]) : (p[1] !== undefined && p[1] !== null ? to2D(p[1]) : defaultX(y.length));
  return mapShape(newX, (x) => Math.exp(m * x + b));
}

/** LOGEST(known_y; [known_x]; [const]) → coeficientes `{m, b}` de la curva `y = b·mˣ` (la rota en formulajs). */
function LOGEST(p: any[]): any {
  const y = nums(p[0]);
  if (y.some((v) => v <= 0)) return '#NUM!';
  const kx = p[1] !== undefined && p[1] !== null ? nums(p[1]) : y.map((_, i) => i + 1);
  const { m, b } = fit(y.map(Math.log), kx, !truthy(p[2]));
  return [[Math.exp(m), Math.exp(b)]];
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const REGRESSION_FUNCTIONS: Record<string, (params: any[]) => any> = {
  SLOPE, INTERCEPT, FORECAST, 'FORECAST.LINEAR': FORECAST, TREND, GROWTH, LOGEST,
};
