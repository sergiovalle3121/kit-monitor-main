/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Comodines en la **búsqueda exacta** de `MATCH`, `VLOOKUP` y `HLOOKUP`.
 *
 * En Excel, con coincidencia exacta (`MATCH(...,0)`, `VLOOKUP(...,FALSE)`, `HLOOKUP(...,FALSE)`), si el
 * valor buscado es texto con comodines (`?`/`*`/`~`) se busca por **patrón**. `@formulajs/formulajs@2.9.3`
 * no lo hace: `MATCH("ap*",{...},0)` devolvía un índice equivocado y `VLOOKUP("ap*",...,FALSE)` daba `#N/A`.
 *
 * Estrategia **quirúrgica**: sólo se intercepta el caso «exacto + texto con comodín»; cualquier otro
 * (numérico, sin comodín, coincidencia aproximada) se **delega** en el mismo `formulajs`, sin tocarlo.
 */
import * as formulajs from '@formulajs/formulajs';
import { hasWildcard, wildcardMatch } from './wildcard';

/** Aplana a 1D en orden de lectura (para el vector de MATCH). */
function flat(arg: any): any[] {
  if (Array.isArray(arg)) {
    const out: any[] = [];
    for (const x of arg) { if (Array.isArray(x)) out.push(...flat(x)); else out.push(x); }
    return out;
  }
  return [arg];
}

/** Normaliza a matriz 2D (filas × columnas). */
function to2D(arg: any): any[][] {
  if (!Array.isArray(arg)) return [[arg]];
  return arg.map((r) => (Array.isArray(r) ? r : [r]));
}

const isWildText = (v: any) => typeof v === 'string' && hasWildcard(v);

/** `MATCH(buscar, vector, [tipo])` — con comodines en tipo 0 (exacto). */
export function MATCH(params: any[]): any {
  const lookup = params[0];
  const type = params[2] === undefined || params[2] === null ? 1 : Math.trunc(Number(params[2]));
  if (type === 0 && isWildText(lookup)) {
    const vals = flat(params[1]);
    for (let i = 0; i < vals.length; i++) if (typeof vals[i] === 'string' && wildcardMatch(vals[i], lookup)) return i + 1;
    return '#N/A';
  }
  return (formulajs as any).MATCH(...params);
}

/** `VLOOKUP(buscar, tabla, col, [rango])` — con comodines en búsqueda exacta (rango = FALSE). */
export function VLOOKUP(params: any[]): any {
  const lookup = params[0];
  const exact = params[3] === false || params[3] === 0;
  if (exact && isWildText(lookup)) {
    const rows = to2D(params[1]);
    const c = Math.trunc(Number(params[2])) - 1;
    if (c < 0) return '#VALUE!';
    for (const row of rows) if (typeof row[0] === 'string' && wildcardMatch(row[0], lookup)) return c < row.length ? row[c] : '#REF!';
    return '#N/A';
  }
  return (formulajs as any).VLOOKUP(...params);
}

/** `HLOOKUP(buscar, tabla, fila, [rango])` — con comodines en búsqueda exacta (rango = FALSE). */
export function HLOOKUP(params: any[]): any {
  const lookup = params[0];
  const exact = params[3] === false || params[3] === 0;
  if (exact && isWildText(lookup)) {
    const rows = to2D(params[1]);
    const r = Math.trunc(Number(params[2])) - 1;
    if (r < 0) return '#VALUE!';
    const header = rows[0] ?? [];
    for (let j = 0; j < header.length; j++) {
      if (typeof header[j] === 'string' && wildcardMatch(header[j], lookup)) return r < rows.length ? rows[r][j] : '#REF!';
    }
    return '#N/A';
  }
  return (formulajs as any).HLOOKUP(...params);
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const LOOKUP_WILDCARD_FUNCTIONS: Record<string, (params: any[]) => any> = { MATCH, VLOOKUP, HLOOKUP };
