'use client';

import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Layers, MessageSquare, MonitorPlay, ShieldAlert, Sparkles, StickyNote, ZoomIn } from 'lucide-react';
import type { SlideInspectorHealth, SlideInspectorSelection } from './SlideInspectorPanel';

export function SlideStatusBar({
  current,
  zoom,
  health,
  selection,
  readOnly,
  onOpenComments,
  onOpenLayers,
  onOpenAnimations,
  onPresentFromHere,
}: {
  current: number;
  zoom: number;
  health: SlideInspectorHealth;
  selection: SlideInspectorSelection | null;
  readOnly?: boolean;
  onOpenComments: () => void;
  onOpenLayers: () => void;
  onOpenAnimations: () => void;
  onPresentFromHere: () => void;
}) {
  const tone = health.pptxIssues > 0 || health.commentsOpen > 0 ? 'amber' : 'green';
  const exportTone = health.exportReadiness === 'blocked' ? 'rose' : health.exportReadiness === 'review' ? 'amber' : 'green';
  const exportIcon = health.exportReadiness === 'blocked'
    ? <ShieldAlert className="w-3.5 h-3.5" />
    : health.exportReadiness === 'review'
      ? <AlertTriangle className="w-3.5 h-3.5" />
      : <CheckCircle2 className="w-3.5 h-3.5" />;
  const exportLabel = health.exportReadiness === 'ready'
    ? 'Export ready'
    : health.exportReadiness === 'blocked'
      ? 'Export blocked'
      : `Export review ${health.exportWarnings}`;
  return (
    <footer className="h-10 flex-shrink-0 rounded-2xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-[#111]/85 backdrop-blur px-3 flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
      <div className="flex items-center gap-2 font-semibold">
        <Activity className={`w-4 h-4 ${tone === 'amber' ? 'text-amber-500' : 'text-emerald-500'}`} />
        <span>Slide {current + 1}/{health.slideCount}</span>
      </div>
      <span className="h-4 w-px bg-black/10 dark:bg-white/10" />
      <span className={`font-semibold ${health.readinessScore >= 85 ? 'text-emerald-600 dark:text-emerald-400' : health.readinessScore >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>Ready {health.readinessScore}%</span>
      <span>{health.objectCount} objetos</span>
      <span className="hidden md:inline">Tema <b>{health.theme}</b></span>
      <span className="hidden md:inline">Ratio <b>{health.ratio}</b></span>
      <span className="hidden lg:inline">Secciones <b>{health.sectionCount}</b></span>
      {health.layout && <span className="hidden lg:inline">Layout <b>{health.layout}</b></span>}
      {selection && <span className="hidden lg:inline truncate max-w-[220px]">Selección: <b>{selection.count > 1 ? `${selection.count} objetos` : selection.label || selection.type}</b></span>}
      <span className="ml-auto inline-flex items-center gap-1 text-gray-500"><ZoomIn className="w-3.5 h-3.5" />{Math.round(zoom * 100)}%</span>
      {health.missingNotes > 0 && <span className="hidden md:inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" title="Hay diapositivas sin notas del orador"><StickyNote className="w-3.5 h-3.5" /> Notes {health.missingNotes}</span>}
      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${
        exportTone === 'rose'
          ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          : exportTone === 'amber'
            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      }`} title={health.exportSummary}>{exportIcon} {exportLabel}</span>
      {health.pptxIssues > 0 && <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" title="Hay avisos de compatibilidad PPTX visibles en el Workbench inspector"><AlertTriangle className="w-3.5 h-3.5" /> PPTX {health.pptxIssues}</span>}
      <button onClick={onOpenComments} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10" title="Abrir comentarios"><MessageSquare className="w-3.5 h-3.5" /> {health.commentsOpen}</button>
      {!readOnly && <button onClick={onOpenLayers} className="hidden sm:inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10" title="Abrir capas"><Layers className="w-3.5 h-3.5" /> Layers</button>}
      {!readOnly && <button onClick={onOpenAnimations} className="hidden sm:inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10" title="Abrir animaciones"><Sparkles className="w-3.5 h-3.5" /> Anim</button>}
      <button onClick={onPresentFromHere} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 bg-black text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80" title="Presentar desde esta diapositiva"><MonitorPlay className="w-3.5 h-3.5" /> Presentar</button>
    </footer>
  );
}
