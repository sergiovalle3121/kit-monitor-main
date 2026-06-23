/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Corrección de fidelidad de **PERCENTILE / QUARTILE** (inclusivos). La auditoría de valores
 * conocidos detectó que `@formulajs/formulajs@2.9.3` interpola mal `PERCENTILE`:
 * `PERCENTILE({1,2,3,4}, 0.25)` daba **1.25** en vez de **1.75** (rango `p·(n−1)` de Excel), pese a
 * que su `QUARTILE` —que debería coincidir, `QUARTILE(·,1) ≡ PERCENTILE(·,0.25)`— sí daba 1.75.
 *
 * Aquí se implementa el algoritmo INCLUSIVO de Excel (interpolación lineal sobre el rango
 * 0-based `p·(n−1)`) y se registran `PERCENTILE`, `PERCENTILE.INC`, `QUARTILE`, `QUARTILE.INC` para
 * que toda la familia sea coherente. Los exclusivos (`PERCENTILE.EXC`/`QUARTILE.EXC`) viven en §54.
 */
import { flatten, toNum } from './formulaEngine';

/** Percentil INCLUSIVO de Excel: interpolación lineal en el rango 0-based `p·(n−1)`. */
function pctInc(arg: any, p: number | null): number | string {
  if (p === null || p < 0 || p > 1) return '#NUM!';
  const a = flatten(arg).map(toNum).filter((x): x is number => x !== null).sort((x, y) => x - y);
  const n = a.length;
  if (n === 0) return '#NUM!';
  if (n === 1) return a[0];
  const rank = p * (n - 1);
  const lo = Math.floor(rank);
  const frac = rank - lo;
  return lo + 1 >= n ? a[n - 1] : a[lo] + frac * (a[lo + 1] - a[lo]);
}

function PERCENTILE(params: any[]): any { return pctInc(params[0], toNum(params[1])); }
function QUARTILE(params: any[]): any {
  const q = Math.trunc(toNum(params[1]) ?? -1);
  if (q < 0 || q > 4) return '#NUM!';
  return pctInc(params[0], q / 4);
}

/** Registro para fusionar en CUSTOM_FUNCTIONS (debe ir DESPUÉS de STAT_FUNCTIONS para imponerse). */
export const PERCENTILE_FUNCTIONS: Record<string, (params: any[]) => any> = {
  PERCENTILE, 'PERCENTILE.INC': PERCENTILE, QUARTILE, 'QUARTILE.INC': QUARTILE,
};
