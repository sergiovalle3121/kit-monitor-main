'use client';

import React from 'react';
import { Filter, X, CalendarRange, Eraser } from 'lucide-react';
import type { Slicer, Timeline } from './slicer';

const ACCENT = '#217346'; // verde Sheets

interface Props {
  slicers: Slicer[];
  timelines: Timeline[];
  valuesOf: (s: Slicer) => string[];
  onToggle: (id: string, value: string) => void;
  onClearSlicer: (id: string) => void;   // selected = null (todos)
  onRemoveSlicer: (id: string) => void;
  onTimeline: (id: string, from: string, to: string) => void;
  onRemoveTimeline: (id: string) => void;
  onClose: () => void;
}

/** ¿El valor está activo en el slicer? (`selected == null` = todos). */
const isOn = (s: Slicer, v: string) => s.selected == null || s.selected.includes(v);

/** Panel flotante de segmentaciones (slicers) y escalas de tiempo. */
export function SheetSlicer({ slicers, timelines, valuesOf, onToggle, onClearSlicer, onRemoveSlicer, onTimeline, onRemoveTimeline, onClose }: Props) {
  if (!slicers.length && !timelines.length) return null;
  return (
    <div className="fixed right-3 top-28 z-[60] w-72 max-h-[70vh] overflow-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur shadow-2xl"
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-black/5 dark:border-white/10">
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: ACCENT }}><Filter className="w-4 h-4" /> Segmentaciones</span>
        <button onClick={onClose} title="Cerrar" className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-2 space-y-2">
        {slicers.map((s) => {
          const vals = valuesOf(s);
          return (
            <div key={s.id} className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
              <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
                <span className="truncate">{s.header || 'Columna'}</span>
                <span className="flex items-center gap-1">
                  <button onClick={() => onClearSlicer(s.id)} title="Mostrar todos" className="p-0.5 rounded hover:bg-white/20"><Eraser className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onRemoveSlicer(s.id)} title="Quitar segmentación" className="p-0.5 rounded hover:bg-white/20"><X className="w-3.5 h-3.5" /></button>
                </span>
              </div>
              <div className="p-1.5 flex flex-wrap gap-1">
                {vals.length === 0 && <span className="text-[11px] text-gray-400 px-1 py-0.5">Sin valores</span>}
                {vals.map((v) => {
                  const on = isOn(s, v);
                  return (
                    <button key={v} onClick={() => onToggle(s.id, v)} title={v}
                      className={`text-[11px] max-w-[7.5rem] truncate px-2 py-1 rounded-lg border transition ${on ? 'text-white border-transparent' : 'text-gray-600 dark:text-gray-300 border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10'}`}
                      style={on ? { background: ACCENT } : undefined}>
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {timelines.map((t) => (
          <div key={t.id} className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
              <span className="flex items-center gap-1 truncate"><CalendarRange className="w-3.5 h-3.5" /> {t.header || 'Fecha'}</span>
              <button onClick={() => onRemoveTimeline(t.id)} title="Quitar escala de tiempo" className="p-0.5 rounded hover:bg-white/20"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="p-2 flex items-center gap-1.5 text-[11px]">
              <input type="date" value={t.from ?? ''} onChange={(e) => onTimeline(t.id, e.target.value, t.to ?? '')}
                className="flex-1 min-w-0 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-1.5 py-1" />
              <span className="text-gray-400">→</span>
              <input type="date" value={t.to ?? ''} onChange={(e) => onTimeline(t.id, t.from ?? '', e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-1.5 py-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
