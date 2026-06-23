/**
 * **Tipografía inteligente** (el «Autoformato» de Word) — función pura, sin dependencias.
 * Convierte la puntuación recta en sus formas tipográficas: comillas y apóstrofos curvos, raya `—`,
 * puntos suspensivos `…`, símbolos `© ® ™` y fracciones `½ ¼ ¾`. La integración con el editor (Tiptap)
 * vive en `components/office/docs/smartTypography.ts`; aquí solo la lógica, comprobable de forma
 * aislada.
 */

export interface TypographyOpts {
  quotes?: boolean;    // comillas " " y apóstrofos ' ' curvos (def. true)
  dashes?: boolean;    // -- → — (def. true)
  ellipsis?: boolean;  // ... → … (def. true)
  symbols?: boolean;   // (c)→©, (r)→®, (tm)→™ (def. true)
  fractions?: boolean; // 1/2→½, 1/4→¼, 3/4→¾ (def. true)
}

/** Comillas dobles y simples rectas → curvas, decidiendo apertura/cierre por el carácter previo. */
function curlyQuotes(text: string): string {
  const open = (prev: string | undefined) => prev == null || /[\s([{<¿¡—–\-/]/.test(prev);
  let s = text.replace(/"/g, (_m, off: number, str: string) => (open(str[off - 1]) ? '“' : '”'));
  s = s.replace(/'/g, (_m, off: number, str: string) => (open(str[off - 1]) ? '‘' : '’'));
  return s;
}

/** Aplica la tipografía inteligente a una cadena. Pura, sin efectos. */
export function smartTypography(text: string, opts: TypographyOpts = {}): string {
  const o = { quotes: true, dashes: true, ellipsis: true, symbols: true, fractions: true, ...opts };
  let s = text;
  if (o.symbols) s = s.replace(/\(c\)/gi, '©').replace(/\(r\)/gi, '®').replace(/\(tm\)/gi, '™');
  if (o.ellipsis) s = s.replace(/\.\.\./g, '…');
  if (o.dashes) s = s.replace(/--/g, '—');
  if (o.fractions) s = s.replace(/(?<![\d/])1\/2(?![\d/])/g, '½').replace(/(?<![\d/])1\/4(?![\d/])/g, '¼').replace(/(?<![\d/])3\/4(?![\d/])/g, '¾');
  if (o.quotes) s = curlyQuotes(s);
  return s;
}
