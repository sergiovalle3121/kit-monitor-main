/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de **`CONVERT` con temperaturas**. Excel convierte entre Celsius (`"C"`/`"cel"`),
 * Fahrenheit (`"F"`/`"fah"`) y Kelvin (`"K"`/`"kel"`): `CONVERT(100,"C","F")`=`212`. Pero
 * `@formulajs/formulajs@2.9.3` no soporta esas unidades → `#VALUE!`. La temperatura es **afín**
 * (lleva un desplazamiento, no sólo un factor), por eso requiere un tratamiento aparte.
 *
 * Se intercepta **únicamente** cuando **ambas** unidades son de temperatura (pivotando por Celsius);
 * cualquier otra conversión (masa, longitud, tiempo…) se **delega** en el mismo `formulajs` sin
 * tocarla → riesgo cero.
 */
import * as formulajs from '@formulajs/formulajs';

const TEMP: Record<string, true> = { C: true, cel: true, F: true, fah: true, K: true, kel: true };
const isF = (u: string) => u === 'F' || u === 'fah';
const isK = (u: string) => u === 'K' || u === 'kel';

const toCelsius = (v: number, u: string): number => (isF(u) ? (v - 32) * 5 / 9 : isK(u) ? v - 273.15 : v);
const fromCelsius = (v: number, u: string): number => (isF(u) ? v * 9 / 5 + 32 : isK(u) ? v + 273.15 : v);

function CONVERT(params: any[]): any {
  const [num, from, to] = params;
  if (typeof from === 'string' && typeof to === 'string' && TEMP[from] && TEMP[to]) {
    const n = Number(num);
    if (Number.isNaN(n)) return '#VALUE!';
    return fromCelsius(toCelsius(n, from), to);
  }
  return (formulajs as any).CONVERT(...params);
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const CONVERT_TEMP_FUNCTIONS: Record<string, (params: any[]) => any> = { CONVERT };
