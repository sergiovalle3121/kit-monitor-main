/**
 * Tokens especiales que viajan como cuerpo de un mensaje de texto y se renderizan
 * de forma especial (igual idea que los stickers `[[sticker:id]]`). XSS-safe: solo
 * reconocemos formatos propios y, para GIFs, validamos el host contra una lista.
 *
 *  - GIF:       [[gif:<url>]]      (host Giphy/Tenor)
 *  - Ubicación: [[loc:<lat>,<lng>]]
 *  - Contacto:  [[contact:<userId>]]
 */

const GIF_RE = /^\[\[gif:(https?:\/\/[^\]\s]+)\]\]$/;
const LOC_RE = /^\[\[loc:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]\]$/;
const CONTACT_RE = /^\[\[contact:([a-zA-Z0-9-]+)\]\]$/;

const GIF_HOSTS = ['giphy.com', 'tenor.com', 'tenor.co'];

export function parseGif(body: string): string | null {
  const m = GIF_RE.exec(body.trim());
  if (!m) return null;
  try {
    const url = new URL(m[1]);
    if (url.protocol !== 'https:') return null;
    const ok = GIF_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
    );
    return ok ? m[1] : null;
  } catch {
    return null;
  }
}

export function parseLocation(body: string): { lat: number; lng: number } | null {
  const m = LOC_RE.exec(body.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function parseContact(body: string): string | null {
  const m = CONTACT_RE.exec(body.trim());
  return m ? m[1] : null;
}

export const gifToken = (url: string) => `[[gif:${url}]]`;
export const locToken = (lat: number, lng: number) =>
  `[[loc:${lat.toFixed(6)},${lng.toFixed(6)}]]`;
export const contactToken = (userId: string) => `[[contact:${userId}]]`;

/** ¿El cuerpo es uno de estos tokens especiales? (para vista previa de la lista). */
export function specialKind(
  body: string | null | undefined,
): 'gif' | 'loc' | 'contact' | null {
  if (!body) return null;
  if (parseGif(body)) return 'gif';
  if (parseLocation(body)) return 'loc';
  if (parseContact(body)) return 'contact';
  return null;
}
