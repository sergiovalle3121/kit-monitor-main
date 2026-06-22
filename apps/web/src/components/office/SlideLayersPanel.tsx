'use client';

import React, { useState } from 'react';
import { X, Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, GripVertical } from 'lucide-react';

export interface LayerItem { idx: number; label: string; type: string; visible: boolean; locked: boolean }

/** Panel de selección (capas): orden Z (botones + arrastrar para reordenar),
 *  visibilidad y bloqueo por objeto. */
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
  // El frente (último en z) se muestra arriba.
  const ordered = [...items].reverse();
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <div className="w-72 flex-shrink-0 flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-11 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <span className="font-semibold text-sm">Panel de selección</span>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!items.length && <p className="text-xs text-gray-400 px-2 py-4 text-center">Diapositiva vacía.</p>}
        {ordered.map((it) => (
          <div key={it.idx}
            draggable
            onDragStart={(e) => { setDrag(it.idx); e.dataTransfer.effectAllowed = 'move'; }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== it.idx) setOver(it.idx); }}
            onDragLeave={() => { if (over === it.idx) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== it.idx) onReorder(drag, it.idx); setDrag(null); setOver(null); }}
            onDragEnd={() => { setDrag(null); setOver(null); }}
            onClick={() => onSelect(it.idx)}
            className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 cursor-pointer transition-colors ${it.idx === activeIdx ? 'bg-blue-500/10 ring-1 ring-blue-500/40' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'} ${over === it.idx && drag !== it.idx ? 'ring-2 ring-amber-500/60' : ''} ${drag === it.idx ? 'opacity-40' : ''}`}>
            <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
            <button onClick={(e) => { e.stopPropagation(); onToggleVisible(it.idx); }} title={it.visible ? 'Ocultar' : 'Mostrar'} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0">
              {it.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
            </button>
            <span className={`flex-1 min-w-0 truncate text-xs ${it.visible ? '' : 'opacity-40'}`}>{it.label}</span>
            <span className="text-[10px] text-gray-400 hidden group-hover:inline flex-shrink-0">{it.type}</span>
            <button onClick={(e) => { e.stopPropagation(); onToggleLock(it.idx); }} title={it.locked ? 'Desbloquear' : 'Bloquear'} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex-shrink-0">
              {it.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />}
            </button>
            <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
              <button onClick={(e) => { e.stopPropagation(); onFront(it.idx); }} title="Traer al frente" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronsUp className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onForward(it.idx); }} title="Traer adelante" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onBackward(it.idx); }} title="Enviar atrás" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronDown className="w-3.5 h-3.5" /></button>
              <button onClick={(e) => { e.stopPropagation(); onBack(it.idx); }} title="Enviar al fondo" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronsDown className="w-3.5 h-3.5" /></button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
