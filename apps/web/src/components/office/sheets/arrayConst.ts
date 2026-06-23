/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Constantes de matriz de Excel — `{1,2,3}` (fila), `{1;2;3}` (columna), `{1,2;3,4}` (2×2).
 *
 * El parser de Fortune-Sheet no entiende las llaves: `=SUM({1,2,3})` revienta con `#ERROR!`
 * ANTES de evaluar. Como en Excel una constante de matriz SÓLO contiene **constantes** (números,
 * texto, lógicos — nunca refs ni fórmulas), podemos resolverlas por **preprocesado de cadena**
 * (igual técnica que `LET` §31): se parsean las llaves a una matriz 2D de valores y se sustituyen
 * por una llamada `ARRCONST("§ARR§<codificado>")` —una función registrada que devuelve esa matriz
 * 2D—. Así componen con `SUM`, `LARGE`, `MATCH`, `CHOOSE`, `INDEX`, etc., y derraman con el
 * «spilling» (§38). Separadores estilo EN: `,` columnas, `;` filas.
 */

const ARR = '§ARR§';

/** Convierte un elemento textual de la constante (`5`, `-2.5`, `"hola"`, `TRUE`) a su valor JS. */
function parseElem(tok: string): any {
  const s = tok.trim();
  if (s === '') return '';
  if (/^"(?:[^"]|"")*"$/.test(s)) return s.slice(1, -1).replace(/""/g, '"'); // texto entre comillas
  const up = s.toUpperCase();
  if (up === 'TRUE' || up === 'VERDADERO') return true;
  if (up === 'FALSE' || up === 'FALSO') return false;
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  return s; // texto sin comillas → literal (tolerante)
}

/** Parsea el interior de unas llaves (`1,2;3,4`) a una matriz 2D rectangular de valores. */
function parseArrayBody(body: string): any[][] {
  const rows = body.split(';');
  const grid = rows.map((r) => r.split(',').map(parseElem));
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  return grid.map((r) => (r.length === cols ? r : [...r, ...Array(cols - r.length).fill('')]));
}

/** Codifica una matriz 2D como literal de texto seguro para el parser (`"§ARR§…"`, sin comillas). */
function encode(grid: any[][]): string {
  return '"' + ARR + encodeURIComponent(JSON.stringify(grid)) + '"';
}

/** Decodifica el valor (ya evaluado) de `ARRCONST` → matriz 2D, o null si no procede. */
export function decodeArrayConst(v: any): any[][] | null {
  if (typeof v !== 'string' || v.slice(0, ARR.length) !== ARR) return null;
  try { const g = JSON.parse(decodeURIComponent(v.slice(ARR.length))); return Array.isArray(g) ? g : null; }
  catch { return null; }
}

/**
 * Sustituye toda constante de matriz `{…}` (fuera de comillas) por `ARRCONST("§ARR§…")`.
 * Ruta rápida si no hay `{`. No anida (Excel tampoco permite matrices anidadas).
 */
export function expandArrayConst(formula: string): string {
  if (typeof formula !== 'string' || formula.indexOf('{') < 0) return formula;
  let out = '', i = 0, inStr = false;
  while (i < formula.length) {
    const ch = formula[i];
    if (inStr) { out += ch; if (ch === '"') { if (formula[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; } i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    if (ch === '{') {
      // Busca el «}» de cierre respetando literales de texto internos.
      let j = i + 1, str = false; let found = -1;
      for (; j < formula.length; j++) { const c = formula[j]; if (str) { if (c === '"') { if (formula[j + 1] === '"') j++; else str = false; } continue; } if (c === '"') { str = true; continue; } if (c === '}') { found = j; break; } if (c === '{') break; /* anidado → aborta */ }
      if (found > 0) { out += 'ARRCONST(' + encode(parseArrayBody(formula.slice(i + 1, found))) + ')'; i = found + 1; continue; }
    }
    out += ch; i++;
  }
  return out;
}

/** ARRCONST("§ARR§…") → matriz 2D decodificada (registrada en CUSTOM_FUNCTIONS). */
function ARRCONST(params: any[]): any {
  const g = decodeArrayConst(params[0]);
  return g ?? '#VALUE!';
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const ARRAY_CONST_FUNCTIONS: Record<string, (params: any[]) => any> = { ARRCONST };
