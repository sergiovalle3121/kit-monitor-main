'use client';

import React, { useEffect, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { Gif, giphyEnabled, searchGifs, trendingGifs } from '@/lib/chat/giphy';

/** Selector de GIFs (Giphy). Al elegir, devuelve la URL animada. */
export function GifPicker({
  onPick,
  onClose,
}: {
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const enabled = giphyEnabled();

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(
      () => {
        const p = q.trim() ? searchGifs(q.trim()) : trendingGifs();
        p.then((g) => alive && setGifs(g))
          .catch(() => alive && setGifs([]))
          .finally(() => alive && setLoading(false));
      },
      q.trim() ? 350 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, enabled]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} flex h-[32rem] w-full max-w-md flex-col rounded-[24px] p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">GIFs</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!enabled ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-500">
            Para usar GIFs configura la variable{' '}
            <code className="mx-1 rounded bg-black/10 px-1 dark:bg-white/10">
              NEXT_PUBLIC_GIPHY_KEY
            </code>{' '}
            con tu clave de Giphy.
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-full bg-black/5 px-3 py-2 dark:bg-white/10">
              <Search className="h-4 w-4 text-gray-500" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar GIFs…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : gifs.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Sin resultados</p>
              ) : (
                <div className="columns-2 gap-2 sm:columns-3">
                  {gifs.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => onPick(g.preview)}
                      className="mb-2 block w-full overflow-hidden rounded-xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.preview}
                        alt="GIF"
                        loading="lazy"
                        className="w-full"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="pt-2 text-center text-[10px] text-gray-400">
              Con tecnología de GIPHY
            </p>
          </>
        )}
      </div>
    </div>
  );
}
