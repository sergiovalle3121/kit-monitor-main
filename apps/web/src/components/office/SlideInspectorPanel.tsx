'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { Activity, AlertTriangle, Box, ChartNoAxesCombined, Database, EyeOff, Layers, Lock, MessageSquare, PanelRight, RefreshCw, Sparkles, Unlock } from 'lucide-react';
import type { SmartObjectSpec } from './slides/smartObjects';

export interface SlideInspectorSelection {
  label: string;
  type: string;
  count: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  opacity: number;
  locked: boolean;
  hidden: boolean;
  objectId?: string;
  chartType?: string;
  assetId?: string;
  assetCategory?: string;
  commentId?: string;
  animation?: { effect?: string; order?: number; duration?: number; delay?: number; start?: string; repeat?: number };
  smartObject?: SmartObjectSpec;
  placeholder?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  hasShadow?: boolean;
}

export interface SlideInspectorHealth {
  slideCount: number;
  objectCount: number;
  commentsOpen: number;
  commentsResolved: number;
  pptxIssues: number;
  pptxIssueMessages?: string[];
  emptySlides: number;
  currentEmpty: boolean;
  missingTitles: number;
  currentHasTitle: boolean;
  smartObjects: number;
  readinessScore: number;
  master: boolean;
  theme: string;
  ratio: string;
  layout?: string;
}

