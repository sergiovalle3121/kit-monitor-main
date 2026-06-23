/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de las conversiones **a hexadecimal** (`DEC2HEX`, `BIN2HEX`, `OCT2HEX`): Excel las
 * devuelve en **MAYÚSCULAS** (`DEC2HEX(31)`=`"1F"`, `BIN2HEX(11111111)`=`"FF"`, `OCT2HEX(777)`=`"1FF"`),
 * pero `@formulajs/formulajs@2.9.3` las devuelve en minúsculas (`"1f"`, `"ff"`, `"1ff"`). Esto rompe
 * comparaciones de texto y búsquedas exactas contra valores de Excel.
 *
 * Se **delega en el mismo `formulajs`** —que calcula bien el valor, el relleno (`places`) y el
 * complemento a dos de los negativos— y sólo se **pasa a mayúsculas** la cadena. Idéntico en todo lo
 * demás, riesgo cero. (`HEX2*` ya aceptan ambas cajas, así que no necesitan arreglo.)
 */
import * as formulajs from '@formulajs/formulajs';

/** Envuelve una función de `formulajs` para devolver su cadena en mayúsculas (el valor no cambia). */
const upper = (name: string) => (params: any[]): any => {
  const r = (formulajs as any)[name](...params);
  return typeof r === 'string' ? r.toUpperCase() : r;
};

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const HEX_FIDELITY_FUNCTIONS: Record<string, (params: any[]) => any> = {
  DEC2HEX: upper('DEC2HEX'),
  BIN2HEX: upper('BIN2HEX'),
  OCT2HEX: upper('OCT2HEX'),
};
