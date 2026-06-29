'use client';

import React, { useMemo, useState } from 'react';
import { X, Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, GripVertical, Search } from 'lucide-react';
import {
  LAYER_FILTERS,
  filterLayerPanelItems,
  layerFilterSummary,
  layerPanelStats,
  type LayerFilterMode,
  type LayerPanelItem,
} from './slides/layerPanel';

export type LayerItem = LayerPanelItem;

/** Panel de seleccion (capas): orden Z, busqueda, filtros, visibilidad y bloqueo por objeto. */
export function SlideLayersPanel({ items, activeIdx, onSelect, onToggleVisible, onToggleLock, onForward, onBackward, onFront, onBack, onReorder, onClose }: {
  items: LayerItem[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onToggleVisible: (idx: number) => void;
  onToggleLock: (idx: number) => void;
  onForward: (idx: number) => void;
  onBackward: (idx: number) => void;
  onFront: (idx: number) => void;
  onBack: (idx: number) => void;
  onReorder: (from: number, to: number) => void;
  onClose: () => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<LayerFilterMode>('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const stats = useMemo(() => layerPanelStats(items), [items]);
  const filtered = useMemo(
    () => filterLayerPanelItems(items, { query, mode, type: typeFilter }),
    [items, mode, query, typeFilter],
  );
  // El frente (ultimo en z) se muestra arriba.
  const ordered = useMemo(() => [...filtered].reverse(), [filtered]);

  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-11 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <div className="min-w-0">
          <span className="font-semibold text-sm">Panel de seleccion</span>
          <p className="text-[10px] text-gray-400 truncate">{layerFilterSummary(stats)}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500" title="Cerrar"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-2 border-b border-black/5 dark:border-white/10 space-y-2 flex-shrink-0">
        <label className="flex h-8 items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-2">
          <Search className="h-3.5 w-3.5 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar objeto o tipo"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>

        <div className="grid grid-cols-5 gap-1">
          {LAYER_FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setMode(filter.id)}
              className={`h-7 rounded-lg px-1 text-[10px] font-semibold transition-colors ${mode === filter.id ? 'bg-blue-500 text-white' : 'bg-black/[0.04] text-gray-500 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="rounded-lg bg-black/[0.035] dark:bg-white/[0.05] px-2 py-1">
            <p className="font-bold tabular-nums">{stats.visible}</p>
            <p className="text-gray-400">visible</p>
          </div>
          <div className="rounded-lg bg-black/[0.035] dark:bg-white/[0.05] px-2 py-1">
            <p className="font-bold tabular-nums">{stats.hidden}</p>
            <p className="text-gray-400">oculto</p>
          </div>
          <div className="rounded-lg bg-black/[0.035] dark:bg-white/[0.05] px-2 py-1">
            <p className="font-bold tabular-nums">{stats.locked}</p>
            <p className="text-gray-400">lock</p>
          </div>
        </div>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-8 w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/30 px-2 text-xs outline-none focus:ring-2 ring-blue-500/30"
        >
          <option value="all">Todos los tipos</option>
          {stats.types.map((entry) => (
            <option key={entry.type} value={entry.type}>{entry.type} ({entry.count})</option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!items.length && <p className="text-xs text-gray-400 px-2 py-4 text-center">Diapositiva vacia.</p>}
        {!!items.length && !ordered.length && (
          <p className="text-xs text-gray-400 px-2 py-4 text-center">Sin objetos para este filtro.</p>
        )}
        {ordered.map((it) => (
          <div
            key={it.idx}
            draggable
            onDragStart={(e) => { setDrag(it.idx); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== it.idx) setOver(it.idx); }}
            onDragLeave={() => { if (over === it.idx) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== it.idx) onReorder(drag, it.idx); setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            onClick={() => onSelect(it.idx)}
            className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 cursor-pointer transition-colors ${it.idx === activeIdx ? 'bg-blue-500/10 ring-1 ring-blue-500/40' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'} ${over === it.idx && drag !== it.idx ? 'ring-2 ring-amber-500/60' : ''} ${drag === it.idx ? 'opacity-40' : ''}`}
          >
            <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
            <button onClick={(e) => { e.stopPropagation(); onToggleVisible(it.idx); }} title={it.visible ? 'Ocultar' : 'Mostrar'} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0">
              {it.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
            </button>
            <span className={`flex-1 min-w-0 truncate text-xs ${it.visible ? '' : 'opacity-40'}`}>{it.label}</span>
            <span className="max-w-[72px] truncate rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-gray-400 flex-shrink-0">{it.type}</span>
            <button onClick={(e) => { e.stopPropagation(); onToggleLock(it.idx); }} title={it.locked ? 'Desbloquear' : 'Bloquear'} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0">
              {it.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />}
            </button>
            <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
              <button onClick={(e) => { e.stopPropagation(); onFront(it.idx); }} title="Traer al frente" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronsUp className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onForward(it.idx); }} title="Traer adelante" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onBackward(it.idx); }} title="Enviar atras" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronDown className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onBack(it.idx); }} title="Enviar al fondo" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronsDown className="w-3.5 h-3.5" /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
