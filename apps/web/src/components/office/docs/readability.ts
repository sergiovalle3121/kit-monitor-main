/**
 * Análisis de legibilidad del documento (panel «Revisar»).
 *
 * Lógica **pura** (sin dependencias de Tiptap) para poder testearla con `npx tsx`. El procesador de
 * texto de referencia muestra, según el idioma de corrección:
 *   • Español → **Fernández-Huerta** (índice de facilidad 0–100).
 *   • Inglés  → **Flesch Reading Ease** (0–100) + **Flesch-Kincaid Grade Level** (curso escolar).
 *
 * El conteo de sílabas es heurístico (como en cualquier corrector): exacto para la inmensa mayoría
 * de palabras comunes y una buena estimación para el resto. Se detecta el idioma por marcas
 * inequívocas del español (ñ, ¿, ¡, vocales acentuadas, «que/los/una»…); si no, se asume inglés.
 */

const VOWELS_ES = /[aeiouáéíóúüy]+/g;

/** Sílabas de una palabra en español: grupos de vocales (incluye acentos y diéresis). */
export function syllablesEs(word: string): number {
  const groups = word.toLowerCase().match(VOWELS_ES);
  return Math.max(1, groups ? groups.length : 1);
}

/**
 * Sílabas de una palabra en inglés (heurística estándar de grupos vocálicos):
 *  1) palabras de ≤3 letras = 1 sílaba; 2) se quitan terminaciones mudas (`-e`, `-es`, `-ed` tras
 *  consonante que no sea «l»: «table»→2, «create»→… ); 3) se cuentan grupos de vocales `[aeiouy]`.
 */
export function syllablesEn(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]e|[^laeiouy]es|ed)$/, '');
  w = w.replace(/^y/, '');
  const m = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, m ? m.length : 1);
}

/** Heurística de idioma: ¿el texto está en español? */
export function isSpanish(text: string): boolean {
  if (/[ñ¿¡áéíóúü]/i.test(text)) return true;
  // Palabras funcionales muy frecuentes del español frente al inglés.
  const es = (text.toLowerCase().match(/\b(el|la|los|las|un|una|que|de|por|con|para|como|más|pero|esta|este)\b/g) || []).length;
  const en = (text.toLowerCase().match(/\b(the|and|of|to|in|is|that|it|for|with|as|was|are|this)\b/g) || []).length;
  return es > en;
}

export interface TextStats {
  words: number;
  charsWithSpaces: number;
  charsNoSpaces: number;
  sentences: number;
  syllablesEs: number;
  syllablesEn: number;
}

/** Estadísticas puras de un texto (sin párrafos, que dependen del documento). */
export function analyzeText(text: string): TextStats {
  const t = text || '';
  const words = t.match(/[\p{L}\p{N}'’-]+/gu) || [];
  const sentences =
    (t.match(/[^.!?…]+[.!?…]+/g) || []).filter((s) => s.trim().length > 1).length || (words.length ? 1 : 0);
  return {
    words: words.length,
    charsWithSpaces: t.replace(/\n/g, '').length,
    charsNoSpaces: t.replace(/\s/g, '').length,
    sentences,
    syllablesEs: words.reduce((a, w) => a + syllablesEs(w), 0),
    syllablesEn: words.reduce((a, w) => a + syllablesEn(w), 0),
  };
}

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Fernández-Huerta (español): 206.84 − 60·(síl/palabra) − 1.02·(palabras/frase). */
export function fernandezHuerta(words: number, sentences: number, syllables: number): number {
  if (!words) return 0;
  const wps = sentences ? words / sentences : words;
  const spw = syllables / words;
  return clamp100(206.84 - 60 * spw - 1.02 * wps);
}

/** Flesch Reading Ease (inglés): 206.835 − 1.015·(palabras/frase) − 84.6·(síl/palabra). */
export function fleschReadingEase(words: number, sentences: number, syllables: number): number {
  if (!words) return 0;
  const wps = sentences ? words / sentences : words;
  const spw = syllables / words;
  return clamp100(206.835 - 1.015 * wps - 84.6 * spw);
}

/** Flesch-Kincaid Grade Level (inglés): 0.39·(palabras/frase) + 11.8·(síl/palabra) − 15.59. */
export function fleschKincaidGrade(words: number, sentences: number, syllables: number): number {
  if (!words) return 0;
  const wps = sentences ? words / sentences : words;
  const spw = syllables / words;
  return Math.max(0, Math.round((0.39 * wps + 11.8 * spw - 15.59) * 10) / 10);
}

export interface Readability {
  scheme: 'es' | 'en';
  ease: number;
  easeLabel: string;
  grade?: number; // sólo inglés (Flesch-Kincaid)
}

function easeLabel(ease: number): string {
  return ease >= 80 ? 'Muy fácil' : ease >= 65 ? 'Fácil' : ease >= 50 ? 'Normal' : ease >= 30 ? 'Difícil' : 'Muy difícil';
}

/** Índice de legibilidad adecuado al idioma detectado del texto. */
export function readability(text: string, stats?: TextStats): Readability {
  const s = stats ?? analyzeText(text);
  if (isSpanish(text)) {
    const ease = fernandezHuerta(s.words, s.sentences, s.syllablesEs);
    return { scheme: 'es', ease, easeLabel: easeLabel(ease) };
  }
  const ease = fleschReadingEase(s.words, s.sentences, s.syllablesEn);
  return { scheme: 'en', ease, easeLabel: easeLabel(ease), grade: fleschKincaidGrade(s.words, s.sentences, s.syllablesEn) };
}
