/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Robustez del motor de fórmulas de la hoja de cálculo.
 *
 * La rejilla (`@fortune-sheet/react` → `@fortune-sheet/core`) evalúa cada celda con
 * `@fortune-sheet/formula-parser` (v0.2.13), que delega las funciones con nombre en
 * `@formulajs/formulajs` (v2.9.3). Auditando el motor REAL (ver `formulaEngine.spec.ts`)
 * encontramos dos huecos de fidelidad que rompen el «feeling Excel»:
 *
 *  1) **Literales booleanos.** El parser NO tokeniza `TRUE`/`FALSE` sueltos: `=VLOOKUP(x,
 *     rango,2,FALSE)`, `=IF(TRUE,1,2)`, `=AND(TRUE,FALSE)`, `=NOT(FALSE)` fallan con
 *     `#NAME?` ANTES de llamar a la función (sólo funcionan `TRUE()`/`FALSE()`). La
 *     coincidencia exacta de BUSCARV con `FALSE` es el patrón de búsqueda más común en EMS.
 *  2) **Funciones ausentes/rotas.** `@formulajs/formulajs` 2.9.3 no trae `XLOOKUP`,
 *     `TEXTJOIN`, `MAXIFS`, `MINIFS`, y su `TEXT(valor, formato)` lanza error para casi
 *     cualquier código de formato.
 *
 * NO reinventamos el motor ni cambiamos de librería (Fortune-Sheet sigue algo estancado
 * —v1.0.4, ver DECISIONS §«Office/Sheets»— pero no pelea con la fidelidad). En su lugar
 * REGISTRAMOS funciones personalizadas y normalizamos los booleanos parcheando UNA sola vez
 * el prototipo del `Parser` COMPARTIDO (la rejilla importa exactamente la misma clase, copia
 * única en node_modules), usando los puntos de extensión propios de la librería:
 *
 *   • `Parser.prototype.parse`  → preprocesa la cadena: `TRUE`/`FALSE` → `TRUE()`/`FALSE()`
 *     FUERA de literales de texto (de modo que toda fórmula —tecleada, cargada o importada de
 *     .xlsx— se beneficia, sin tocar el lexer).
 *   • `Parser.prototype.getFunction` → resuelve nuestras funciones (mayúsc./minúsc.) ANTES
 *     del built-in roto; si no es nuestra, devuelve `undefined` y el motor sigue su curso
 *     normal (`_callFunction` → `evaluateByOperator` → formulajs). Es el mismo mecanismo que
 *     `setFunction`, aplicado a todas las instancias.
 *
 * El parche es idempotente y defensivo (si la API cambia, no rompe; sólo no parchea).
 */
import { Parser } from '@fortune-sheet/formula-parser';
import { formatNumber } from '@/lib/office/sheetOps';
import { MODERN_FUNCTIONS } from './modernFunctions';
import { expandLet } from './letExpand';
import { expandStructuredRefs } from './tableRefs';
import { expandLambda, LAMBDA_FUNCTIONS } from './lambdaExpand';
import { expandArrayConst, ARRAY_CONST_FUNCTIONS } from './arrayConst';
import { SCALAR_FUNCTIONS, aliasScalarFns } from './scalarFunctions';
import { STAT_FUNCTIONS } from './statFunctions';
import { DB_FUNCTIONS } from './dbFunctions';
import { MATRIX_FUNCTIONS } from './matrixFunctions';
import { MATH_EXTRA_FUNCTIONS } from './mathExtras';
import { DATE_INTL_FUNCTIONS } from './dateIntl';

// ── Utilidades de coerción / aplanado de argumentos ──────────────────────────
// Las funciones reciben `params`: un array donde cada argumento ya viene evaluado.
// Un rango llega como matriz 2D (filas × columnas); un escalar, como valor suelto.

