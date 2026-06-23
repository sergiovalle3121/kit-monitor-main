/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Familia de criterios de Excel con **comodines**: `COUNTIF/COUNTIFS`, `SUMIF/SUMIFS`,
 * `AVERAGEIF/AVERAGEIFS`, `MAXIFS/MINIFS`.
 *
 * `@formulajs/formulajs@2.9.3` entiende los operadores (`">5"`, `"<>x"`…) pero **ignora los comodines**:
 * `COUNTIF(rango,"ap*")` cuenta 0 cuando debería contar todas las celdas que empiezan por «ap». Se
 * reimplementa la familia con un **evaluador de criterios fiel** que reutiliza el núcleo `wildcard.ts`
 * (`?`, `*`, `~`) y conserva los operadores de comparación y la coincidencia numérica/de texto de Excel.
 */
import { excelWildcardToRegExp } from './wildcard';

/** Aplana un argumento (matriz 2D de rango o escalar) a 1D en orden de lectura. */
function flat(arg: any): any[] {
  if (Array.isArray(arg)) {
    const out: any[] = [];
    for (const x of arg) { if (Array.isArray(x)) out.push(...flat(x)); else out.push(x); }
    return out;
  }
  return [arg];
}

/** Coerciona a número si es posible (texto numérico, booleano); si no, `null`. */
function toNum(v: any): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

const isBlank = (v: any) => v === '' || v === null || v === undefined;

/**
 * Coincidencia de texto al estilo Excel: insensible a may., con comodines (`?`/`*`) y escapes (`~`).
 * Se enruta SIEMPRE por el patrón→RegExp anclado, que también trata correctamente los literales
 * (incluidos los caracteres especiales y las secuencias escapadas como `~?`).
 */
function textMatch(v: any, pat: string): boolean {
  const s = isBlank(v) ? '' : String(v);
  return excelWildcardToRegExp(pat, { anchored: true, flags: 'i' }).test(s);
}

/** Construye un predicado a partir de un criterio de Excel (número, texto, `">5"`, `"<>x"`, `"a*"`…). */
export function makeCriterion(crit: any): (v: any) => boolean {
  if (typeof crit === 'number') return (v) => toNum(v) === crit;
  if (typeof crit === 'boolean') return (v) => (typeof v === 'boolean' ? v === crit : String(v).toUpperCase() === String(crit).toUpperCase());
  const raw = crit === null || crit === undefined ? '' : String(crit);
  const m = /^(<=|>=|<>|=|<|>)\s*([\s\S]*)$/.exec(raw);
  const op = m ? m[1] : '=';
  const rhs = m ? m[2] : raw;
  const rhsTrim = rhs.trim();
  const rhsNum = rhsTrim !== '' && !Number.isNaN(Number(rhsTrim)) ? Number(rhsTrim) : null;
  const cmp = (v: any): number => {
    // Numérico si ambos lo son; si no, comparación de texto insensible a may.
    const vn = toNum(v);
    if (rhsNum !== null && vn !== null) return vn - rhsNum;
    return String(isBlank(v) ? '' : v).toLowerCase().localeCompare(rhsTrim.toLowerCase());
  };
  switch (op) {
    case '>': return (v) => !isBlank(v) && cmp(v) > 0;
    case '<': return (v) => !isBlank(v) && cmp(v) < 0;
    case '>=': return (v) => !isBlank(v) && cmp(v) >= 0;
    case '<=': return (v) => !isBlank(v) && cmp(v) <= 0;
    case '<>':
      if (rhs === '') return (v) => !isBlank(v); // «<>» = no vacío
      return (v) => (rhsNum !== null && toNum(v) !== null ? toNum(v) !== rhsNum : !textMatch(v, rhs));
    case '=':
    default:
      if (rhs === '') return (v) => isBlank(v); // «» = vacío
      return (v) => (rhsNum !== null && toNum(v) !== null ? toNum(v) === rhsNum : textMatch(v, rhs));
  }
}

/** Índices (0-based) de un rango aplanado que cumplen TODOS los pares (rango, criterio). */
function matchingIndices(pairs: [any, any][]): number[] {
  const cols = pairs.map(([range, crit]) => ({ vals: flat(range), pred: makeCriterion(crit) }));
  const n = cols.length ? cols[0].vals.length : 0;
  const idx: number[] = [];
  for (let i = 0; i < n; i++) if (cols.every((c) => c.pred(c.vals[i]))) idx.push(i);
  return idx;
}

export function COUNTIF(params: any[]): any {
  return flat(params[0]).filter(makeCriterion(params[1])).length;
}

export function COUNTIFS(params: any[]): any {
  const pairs: [any, any][] = [];
  for (let i = 0; i + 1 < params.length; i += 2) pairs.push([params[i], params[i + 1]]);
  return matchingIndices(pairs).length;
}

export function SUMIF(params: any[]): any {
  const range = flat(params[0]);
  const pred = makeCriterion(params[1]);
  const sumRange = params[2] !== undefined ? flat(params[2]) : range;
  let s = 0;
  for (let i = 0; i < range.length; i++) if (pred(range[i])) s += toNum(sumRange[i]) ?? 0;
  return s;
}

export function SUMIFS(params: any[]): any {
  const sumRange = flat(params[0]);
  const pairs: [any, any][] = [];
  for (let i = 1; i + 1 < params.length; i += 2) pairs.push([params[i], params[i + 1]]);
  let s = 0;
  for (const i of matchingIndices(pairs)) s += toNum(sumRange[i]) ?? 0;
  return s;
}

export function AVERAGEIF(params: any[]): any {
  const range = flat(params[0]);
  const pred = makeCriterion(params[1]);
  const avgRange = params[2] !== undefined ? flat(params[2]) : range;
  let s = 0; let c = 0;
  for (let i = 0; i < range.length; i++) if (pred(range[i])) { const n = toNum(avgRange[i]); if (n !== null) { s += n; c++; } }
  return c ? s / c : '#DIV/0!';
}

export function AVERAGEIFS(params: any[]): any {
  const avgRange = flat(params[0]);
  const pairs: [any, any][] = [];
  for (let i = 1; i + 1 < params.length; i += 2) pairs.push([params[i], params[i + 1]]);
  let s = 0; let c = 0;
  for (const i of matchingIndices(pairs)) { const n = toNum(avgRange[i]); if (n !== null) { s += n; c++; } }
  return c ? s / c : '#DIV/0!';
}

export function MAXIFS(params: any[]): any {
  const range = flat(params[0]);
  const pairs: [any, any][] = [];
  for (let i = 1; i + 1 < params.length; i += 2) pairs.push([params[i], params[i + 1]]);
  const vals = matchingIndices(pairs).map((i) => toNum(range[i])).filter((n): n is number => n !== null);
  return vals.length ? Math.max(...vals) : 0;
}

export function MINIFS(params: any[]): any {
  const range = flat(params[0]);
  const pairs: [any, any][] = [];
  for (let i = 1; i + 1 < params.length; i += 2) pairs.push([params[i], params[i + 1]]);
  const vals = matchingIndices(pairs).map((i) => toNum(range[i])).filter((n): n is number => n !== null);
  return vals.length ? Math.min(...vals) : 0;
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const CRITERIA_FUNCTIONS: Record<string, (params: any[]) => any> = {
  COUNTIF, COUNTIFS, SUMIF, SUMIFS, AVERAGEIF, AVERAGEIFS, MAXIFS, MINIFS,
};
