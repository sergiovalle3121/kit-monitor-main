/**
 * `LET(nombre1; valor1; [nombre2; valor2; …]; cálculo)` — define nombres locales y los usa
 * en el cálculo final, una de las funciones estrella de Excel 365 (evita repetir subexpresiones
 * y mejora legibilidad/rendimiento).
 *
 * El parser de Fortune-Sheet evalúa cada argumento ANTES de llamar a la función, así que `LET`
 * NO puede ser una función registrada normal: `LET(x; 5; x+1)` intentaría evaluar `x+1` con `x`
 * indefinido. La implementamos como **preprocesado de cadena** (igual técnica que la
 * normalización de booleanos): sustituimos cada nombre por su expresión-valor —entre
 * paréntesis— en los valores posteriores y en el cálculo, de izquierda a derecha (para que
 * `valor2` pueda usar `nombre1`). El parser nunca ve los nombres; sólo la expresión expandida.
 *
 * Robustez: respeta literales de texto entrecomillados, sólo sustituye identificadores
 * COMPLETOS (no `xy` cuando el nombre es `x`), no toca usos como llamada `nombre(` y soporta
 * `LET` ANIDADO (se expanden los argumentos —que pueden contener otros `LET`— antes de
 * sustituir). Idempotente y defensivo: si la sintaxis no cuadra, deja la expresión intacta para
 * que el motor reporte el error como siempre.
 */

const ID = /[A-Za-z0-9_.$]/;
const isId = (c: string | undefined): boolean => c != null && ID.test(c);

/** Divide por comas/puntoycoma de NIVEL SUPERIOR (respeta paréntesis y comillas). */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0, inStr = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { cur += ch; if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else inStr = false; } continue; }
    if (ch === '"') { inStr = true; cur += ch; continue; }
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (depth === 0 && (ch === ',' || ch === ';')) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/** Localiza la PRIMERA llamada `LET(` de la cadena (fuera de comillas, como identificador). */
function findLetCall(s: string): { start: number; end: number; inner: string } | null {
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (ch === '"') { if (s[i + 1] === '"') i++; else inStr = false; } continue; }
    if (ch === '"') { inStr = true; continue; }
    // ¿«LET» como palabra completa seguido de «(»?
    if ((ch === 'L' || ch === 'l') && /let/i.test(s.slice(i, i + 3)) && !isId(s[i - 1])) {
      let j = i + 3; while (s[j] === ' ') j++;
      if (s[j] !== '(') continue;
      // Empareja el paréntesis de cierre respetando comillas/anidamiento.
      let depth = 0, k = j, str = false;
      for (; k < s.length; k++) {
        const c = s[k];
        if (str) { if (c === '"') { if (s[k + 1] === '"') k++; else str = false; } continue; }
        if (c === '"') { str = true; continue; }
        if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) break; }
      }
      if (depth !== 0) return null; // paréntesis desbalanceado → no tocar
      return { start: i, end: k + 1, inner: s.slice(j + 1, k) };
    }
  }
  return null;
}

/** Sustituye el identificador COMPLETO `name` por `(value)` fuera de comillas y de usos `name(`. */
function substituteName(expr: string, name: string, value: string): string {
  let out = '', i = 0, inStr = false;
  while (i < expr.length) {
    const ch = expr[i];
    if (inStr) { out += ch; if (ch === '"') { if (expr[i + 1] === '"') { out += '"'; i += 2; continue; } inStr = false; } i++; continue; }
    if (ch === '"') { inStr = true; out += ch; i++; continue; }
    if (expr.startsWith(name, i) && !isId(expr[i - 1]) && !isId(expr[i + name.length])) {
      let j = i + name.length; while (expr[j] === ' ') j++;
      if (expr[j] === '(') { out += expr.slice(i, i + name.length); i += name.length; continue; } // uso como función
      out += `(${value})`; i += name.length; continue;
    }
    out += ch; i++;
  }
  return out;
}

/** Construye la expansión de un `LET` ya con sus argumentos expandidos. */
function buildLet(args: string[]): string {
  // Necesita un nº impar ≥ 3: pares (nombre, valor) + cálculo final.
  if (args.length < 3 || args.length % 2 === 0) return `LET(${args.join(',')})`; // inválido → intacto
  const calc = args[args.length - 1];
  const names: string[] = [];
  const values: string[] = [];
  for (let i = 0; i + 1 < args.length - 1; i += 2) { names.push(args[i]); values.push(args[i + 1]); }
  const resolved: string[] = [];
  for (let i = 0; i < names.length; i++) {
    let v = values[i];
    for (let k = 0; k < i; k++) v = substituteName(v, names[k], resolved[k]); // valores anteriores
    resolved.push(v);
  }
  let body = calc;
  for (let i = 0; i < names.length; i++) body = substituteName(body, names[i], resolved[i]);
  return `(${body})`;
}

/**
 * Expande TODAS las llamadas `LET(...)` de una expresión (anidadas incluidas). Devuelve la
 * cadena lista para el parser. Si no hay `LET`, retorna la entrada sin cambios (ruta rápida).
 */
export function expandLet(expr: string): string {
  if (typeof expr !== 'string' || !/let\s*\(/i.test(expr)) return expr;
  let out = expr;
  let guard = 0;
  while (guard++ < 64) {
    const m = findLetCall(out);
    if (!m) break;
    const args = splitTopLevel(m.inner).map(expandLet); // expande LET anidado en los argumentos
    const replaced = buildLet(args);
    if (replaced === `LET(${args.join(',')})`) break; // inválido: evita bucle infinito
    out = out.slice(0, m.start) + replaced + out.slice(m.end);
  }
  return out;
}