/** Aplana cualquier argumento (matriz 2D de rango o escalar) a un array 1D. */
export function flatten(arg: any): any[] {
  if (Array.isArray(arg)) {
    const out: any[] = [];
    for (const x of arg) { if (Array.isArray(x)) out.push(...flatten(x)); else out.push(x); }
    return out;
  }
  return [arg];
}

/** Convierte a número si es posible (número directo o string numérico); si no, null. */
export function toNum(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
}

// Comodines de Excel en criterios de texto: `*` (cualquier nº de caracteres), `?` (uno),
// `~` escapa al siguiente comodín. Coincidencia sin distinguir mayúsculas/minúsculas.
function wildcardToRegex(pat: string): RegExp {
  let out = '^';
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === '~') { const n = pat[i + 1]; if (n === '*' || n === '?' || n === '~') { out += n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; continue; } }
    if (c === '*') { out += '.*'; continue; }
    if (c === '?') { out += '.'; continue; }
    out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(out + '$', 'i');
}

/**
 * ¿`value` cumple el `criterion` estilo Excel? Acepta operadores (`>`, `>=`, `<`, `<=`,
 * `<>`, `=`), comparación numérica cuando ambos lados son números y comodines en texto.
 */
export function matchesCriterion(value: any, criterion: any): boolean {
  if (criterion === null || criterion === undefined) return value === null || value === undefined || value === '';
  if (typeof criterion === 'number') { const n = toNum(value); return n !== null && n === criterion; }
  const s = String(criterion).trim();
  const m = /^(<=|>=|<>|=|<|>)/.exec(s);
  const op = m ? m[1] : '=';
  const operand = m ? s.slice(op.length).trim() : s;
  const opNum = toNum(operand);
  const valNum = toNum(value);
  if (opNum !== null && valNum !== null) {
    switch (op) {
      case '=': return valNum === opNum;
      case '<>': return valNum !== opNum;
      case '>': return valNum > opNum;
      case '>=': return valNum >= opNum;
      case '<': return valNum < opNum;
      case '<=': return valNum <= opNum;
    }
  }
  const a = value === null || value === undefined ? '' : String(value);
  if (op === '=' || op === '<>') {
    const hit = wildcardToRegex(operand).test(a);
    return op === '=' ? hit : !hit;
  }
  const cmp = a.localeCompare(operand);
  switch (op) {
    case '>': return cmp > 0;
    case '>=': return cmp >= 0;
    case '<': return cmp < 0;
    case '<=': return cmp <= 0;
  }
  return false;
}

// ── Implementaciones de las funciones que faltan / están rotas ────────────────

/** Igualdad estilo búsqueda: texto sin distinguir mayúsculas; números por valor. */
function lookupEq(a: any, key: any): boolean {
  if (typeof key === 'string' && typeof a === 'string') return a.toLowerCase() === key.toLowerCase();
  const ka = toNum(a); const kk = toNum(key);
  if (ka !== null && kk !== null) return ka === kk;
  return a === key;
}

/**
 * XLOOKUP(buscado, matriz_buscada, matriz_devuelta, [si_no_encontrado], [modo_coincidencia]).
 * Modo 0 = exacto (por defecto); -1 = exacto o inferior más próximo; 1 = exacto o superior
 * más próximo (numérico). Sin coincidencia → `si_no_encontrado` o `#N/A`.
 */
export function XLOOKUP(params: any[]): any {
  const [key, lookupArr, returnArr, ifNotFound, matchMode] = params;
  const L = flatten(lookupArr);
  const R = flatten(returnArr);
  let idx = L.findIndex((v) => lookupEq(v, key));
  const mode = toNum(matchMode) ?? 0;
  if (idx < 0 && (mode === -1 || mode === 1)) {
    const keyNum = toNum(key);
    let best = -1; let bestDelta = Infinity;
    if (keyNum !== null) {
      for (let i = 0; i < L.length; i++) {
        const n = toNum(L[i]); if (n === null) continue;
        if (mode === -1 && n <= keyNum && keyNum - n < bestDelta) { bestDelta = keyNum - n; best = i; }
        if (mode === 1 && n >= keyNum && n - keyNum < bestDelta) { bestDelta = n - keyNum; best = i; }
      }
    }
    idx = best;
  }
  if (idx < 0) return ifNotFound !== undefined ? ifNotFound : '#N/A';
  return R[idx] ?? '';
}

