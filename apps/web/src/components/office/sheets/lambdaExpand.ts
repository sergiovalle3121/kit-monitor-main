/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Familia `LAMBDA` de Excel 365 — funciones anónimas y de orden superior:
 *   • `LAMBDA(p1; …; pn; cálculo)(a1; …; an)` — define e invoca una función anónima.
 *   • `MAP(matriz; …; LAMBDA(…))`            — aplica la lambda a cada elemento.
 *   • `REDUCE(inicial; matriz; LAMBDA(acc; v; …))` — pliega (fold) a un escalar.
 *   • `SCAN(inicial; matriz; LAMBDA(acc; v; …))`   — pliegue con acumulados (mismo tamaño).
 *   • `BYROW(matriz; LAMBDA(fila; …))` / `BYCOL(matriz; LAMBDA(col; …))` — agrega por fila/columna.
 *   • `MAKEARRAY(filas; cols; LAMBDA(i; j; …))`    — genera una matriz (índices 1-based).
 *
 * Igual que `LET` (§31) y las referencias estructuradas (§51), NO pueden ser funciones
 * registradas normales porque el parser evalúa cada argumento ANTES de llamar a la función: el
 * cuerpo `x*2` referencia un nombre `x` que aún no existe → `#NAME?`. Se resuelven en dos tiempos:
 *
 *  1) **Preprocesado de cadena** (`expandLambda`, en el parche de `parse`):
 *       – Invocación directa `LAMBDA(p…; cuerpo)(args…)` → sustitución en línea del cuerpo (queda
 *         una expresión normal que el MISMO parser evalúa; los refs externos siguen vivos).
 *       – `LAMBDA(…)` pasada como ARGUMENTO a una función de orden superior → se codifica como un
 *         literal de texto seguro (`"§LMB§<encodeURIComponent(JSON)>"`, sin comillas internas) que
 *         el parser sí sabe pasar como parámetro.
 *  2) **Funciones de orden superior** (`LAMBDA_FUNCTIONS`): reciben la matriz ya evaluada y la
 *     lambda codificada; decodifican el cuerpo y lo evalúan con un **sub-parser** sobre una rejilla
 *     sintética (cada parámetro se enlaza a una celda/rango `A1`, `A2`, `A1:C1`…). Así el cuerpo
 *     puede usar el parámetro como escalar (`x*2`) o como vector (`SUM(fila)`) con total fidelidad.
 *
 * Límite documentado: el cuerpo de una orden-superior sólo ve sus parámetros (no refs externos a
 * la hoja; pásalos como argumentos). La invocación directa SÍ conserva los refs externos.
 */
import { Parser } from '@fortune-sheet/formula-parser';
import { to2D } from './modernFunctions';

const LMB = '§LMB§';
const ID = /[A-Za-z0-9_.$!]/;
const isId = (c: string | undefined): boolean => c != null && ID.test(c);

function colName(c: number): string { let s = ''; c += 1; while (c > 0) { const r = (c - 1) % 26; s = String.fromCharCode(65 + r) + s; c = Math.floor((c - 1) / 26); } return s; }

/** Divide por comas/puntoycoma de NIVEL SUPERIOR (respeta paréntesis, corchetes y comillas). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0, inStr = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { cur += ch; if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else inStr = false; } continue; }
    if (ch === '"') { inStr = true; cur += ch; continue; }
    if (ch === '(' || ch === '[') { depth++; cur += ch; continue; }
    if (ch === ')' || ch === ']') { depth--; cur += ch; continue; }
    if (depth === 0 && (ch === ',' || ch === ';')) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.length || out.length) out.push(cur);
  return out.map((x) => x.trim());
}

/** Desde el índice de un `(` devuelve el índice JUSTO TRAS el `)` que lo cierra (o -1). */
function afterBalanced(s: string, open: number): number {
  let depth = 0, inStr = false;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (c === '"') { if (s[i + 1] === '"') i++; else inStr = false; } continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i + 1; }
  }
  return -1;
}

