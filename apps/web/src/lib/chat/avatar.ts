import type { CSSProperties } from 'react';

/**
 * Color de avatar determinista por persona/canal: el mismo usuario tiene SIEMPRE
 * el mismo color en toda la app (lista, hilo, menciones), para distinguir de un
 * vistazo quién es quién (estilo Teams/Slack). Devuelve un estilo inline que
 * sobreescribe el gradiente por defecto de Tailwind.
 */
const GRADIENTS: [string, string][] = [
  ['#6f6fe6', '#5b5bd6'],
  ['#4aa3ff', '#0a84ff'],
  ['#3cc2b2', '#16a394'],
  ['#ff9a66', '#ff7a45'],
  ['#4ad991', '#2ec27e'],
  ['#ff7db0', '#ff4d8d'],
  ['#9a7bff', '#7c5cff'],
  ['#ffc24d', '#f5a524'],
  ['#4fd0e0', '#22b8cf'],
  ['#34d1bf', '#0fb39a'],
  ['#60a5fa', '#3b82f6'],
  ['#f5945c', '#ef6f3c'],
];

function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Estilo inline (backgroundImage) con el gradiente estable del `key`. */
export function avatarStyle(key: string | null | undefined): CSSProperties {
  const [from, to] = GRADIENTS[hashKey(key || '?') % GRADIENTS.length];
  return { backgroundImage: `linear-gradient(135deg, ${from}, ${to})` };
}