/**
 * XMATCH(buscado, matriz_buscada, [modo_coincidencia]) → posición 1-based o `#N/A`.
 */
export function XMATCH(params: any[]): any {
  const [key, lookupArr, matchMode] = params;
  const L = flatten(lookupArr);
  let idx = L.findIndex((v) => lookupEq(v, key));
  const mode = toNum(matchMode) ?? 0;
  if (idx < 0 && (mode === -1 || mode === 1)) {
    const keyNum = toNum(key);
    let best = -1; let bestDelta = Infinity;
    if (keyNum !== null) {
      for (let i = 0; i < L.length; i++) {
        const n = toNum(L[i]); if (n === null) continue;
        if (mode === -1 && n <= keyNum && keyNum - n < bestDelta) { bestDelta = keyNum - n; best = i; }
        if (mode === 1 && n >= keyNum && n - keyNum < bestDelta) { bestDelta = n - keyNum; best = i; }
      }
    }
    idx = best;
  }
  return idx < 0 ? '#N/A' : idx + 1;
}

/** TEXTJOIN(delimitador, ignorar_vacíos, texto1, …) — une texto aplanando rangos. */
export function TEXTJOIN(params: any[]): any {
  const delim = params[0];
  const ignore = params[1];
  const d = delim === null || delim === undefined ? '' : String(delim);
  const ig = ignore === true || ignore === 1 || (typeof ignore === 'string' && ignore.toUpperCase() === 'TRUE');
  const vals: any[] = [];
  for (const a of params.slice(2)) vals.push(...flatten(a));
  return vals
    .filter((v) => (ig ? !(v === null || v === undefined || v === '') : true))
    .map((v) => (v === null || v === undefined ? '' : String(v)))
    .join(d);
}

// Índices del rango de valores que cumplen TODOS los pares (rango_criterio, criterio).
function ifsKeepIndices(params: any[], valueLen: number): number[] {
  let keep = Array.from({ length: valueLen }, (_, i) => i);
  for (let p = 1; p + 1 < params.length; p += 2) {
    const cr = flatten(params[p]);
    const crit = params[p + 1];
    keep = keep.filter((i) => matchesCriterion(cr[i], crit));
  }
  return keep;
}

/** MAXIFS(rango_máx, rango_crit1, crit1, …) — máximo condicional (0 si nada coincide). */
export function MAXIFS(params: any[]): any {
  const M = flatten(params[0]);
  const nums = ifsKeepIndices(params, M.length).map((i) => toNum(M[i])).filter((x): x is number => x !== null);
  return nums.length ? Math.max(...nums) : 0;
}

/** MINIFS(rango_mín, rango_crit1, crit1, …) — mínimo condicional (0 si nada coincide). */
export function MINIFS(params: any[]): any {
  const M = flatten(params[0]);
  const nums = ifsKeepIndices(params, M.length).map((i) => toNum(M[i])).filter((x): x is number => x !== null);
  return nums.length ? Math.min(...nums) : 0;
}

/**
 * TEXT(valor, formato) — formatea con el motor de números/fechas estilo Excel ya probado
 * (`formatNumber`), sustituyendo al built-in de formulajs 2.9.3 que lanza error.
 */
export function TEXT(params: any[]): any {
  const [value, fmt] = params;
  if (fmt === null || fmt === undefined) return value === null || value === undefined ? '' : String(value);
  try { return formatNumber(value, String(fmt)); }
  catch { return value === null || value === undefined ? '' : String(value); }
}

