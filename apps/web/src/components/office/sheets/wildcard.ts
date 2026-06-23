/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Comodines de Excel (`?`, `*`, `~`) — núcleo compartido.
 *
 * Excel admite comodines en `SEARCH` y en los criterios de la familia `COUNTIF/SUMIF/MATCH…`:
 *   • `?` coincide con **un** carácter cualquiera.
 *   • `*` coincide con **cualquier secuencia** (incluida la vacía).
 *   • `~?`, `~*`, `~~` escapan el carácter siguiente (literal `?`, `*`, `~`).
 * Las comparaciones de texto de Excel son **insensibles a mayúsculas**.
 *
 * `@formulajs/formulajs@2.9.3` no implementa ninguno de estos comodines: `SEARCH("b?d","abcd")`
 * devuelve `#VALUE!` y `COUNTIF(rango,"ap*")` cuenta 0. Aquí está el convertidor patrón→RegExp y el
 * `SEARCH` fiel; la familia de criterios lo reutiliza (ver `criteriaWildcards.ts`).
 */

/** Escapa los metacaracteres de RegExp en un literal. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Convierte un patrón con comodines de Excel a una `RegExp`. */
export function excelWildcardToRegExp(pattern: string, opts: { anchored?: boolean; flags?: string } = {}): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~') {
      const nxt = pattern[i + 1];
      if (nxt === '?' || nxt === '*' || nxt === '~') { out += escapeRe(nxt); i++; continue; }
      out += escapeRe('~'); continue; // `~` suelto = literal
    }
    if (ch === '?') { out += '.'; continue; }
    if (ch === '*') { out += '[\\s\\S]*'; continue; }
    out += escapeRe(ch);
  }
  const body = opts.anchored ? `^${out}$` : out;
  return new RegExp(body, opts.flags ?? '');
}

/** ¿El patrón contiene algún comodín sin escapar? */
export function hasWildcard(pattern: string): boolean {
  return /[?*]/.test(pattern.replace(/~[?*~]/g, ''));
}

/** ¿`value` casa con el patrón `criteria` (comodines de Excel, insensible a may.)? Anclado (todo el valor). */
export function wildcardMatch(value: string, criteria: string): boolean {
  return excelWildcardToRegExp(criteria, { anchored: true, flags: 'i' }).test(value);
}

/**
 * `SEARCH(buscar, dentro, [inicio])` — posición (1-based) insensible a may. **con comodines**.
 * Devuelve `#VALUE!` si no encuentra o si `inicio` es inválido. (`FIND` sigue siendo literal y
 * sensible a may.: no se toca.)
 */
export function SEARCH(params: any[]): any {
  const find = params[0] === null || params[0] === undefined ? '' : String(params[0]);
  const within = params[1] === null || params[1] === undefined ? '' : String(params[1]);
  const start = params[2] === null || params[2] === undefined ? 1 : Math.trunc(Number(params[2]));
  if (!Number.isFinite(start) || start < 1) return '#VALUE!';
  if (find === '') return start <= within.length + 1 ? start : '#VALUE!';
  const idx = within.slice(start - 1).search(excelWildcardToRegExp(find, { flags: 'i' }));
  return idx < 0 ? '#VALUE!' : start + idx;
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const WILDCARD_FUNCTIONS: Record<string, (params: any[]) => any> = { SEARCH };
