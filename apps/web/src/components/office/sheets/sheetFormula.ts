/**
 * Entrada de celda estilo Excel para el motor de Fortune-Sheet.
 *
 * Fortune-Sheet sólo trata como fórmula lo que empieza por «=» (su `isFormula`
 * interno). Excel además acepta el atajo Lotus de empezar por «+» o «-»:
 * `+1+1`, `-A1*2`, `+SUM(A1:A3)` se entienden como fórmula. En cambio un número
 * con signo suelto (`-5`, `+3.14`, `-.5`) NO es fórmula: es ese número. El texto
 * normal sigue como texto.
 *
 * `normalizeCellInput` devuelve la cadena lista para entregar al motor: las
 * fórmulas salen con «=» delante para que Fortune-Sheet calcule y guarde tanto la
 * fórmula (`f`) como el valor (`v`) y recalcule los dependientes; lo demás queda
 * igual. Mantener este criterio en un único helper puro permite probarlo sin DOM
 * y reutilizarlo desde la escritura directa en la celda y desde el asistente.
 *
 * Nota de paridad con Excel: igual que Excel, `+52 5512` (un teléfono) se
 * interpreta como intento de fórmula porque empieza por «+» seguido de dígito;
 * para texto literal de ese tipo el usuario antepone un apóstrofo, como en Excel.
 */

// Un número con signo suelto: "-5", "+3.14", "-.5", "10", "3.0".
const PLAIN_NUMBER = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;

// Tras un «+»/«-» inicial, ¿el cuerpo parece una expresión de fórmula?
// Acepta: número / decimal / paréntesis, una referencia de celda (A1, AB12,
// $B$2) o una llamada a función NOMBRE(.
const FORMULA_AFTER_SIGN =
  /^[+-]\s*(?:[\d.(]|\$?[A-Za-z]{1,3}\$?\d|[A-Za-z][\w.]*\()/;

/** ¿La entrada cruda debe evaluarse como fórmula (estilo Excel)? */
export function isFormulaInput(raw: string): boolean {
  if (typeof raw !== 'string' || raw.length < 2) return false;
  if (raw[0] === '=') return true;
  if (raw[0] === '+' || raw[0] === '-') {
    if (PLAIN_NUMBER.test(raw)) return false; // número con signo, no fórmula
    return FORMULA_AFTER_SIGN.test(raw);
  }
  return false;
}

/**
 * Normaliza la entrada cruda de una celda al estilo Excel y la devuelve lista
 * para el motor de Fortune-Sheet:
 *  - «=...»            → fórmula (sin cambios).
 *  - «+1+1», «-A1*2»   → fórmula (antepone «=»).
 *  - «-5», «+3.14»     → número con signo (sin cambios).
 *  - resto             → texto / número normal (sin cambios).
 */
export function normalizeCellInput(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) return raw;
  if (raw[0] === '=') return raw;
  if (raw[0] === '+' || raw[0] === '-') {
    if (PLAIN_NUMBER.test(raw)) return raw; // número con signo → número
    if (FORMULA_AFTER_SIGN.test(raw)) return `=${raw}`; // atajo Lotus → fórmula
  }
  return raw; // texto / número normal
}