// ── Detección de errores estilo Excel ─────────────────────────────────────────
// El motor mezcla DOS representaciones de error: formulajs devuelve OBJETOS `Error`
// (`.message` = '#NUM!', '#N/A'…) mientras que los OPERADORES aritméticos del parser
// (`/`, `+`…) devuelven CADENAS sueltas ('DIV/0', 'VALUE'…). Por eso `IFERROR(A1/0,0)`
// —patrón EMS habitual (tasas, rendimientos)— NO lo atrapaba el `IFERROR` de formulajs:
// no reconoce la cadena 'DIV/0'. Aquí unificamos ambos para que SI.ERROR/SI.ND/ESERROR…
// se comporten como en Excel, con coincidencia EXACTA contra el conjunto de códigos para
// no confundir texto legítimo (p. ej. la celda con el texto "VALUE").
// Mapea las cadenas crudas del parser a la forma de visualización de Excel.
const PARSER_ERR: Record<string, string> = {
  'DIV/0': '#DIV/0!', VALUE: '#VALUE!', REF: '#REF!', NAME: '#NAME?',
  NUM: '#NUM!', NULL: '#NULL!', ERROR: '#ERROR!', 'N/A': '#N/A',
};
const EXCEL_ERR = new Set(['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A', '#ERROR!']);

/** Devuelve el código de error Excel de un valor, o null si no es un error. */
export function errorCode(v: any): string | null {
  if (v instanceof Error) return v.message || '#ERROR!';
  if (typeof v === 'string') { if (EXCEL_ERR.has(v)) return v; if (v in PARSER_ERR) return PARSER_ERR[v]; }
  return null;
}
export function isErrorValue(v: any): boolean { return errorCode(v) !== null; }
export function isNAValue(v: any): boolean { return (v instanceof Error && v.message === '#N/A') || v === '#N/A' || v === 'N/A'; }

/** IFERROR(valor, alternativo) — atrapa CUALQUIER error (objeto formulajs o cadena del parser). */
export function IFERROR(params: any[]): any { return isErrorValue(params[0]) ? params[1] : params[0]; }
/** IFNA(valor, alternativo) — atrapa sólo #N/A. */
export function IFNA(params: any[]): any { return isNAValue(params[0]) ? params[1] : params[0]; }
/** ISERROR(valor) — ¿es cualquier error? */
export function ISERROR(params: any[]): any { return isErrorValue(params[0]); }
/** ISERR(valor) — ¿es error distinto de #N/A? */
export function ISERR(params: any[]): any { return isErrorValue(params[0]) && !isNAValue(params[0]); }
/** ISNA(valor) — ¿es #N/A? */
export function ISNA(params: any[]): any { return isNAValue(params[0]); }

/** Registro de funciones personalizadas (clave en MAYÚSCULAS). */
export const CUSTOM_FUNCTIONS: Record<string, (params: any[]) => any> = {
  XLOOKUP, XMATCH, TEXTJOIN, MAXIFS, MINIFS, TEXT,
  IFERROR, IFNA, ISERROR, ISERR, ISNA,
  // Funciones modernas de Excel 365 (matrices dinámicas + texto) — ver `modernFunctions.ts`.
  ...MODERN_FUNCTIONS,
  // Familia LAMBDA (orden superior: MAP/REDUCE/SCAN/BYROW/BYCOL/MAKEARRAY) — ver `lambdaExpand.ts`.
  ...LAMBDA_FUNCTIONS,
  // Constantes de matriz `{1,2,3}` → ARRCONST(...) — ver `arrayConst.ts`.
  ...ARRAY_CONST_FUNCTIONS,
  // Escalares ausentes/rotas en formulajs (ADDRESS/DOLLAR/FIXED/T/N/BASE/DECIMAL/TIMEVALUE).
  ...SCALAR_FUNCTIONS,
  // Estadísticas con nombre moderno (punto) + correcciones de fidelidad — ver `statFunctions.ts`.
  ...STAT_FUNCTIONS,
  // Funciones de base de datos (DSUM/DCOUNT/DGET…) — ver `dbFunctions.ts`.
  ...DB_FUNCTIONS,
  // Matriciales (MMULT/MINVERSE/MDETERM/MUNIT) + SERIESSUM + ERROR.TYPE — ver `matrixFunctions.ts`.
  ...MATRIX_FUNCTIONS,
  // Redondeo moderno (CEILING.MATH/FLOOR.MATH/…) + RANDARRAY + ENCODEURL — ver `mathExtras.ts`.
  ...MATH_EXTRA_FUNCTIONS,
  // Fechas internacionales (WORKDAY.INTL/NETWORKDAYS.INTL) — ver `dateIntl.ts`.
  ...DATE_INTL_FUNCTIONS,
};

