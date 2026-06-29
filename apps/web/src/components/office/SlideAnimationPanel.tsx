'use client';

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Eraser,
  Hash,
  MousePointerClick,
  PlayCircle,
  Timer,
  Wand2,
  X,
} from 'lucide-react';
import { ANIM_KIND_LABEL, OBJ_ANIM_OPTIONS, OBJ_ANIM_START, type AnimKind } from './slideAssets';
import {
  buildAnimationPresetChanges,
  buildClearAnimationChanges,
  buildSlideAnimationTimeline,
  formatAnimationTime,
  type AnimationChange,
  type AnimationChangeKey,
  type SlideAnimationTimelineEntry,
  type SlideAnimationTimelineItem,
} from './slides/slideAnimationTimeline';

export interface AnimItem extends SlideAnimationTimelineItem {
  idx: number;
  label: string;
  type: string;
  anim: string;
  order: number;
  dur: number;
  delay: number;
  start: string;
  repeat: number;
  kind: AnimKind;
}

const KIND_BADGE: Record<AnimKind, string> = {
  entrance: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  emphasis: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  exit: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  motion: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  none: 'bg-black/10 dark:bg-white/10 text-gray-400',
};

const repeatLabel = (repeat?: number) => !repeat ? 'inf' : `${repeat}x`;

function timelineStyle(entry: SlideAnimationTimelineEntry, scaleMs: number): React.CSSProperties {
  const left = Math.min(88, Math.max(0, (entry.startMs / scaleMs) * 100));
  const width = Math.min(100 - left, Math.max(8, (Math.max(entry.durationMs, 120) / scaleMs) * 100));
  return { left: `${left}%`, width: `${width}%` };
}

function stepLabel(entry: SlideAnimationTimelineEntry): string {
  return entry.step === 0 ? 'Auto' : `Click ${entry.step}`;
}

