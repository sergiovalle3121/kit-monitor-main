/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de **`PROPER(texto)`** — «Tipo título» exactamente como Excel.
 *
 * Excel pone en mayúscula la primera letra de cada palabra **y toda letra que siga a un carácter
 * NO alfabético** (espacio, apóstrofo, guion, dígito…), y baja el resto. Esto incluye el conocido
 * comportamiento (a veces sorprendente) con apóstrofos y dígitos:
 *
 *   • `PROPER("o'brien mcdonald")` → `"O'Brien Mcdonald"`   (mayúscula tras el apóstrofo)
 *   • `PROPER("they're")`          → `"They'Re"`            (sí, Excel hace esto)
 *   • `PROPER("abc2def")`          → `"Abc2Def"`            (mayúscula tras el dígito)
 *   • `PROPER("HELLO WORLD")`      → `"Hello World"`        (baja el resto)
 *
 * `@formulajs/formulajs@2.9.3` sólo trata el **espacio** como separador, así que `PROPER("o'brien")`
 * daba `"O'brien"`. Se reimplementa la función (trivial y exacta) tratando como inicio de palabra
 * cualquier letra precedida por algo que no sea letra. Unicode-aware (`\p{L}`) para acentos/ñ.
 */

/** `PROPER(texto)` — pone «Tipo título» con las reglas exactas de Excel. */
export function PROPER(params: any[]): any {
  const v = params[0];
  if (v === null || v === undefined) return '';
  const s = String(v);
  let out = '';
  let prevIsLetter = false;
  for (const ch of s) {
    const isLetter = /\p{L}/u.test(ch);
    if (isLetter) out += prevIsLetter ? ch.toLowerCase() : ch.toUpperCase();
    else out += ch;
    prevIsLetter = isLetter;
  }
  return out;
}

/** Registro para fusionar en CUSTOM_FUNCTIONS. */
export const PROPER_FIDELITY_FUNCTIONS: Record<string, (params: any[]) => any> = { PROPER };
