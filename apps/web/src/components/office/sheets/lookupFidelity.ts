/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de **`INDEX`** con vectores de **una sola fila**. En Excel, `INDEX(vector, n)` devuelve el
 * n-ésimo elemento sea el vector fila o columna; con una sola fila (`INDEX(A1:C1, 2)`), el índice es
 * la **columna**. `@formulajs/formulajs@2.9.3` lo trata como número de fila → fuera de rango →
 * `#REF!`, lo que **rompe el `INDEX/MATCH` horizontal** (`INDEX(A1:C1, MATCH(x, A1:C1, 0))`), un
 * patrón de búsqueda muy común. (El caso de una sola columna ya funciona.)
 *
 * Se **intercepta únicamente** ese patrón roto —un solo índice (sin `col_num`) sobre un vector 1D o
 * una matriz de una fila— devolviendo el elemento por posición; **todo lo demás se delega** en el
 * mismo `formulajs` sin tocarlo (riesgo cero para `INDEX(rango, fila, col)`, columnas, etc.).
 */
import * as formulajs from '@formulajs/formulajs';

function INDEX(params: any[]): any {
  const arr = params[0];
  const colMissing = params[2] === undefined || params[2] === null;
  if (colMissing && Array.isArray(arr)) {
    const is2D = Array.isArray(arr[0]);
    const oneRow = is2D ? arr.length === 1 : true; // un 1D se trata como una fila (vector posicional)
    if (oneRow) {
      const row: any[] = is2D ? arr[0] : arr;
      const i = Math.trunc(Number(params[1]));
      if (i === 0) return [row.slice()];                 // índice 0 → fila completa
      if (i >= 1 && i <= row.length) { const v = row[i - 1]; return v === null || v === undefined ? 0 : v; }
      return '#REF!';
    }
  }
  return (formulajs as any).INDEX(...params);
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const LOOKUP_FIDELITY_FUNCTIONS: Record<string, (params: any[]) => any> = { INDEX };
