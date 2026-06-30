'use client';

import React from 'react';
import { CalendarRange, Eraser, Filter, X } from 'lucide-react';
import {
  AXOS_TIMELINE_PRESETS,
  summarizeSlicerSelection,
  timelinePresetRange,
  type AxosTimelinePreset,
  type Slicer,
  type Timeline,
} from './slicer';

const ACCENT = '#217346'; // Sheets green

interface Props {
  slicers: Slicer[];
  timelines: Timeline[];
  valuesOf: (s: Slicer) => string[];
  onToggle: (id: string, value: string) => void;
  onClearSlicer: (id: string) => void;
  onRemoveSlicer: (id: string) => void;
  onTimeline: (id: string, from: string, to: string) => void;
  onRemoveTimeline: (id: string) => void;
  onClose: () => void;
}

const isOn = (s: Slicer, v: string) => s.selected == null || s.selected.includes(v);

/** Floating panel for slicers and timeline filters. */
export function SheetSlicer({ slicers, timelines, valuesOf, onToggle, onClearSlicer, onRemoveSlicer, onTimeline, onRemoveTimeline, onClose }: Props) {
  if (!slicers.length && !timelines.length) return null;

  const applyTimelinePreset = (id: string, preset: AxosTimelinePreset) => {
    const range = timelinePresetRange(preset);
    onTimeline(id, range.from, range.to);
  };

  return (
    <div
      className="fixed right-3 top-28 z-[60] w-72 max-h-[70vh] overflow-auto rounded-2xl border border-black/10 bg-white/95 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-[#1a1a1a]/95"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-black/5 px-3 py-2 dark:border-white/10">
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: ACCENT }}>
          <Filter className="w-4 h-4" /> Segmentaciones
        </span>
        <button onClick={onClose} title="Cerrar" className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 p-2">
        {slicers.map((s) => {
          const vals = valuesOf(s);
          const summary = summarizeSlicerSelection(s, vals);
          return (
            <div key={s.id} className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
              <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
                <span className="truncate">{s.header || 'Columna'}</span>
                <span className="flex items-center gap-1">
                  <button onClick={() => onClearSlicer(s.id)} title="Mostrar todos" className="rounded p-0.5 hover:bg-white/20">
                    <Eraser className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onRemoveSlicer(s.id)} title="Quitar segmentacion" className="rounded p-0.5 hover:bg-white/20">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-b border-black/5 px-2 py-1 text-[10px] text-gray-500 dark:border-white/10">
                <span className={summary.active ? 'font-semibold text-emerald-700 dark:text-emerald-200' : ''}>{summary.label}</span>
                <button onClick={() => onClearSlicer(s.id)} className="rounded-md px-1.5 py-0.5 font-semibold hover:bg-black/5 dark:hover:bg-white/10">
                  Todos
                </button>
              </div>
              <div className="flex flex-wrap gap-1 p-1.5">
                {vals.length === 0 && <span className="px-1 py-0.5 text-[11px] text-gray-500 dark:text-gray-400">Sin valores</span>}
                {vals.map((v) => {
                  const on = isOn(s, v);
                  return (
                    <button
                      key={v}
                      onClick={() => onToggle(s.id, v)}
                      title={v}
                      className={`max-w-[7.5rem] truncate rounded-lg border px-2 py-1 text-[11px] transition ${on ? 'border-transparent text-white' : 'border-black/10 text-gray-600 hover:bg-black/5 dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10'}`}
                      style={on ? { background: ACCENT } : undefined}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {timelines.map((t) => (
          <div key={t.id} className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
              <span className="flex truncate items-center gap-1">
                <CalendarRange className="w-3.5 h-3.5" /> {t.header || 'Fecha'}
              </span>
              <button onClick={() => onRemoveTimeline(t.id)} title="Quitar escala de tiempo" className="rounded p-0.5 hover:bg-white/20">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 border-b border-black/5 p-2 text-[10px] dark:border-white/10">
              {AXOS_TIMELINE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyTimelinePreset(t.id, preset.id)}
                  title={preset.description}
                  className="rounded-lg border border-black/10 px-1.5 py-1 font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  {preset.label}
                </button>
              ))}
              <button onClick={() => onTimeline(t.id, '', '')} className="rounded-lg border border-black/10 px-1.5 py-1 font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
                Limpiar
              </button>
            </div>
            <div className="flex items-center gap-1.5 p-2 text-[11px]">
              <input
                type="date"
                value={t.from ?? ''}
                onChange={(e) => onTimeline(t.id, e.target.value, t.to ?? '')}
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-1.5 py-1 dark:border-white/15"
              />
              <span className="text-gray-500 dark:text-gray-400">to</span>
              <input
                type="date"
                value={t.to ?? ''}
                onChange={(e) => onTimeline(t.id, t.from ?? '', e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-1.5 py-1 dark:border-white/15"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
