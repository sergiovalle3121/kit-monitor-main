'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Database,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  Lock,
  MessageSquare,
  Search,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import {
  analyzeSlideLayers,
  filterSlideLayerInsights,
  type SlideLayerIssueFilter,
  type SlideLayerItem,
} from './slides/layerHealth';

export type LayerItem = SlideLayerItem;

const ISSUE_FILTERS: { id: SlideLayerIssueFilter; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: 'review', label: 'Revision' },
  { id: 'offCanvas', label: 'Fuera' },
  { id: 'hidden', label: 'Ocultos' },
  { id: 'locked', label: 'Lock' },
  { id: 'animated', label: 'Anim' },
  { id: 'commented', label: 'Comms' },
  { id: 'linked', label: 'Links' },
  { id: 'smartObject', label: 'AXOS' },
];

/** Selection pane: z-order, visibility, locking, filtering and object health. */
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [issueFilter, setIssueFilter] = useState<SlideLayerIssueFilter>('all');
  const analysis = useMemo(() => analyzeSlideLayers(items), [items]);
  const filtered = useMemo(
    () => filterSlideLayerInsights(analysis.items, { query, type: typeFilter, issue: issueFilter }).reverse(),
    [analysis.items, issueFilter, query, typeFilter],
  );
  const activeFilters = !!query.trim() || typeFilter !== 'all' || issueFilter !== 'all';

  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-11 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <span className="font-semibold text-sm">Panel de seleccion</span>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-shrink-0 border-b border-black/5 dark:border-white/10 p-2 space-y-2">
        <div className="grid grid-cols-4 gap-1 text-[10px] font-semibold">
          <Metric label="Obj" value={analysis.summary.total} />
          <Metric label="Vis" value={analysis.summary.visible} />
          <Metric label="Review" value={analysis.summary.needsReview} tone={analysis.summary.needsReview ? 'amber' : 'green'} />
          <Metric label="Fuera" value={analysis.summary.offCanvas} tone={analysis.summary.offCanvas ? 'rose' : 'green'} />
        </div>

        <label className="flex h-8 items-center gap-2 rounded-lg border border-black/10 bg-black/[0.03] px-2 text-xs dark:border-white/10 dark:bg-white/[0.05]">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar capas..." className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>

        <div className="flex items-center gap-1.5">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-black/10 bg-black/[0.03] px-2 text-xs outline-none dark:border-white/10 dark:bg-white/[0.05]">
            <option value="all">Todos los tipos</option>
            {analysis.summary.types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
          {activeFilters && (
            <button type="button" onClick={() => { setQuery(''); setTypeFilter('all'); setIssueFilter('all'); }} className="h-8 rounded-lg px-2 text-[11px] font-semibold text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
              Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1">
          {ISSUE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setIssueFilter(filter.id)}
              className={`h-7 rounded-lg text-[10px] font-semibold ${issueFilter === filter.id ? 'bg-blue-500 text-white' : 'bg-black/[0.04] text-gray-500 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {analysis.summary.warnings.length > 0 && (
          <div className="space-y-1">
            {analysis.summary.warnings.slice(0, 2).map((warning) => (
              <p key={warning} className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{warning}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!items.length && <p className="text-xs text-gray-400 px-2 py-4 text-center">Diapositiva vacia.</p>}
        {items.length > 0 && !filtered.length && <p className="text-xs text-gray-400 px-2 py-4 text-center">Sin capas para este filtro.</p>}
        {filtered.map((it) => (
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
            <span className="text-[10px] text-gray-400 hidden group-hover:inline flex-shrink-0">{it.type}</span>
            <span className="flex items-center gap-0.5 flex-shrink-0">
              {it.offCanvas && <IssueBadge title="Objeto fuera del slide" tone="rose" icon={<AlertTriangle className="h-3 w-3" />} />}
              {it.commented && <IssueBadge title={`${it.commentCount ?? 0} comentario(s) abiertos`} tone="amber" icon={<MessageSquare className="h-3 w-3" />} />}
              {it.animated && <IssueBadge title="Tiene animacion" tone="blue" icon={<Sparkles className="h-3 w-3" />} />}
              {it.linked && <IssueBadge title="Tiene link" tone="violet" icon={<Link2 className="h-3 w-3" />} />}
              {it.smartObjectPending && <IssueBadge title="Smart Object AXOS pendiente de contrato/refresh" tone="amber" icon={<Database className="h-3 w-3" />} />}
            </span>
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

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'amber' | 'rose' }) {
  const cls = tone === 'rose'
    ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
      : tone === 'green'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'bg-black/[0.04] text-gray-500 dark:bg-white/[0.06]';
  return <span className={`rounded-lg px-1.5 py-1 text-center tabular-nums ${cls}`}>{label}: {value}</span>;
}

function IssueBadge({ title, tone, icon }: { title: string; tone: 'amber' | 'rose' | 'blue' | 'violet'; icon: React.ReactNode }) {
  const cls = tone === 'rose'
    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
    : tone === 'blue'
      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300'
      : tone === 'violet'
        ? 'bg-violet-500/10 text-violet-600 dark:text-violet-300'
        : 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
  return <span title={title} className={`inline-flex h-5 w-5 items-center justify-center rounded-md ${cls}`}>{icon}</span>;
}
