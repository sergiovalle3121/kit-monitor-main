/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones matemáticas modernas que `@formulajs/formulajs@2.9.3` no trae (`#NAME?`):
 * la familia de **redondeo** `CEILING.MATH`/`FLOOR.MATH`/`CEILING.PRECISE`/`FLOOR.PRECISE`/
 * `ISO.CEILING` (nombres con punto → el fallback busca un objeto anidado inexistente, §54), la
 * matriz dinámica `RANDARRAY`, y `ENCODEURL`.
 */
import { toNum } from './formulaEngine';

function truthy(v: any): boolean { if (v === true) return true; if (v === false || v == null || v === '') return false; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return !/^(false|falso|0)$/i.test(v.trim()); return !!v; }

/** CEILING.MATH(núm; [sig=1]; [modo=0]) — redondea hacia +∞; `modo`≠0 aleja del cero los negativos. */
function ceilingMath(params: any[]): any {
  const num = toNum(params[0]); if (num === null) return '#VALUE!';
  const sig = Math.abs(toNum(params[1]) ?? 1); if (sig === 0) return 0;
  const mode = params[2] === undefined ? 0 : (toNum(params[2]) ?? 0);
  if (num >= 0) return Math.ceil(num / sig) * sig;
  return mode ? -Math.ceil(Math.abs(num) / sig) * sig : -Math.floor(Math.abs(num) / sig) * sig;
}

/** FLOOR.MATH(núm; [sig=1]; [modo=0]) — redondea hacia −∞; `modo`≠0 acerca al cero los negativos. */
function floorMath(params: any[]): any {
  const num = toNum(params[0]); if (num === null) return '#VALUE!';
  const sig = Math.abs(toNum(params[1]) ?? 1); if (sig === 0) return 0;
  const mode = params[2] === undefined ? 0 : (toNum(params[2]) ?? 0);
  if (num >= 0) return Math.floor(num / sig) * sig;
  return mode ? -Math.floor(Math.abs(num) / sig) * sig : -Math.ceil(Math.abs(num) / sig) * sig;
}

/** CEILING.PRECISE / ISO.CEILING — hacia +∞ (el signo de la cifra significativa se ignora). */
function ceilingPrecise(params: any[]): any {
  const num = toNum(params[0]); if (num === null) return '#VALUE!';
  const sig = Math.abs(toNum(params[1]) ?? 1); if (sig === 0) return 0;
  return Math.ceil(num / sig) * sig;
}
/** FLOOR.PRECISE — hacia −∞ (el signo de la cifra significativa se ignora). */
function floorPrecise(params: any[]): any {
  const num = toNum(params[0]); if (num === null) return '#VALUE!';
  const sig = Math.abs(toNum(params[1]) ?? 1); if (sig === 0) return 0;
  return Math.floor(num / sig) * sig;
}

/** RANDARRAY([filas=1]; [cols=1]; [mín=0]; [máx=1]; [entero=FALSO]) — matriz 2D aleatoria. */
function RANDARRAY(params: any[]): any {
  const rows = Math.max(1, Math.trunc(toNum(params[0]) ?? 1));
  const cols = Math.max(1, Math.trunc(toNum(params[1]) ?? 1));
  const min = toNum(params[2]) ?? 0;
  const max = toNum(params[3]) ?? 1;
  const integer = truthy(params[4]);
  if (max < min) return '#VALUE!';
  const lo = Math.ceil(min), hi = Math.floor(max);
  const cell = () => (integer ? lo + Math.floor(Math.random() * (hi - lo + 1)) : min + Math.random() * (max - min));
  return Array.from({ length: rows }, () => Array.from({ length: cols }, cell));
}

/** ENCODEURL(texto) — codifica para URL (equivalente a `encodeURIComponent`). */
function ENCODEURL(params: any[]): any {
  return encodeURIComponent(String(params[0] ?? ''));
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const MATH_EXTRA_FUNCTIONS: Record<string, (params: any[]) => any> = {
  'CEILING.MATH': ceilingMath, 'FLOOR.MATH': floorMath,
  'CEILING.PRECISE': ceilingPrecise, 'ISO.CEILING': ceilingPrecise, 'FLOOR.PRECISE': floorPrecise,
  RANDARRAY, ENCODEURL,
};
