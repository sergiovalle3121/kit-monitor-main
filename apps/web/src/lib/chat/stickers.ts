/**
 * "Stickers" sin assets binarios: combos de emoji expresivos que se envían como
 * un mensaje de texto normal y se renderizan EN GRANDE (estilo WhatsApp, donde
 * un mensaje de solo emoji se ve grande). Así no añadimos imágenes al repo ni
 * tocamos el backend (es texto), pero se sienten como stickers.
 */
export interface StickerPack {
  id: string;
  label: string;
  glyph: string;
  stickers: string[];
}

export const STICKER_PACKS: StickerPack[] = [
  {
    id: 'reactions',
    label: 'Reacciones',
    glyph: '👍',
    stickers: [
      '👍😄',
      '👌🔥',
      '🙌🎉',
      '👏👏👏',
      '💯✅',
      '🤝👍',
      '🙏✨',
      '🫶❤️',
      '😎👍',
      '🤩🌟',
      '💪🔥',
      '🚀💨',
    ],
  },
  {
    id: 'mood',
    label: 'Ánimo',
    glyph: '😂',
    stickers: [
      '😂😂😂',
      '🤣👌',
      '😅👍',
      '🥳🎊',
      '😍❤️',
      '😉👍',
      '🤔💭',
      '😴💤',
      '🥺🙏',
      '😭💔',
      '😤💢',
      '🤯💥',
    ],
  },
  {
    id: 'work',
    label: 'Trabajo',
    glyph: '🏭',
    stickers: [
      '✅📦',
      '🏭⚙️',
      '📈🔥',
      '🛠️👷',
      '🚚💨',
      '📊👀',
      '⏰⚡',
      '🎯💯',
      '🤝💼',
      '☕💻',
      '🧠💡',
      '🏆🥇',
    ],
  },
  {
    id: 'celebrate',
    label: 'Festejo',
    glyph: '🎉',
    stickers: [
      '🎉🥳🎊',
      '🎂🎈',
      '🍻🎉',
      '🥂✨',
      '🎁❤️',
      '🌟🎆',
      '🏅🎉',
      '👑✨',
      '🎶🕺',
      '💃🎵',
      '🔥🚀🌟',
      '✨🙌✨',
    ],
  },
];

/**
 * ¿El texto es SOLO emoji (y espacios)? Sirve para renderizar "stickers" /
 * mensajes de solo emoji en grande. Devuelve false si hay letras o números.
 * Usa propiedades Unicode (Extended_Pictographic) + componentes/zwj/variación.
 */
const EMOJI_ONLY_RE =
  /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|[\u{1F1E6}-\u{1F1FF}]|️|‍|\s)+$/u;
const HAS_PICTOGRAPH_RE = /\p{Extended_Pictographic}/u;

export function isEmojiOnly(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 24) return false; // cota: cadenas largas no son "sticker"
  return HAS_PICTOGRAPH_RE.test(t) && EMOJI_ONLY_RE.test(t);
}

/**
 * Cuenta aproximada de "glifos" emoji (segmentos separados por zwj cuentan como
 * uno). Sirve para escalar el tamaño: 1 emoji enorme, varios un poco menor.
 */
export function emojiGlyphCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  // Intl.Segmenter respeta clusters de grafemas (emoji compuestos = 1).
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let n = 0;
    for (const s of seg.segment(t)) if (s.segment.trim()) n++;
    return n;
  } catch {
    return Array.from(t).filter((c) => c.trim()).length;
  }
}
