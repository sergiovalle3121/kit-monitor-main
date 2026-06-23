/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Contrastes estadísticos con **nombre moderno (con punto)** de Excel 2010+ y dos alias de
 * ingeniería. Como en §54, el fallback de formulajs no resuelve los nombres con punto (busca un
 * objeto anidado), pero la versión LEGADA existe y es correcta, así que basta delegar:
 *   T.TEST→TTEST, F.TEST→FTEST, CHISQ.TEST→CHITEST, Z.TEST→ZTEST, BINOM.INV→CRITBINOM,
 *   ERF.PRECISE→ERF, ERFC.PRECISE→ERFC.
 * `CONFIDENCE.T` (intervalo de confianza con la t de Student) no existe en formulajs y se calcula
 * con `T.INV.2T` (§59): `CONFIDENCE.T(α, σ, n) = T.INV.2T(α, n−1) · σ / √n`.
 */
import * as formulajs from '@formulajs/formulajs';
import { toNum } from './formulaEngine';
import { DISTRIBUTION_FUNCTIONS } from './distributions';

/** Delegación a una función LEGADA de formulajs (misma firma). */
function delegate(name: string): (params: any[]) => any {
  const fn = (formulajs as any)[name];
  return (params: any[]) => (typeof fn === 'function' ? fn.apply(formulajs, params) : '#NAME?');
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const STAT_TEST_FUNCTIONS: Record<string, (params: any[]) => any> = {
  'T.TEST': delegate('TTEST'),
  'F.TEST': delegate('FTEST'),
  'CHISQ.TEST': delegate('CHITEST'),
  'Z.TEST': delegate('ZTEST'),
  'BINOM.INV': delegate('CRITBINOM'),
  'ERF.PRECISE': delegate('ERF'),
  'ERFC.PRECISE': delegate('ERFC'),
  'CONFIDENCE.T': (p) => {
    const alpha = toNum(p[0]), sd = toNum(p[1]), n = toNum(p[2]);
    if (alpha === null || sd === null || n === null || alpha <= 0 || alpha >= 1 || sd <= 0 || n < 2) return '#NUM!';
    const t = DISTRIBUTION_FUNCTIONS['T.INV.2T']([alpha, n - 1]);
    return typeof t === 'number' ? t * sd / Math.sqrt(n) : t;
  },
};