// ── Normalización de literales booleanos en la cadena de fórmula ──────────────

/**
 * Reescribe `TRUE`/`FALSE` sueltos a `TRUE()`/`FALSE()` (forma que el parser SÍ entiende),
 * pero sólo FUERA de literales de texto entrecomillados y sin tocar identificadores que los
 * contengan (p. ej. un nombre `TRUEVALUE` o `"texto TRUE"`). Idempotente con `TRUE(`/`FALSE(`.
 */
export function normalizeFormula(expr: string): string {
  if (typeof expr !== 'string' || !/[tTfF]/.test(expr)) return expr;
  let out = '';
  let i = 0;
  let inStr = false;
  while (i < expr.length) {
    const ch = expr[i];
    if (inStr) {
      out += ch;
      if (ch === '"') { if (expr[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; }
      i++; continue;
    }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    const m = /^(TRUE|FALSE)/i.exec(expr.slice(i));
    const prev = out[out.length - 1];
    const prevIsIdent = prev != null && /[A-Za-z0-9_.$!]/.test(prev);
    if (m && !prevIsIdent) {
      const kw = m[1];
      const after = expr[i + kw.length];
      // No partir un identificador más largo (TRUEISH) ni duplicar TRUE(.
      if (after != null && /[A-Za-z0-9_.]/.test(after)) { out += ch; i++; continue; }
      if (after === '(') { out += kw; i += kw.length; continue; }
      out += kw.toUpperCase() + '()';
      i += kw.length; continue;
    }
    out += ch; i++;
  }
  return out;
}

// ── Instalación del parche (idempotente) ──────────────────────────────────────
let installed = false;

/**
 * Parchea una vez el prototipo del `Parser` compartido para (1) normalizar booleanos en
 * `parse` y (2) resolver las funciones personalizadas en `getFunction`. Seguro en SSR (sólo
 * muta el prototipo) y a prueba de cambios de API (si los métodos no existen, no parchea).
 */
export function installFormulaEngine(): void {
  if (installed) return;
  const proto: any = (Parser as any)?.prototype;
  if (!proto) return;

  if (!proto.__axosParsePatched && typeof proto.parse === 'function') {
    const origParse = proto.parse;
    proto.parse = function patchedParse(expression: any, options: any) {
      // Preprocesa la cadena: 1) alias de `T(`/`N(` (el lexer no admite funciones de 1 letra);
      // 2) constantes de matriz `{1,2,3}` → ARRCONST(...); 3) referencias estructuradas `Tabla[Col]`
      // → rangos; 4) familia LAMBDA (invocación directa + lambdas-argumento codificadas); 5) LET
      // (nombres locales → su valor); 6) normaliza booleanos sueltos. El parser sólo ve lo resuelto.
      return origParse.call(this, typeof expression === 'string' ? normalizeFormula(expandLet(expandLambda(expandStructuredRefs(expandArrayConst(aliasScalarFns(expression)))))) : expression, options);
    };
    proto.__axosParsePatched = true;
  }

  if (!proto.__axosFnPatched && typeof proto.getFunction === 'function') {
    const origGet = proto.getFunction;
    proto.getFunction = function patchedGetFunction(name: any) {
      const own = origGet.call(this, name);
      if (own !== undefined) return own;
      return CUSTOM_FUNCTIONS[String(name).toUpperCase()];
    };
    proto.__axosFnPatched = true;
  }

  installed = true;
}
