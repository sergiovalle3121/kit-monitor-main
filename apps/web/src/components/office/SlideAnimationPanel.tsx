'use client';

import React from 'react';
import { X, Clock, Hash, MousePointerClick, PlayCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { OBJ_ANIM_OPTIONS, OBJ_ANIM_START, ANIM_KIND_LABEL, type AnimKind } from './slideAssets';

export interface AnimItem { idx: number; label: string; type: string; anim: string; order: number; dur: number; delay: number; start: string; repeat: number; kind: AnimKind }

const KIND_BADGE: Record<AnimKind, string> = {
  entrance: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  emphasis: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  exit: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  motion: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  none: 'bg-black/10 dark:bg-white/10 text-gray-400',
};

const repeatLabel = (repeat?: number) => !repeat ? '∞' : `${repeat}×`;
const timelineWidth = (dur: number, delay: number, repeat: number) => Math.min(100, Math.max(10, ((delay + dur * (repeat || 1)) / 3600) * 100));

/** Panel/línea de tiempo de animación de la diapositiva actual. */
export function SlideAnimationPanel({ items, activeIdx, onChange, onSelect, onPreview, onClose }: {
  items: AnimItem[];
  activeIdx: number;
  onChange: (idx: number, key: 'anim' | 'animOrder' | 'animDur' | 'animDelay' | 'animStart' | 'animRepeat', value: number | string) => void;
  onSelect: (idx: number) => void;
  onPreview: () => void;
  onClose: () => void;
}) {
  const sorted = [...items].sort((a, b) => (a.anim === 'none' ? 1 : 0) - (b.anim === 'none' ? 1 : 0) || a.order - b.order || a.idx - b.idx);
  const hasAnimated = items.some((it) => it.anim && it.anim !== 'none');
  return (
    <div className="w-72 flex-shrink-0 flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-11 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <span className="font-semibold text-sm">Animación</span>
        <div className="flex items-center gap-1">
          <button onClick={onPreview} disabled={!hasAnimated} title="Vista previa: reproduce las animaciones de esta diapositiva" className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"><PlayCircle className="w-3.5 h-3.5" /> Vista previa</button>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {!items.length && <p className="text-xs text-gray-400 px-2 py-4 text-center">No hay objetos en esta diapositiva.</p>}
        {sorted.map((it) => {
          const animated = it.anim && it.anim !== 'none';
          return (
            <div key={it.idx} onClick={() => onSelect(it.idx)}
              className={`rounded-xl border p-2 cursor-pointer transition-colors ${it.idx === activeIdx ? 'border-blue-500 bg-blue-500/5' : 'border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${animated ? 'bg-blue-500 text-white' : 'bg-black/10 dark:bg-white/10 text-gray-400'}`}>{animated ? it.order : '–'}</span>
                <span className="text-xs font-medium truncate flex-1">{it.label}</span>
                {animated && <span className="text-[9px] font-bold text-gray-400" title="Repetición">{repeatLabel(it.repeat)}</span>}
                {animated ? <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${KIND_BADGE[it.kind]}`}>{ANIM_KIND_LABEL[it.kind]}</span> : <span className="text-[10px] text-gray-400">{it.type}</span>}
              </div>
              <select value={it.anim} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(it.idx, 'anim', e.target.value)}
                className="w-full h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 outline-none border border-transparent focus:border-blue-500/40 mb-1.5">
                {OBJ_ANIM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {animated && (
                <>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1.5" title="Inicio de la animación" onClick={(e) => e.stopPropagation()}>
                  <MousePointerClick className="w-3 h-3 flex-shrink-0" />
                  <select value={it.start} onChange={(e) => onChange(it.idx, 'animStart', e.target.value)}
                    className="flex-1 h-6 text-[11px] rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none">
                    {OBJ_ANIM_START.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <div className="mb-1.5 h-2 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden" title={`Timeline: retraso ${it.delay}ms · duración ${it.dur}ms · repetición ${repeatLabel(it.repeat)}`}>
                  <div className="h-full rounded-full bg-blue-500/70" style={{ marginLeft: `${Math.min(70, Math.max(0, (it.delay / 3000) * 100))}%`, width: `${timelineWidth(it.dur, it.delay, it.repeat)}%` }} />
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 flex-1" title="Orden">
                    <Hash className="w-3 h-3" />
                    <input type="number" min={0} value={it.order} onChange={(e) => onChange(it.idx, 'animOrder', Number(e.target.value))}
                      className="w-full h-6 text-xs rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none" />
                  </label>
                  <span className="flex flex-col -my-0.5">
                    <button onClick={() => onChange(it.idx, 'animOrder', it.order + 1)} title="Reproducir más tarde" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => onChange(it.idx, 'animOrder', Math.max(0, it.order - 1))} title="Reproducir antes" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronDown className="w-3 h-3" /></button>
                  </span>
                  <select value={String(it.dur)} onChange={(e) => onChange(it.idx, 'animDur', Number(e.target.value))} title="Duración"
                    className="h-6 text-[11px] rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none">
                    <option value="300">Rápida</option><option value="500">Normal</option><option value="900">Lenta</option>
                  </select>
                  <label className="flex items-center gap-1 text-[10px] text-gray-500" title="Retraso (ms)">
                    <Clock className="w-3 h-3" />
                    <input type="number" min={0} step={100} value={it.delay} onChange={(e) => onChange(it.idx, 'animDelay', Number(e.target.value))}
                      className="w-12 h-6 text-xs rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none" />
                  </label>
                  <select value={String(it.repeat)} onChange={(e) => onChange(it.idx, 'animRepeat', Number(e.target.value))} title="Repetir"
                    className="h-6 text-[11px] rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none">
                    <option value="1">1×</option><option value="2">2×</option><option value="3">3×</option><option value="0">∞</option>
                  </select>
                </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
