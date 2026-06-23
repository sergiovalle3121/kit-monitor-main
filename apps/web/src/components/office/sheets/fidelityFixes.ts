/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Correcciones de **fidelidad** de funciones MUY comunes cuyo resultado en
 * `@formulajs/formulajs@2.9.3` difiere de Excel (detectadas con una auditoría de valores conocidos):
 *
 *  • `ROUND`: Excel redondea «mitad lejos del cero»; formulajs usa `Math.round` (mitad hacia +∞),
 *    así `ROUND(-2.5, 0)` daba **-2** en vez de **-3**. Además corrige el error de coma flotante que
 *    estropea casos como `ROUND(1.005, 2)` (→ 1.01) y `ROUND(2.675, 2)` (→ 2.68).
 *  • `SUBSTITUTE(texto, viejo, nuevo, n)`: con el argumento de instancia, formulajs sustituía la
 *    ocurrencia equivocada — `SUBSTITUTE("aaa","a","b",2)` daba **"aab"** en vez de **"aba"**.
 *
 * Se registran en `CUSTOM_FUNCTIONS`, que `getFunction` resuelve ANTES del fallback de formulajs.
 */
import { toNum } from './formulaEngine';

/** Redondeo «mitad lejos del cero» (Excel) con corrección de error de coma flotante. */
function ROUND(p: any[]): any {
  const num = toNum(p[0]); if (num === null) return '#VALUE!';
  const digits = Math.trunc(toNum(p[1]) ?? 0);
  if (!Number.isFinite(num)) return num;
  const f = Math.pow(10, Math.abs(digits));
  const scaled = digits >= 0 ? Math.abs(num) * f : Math.abs(num) / f;
  const frac = scaled - Math.floor(scaled);
  const r = Math.round(scaled + (frac > 0 ? 1e-9 : 0)); // ε corrige 1.005·100 = 100.4999…
  const back = digits >= 0 ? r / f : r * f;
  return num < 0 ? -back : back;
}

/** SUBSTITUTE(texto; viejo; nuevo; [instancia]) — sustituye la n-ésima ocurrencia (o todas). */
function SUBSTITUTE(p: any[]): any {
  const text = p[0] === null || p[0] === undefined ? '' : String(p[0]);
  const oldT = p[1] === null || p[1] === undefined ? '' : String(p[1]);
  const newT = p[2] === null || p[2] === undefined ? '' : String(p[2]);
  if (oldT === '') return text;
  if (p[3] === undefined || p[3] === null) return text.split(oldT).join(newT);
  const inst = Math.trunc(toNum(p[3]) ?? 0);
  if (inst < 1) return '#VALUE!';
  let pos = 0, count = 0, idx: number;
  while ((idx = text.indexOf(oldT, pos)) !== -1) {
    if (++count === inst) return text.slice(0, idx) + newT + text.slice(idx + oldT.length);
    pos = idx + oldT.length;
  }
  return text; // menos de `inst` ocurrencias → sin cambios
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const FIDELITY_FUNCTIONS: Record<string, (params: any[]) => any> = { ROUND, SUBSTITUTE };
