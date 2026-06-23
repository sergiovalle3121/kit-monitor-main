/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de **`DEC2HEX`**: Excel devuelve el hexadecimal en **MAYÚSCULAS** (`DEC2HEX(31)`=`"1F"`,
 * `DEC2HEX(255,4)`=`"00FF"`, `DEC2HEX(-1)`=`"FFFFFFFFFF"`), pero `@formulajs/formulajs@2.9.3` lo
 * devuelve en minúsculas (`"1f"`, `"00ff"`, `"ffffffffff"`). Esto rompe comparaciones de texto y
 * búsquedas exactas contra valores de Excel.
 *
 * Se **delega en el mismo `formulajs`** —que calcula bien el valor, el relleno (`places`) y el
 * complemento a dos de los negativos— y sólo se **pasa a mayúsculas** la cadena. Idéntico en todo lo
 * demás, riesgo cero. (`HEX2DEC` ya acepta ambas cajas, así que no necesita arreglo.)
 */
import * as formulajs from '@formulajs/formulajs';

function DEC2HEX(params: any[]): any {
  const r = (formulajs as any).DEC2HEX(...params);
  return typeof r === 'string' ? r.toUpperCase() : r;
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const HEX_FIDELITY_FUNCTIONS: Record<string, (params: any[]) => any> = { DEC2HEX };