/** Sustituye el identificador COMPLETO `name` por `repl` fuera de comillas (no parte de otro id). */
function substituteName(expr: string, name: string, repl: string): string {
  if (!name) return expr;
  let out = '', i = 0, inStr = false;
  while (i < expr.length) {
    const ch = expr[i];
    if (inStr) { out += ch; if (ch === '"') { if (expr[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; } i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    if (expr.startsWith(name, i) && !isId(expr[i - 1]) && !isId(expr[i + name.length])) {
      out += repl; i += name.length; continue;
    }
    out += ch; i++;
  }
  return out;
}

/** Codifica una lambda (parámetros + cuerpo) como literal de texto seguro para el parser. */
function encodeLambda(params: string[], body: string): string {
  return '"' + LMB + encodeURIComponent(JSON.stringify([params, body])) + '"';
}
/** Decodifica el valor de una lambda (ya evaluado por el parser) → {names, body} o null. */
export function decodeLambda(v: any): { names: string[]; body: string } | null {
  if (typeof v !== 'string' || v.slice(0, LMB.length) !== LMB) return null;
  try { const arr = JSON.parse(decodeURIComponent(v.slice(LMB.length))); return { names: arr[0] || [], body: String(arr[1] ?? '') }; }
  catch { return null; }
}

/** Una pasada: resuelve invocaciones directas y codifica lambdas-argumento (de izquierda a derecha). */
function expandLambdaOnce(formula: string): string {
  let out = '', i = 0, inStr = false;
  while (i < formula.length) {
    const ch = formula[i];
    if (inStr) { out += ch; if (ch === '"') { if (formula[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; } i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    const m = /^LAMBDA\s*\(/i.exec(formula.slice(i));
    const prev = out[out.length - 1];
    if (m && !isId(prev)) {
      const open = i + m[0].length - 1;     // índice del «(» de LAMBDA
      const close = afterBalanced(formula, open); // justo tras el «)»
      if (close > 0) {
        const parts = splitTopLevel(formula.slice(open + 1, close - 1));
        const params = parts.slice(0, -1);
        const body = parts[parts.length - 1] ?? '';
        // ¿Invocación directa? → «)(» (admite espacios).
        let k = close; while (k < formula.length && /\s/.test(formula[k])) k++;
        if (formula[k] === '(') {
          const callClose = afterBalanced(formula, k);
          if (callClose > 0) {
            const callArgs = splitTopLevel(formula.slice(k + 1, callClose - 1));
            let b = body;
            params.forEach((pn, idx) => {
              const a = (callArgs[idx] ?? '').trim();
              const repl = /^[\w$.!':]+$/.test(a) || a === '' ? (a || '0') : `(${a})`;
              b = substituteName(b, pn.trim(), repl);
            });
            out += `(${b})`; i = callClose; continue;
          }
        }
        // Lambda pasada como argumento → se codifica.
        out += encodeLambda(params.map((p) => p.trim()), body); i = close; continue;
      }
    }
    out += ch; i++;
  }
  return out;
}

/**
 * Expande la familia LAMBDA de una expresión (resuelve invocaciones directas, codifica lambdas
 * que viajan como argumento). Itera hasta estabilizar para soportar anidamiento. Ruta rápida si
 * no hay `LAMBDA(`.
 */
export function expandLambda(formula: string): string {
  if (typeof formula !== 'string' || !/lambda\s*\(/i.test(formula)) return formula;
  let prev = formula;
  for (let pass = 0; pass < 16; pass++) {
    const next = expandLambdaOnce(prev);
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

// ── Evaluación de cuerpos con sub-parser sobre rejilla sintética ───────────────

interface Binding { name: string; cells: any[] }

/** Evalúa `body` enlazando cada parámetro a una fila de una rejilla sintética (escalar o vector). */
function subEval(body: string, bindings: Binding[]): any {
  const grid: Record<string, any> = {};
  let b = body;
  bindings.forEach((bd, row) => {
    const cells = bd.cells.length ? bd.cells : [null];
    cells.forEach((val, col) => { grid[`${row}_${col}`] = val; });
    const ref = cells.length <= 1 ? `A${row + 1}` : `A${row + 1}:${colName(cells.length - 1)}${row + 1}`;
    b = substituteName(b, bd.name, ref);
  });
  const P: any = Parser as any;
  const sp = new P();
  sp.on('callCellValue', (c: any, _o: any, done: any) => done(grid[`${c.row.index}_${c.column.index}`] ?? 0));
  sp.on('callRangeValue', (s: any, e: any, _o: any, done: any) => {
    const o: any[][] = [];
    for (let r = s.row.index; r <= e.row.index; r++) { const rr: any[] = []; for (let cc = s.column.index; cc <= e.column.index; cc++) rr.push(grid[`${r}_${cc}`] ?? null); o.push(rr); }
    done(o);
  });
  const r = sp.parse(b);
  if (r.error) return r.error;
  // El cuerpo de una orden-superior debe dar un escalar; si da matriz, tomamos su esquina.
  const res = r.result;
  return Array.isArray(res) ? (Array.isArray(res[0]) ? res[0][0] : res[0]) ?? null : res;
}

/** MAP(matriz1; …; LAMBDA(p1; …; pk; cuerpo)) — aplica la lambda elemento a elemento. */
function MAP(params: any[]): any {
  const lam = decodeLambda(params[params.length - 1]);
  if (!lam) return '#VALUE!';
  const arrays = params.slice(0, -1).map(to2D);
  const a0 = arrays[0] ?? [[null]];
  const out: any[][] = [];
  for (let i = 0; i < a0.length; i++) {
    const row: any[] = [];
    for (let j = 0; j < (a0[i]?.length ?? 0); j++) {
      const bindings = lam.names.map((nm, k) => ({ name: nm, cells: [arrays[k]?.[i]?.[j] ?? null] }));
      row.push(subEval(lam.body, bindings));
    }
    out.push(row);
  }
  return out;
}

/** REDUCE(inicial; matriz; LAMBDA(acc; v; cuerpo)) — pliega a un único valor. */
function REDUCE(params: any[]): any {
  const lam = decodeLambda(params[params.length - 1]);
  if (!lam) return '#VALUE!';
  const init = params[0];
  const arr = to2D(params[1]);
  let acc = init;
  for (const r of arr) for (const v of r) acc = subEval(lam.body, [{ name: lam.names[0], cells: [acc] }, { name: lam.names[1], cells: [v] }]);
  return acc;
}

/** SCAN(inicial; matriz; LAMBDA(acc; v; cuerpo)) — como REDUCE pero devuelve los acumulados. */
function SCAN(params: any[]): any {
  const lam = decodeLambda(params[params.length - 1]);
  if (!lam) return '#VALUE!';
  const arr = to2D(params[1]);
  let acc = params[0];
  const out: any[][] = [];
  for (const r of arr) { const row: any[] = []; for (const v of r) { acc = subEval(lam.body, [{ name: lam.names[0], cells: [acc] }, { name: lam.names[1], cells: [v] }]); row.push(acc); } out.push(row); }
  return out;
}

/** BYROW(matriz; LAMBDA(fila; cuerpo)) — un resultado por fila (vector columna). */
function BYROW(params: any[]): any {
  const lam = decodeLambda(params[params.length - 1]);
  if (!lam) return '#VALUE!';
  return to2D(params[0]).map((row) => [subEval(lam.body, [{ name: lam.names[0], cells: row }])]);
}

/** BYCOL(matriz; LAMBDA(col; cuerpo)) — un resultado por columna (vector fila). */
function BYCOL(params: any[]): any {
  const lam = decodeLambda(params[params.length - 1]);
  if (!lam) return '#VALUE!';
  const a = to2D(params[0]);
  const cols = a.reduce((m, r) => Math.max(m, r.length), 0);
  const row: any[] = [];
  for (let j = 0; j < cols; j++) { const col = a.map((r) => r[j] ?? null); row.push(subEval(lam.body, [{ name: lam.names[0], cells: col }])); }
  return [row];
}

/** MAKEARRAY(filas; cols; LAMBDA(i; j; cuerpo)) — genera una matriz (índices 1-based). */
function MAKEARRAY(params: any[]): any {
  const lam = decodeLambda(params[params.length - 1]);
  if (!lam) return '#VALUE!';
  const rows = Math.max(0, Math.trunc(Number(params[0]) || 0));
  const cols = Math.max(0, Math.trunc(Number(params[1]) || 0));
  const out: any[][] = [];
  for (let i = 1; i <= rows; i++) { const row: any[] = []; for (let j = 1; j <= cols; j++) row.push(subEval(lam.body, [{ name: lam.names[0], cells: [i] }, { name: lam.names[1], cells: [j] }])); out.push(row); }
  return out;
}

/** Registro de funciones de orden superior (se fusiona en CUSTOM_FUNCTIONS). */
export const LAMBDA_FUNCTIONS: Record<string, (params: any[]) => any> = {
  MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY,
};
