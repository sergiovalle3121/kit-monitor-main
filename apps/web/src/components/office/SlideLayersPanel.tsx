'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  Lock,
  Search,
  Unlock,
  X,
} from 'lucide-react';
import {
  buildSlideLayerPanelModel,
  type SlideLayerItem,
  type SlideLayerStatusFilter,
} from './slides/layers';

export type LayerItem = SlideLayerItem;

/** Panel de seleccion (capas): orden Z, visibilidad, bloqueo y filtro por objeto. */
export function SlideLayersPanel({
  items,
  activeIdx,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onForward,
  onBackward,
  onFront,
  onBack,
  onReorder,
  onClose,
}: {
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
  const [status, setStatus] = useState<SlideLayerStatusFilter>('all');
  const [type, setType] = useState('all');
  const model = useMemo(() => buildSlideLayerPanelModel(items, { query, status, type }), [items, query, status, type]);
  const { filtered, summary } = model;
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setType('all');
  };
  const showHidden = () => items.filter((item) => !item.visible).forEach((item) => onToggleVisible(item.idx));
  const unlockAll = () => items.filter((item) => item.locked).forEach((item) => onToggleLock(item.idx));

  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-11 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <div className="min-w-0">
          <span className="font-semibold text-sm">Panel de seleccion</span>
          <p className="truncate text-[10px] text-gray-400">{summary.total} objeto(s) · {summary.hidden} oculto(s) · {summary.locked} bloqueado(s)</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-shrink-0 border-b border-black/5 dark:border-white/10 p-2 space-y-2">
        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-semibold">
          <Badge label="Visible" value={summary.visible} tone={summary.hidden ? 'neutral' : 'green'} />
          <Badge label="Ocultos" value={summary.hidden} tone={summary.hidden ? 'amber' : 'green'} />
          <Badge label="Bloq." value={summary.locked} tone={summary.locked ? 'amber' : 'green'} />
        </div>
        <label className="flex h-8 items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-2 text-xs dark:border-white/10 dark:bg-white/[0.05]">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar capa, tipo o Z..." className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {(['all', 'hidden', 'locked'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`h-7 rounded-lg px-2 text-[11px] font-semibold ${
                status === value
                  ? 'bg-blue-500 text-white'
                  : 'bg-black/[0.04] text-gray-500 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]'
              }`}
            >
              {value === 'all' ? 'Todo' : value === 'hidden' ? 'Ocultos' : 'Bloqueados'}
            </button>
          ))}
          {summary.types.length > 1 && (
            <label className="ml-auto flex h-7 items-center gap-1 rounded-lg bg-black/[0.04] px-1.5 text-[11px] text-gray-500 dark:bg-white/[0.06]">
              <Filter className="h-3 w-3" />
              <select value={type} onChange={(event) => setType(event.target.value)} className="max-w-[105px] bg-transparent text-[11px] font-semibold outline-none">
                <option value="all">Tipos</option>
                {summary.types.map((option) => <option key={option.type} value={option.type}>{option.type} ({option.count})</option>)}
              </select>
            </label>
          )}
        </div>
        {(summary.hidden > 0 || summary.locked > 0) && (
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={showHidden} disabled={summary.hidden === 0} className="h-7 rounded-lg border border-black/10 px-2 text-[11px] font-semibold text-gray-600 hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10">Mostrar ocultos</button>
            <button onClick={unlockAll} disabled={summary.locked === 0} className="h-7 rounded-lg border border-black/10 px-2 text-[11px] font-semibold text-gray-600 hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10">Desbloquear</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!items.length && <p className="text-xs text-gray-400 px-2 py-4 text-center">Diapositiva vacia.</p>}
        {items.length > 0 && !filtered.length && (
          <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 p-4 text-center">
            <AlertTriangle className="mx-auto mb-2 h-4 w-4 text-amber-500" />
            <p className="text-xs font-semibold text-gray-500">Sin capas para este filtro.</p>
            {model.hasFilters && <button onClick={clearFilters} className="mt-2 text-[11px] font-semibold text-blue-500 hover:underline">Limpiar filtros</button>}
          </div>
        )}
        {filtered.map((item) => (
          <div
            key={item.idx}
            draggable
            onDragStart={(event) => {
              setDrag(item.idx);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (over !== item.idx) setOver(item.idx);
            }}
            onDragLeave={() => {
              if (over === item.idx) setOver(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (drag !== null && drag !== item.idx) onReorder(drag, item.idx);
              setDrag(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onClick={() => onSelect(item.idx)}
            className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 cursor-pointer transition-colors ${
              item.idx === activeIdx ? 'bg-blue-500/10 ring-1 ring-blue-500/40' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
            } ${over === item.idx && drag !== item.idx ? 'ring-2 ring-amber-500/60' : ''} ${drag === item.idx ? 'opacity-40' : ''}`}
          >
            <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
            <button onClick={(event) => { event.stopPropagation(); onToggleVisible(item.idx); }} title={item.visible ? 'Ocultar' : 'Mostrar'} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0">
              {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
            </button>
            <div className={`min-w-0 flex-1 ${item.visible ? '' : 'opacity-40'}`}>
              <span className="block truncate text-xs font-medium">{item.label}</span>
              <span className="block truncate text-[10px] text-gray-400">Z {item.idx + 1} · {item.type}</span>
            </div>
            <button onClick={(event) => { event.stopPropagation(); onToggleLock(item.idx); }} title={item.locked ? 'Desbloquear' : 'Bloquear'} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0">
              {item.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />}
            </button>
            <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
              <button onClick={(event) => { event.stopPropagation(); onFront(item.idx); }} title="Traer al frente" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronsUp className="w-3.5 h-3.5" /></button>
              <button onClick={(event) => { event.stopPropagation(); onForward(item.idx); }} title="Traer adelante" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={(event) => { event.stopPropagation(); onBackward(item.idx); }} title="Enviar atras" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronDown className="w-3.5 h-3.5" /></button>
              <button onClick={(event) => { event.stopPropagation(); onBack(item.idx); }} title="Enviar al fondo" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronsDown className="w-3.5 h-3.5" /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ label, value, tone }: { label: string; value: number; tone?: 'neutral' | 'green' | 'amber' }) {
  const cls = tone === 'amber'
    ? 'border-amber-300/50 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : tone === 'green'
      ? 'border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'border-black/10 bg-black/[0.03] text-gray-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-400';
  return <span className={`rounded-lg border px-1.5 py-1 ${cls}`}><b>{value}</b> {label}</span>;
}
