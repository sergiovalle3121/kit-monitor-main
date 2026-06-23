/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones de texto **por bytes** de Excel: `LENB`, `LEFTB`, `RIGHTB`, `MIDB`, `REPLACEB`,
 * `FINDB`, `SEARCHB`. Existen para idiomas de doble byte (DBCS: japonés, chino, coreano), donde
 * cuentan *bytes* en vez de caracteres. En una configuración regional de **un solo byte** (español,
 * inglés y demás latinas) cada carácter ocupa 1 byte, así que **son idénticas** a sus versiones por
 * carácter (`LEN`, `LEFT`, `RIGHT`, `MID`, `REPLACE`, `FIND`, `SEARCH`).
 *
 * `@formulajs/formulajs@2.9.3` no las trae, así que devolvían `#NAME?` —y cualquier `.xlsx` que las
 * usara se rompía al abrir—. Se registran como **delegaciones** a la función por carácter equivalente
 * de `formulajs` (mismo resultado que Excel en locales de un solo byte, que es el contexto de la app).
 * Riesgo cero: no tocan ninguna función existente, sólo añaden los nombres que faltaban.
 */
import * as formulajs from '@formulajs/formulajs';

/** Envuelve una función de `formulajs` por nombre (delegación directa de argumentos). */
const delegate = (name: string) => (params: any[]): any => (formulajs as any)[name](...params);

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const BYTE_TEXT_FUNCTIONS: Record<string, (params: any[]) => any> = {
  LENB: delegate('LEN'),
  LEFTB: delegate('LEFT'),
  RIGHTB: delegate('RIGHT'),
  MIDB: delegate('MID'),
  REPLACEB: delegate('REPLACE'),
  FINDB: delegate('FIND'),
  SEARCHB: delegate('SEARCH'),
};