/** Panel/timeline for the current slide's object animations. */
export function SlideAnimationPanel({ items, activeIdx, onChange, onSelect, onPreview, onClose }: {
  items: AnimItem[];
  activeIdx: number;
  onChange: (idx: number, key: AnimationChangeKey, value: number | string) => void;
  onSelect: (idx: number) => void;
  onPreview: () => void;
  onClose: () => void;
}) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.anim === 'none' ? 1 : 0) - (b.anim === 'none' ? 1 : 0) || a.order - b.order || a.idx - b.idx),
    [items],
  );
  const report = useMemo(() => buildSlideAnimationTimeline(items), [items]);
  const entryByIdx = useMemo(() => new Map(report.entries.map((entry) => [entry.idx, entry])), [report.entries]);
  const hasAnimated = report.animatedCount > 0;
  const scaleMs = Math.max(1000, report.totalDurationMs || 1000);

  function applyChanges(changes: AnimationChange[]) {
    for (const change of changes) onChange(change.idx, change.key, change.value);
  }

  return (
    <div className="w-80 flex-shrink-0 flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#141414] overflow-hidden">
      <div className="flex items-center justify-between px-3 h-11 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <span className="font-semibold text-sm">Animacion</span>
        <div className="flex items-center gap-1">
          <button onClick={onPreview} disabled={!hasAnimated} title="Vista previa: reproduce las animaciones de esta diapositiva" className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"><PlayCircle className="w-3.5 h-3.5" /> Preview</button>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="border-b border-black/5 dark:border-white/10 p-2 space-y-2">
        <div className="grid grid-cols-4 gap-1.5">
          <Metric label="Anim" value={report.animatedCount} tone={report.readiness === 'ready' ? 'green' : report.readiness === 'review' ? 'amber' : undefined} />
          <Metric label="Clicks" value={report.clickStepCount} />
          <Metric label="Auto" value={report.autoEntryCount} />
          <Metric label="Time" value={formatAnimationTime(report.totalDurationMs)} />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button disabled={!items.length} onClick={() => applyChanges(buildAnimationPresetChanges(items, 'sequence'))} className={actionButton} title="Aplica una secuencia automatica a todos los objetos"><Wand2 className="w-3.5 h-3.5" /> Secuencia</button>
          <button disabled={!items.length} onClick={() => applyChanges(buildAnimationPresetChanges(items, 'clickReveal'))} className={actionButton} title="Convierte cada objeto en una revelacion por click"><MousePointerClick className="w-3.5 h-3.5" /> Click</button>
          <button disabled={!hasAnimated} onClick={() => applyChanges(buildClearAnimationChanges(items))} className={actionButton} title="Quita animaciones de esta diapositiva"><Eraser className="w-3.5 h-3.5" /> Limpiar</button>
        </div>
        {report.issues.length > 0 && (
          <div className="space-y-1">
            {report.issues.slice(0, 3).map((issue) => (
              <p key={issue.code} className={`flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-snug ${
                issue.severity === 'warning'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'bg-black/[0.03] text-gray-500 dark:bg-white/[0.05] dark:text-gray-400'
              }`}>
                <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {issue.message}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {!items.length && <p className="text-xs text-gray-400 px-2 py-4 text-center">No hay objetos en esta diapositiva.</p>}
        {sorted.map((it) => {
          const animated = it.anim && it.anim !== 'none';
          const entry = entryByIdx.get(it.idx);
          return (
            <div key={it.idx} onClick={() => onSelect(it.idx)}
              className={`rounded-xl border p-2 cursor-pointer transition-colors ${it.idx === activeIdx ? 'border-blue-500 bg-blue-500/5' : 'border-black/10 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${animated ? 'bg-blue-500 text-white' : 'bg-black/10 dark:bg-white/10 text-gray-400'}`}>{animated ? it.order : '-'}</span>
                <span className="text-xs font-medium truncate flex-1">{it.label}</span>
                {animated && <span className="text-[9px] font-bold text-gray-400" title="Repeticion">{repeatLabel(it.repeat)}</span>}
                {animated ? <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${KIND_BADGE[it.kind]}`}>{ANIM_KIND_LABEL[it.kind]}</span> : <span className="text-[10px] text-gray-400">{it.type}</span>}
              </div>
              <select value={it.anim} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(it.idx, 'anim', e.target.value)}
                className="w-full h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 outline-none border border-transparent focus:border-blue-500/40 mb-1.5">
                {OBJ_ANIM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {animated && (
                <>
                  {entry && (
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] text-gray-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400"><Timer className="h-3 w-3" /> {stepLabel(entry)}</span>
                      <span title={`Inicio ${formatAnimationTime(entry.startMs)}; fin ${formatAnimationTime(entry.endMs)}`}>{formatAnimationTime(entry.startMs)} - {entry.infinite ? 'inf' : formatAnimationTime(entry.endMs)}</span>
                    </div>
                  )}
                  <label className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1.5" title="Inicio de la animacion" onClick={(e) => e.stopPropagation()}>
                    <MousePointerClick className="w-3 h-3 flex-shrink-0" />
                    <select value={it.start} onChange={(e) => onChange(it.idx, 'animStart', e.target.value)}
                      className="flex-1 h-6 text-[11px] rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none">
                      {OBJ_ANIM_START.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <div className="relative mb-1.5 h-2.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden" title={entry ? `Timeline: retraso ${entry.delayMs}ms; duracion ${entry.durationMs}ms; repeticion ${repeatLabel(entry.repeat)}` : undefined}>
                    {entry && <div className="absolute inset-y-0 rounded-full bg-blue-500/75" style={timelineStyle(entry, scaleMs)} />}
                  </div>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <label className="flex items-center gap-1 text-[10px] text-gray-500 flex-1" title="Orden">
                      <Hash className="w-3 h-3" />
                      <input type="number" min={0} value={it.order} onChange={(e) => onChange(it.idx, 'animOrder', Number(e.target.value))}
                        className="w-full h-6 text-xs rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none" />
                    </label>
                    <span className="flex flex-col -my-0.5">
                      <button onClick={() => onChange(it.idx, 'animOrder', it.order + 1)} title="Reproducir mas tarde" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={() => onChange(it.idx, 'animOrder', Math.max(0, it.order - 1))} title="Reproducir antes" className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 leading-none"><ChevronDown className="w-3 h-3" /></button>
                    </span>
                    <select value={String(it.dur)} onChange={(e) => onChange(it.idx, 'animDur', Number(e.target.value))} title="Duracion"
                      className="h-6 text-[11px] rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none">
                      <option value="300">Rapida</option><option value="500">Normal</option><option value="900">Lenta</option>
                    </select>
                    <label className="flex items-center gap-1 text-[10px] text-gray-500" title="Retraso (ms)">
                      <Clock className="w-3 h-3" />
                      <input type="number" min={0} step={100} value={it.delay} onChange={(e) => onChange(it.idx, 'animDelay', Number(e.target.value))}
                        className="w-12 h-6 text-xs rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none" />
                    </label>
                    <select value={String(it.repeat)} onChange={(e) => onChange(it.idx, 'animRepeat', Number(e.target.value))} title="Repetir"
                      className="h-6 text-[11px] rounded-md bg-black/[0.04] dark:bg-white/[0.06] px-1 outline-none">
                      <option value="1">1x</option><option value="2">2x</option><option value="3">3x</option><option value="0">inf</option>
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

const actionButton = 'inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-black/10 px-2 text-[11px] font-semibold text-gray-600 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10';

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: 'green' | 'amber' }) {
  const cls = tone === 'green'
    ? 'border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
    : tone === 'amber'
      ? 'border-amber-300/50 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
      : 'border-black/10 bg-black/[0.03] text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300';
  return (
    <div className={`min-w-0 rounded-lg border px-1.5 py-1 ${cls}`}>
      <div className="truncate text-[10px] opacity-70">{label}</div>
      <div className="truncate text-xs font-bold leading-tight">{value}</div>
    </div>
  );
}
