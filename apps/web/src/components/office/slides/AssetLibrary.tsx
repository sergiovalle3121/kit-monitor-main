'use client';

import React, { useMemo, useState } from 'react';
import { Clock3, Factory, Search, Star } from 'lucide-react';
import {
  CATEGORY_LABEL,
  INDUSTRIAL_ASSETS,
  SLIDE_ASSET_CATEGORIES,
  assetCatalogStats,
  filterSlideAssets,
  type SlideAssetCategory,
  type SlideAssetFilterMode,
  type SlideAssetSymbol,
} from './assetCatalog';

export type { SlideAssetCategory, SlideAssetSymbol } from './assetCatalog';

const FAVORITES_KEY = 'axos.slides.assetLibrary.favorites';
const RECENT_KEY = 'axos.slides.assetLibrary.recent';

function readStoredIds(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(ids.slice(0, 24)));
  } catch {
    // LocalStorage is opportunistic; insertion still works without it.
  }
}

const MODE_ITEMS: { id: SlideAssetFilterMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'Todos', icon: Factory },
  { id: 'favorites', label: 'Favoritos', icon: Star },
  { id: 'recent', label: 'Recientes', icon: Clock3 },
];

export function SlideAssetLibrary({ onPick }: { onPick: (asset: SlideAssetSymbol) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SlideAssetCategory | 'all'>('all');
  const [mode, setMode] = useState<SlideAssetFilterMode>('all');
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(readStoredIds(FAVORITES_KEY)));
  const [recent, setRecent] = useState<string[]>(() => readStoredIds(RECENT_KEY));

  const stats = useMemo(() => assetCatalogStats(INDUSTRIAL_ASSETS), []);
  const filtered = useMemo(() => filterSlideAssets(INDUSTRIAL_ASSETS, {
    category,
    query,
    mode,
    favoriteIds: favorites,
    recentIds: recent,
  }), [category, favorites, mode, query, recent]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeStoredIds(FAVORITES_KEY, [...next]);
      return next;
    });
  }

  function pick(asset: SlideAssetSymbol) {
    setRecent((prev) => {
      const next = [asset.id, ...prev.filter((id) => id !== asset.id)].slice(0, 16);
      writeStoredIds(RECENT_KEY, next);
      return next;
    });
    onPick(asset);
  }

  return (
    <div className="w-[360px] p-3 space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-2.5 h-9">
        <Search className="w-4 h-4 text-gray-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar asset industrial..." className="flex-1 bg-transparent outline-none text-sm" />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MODE_ITEMS.map((item) => {
          const Icon = item.icon;
          const disabled = (item.id === 'favorites' && favorites.size === 0) || (item.id === 'recent' && recent.length === 0);
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => setMode(item.id)}
              className={`h-8 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 border disabled:opacity-40 disabled:cursor-not-allowed ${mode === item.id ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/10 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${category === 'all' ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/10 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}
        >
          Todo
        </button>
        {SLIDE_ASSET_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${category === c.id ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/10 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        <span>{filtered.length} / {stats.total} assets</span>
        <span>{category === 'all' ? 'Industrial library' : CATEGORY_LABEL[category]}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[330px] overflow-y-auto pr-1">
        {filtered.map((asset) => {
          const favored = favorites.has(asset.id);
          return (
            <div key={asset.id} className="relative rounded-xl border border-black/10 dark:border-white/10 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-colors">
              <button type="button" onClick={() => pick(asset)} className="w-full text-left p-2 pr-8">
                <span className="flex items-center gap-2">
                  <span className="w-11 h-11 rounded-lg bg-white dark:bg-black/20 border border-black/5 dark:border-white/10 p-1.5 flex-shrink-0" dangerouslySetInnerHTML={{ __html: asset.svg }} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground truncate">{asset.label}</span>
                    <span className="block text-[10px] text-gray-400 truncate">{CATEGORY_LABEL[asset.category]}</span>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 truncate">{asset.description}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                title={favored ? 'Quitar favorito' : 'Marcar favorito'}
                onClick={() => toggleFavorite(asset.id)}
                className={`absolute right-1.5 top-1.5 p-1 rounded-md ${favored ? 'text-amber-500 bg-amber-500/10' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-500/10'}`}
              >
                <Star className="w-3.5 h-3.5" fill={favored ? 'currentColor' : 'none'} />
              </button>
            </div>
          );
        })}
        {!filtered.length && (
          <div className="col-span-2 py-8 text-center text-xs text-gray-400 rounded-xl border border-dashed border-black/10 dark:border-white/10">
            Sin assets para este filtro.
          </div>
        )}
      </div>
    </div>
  );
}
