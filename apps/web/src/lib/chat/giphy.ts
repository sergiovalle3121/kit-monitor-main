'use client';

/**
 * Búsqueda de GIFs vía Giphy. Requiere una clave pública en build-time:
 *   NEXT_PUBLIC_GIPHY_KEY=xxxxx
 * Sin clave, el selector lo indica y no busca.
 */
export const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_KEY || '';
export const giphyEnabled = () => GIPHY_KEY.length > 0;

export interface Gif {
  id: string;
  preview: string; // url animada pequeña (para la rejilla y el mensaje)
  width: number;
  height: number;
}

interface GiphyItem {
  id: string;
  images?: {
    fixed_height?: { url?: string; width?: string; height?: string };
    fixed_height_small?: { url?: string };
  };
}

function map(items: GiphyItem[]): Gif[] {
  return items
    .map((it) => {
      const fh = it.images?.fixed_height;
      return {
        id: it.id,
        preview: fh?.url || it.images?.fixed_height_small?.url || '',
        width: Number(fh?.width) || 200,
        height: Number(fh?.height) || 200,
      };
    })
    .filter((g) => !!g.preview);
}

async function call(path: string, params: Record<string, string>): Promise<Gif[]> {
  const qs = new URLSearchParams({
    api_key: GIPHY_KEY,
    rating: 'pg-13',
    limit: '24',
    ...params,
  });
  const res = await fetch(`https://api.giphy.com/v1/gifs/${path}?${qs}`);
  if (!res.ok) throw new Error('Giphy no disponible');
  const json = await res.json();
  return map((json?.data as GiphyItem[]) ?? []);
}

export const trendingGifs = () => call('trending', {});
export const searchGifs = (q: string) => call('search', { q });
