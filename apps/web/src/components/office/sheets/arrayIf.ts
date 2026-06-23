/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * `IF` **consciente de matrices** — completa el trabajo de la difusión de operadores (§69). Tras
 * habilitar `A1:A10>5` (→ matriz de lógicos), el idioma clásico de fórmula matricial
 * `SUM(IF(rango>x; valores; otro))` seguía fallando porque el `IF` de `@formulajs/formulajs` es
 * escalar: con una condición-matriz evalúa la matriz como un único «verdadero» y devuelve la rama
 * verdadera entera.
 *
 * Aquí: si la **condición es una matriz 2D**, se selecciona elemento a elemento entre las ramas
 * verdadera/falsa (que pueden ser escalares —se reciclan— o matrices), devolviendo una matriz 2D que
 * compone con `SUM`/`SUMPRODUCT`/… y derrama (§38). Si la condición es **escalar**, se delega en el
 * MISMO `formulajs.IF` que ya usaba el motor → comportamiento idéntico, riesgo cero de regresión.
 */
import * as formulajs from '@formulajs/formulajs';
import { to2D } from './modernFunctions';

/** Verdad estilo Excel para una condición (núm ≠ 0, lógico, "TRUE"/"FALSE", 1/0). */
function truthy(v: any): boolean {
  if (v === true) return true;
  if (v === false || v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') { const s = v.trim().toUpperCase(); if (s === 'TRUE' || s === 'VERDADERO') return true; if (s === 'FALSE' || s === 'FALSO') return false; const n = Number(v); return isNaN(n) ? true : n !== 0; }
  return !!v;
}
/** Elemento (i,j) de un valor, reciclando una matriz de 1 fila/columna; escalar → él mismo. */
function pick(x: any, i: number, j: number): any {
  if (!Array.isArray(x)) return x;
  const M = to2D(x); const r = M.length, c = M.reduce((m, row) => Math.max(m, row.length), 0);
  return M[r > 1 ? i : 0]?.[c > 1 ? j : 0];
}

/** IF(condición; [si_verdadero]; [si_falso]) — element-wise si la condición es matriz. */
function IF(params: any[]): any {
  const cond = params[0];
  if (!Array.isArray(cond)) return (formulajs as any).IF.apply(formulajs, params); // escalar: idéntico al motor
  const t = params.length > 1 ? params[1] : true;
  const f = params.length > 2 ? params[2] : false;
  const C = to2D(cond);
  const R = C.length, Cc = C.reduce((m, row) => Math.max(m, row.length), 0);
  const out: any[][] = [];
  for (let i = 0; i < R; i++) {
    const row: any[] = [];
    for (let j = 0; j < Cc; j++) row.push(truthy(C[i]?.[j]) ? pick(t, i, j) : pick(f, i, j));
    out.push(row);
  }
  return out;
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const ARRAY_IF_FUNCTIONS: Record<string, (params: any[]) => any> = { IF };
