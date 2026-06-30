'use client';

import React, { useMemo, useState } from 'react';
import { Search, Smile, Sticker, Clock } from 'lucide-react';
import { glass } from '@/lib/glass';
import { EMOJI_CATEGORIES, searchEmojis } from '@/lib/chat/emojis';
import { STICKER_PACKS } from '@/lib/chat/stickers';
import { IMAGE_STICKERS, stickerToken } from '@/lib/chat/stickerImages';

const RECENTS_KEY = 'axos_chat_emoji_recents';

function loadRecents(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 24) : [];
  } catch {
    return [];
  }
}

function pushRecent(emoji: string) {
  if (typeof window === 'undefined') return;
  try {
    const cur = loadRecents().filter((e) => e !== emoji);
    window.localStorage.setItem(
      RECENTS_KEY,
      JSON.stringify([emoji, ...cur].slice(0, 24)),
    );
  } catch {
    /* almacenamiento no disponible: ignorar */
  }
}

interface Props {
  onPickEmoji: (emoji: string) => void;
  onPickSticker: (sticker: string) => void;
  className?: string;
}

/**
 * Selector de emojis (cientos, por categoría + búsqueda + recientes) y stickers.
 * Emojis → `onPickEmoji` (se insertan en el borrador). Stickers → `onPickSticker`
 * (se envían como mensaje de inmediato).
 */
export function EmojiStickerPicker({
  onPickEmoji,
  onPickSticker,
  className = '',
}: Props) {
  const [mode, setMode] = useState<'emoji' | 'sticker'>('emoji');
  const [catId, setCatId] = useState(EMOJI_CATEGORIES[0].id);
  const [packId, setPackId] = useState(STICKER_PACKS[0].id);
  const [query, setQuery] = useState('');
  const [recents] = useState<string[]>(loadRecents);

  const searchResults = useMemo(() => searchEmojis(query), [query]);
  const activeCat =
    EMOJI_CATEGORIES.find((c) => c.id === catId) ?? EMOJI_CATEGORIES[0];
  const activePack =
    STICKER_PACKS.find((p) => p.id === packId) ?? STICKER_PACKS[0];

  function handleEmoji(e: string) {
    pushRecent(e);
    onPickEmoji(e);
  }

  return (
    <div
      className={`${glass} flex h-72 w-[19rem] flex-col overflow-hidden rounded-2xl shadow-xl ${className}`}
    >
      {/* Pestañas Emoji / Stickers */}
      <div className="flex items-center gap-1 border-b border-black/10 p-2 dark:border-white/10">
        <button
          onClick={() => setMode('emoji')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition-colors ${
            mode === 'emoji'
              ? 'bg-black/10 dark:bg-white/15'
              : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          <Smile className="h-4 w-4" /> Emojis
        </button>
        <button
          onClick={() => setMode('sticker')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-semibold transition-colors ${
            mode === 'sticker'
              ? 'bg-black/10 dark:bg-white/15'
              : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          <Sticker className="h-4 w-4" /> Stickers
        </button>
      </div>

      {mode === 'emoji' ? (
        <>
          {/* Buscador */}
          <div className="p-2">
            <div className="flex items-center gap-2 rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10">
              <Search className="h-3.5 w-3.5 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar emoji…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Resultados de búsqueda o categoría activa */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {query.trim() ? (
              searchResults.length > 0 ? (
                <EmojiGrid emojis={searchResults} onPick={handleEmoji} />
              ) : (
                <p className="py-6 text-center text-xs text-gray-500">
                  Sin resultados para “{query}”
                </p>
              )
            ) : (
              <>
                {recents.length > 0 && (
                  <>
                    <CategoryLabel icon={<Clock className="h-3 w-3" />} text="Recientes" />
                    <EmojiGrid emojis={recents} onPick={handleEmoji} />
                  </>
                )}
                <CategoryLabel text={activeCat.label} />
                <EmojiGrid
                  emojis={activeCat.emojis.map((x) => x.e)}
                  onPick={handleEmoji}
                />
              </>
            )}
          </div>

          {/* Tabs de categoría (glifos) */}
          {!query.trim() && (
            <div className="flex items-center gap-0.5 overflow-x-auto border-t border-black/10 p-1.5 dark:border-white/10">
              {EMOJI_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatId(c.id)}
                  title={c.label}
                  aria-label={c.label}
                  className={`shrink-0 rounded-lg p-1.5 text-lg leading-none transition-colors ${
                    c.id === catId
                      ? 'bg-black/10 dark:bg-white/15'
                      : 'hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {c.glyph}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Stickers ilustrados + pack de emoji activo */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <CategoryLabel text="Ilustrados" />
            <div className="mb-2 grid grid-cols-3 gap-2">
              {IMAGE_STICKERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPickSticker(stickerToken(s.id))}
                  className="aspect-square rounded-2xl p-1 transition-transform hover:scale-105 hover:bg-black/5 dark:hover:bg-white/10"
                  title={`Enviar sticker: ${s.label}`}
                  aria-label={`Sticker ${s.label}`}
                >
                  {s.node}
                </button>
              ))}
            </div>
            <CategoryLabel text="Emoji" />
            <div className="grid grid-cols-3 gap-2">
              {activePack.stickers.map((s, i) => (
                <button
                  key={`${s}-${i}`}
                  onClick={() => onPickSticker(s)}
                  className="flex aspect-square items-center justify-center rounded-2xl bg-black/5 text-2xl transition-transform hover:scale-105 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                  title="Enviar sticker"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs de pack */}
          <div className="flex items-center gap-0.5 overflow-x-auto border-t border-black/10 p-1.5 dark:border-white/10">
            {STICKER_PACKS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPackId(p.id)}
                title={p.label}
                aria-label={p.label}
                className={`shrink-0 rounded-lg p-1.5 text-lg leading-none transition-colors ${
                  p.id === packId
                    ? 'bg-black/10 dark:bg-white/15'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {p.glyph}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryLabel({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <p className="sticky top-0 flex items-center gap-1 bg-transparent px-1 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {icon}
      {text}
    </p>
  );
}

function EmojiGrid({
  emojis,
  onPick,
}: {
  emojis: string[];
  onPick: (e: string) => void;
}) {
  return (
    <div className="mb-1 grid grid-cols-8 gap-0.5">
      {emojis.map((e, i) => (
        <button
          key={`${e}-${i}`}
          onClick={() => onPick(e)}
          className="rounded-lg p-1 text-xl leading-none transition-transform hover:scale-125 hover:bg-black/5 dark:hover:bg-white/10"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
