/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Funciones **matriciales** de Excel (`MMULT`, `MINVERSE`, `MDETERM`, `MUNIT`) — ausentes en
 * `@formulajs/formulajs@2.9.3` (`#NAME?`) — más dos huecos sueltos detectados auditando el motor:
 * `SERIESSUM` (rota, `#VALUE!`) y `ERROR.TYPE` (nombre con punto → `#NAME?`).
 *
 * Como el resto de funciones de matriz dinámica (§«modernFunctions»), `MMULT`/`MINVERSE`/`MUNIT`
 * DEVUELVEN matrices 2D que componen con `INDEX`/`SUM` y derraman con el «spilling» (§38). El
 * parser evalúa los rangos a matrices 2D antes de llamar, así que son funciones personalizadas
 * puras (sin acceso a la hoja). Álgebra con eliminación gaussiana y pivoteo parcial.
 */
import { flatten, toNum, errorCode } from './formulaEngine';
import { to2D } from './modernFunctions';

/** Argumento → matriz numérica rectangular, o null si hay algún valor no numérico/forma irregular. */
function numMatrix(arg: any): number[][] | null {
  const raw = to2D(arg);
  const cols = raw[0]?.length ?? 0;
  const out: number[][] = [];
  for (const row of raw) {
    if (row.length !== cols) return null;
    const r: number[] = [];
    for (const v of row) { const n = toNum(v); if (n === null) return null; r.push(n); }
    out.push(r);
  }
  return out.length ? out : null;
}

/** MMULT(a; b) — producto matricial (columnas de A = filas de B). */
function MMULT(params: any[]): any {
  const A = numMatrix(params[0]); const B = numMatrix(params[1]);
  if (!A || !B) return '#VALUE!';
  const ra = A.length, ca = A[0].length, rb = B.length, cb = B[0].length;
  if (ca !== rb) return '#VALUE!';
  const out: number[][] = [];
  for (let i = 0; i < ra; i++) {
    const row: number[] = [];
    for (let j = 0; j < cb; j++) { let s = 0; for (let k = 0; k < ca; k++) s += A[i][k] * B[k][j]; row.push(s); }
    out.push(row);
  }
  return out;
}

/** MUNIT(n) — matriz identidad n×n. */
function MUNIT(params: any[]): any {
  const n = Math.trunc(toNum(params[0]) ?? 0);
  if (n < 1) return '#VALUE!';
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

/** Determinante por eliminación gaussiana con pivoteo parcial; null si no es cuadrada. */
function determinant(M: number[][]): number | null {
  const n = M.length;
  if (M.some((r) => r.length !== n)) return null;
  const a = M.map((r) => r.slice());
  let det = 1;
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-14) return 0;
    if (p !== i) { const t = a[i]; a[i] = a[p]; a[p] = t; det = -det; }
    det *= a[i][i];
    for (let r = i + 1; r < n; r++) { const f = a[r][i] / a[i][i]; for (let c = i; c < n; c++) a[r][c] -= f * a[i][c]; }
  }
  return det;
}

/** MDETERM(a) — determinante de una matriz cuadrada. */
function MDETERM(params: any[]): any {
  const A = numMatrix(params[0]);
  if (!A) return '#VALUE!';
  const d = determinant(A);
  return d === null ? '#VALUE!' : d;
}

/** MINVERSE(a) — matriz inversa por Gauss-Jordan; #NUM! si es singular. */
function MINVERSE(params: any[]): any {
  const A = numMatrix(params[0]);
  if (!A) return '#VALUE!';
  const n = A.length;
  if (A.some((r) => r.length !== n)) return '#VALUE!';
  const a = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r;
    if (Math.abs(a[p][i]) < 1e-14) return '#NUM!'; // singular
    const t = a[i]; a[i] = a[p]; a[p] = t;
    const piv = a[i][i];
    for (let c = 0; c < 2 * n; c++) a[i][c] /= piv;
    for (let r = 0; r < n; r++) { if (r === i) continue; const f = a[r][i]; for (let c = 0; c < 2 * n; c++) a[r][c] -= f * a[i][c]; }
  }
  return a.map((r) => r.slice(n));
}

/** SERIESSUM(x; n; m; coeficientes) — Σ coef_i · x^(n + i·m). */
function SERIESSUM(params: any[]): any {
  const x = toNum(params[0]); const n = toNum(params[1]); const m = toNum(params[2]);
  if (x === null || n === null || m === null) return '#VALUE!';
  const coeffs = flatten(params[3]).map(toNum).filter((c): c is number => c !== null);
  return coeffs.reduce((acc, c, i) => acc + c * Math.pow(x, n + i * m), 0);
}

const ERR_NUM: Record<string, number> = { '#NULL!': 1, '#DIV/0!': 2, '#VALUE!': 3, '#REF!': 4, '#NAME?': 5, '#NUM!': 6, '#N/A': 7 };
/** ERROR.TYPE(valor) — número del tipo de error (1–7), o #N/A si el valor no es un error. */
function ERROR_TYPE(params: any[]): any {
  const code = errorCode(params[0]);
  if (code === null) return '#N/A';
  return ERR_NUM[code] ?? '#N/A';
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const MATRIX_FUNCTIONS: Record<string, (params: any[]) => any> = {
  MMULT, MUNIT, MDETERM, MINVERSE, SERIESSUM, 'ERROR.TYPE': ERROR_TYPE,
};
