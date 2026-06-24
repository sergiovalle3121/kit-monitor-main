/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * **Difusión de funciones escalares sobre matrices** — la última pieza de las fórmulas matriciales.
 * La difusión de operadores (§69) habilitó `rango*2`/`rango>x`, y el `IF` matricial (§70) la
 * selección; pero las **funciones escalares** (`ROUND`, `ABS`, `TEXT`, `LEN`…) seguían sin aplicarse
 * elemento a elemento: `SUM(ROUND(rango*1.1; 0))` o `TEXT(rango; fmt)` daban `#VALUE!` porque reciben
 * la matriz entera. En Excel, una función escalar en contexto matricial se aplica a cada elemento.
 *
 * Aquí se **envuelve un conjunto curado de funciones escalares** (sólo unarias/diádicas elemento a
 * elemento — NUNCA agregados como `SUM`/`MAX` ni de matriz como `FILTER`/`SORT`): si algún argumento
 * es una matriz 2D, se aplica la función a cada celda (reciclando los escalares y, como los
 * operadores, columna n×1 ⊗ fila 1×m → matriz). Devuelve una matriz 2D que compone con `SUM`/… y
 * derrama (§38). **Riesgo cero**: con argumentos escalares se llama a la implementación original sin
 * cambios; sólo los argumentos-matriz (que antes fallaban) activan la difusión.
 */
import * as formulajs from '@formulajs/formulajs';

function to2D(x: any): any[][] { if (!Array.isArray(x)) return [[x]]; if (x.length === 0) return [[]]; return Array.isArray(x[0]) ? (x as any[][]) : (x as any[]).map((v) => [v]); }
const maxCols = (a: any[][]): number => a.reduce((m, r) => Math.max(m, r.length), 0);

/** Envuelve una implementación escalar `impl(params)` para difundir sobre matrices. */
function broadcast(impl: (p: any[]) => any): (p: any[]) => any {
  return (params: any[]) => {
    if (!params.some((x) => Array.isArray(x))) return impl(params);
    const arrs = params.map((x) => (Array.isArray(x) ? to2D(x) : null));
    let R = 1, C = 1;
    for (const a of arrs) if (a) { R = Math.max(R, a.length); C = Math.max(C, maxCols(a)); }
    const out: any[][] = [];
    for (let i = 0; i < R; i++) {
      const row: any[] = [];
      for (let j = 0; j < C; j++) {
        const sp = params.map((x, k) => { const a = arrs[k]; if (!a) return x; const r = a.length, c = maxCols(a); return a[r > 1 ? i : 0]?.[c > 1 ? j : 0]; });
        row.push(impl(sp));
      }
      out.push(row);
    }
    return out;
  };
}

/** Funciones escalares (elemento a elemento) que deben difundir sobre matrices. */
const SCALAR_NAMES = [
  // Matemáticas / redondeo
  'ROUND', 'ROUNDUP', 'ROUNDDOWN', 'MROUND', 'INT', 'TRUNC', 'ABS', 'SIGN', 'SQRT', 'MOD', 'POWER',
  'EXP', 'LN', 'LOG', 'LOG10', 'CEILING', 'FLOOR', 'EVEN', 'ODD', 'FACT', 'DEGREES', 'RADIANS',
  // Texto
  'TEXT', 'UPPER', 'LOWER', 'PROPER', 'TRIM', 'LEN', 'LEFT', 'RIGHT', 'MID', 'VALUE', 'CLEAN',
  'CHAR', 'CODE', 'UNICHAR', 'UNICODE', 'REPT', 'SUBSTITUTE',
];

/**
 * Aplica la difusión a las funciones escalares de `custom`, MUTÁNDOLO. Para los nombres no presentes
 * en `custom`, se crea un delegado a `formulajs` (que sólo se usará para argumentos-matriz; el
 * escalar sigue yendo por el fallback normal del motor cuando no es matriz, pero registrarlo aquí lo
 * intercepta — el delegado escalar es idéntico a formulajs, así que no cambia nada).
 */
export function applyScalarBroadcast(custom: Record<string, (p: any[]) => any>): void {
  for (const name of SCALAR_NAMES) {
    const existing = custom[name];
    const impl = existing ?? ((p: any[]) => { const f = (formulajs as any)[name]; return typeof f === 'function' ? f.apply(formulajs, p) : '#NAME?'; });
    custom[name] = broadcast(impl);
  }
}
