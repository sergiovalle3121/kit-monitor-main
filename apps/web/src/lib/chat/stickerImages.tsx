import React from 'react';

/**
 * Stickers ILUSTRADOS (SVG vectoriales propios, no emojis). Se envían como un
 * mensaje de texto con el token `[[sticker:<id>]]` y se renderizan en grande en
 * la burbuja. Cero assets binarios: el dibujo vive en código y es XSS-safe.
 */
export interface ImageSticker {
  id: string;
  label: string;
  node: React.ReactNode;
}

/** Fondo redondeado con gradiente reutilizable para todos los stickers. */
function Badge({
  from,
  to,
  children,
}: {
  from: string;
  to: string;
  children: React.ReactNode;
}) {
  // Sin ':' → seguro para referencias url(#id) en SVG.
  const gid = `sg${React.useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" role="img">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="108" height="108" rx="30" fill={`url(#${gid})`} />
      <g fill="#fff" stroke="none">
        {children}
      </g>
    </svg>
  );
}

export const IMAGE_STICKERS: ImageSticker[] = [
  {
    id: 'like',
    label: 'Me gusta',
    node: (
      <Badge from="#4aa3ff" to="#0a84ff">
        <path d="M44 54h-9a4 4 0 00-4 4v26a4 4 0 004 4h9zM50 54l13-22a7 7 0 0112 6l-4 16h18a7 7 0 016.9 8.3l-4.2 22A8 8 0 0184 95H50z" />
      </Badge>
    ),
  },
  {
    id: 'heart',
    label: 'Corazón',
    node: (
      <Badge from="#ff7db0" to="#ff4d8d">
        <path d="M60 92S30 74 30 52a16 16 0 0130-7 16 16 0 0130 7c0 22-30 40-30 40z" />
      </Badge>
    ),
  },
  {
    id: 'star',
    label: 'Estrella',
    node: (
      <Badge from="#ffc24d" to="#f5a524">
        <path d="M60 26l9.5 19.3 21.3 3.1-15.4 15 3.6 21.2L60 79.6 40.9 89.6l3.6-21.2-15.4-15 21.3-3.1z" />
      </Badge>
    ),
  },
  {
    id: 'fire',
    label: 'Fuego',
    node: (
      <Badge from="#ff9a66" to="#ff5a2c">
        <path d="M62 24c2 12-8 16-12 24-3 6-2 12 2 15-1-6 3-9 4-13 4 6 12 9 12 19a18 18 0 11-36 0c0-12 9-16 9-28 0 5 3 8 6 9-1-12 9-19 15-26z" />
      </Badge>
    ),
  },
  {
    id: 'check',
    label: 'Listo',
    node: (
      <Badge from="#4ad991" to="#2ec27e">
        <path d="M40 61l13 13 28-28 8 8-36 36-21-21z" />
      </Badge>
    ),
  },
  {
    id: 'rocket',
    label: 'Cohete',
    node: (
      <Badge from="#9a7bff" to="#7c5cff">
        <path d="M60 24c14 8 20 22 20 36l-8 8H48l-8-8c0-14 6-28 20-36zm0 22a7 7 0 100 14 7 7 0 000-14zM48 74l-8 14 12-4zm24 0l8 14-12-4z" />
      </Badge>
    ),
  },
  {
    id: 'trophy',
    label: 'Trofeo',
    node: (
      <Badge from="#ffd24d" to="#f59e0b">
        <path d="M42 30h36v10c0 12-8 20-18 20s-18-8-18-20zM34 34h8v8a10 10 0 01-8-8zm44 0h8a10 10 0 01-8 8zM54 62h12v12H54zM44 78h32v8H44z" />
      </Badge>
    ),
  },
  {
    id: 'idea',
    label: 'Idea',
    node: (
      <Badge from="#34d1bf" to="#0fb39a">
        <path d="M60 28a22 22 0 00-13 40v8h26v-8a22 22 0 00-13-40zM50 82h20v5H50zm3 9h14v4a4 4 0 01-4 4h-6a4 4 0 01-4-4z" />
      </Badge>
    ),
  },
  {
    id: 'party',
    label: 'Fiesta',
    node: (
      <Badge from="#ff6fae" to="#c44be0">
        <path d="M34 88l16-44 28 28zm26-46l4-8m6 14l8-4m-12 18l9 1M52 34l2-8" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />
        <circle cx="60" cy="40" r="3" />
        <circle cx="82" cy="58" r="3" />
        <circle cx="48" cy="30" r="2.5" />
      </Badge>
    ),
  },
  {
    id: 'clap',
    label: 'Aplausos',
    node: (
      <Badge from="#4fd0e0" to="#22b8cf">
        <g stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M44 58l-6-10m20 4l-2-12m14 16l4-10" />
        </g>
        <path d="M48 64c-6 6-6 16 0 22l10 8c6 4 14 3 18-3l8-12c2-3 1-7-2-9s-7-1-9 2l-3 4 8-16c1-3 0-6-3-7s-6 0-7 3l-6 12 2-16c0-3-2-6-5-6s-6 2-6 5l-2 16-3-12c-1-3-4-5-7-4s-4 4-3 7z" />
      </Badge>
    ),
  },
  {
    id: 'coffee',
    label: 'Café',
    node: (
      <Badge from="#b98a5e" to="#8a5a2b">
        <path d="M38 46h36v22a16 16 0 01-16 16h-4a16 16 0 01-16-16zm36 6h6a8 8 0 010 16h-6zM40 34c0-4 4-4 4-8m10 8c0-4 4-4 4-8m10 8c0-4 4-4 4-8" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M38 46h36v6H38z" />
      </Badge>
    ),
  },
  {
    id: 'hundred',
    label: 'Cien',
    node: (
      <Badge from="#ff5a5a" to="#e0245e">
        <text
          x="60"
          y="74"
          textAnchor="middle"
          fontSize="42"
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
        >
          100
        </text>
        <rect x="30" y="84" width="60" height="5" rx="2.5" />
      </Badge>
    ),
  },
];

const BY_ID = new Map(IMAGE_STICKERS.map((s) => [s.id, s]));

export function getSticker(id: string): ImageSticker | undefined {
  return BY_ID.get(id);
}

/** Token textual que viaja en el cuerpo del mensaje. */
export function stickerToken(id: string): string {
  return `[[sticker:${id}]]`;
}

/** Si el cuerpo es exactamente un sticker ilustrado, devuelve su id; si no, null. */
const TOKEN_RE = /^\[\[sticker:([a-z0-9_-]+)\]\]$/;
export function parseStickerId(body: string): string | null {
  const m = TOKEN_RE.exec(body.trim());
  return m && BY_ID.has(m[1]) ? m[1] : null;
}
