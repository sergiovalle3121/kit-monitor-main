/**
 * Autosuma (Σ) estilo Excel: dado el rango seleccionado, propone la fórmula de agregación y la
 * celda donde colocarla (debajo de una columna, a la derecha de una fila). Pura → testeable.
 */
import { parseRange } from '@/lib/office/charts';
import { colName } from '@/lib/office/sheetOps';

export type AggFn = 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN';

export interface AutoSumPlan { formula: string; targetCell: string; range: string }

/**
 * Plan de autosuma para `rangeA1` con la función `fn`:
 *  - rango de una FILA (varias columnas) → resultado a la DERECHA.
 *  - rango de una COLUMNA o 2D → resultado DEBAJO.
 *  - una sola celda → suma la columna contigua de números hacia arriba (no soportado sin datos
 *    → se agrega esa misma celda como rango trivial debajo).
 */
export function autoSumPlan(rangeA1: string, fn: AggFn = 'SUM'): AutoSumPlan | null {
  const rng = parseRange(rangeA1);
  if (!rng) return null;
  const singleRow = rng.r1 === rng.r2;
  const singleCol = rng.c1 === rng.c2;
  let targetCell: string;
  if (singleRow && !singleCol) {
    // fila → a la derecha
    targetCell = `${colName(rng.c2 + 1)}${rng.r1 + 1}`;
  } else {
    // columna o bloque → debajo (de la primera columna del rango)
    targetCell = `${colName(rng.c1)}${rng.r2 + 2}`;
  }
  return { formula: `=${fn}(${rangeA1})`, targetCell, range: rangeA1 };
}