export function SlideInspectorPanel({
  selection, health, readOnly, onGeom, onOpacity, onLabel, onToggleLock, onToggleHidden,
  onFill, onStroke, onStrokeWidth, onCornerRadius, onToggleShadow, onFixCurrentTitle, onFixCurrentEmpty, onSmartObject, onRefreshSmartObject, onMaterializePlaceholder, onOpenComments, onOpenLayers, onOpenAnimations,
}: {
  selection: SlideInspectorSelection | null;
  health: SlideInspectorHealth;
  readOnly?: boolean;
  onGeom: (patch: { x?: number; y?: number; w?: number; h?: number; angle?: number }) => void;
  onOpacity: (v: number) => void;
  onLabel: (v: string) => void;
  onToggleLock: () => void;
  onToggleHidden: () => void;
  onFill: (v: string) => void;
  onStroke: (v: string) => void;
  onStrokeWidth: (v: number) => void;
  onCornerRadius: (v: number) => void;
  onToggleShadow: () => void;
  onFixCurrentTitle: () => void;
  onFixCurrentEmpty: () => void;
  onSmartObject: (patch: Partial<SmartObjectSpec>) => void;
  onRefreshSmartObject: () => void;
  onMaterializePlaceholder: (kind: string) => void;
  onOpenComments: () => void;
  onOpenLayers: () => void;
  onOpenAnimations: () => void;
}) {
  const disabled = readOnly || !selection;
  const readinessActions = [
    health.emptySlides > 0 ? `${health.emptySlides} slide(s) vacía(s): aplica un layout o elimina contenido muerto.` : '',
    health.missingTitles > 0 ? `${health.missingTitles} slide(s) sin título: agrega encabezados para navegación y PPTX export.` : '',
    health.commentsOpen > 0 ? `${health.commentsOpen} comentario(s) abiertos: resuelve o asigna antes de presentar.` : '',
    health.pptxIssues > 0 ? `${health.pptxIssues} aviso(s) PPTX: revisa compatibilidad antes de compartir.` : '',
  ].filter(Boolean);
  return (
    <aside className="w-72 flex-shrink-0 rounded-2xl border border-black/10 dark:border-white/10 bg-white/85 dark:bg-[#111]/85 backdrop-blur overflow-hidden flex flex-col min-h-0">
      <div className="h-11 px-3 flex items-center justify-between border-b border-black/5 dark:border-white/10">
        <span className="inline-flex items-center gap-2 text-sm font-bold"><PanelRight className="w-4 h-4 text-amber-500" /> Workbench</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Inspector</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <Section title="Deck health" icon={<Activity className="w-3.5 h-3.5" />}>
          <div className="mb-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 p-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
              <span>Readiness score</span><span>{health.readinessScore}%</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div className={`h-full rounded-full ${health.readinessScore >= 85 ? 'bg-emerald-500' : health.readinessScore >= 65 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${health.readinessScore}%` }} />
            </div>
            {readinessActions.length > 0 && (
              <div className="mt-2 space-y-1">
                {readinessActions.slice(0, 3).map((item) => <p key={item} className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">• {item}</p>)}
              </div>
            )}
            {!readOnly && !health.currentHasTitle && (
              <button onClick={onFixCurrentTitle} className="mt-2 w-full rounded-lg bg-amber-500 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-amber-600">Agregar título al slide actual</button>
            )}
            {!readOnly && health.currentEmpty && (
              <button onClick={onFixCurrentEmpty} className="mt-2 w-full rounded-lg bg-blue-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700">Aplicar layout base</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Slides" value={health.slideCount} />
            <Metric label="Objetos" value={health.objectCount} />
            <Metric label="Open comments" value={health.commentsOpen} tone={health.commentsOpen ? 'amber' : 'green'} />
            <Metric label="PPTX warnings" value={health.pptxIssues} tone={health.pptxIssues ? 'amber' : 'green'} />
            <Metric label="Sin título" value={health.missingTitles} tone={health.missingTitles ? 'amber' : 'green'} />
            <Metric label="Vacías" value={health.emptySlides} tone={health.emptySlides ? 'amber' : 'green'} />
          </div>
          <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 space-y-1">
            <p>Theme: <b>{health.theme}</b> · Ratio: <b>{health.ratio}</b></p>
            <p>Master: <b>{health.master ? 'activo' : 'sin patrón'}</b>{health.layout ? ` · Layout: ${health.layout}` : ''}</p>
            <p>Smart Objects: <b>{health.smartObjects}</b> · Review threads: <b>{health.commentsOpen + health.commentsResolved}</b></p>
          </div>
          {health.pptxIssues > 0 && <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-300"><AlertTriangle className="w-3 h-3 mt-0.5" /> Revisa la compatibilidad PPTX antes de exportar o compartir.</p>}
        </Section>

        {health.pptxIssues > 0 && (
          <Section title="PPTX review" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
            <div className="space-y-1.5">
              {(health.pptxIssueMessages || []).slice(0, 5).map((msg, idx) => (
                <p key={idx} className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">{msg}</p>
              ))}
              {health.pptxIssues > 5 && <p className="text-[11px] text-gray-400">+{health.pptxIssues - 5} avisos adicionales en el reporte de importación.</p>}
            </div>
          </Section>
        )}

        <Section title="Objeto" icon={<Box className="w-3.5 h-3.5" />}>
          {selection ? (
            <div className="space-y-2">
              <label className="block text-[11px] text-gray-500">Nombre / label
                <input value={selection.label} onChange={(e) => onLabel(e.target.value)} disabled={readOnly} className={field} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Read label="Tipo" value={selection.count > 1 ? `Selección múltiple (${selection.count})` : selection.type} />
                <Read label="Object id" value={selection.objectId || selection.commentId || '—'} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Num label="X" value={selection.x} disabled={disabled} onChange={(v) => onGeom({ x: v })} />
                <Num label="Y" value={selection.y} disabled={disabled} onChange={(v) => onGeom({ y: v })} />
                <Num label="W" value={selection.w} disabled={disabled || selection.type === 'line'} onChange={(v) => onGeom({ w: v })} />
                <Num label="H" value={selection.h} disabled={disabled || selection.type === 'line'} onChange={(v) => onGeom({ h: v })} />
                <Num label="Rotación" value={selection.angle} disabled={disabled} onChange={(v) => onGeom({ angle: v })} />
                <label className="text-[11px] text-gray-500">Opacidad
                  <input type="number" min={0.05} max={1} step={0.05} value={selection.opacity} disabled={disabled} onChange={(e) => onOpacity(Number(e.target.value))} className={field} />
                </label>
              </div>
              <div className="flex gap-2">
                <button disabled={disabled} onClick={onToggleLock} className={button}>{selection.locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />} {selection.locked ? 'Unlock' : 'Lock'}</button>
                <button disabled={disabled} onClick={onToggleHidden} className={button}><EyeOff className="w-3.5 h-3.5" /> {selection.hidden ? 'Show' : 'Hide'}</button>
              </div>
              <div className="rounded-xl border border-black/10 dark:border-white/10 p-2 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Apariencia</p>
                <div className="grid grid-cols-3 gap-2">
                  <Color label="Fill" value={selection.fill || '#ffffff'} disabled={disabled || selection.type === 'Imagen'} onChange={onFill} />
                  <Color label="Stroke" value={selection.stroke || '#111827'} disabled={disabled} onChange={onStroke} />
                  <Num label="Stroke w" value={selection.strokeWidth ?? 0} disabled={disabled} onChange={onStrokeWidth} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Num label="Radius" value={selection.cornerRadius ?? 0} disabled={disabled || selection.cornerRadius == null} onChange={onCornerRadius} />
                  <button disabled={disabled} onClick={onToggleShadow} className={`${button} mt-5 justify-center ${selection.hasShadow ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : ''}`}>Shadow {selection.hasShadow ? 'on' : 'off'}</button>
                </div>
              </div>
            </div>
          ) : <p className="text-xs text-gray-400">Selecciona un objeto para editar posición, tamaño, metadata y bindings.</p>}
        </Section>



        {selection?.placeholder && ['chart', 'kpi', 'timeline', 'riskMatrix', 'actionRegister'].includes(selection.placeholder) && (
          <Section title="Placeholder" icon={<Sparkles className="w-3.5 h-3.5" />}>
            <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Rol: <b>{selection.placeholder}</b>. Convierte este marcador en un objeto AXOS editable.</p>
            <button disabled={readOnly} onClick={() => onMaterializePlaceholder(selection.placeholder!)} className={`${button} w-full justify-center`}><Sparkles className="w-3.5 h-3.5" /> Insertar objeto sugerido</button>
          </Section>
        )}

        {selection?.smartObject && (
          <Section title="Smart Object Data" icon={<Database className="w-3.5 h-3.5" />}>
            <div className="space-y-2">
              <Read label="Tipo" value={selection.smartObject.kind} />
              <label className="block text-[11px] text-gray-500">Título<input value={selection.smartObject.title || ''} disabled={readOnly} onChange={(e) => onSmartObject({ title: e.target.value })} className={field} /></label>
              <label className="block text-[11px] text-gray-500">Subtítulo<input value={selection.smartObject.subtitle || ''} disabled={readOnly} onChange={(e) => onSmartObject({ subtitle: e.target.value })} className={field} /></label>
              <label className="block text-[11px] text-gray-500">Fuente / binding<input value={selection.smartObject.source || 'manual'} disabled={readOnly} onChange={(e) => onSmartObject({ source: e.target.value })} className={field} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[11px] text-gray-500">Valor<input value={selection.smartObject.value || ''} disabled={readOnly} onChange={(e) => onSmartObject({ value: e.target.value })} className={field} /></label>
                <label className="block text-[11px] text-gray-500">Target<input value={selection.smartObject.target || ''} disabled={readOnly} onChange={(e) => onSmartObject({ target: e.target.value })} className={field} /></label>
              </div>
              <select value={selection.smartObject.status || 'good'} disabled={readOnly} onChange={(e) => onSmartObject({ status: e.target.value as any })} className={field}>
                <option value="good">good</option><option value="warn">warn</option><option value="bad">bad</option>
              </select>
              <button disabled={readOnly} onClick={onRefreshSmartObject} className={`${button} w-full justify-center`}><RefreshCw className="w-3.5 h-3.5" /> Refrescar snapshot</button>
            </div>
          </Section>
        )}

        <Section title="Metadata" icon={<Sparkles className="w-3.5 h-3.5" />}>
          <div className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            <p><ChartNoAxesCombined className="inline w-3 h-3 mr-1" />Chart: <b>{selection?.chartType || '—'}</b></p>
            <p>Asset: <b>{selection?.assetId || '—'}</b>{selection?.assetCategory ? ` · ${selection.assetCategory}` : ''}</p>
            <p>Placeholder: <b>{selection?.placeholder || '—'}</b></p>
            <p>Animation: <b>{selection?.animation?.effect || 'none'}</b> · order {selection?.animation?.order ?? 0}</p>
          </div>
        </Section>
      </div>
      <div className="border-t border-black/5 dark:border-white/10 p-2 grid grid-cols-3 gap-1.5">
        <button onClick={onOpenLayers} className={quick}><Layers className="w-3.5 h-3.5" /> Layers</button>
        <button onClick={onOpenComments} className={quick}><MessageSquare className="w-3.5 h-3.5" /> Review</button>
        <button onClick={onOpenAnimations} className={quick}><Sparkles className="w-3.5 h-3.5" /> Anim</button>
      </div>
    </aside>
  );
}

const field = 'mt-1 w-full h-8 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.05] px-2 text-xs outline-none focus:border-amber-500/60 disabled:opacity-60';
const button = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50';
const quick = 'inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10';
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.03] p-3"><h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{icon}{title}</h3>{children}</section>; }
function Metric({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'amber' }) { return <div className={`rounded-lg p-2 border ${tone === 'amber' ? 'border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300' : tone === 'green' ? 'border-emerald-300/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-black/10 dark:border-white/10'}`}><div className="text-lg font-bold leading-none">{value}</div><div className="text-[10px] opacity-70">{label}</div></div>; }
function Read({ label, value }: { label: string; value: string }) { return <div className="text-[11px] text-gray-500"><span>{label}</span><p className="mt-1 truncate rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-2 py-1.5 text-xs font-medium text-gray-800 dark:text-gray-100">{value}</p></div>; }
function Num({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (v: number) => void }) { return <label className="text-[11px] text-gray-500">{label}<input type="number" value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className={field} /></label>; }
function Color({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#111827';
  return <label className="text-[11px] text-gray-500">{label}<input type="color" value={safe} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full h-8 rounded-lg border border-black/10 dark:border-white/10 bg-transparent p-1 disabled:opacity-60" /></label>;
}
