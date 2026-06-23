/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * **Difusión (broadcasting) de operadores sobre matrices** — la mayor limitación del motor.
 *
 * El parser de Fortune-Sheet evalúa los operadores binarios (`+ - * / ^ > < >= <= = <> &`) elemento
 * a elemento sólo con escalares: `A1:A10>5` colapsaba a un escalar y `(rango>x)*1`,
 * `SUMPRODUCT((a>b)*c)` o `{1,2,3}+{10,20,30}` fallaban. Por eso `FILTER` necesitaba la máscara ya
 * evaluada (§«modernFunctions»). Aquí se **envuelve el despachador de operadores por instancia**
 * (`parser.parser.yy.evaluateByOperator`, fijado en el constructor) para que, si algún operando es
 * una matriz 2D, el operador se aplique elemento a elemento estilo Excel (escalar↔matriz se recicla;
 * columna n×1 ⊗ fila 1×m → matriz n×m). Devuelve una matriz 2D que compone con `SUM`/`SUMPRODUCT`/…
 * y derrama (§38).
 *
 * (El menos unario `-`/idioma `--(…)` queda fuera: la regla del gramático lo trata de forma especial
 * y no compone con matrices de forma fiable; usa el idioma equivalente `(…)*1`, que sí se difunde.)
 *
 * Corrige además un hueco de fidelidad: los operadores aritméticos de formulajs no convierten los
 * **lógicos** (`toNumber(true)` = `undefined` → `#VALUE!`), así que aquí `VERDADERO→1`, `FALSO→0`
 * para `+ - * / ^` (lo que hace que `(rango>x)*1` funcione). No toca el camino escalar salvo esa
 * coerción (que sólo puede arreglar, nunca romper, pues antes daba error).
 */

const ARITH = new Set(['+', '-', '*', '/', '^']);
/** VERDADERO/FALSO → 1/0 sólo para operadores aritméticos (Excel). */
function coerce(v: any, op: string): any { return typeof v === 'boolean' && ARITH.has(op) ? (v ? 1 : 0) : v; }

/** Cualquier valor → matriz 2D (escalar → `[[v]]`, vector 1D → columna). */
function to2D(x: any): any[][] {
  if (!Array.isArray(x)) return [[x]];
  if (x.length === 0) return [[]];
  return Array.isArray(x[0]) ? (x as any[][]) : (x as any[]).map((v) => [v]);
}
const maxCols = (a: any[][]): number => a.reduce((m, r) => Math.max(m, r.length), 0);

/**
 * Envuelve `yy.evaluateByOperator` (operadores binarios) de UNA instancia de parser para difundir
 * sobre matrices. Idempotente (marca `yy.__axosBroadcast`). Defensivo: si la API no está, no parchea.
 */
export function installBroadcast(yy: any): void {
  if (!yy || yy.__axosBroadcast) return;

  const origOp = yy.evaluateByOperator;
  if (typeof origOp === 'function') {
    yy.evaluateByOperator = function patchedOp(operator: any, params: any[]): any {
      const a = params?.[0], b = params?.[1];
      if (!Array.isArray(a) && !Array.isArray(b)) return origOp(operator, [coerce(a, operator), coerce(b, operator)]);
      const A = to2D(a), B = to2D(b);
      const ra = A.length, ca = maxCols(A), rb = B.length, cb = maxCols(B);
      const R = Math.max(ra, rb), C = Math.max(ca, cb);
      const out: any[][] = [];
      for (let i = 0; i < R; i++) {
        const row: any[] = [];
        for (let j = 0; j < C; j++) {
          const av = A[ra > 1 ? i : 0]?.[ca > 1 ? j : 0];
          const bv = B[rb > 1 ? i : 0]?.[cb > 1 ? j : 0];
          row.push(origOp(operator, [coerce(av, operator), coerce(bv, operator)]));
        }
        out.push(row);
      }
      return out;
    };
  }

  yy.__axosBroadcast = true;
}
