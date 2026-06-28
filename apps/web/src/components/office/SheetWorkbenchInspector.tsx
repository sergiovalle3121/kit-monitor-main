'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { Activity, BarChart3, CheckCircle2, Database, FileSpreadsheet, Lock, MessageSquare, ShieldAlert, Sigma, Table2, Wrench } from 'lucide-react';
import { AXOS_SHEET_CONNECTORS, type AxosConnectorType } from '@/lib/office/axosConnectors';
import type { DerivedWorkbookHealth, SheetSelectionStats } from '@/lib/office/workbookHealth';
import type { XlsxCompatibilityReport } from '@/lib/office/xlsxCompatibility';

export type SheetWorkbenchInspectorTab = 'workbook' | 'cell' | 'data' | 'charts' | 'pivot' | 'comments' | 'protection' | 'xlsx' | 'axos';

type SheetWorkbenchInspectorProps = {
  tab: SheetWorkbenchInspectorTab;
  onTab: (tab: SheetWorkbenchInspectorTab) => void;
  health: DerivedWorkbookHealth;
  compatibility: XlsxCompatibilityReport;
  selection: SheetSelectionStats;
  sheets: any[];
  activeSheetIndex: number;
  charts: any[];
  pivots: any[];
  comments: any[];
  connectors: any[];
  names: any[];
  readOnly?: boolean;
  onOpenValidation: () => void;
  onOpenConditional: () => void;
  onOpenNames: () => void;
  onOpenPivot: () => void;
  onOpenChart: () => void;
  onOpenScenarios: () => void;
  onOpenGoalSeek: () => void;
  onOpenSolver: () => void;
  onAddComment: () => void;
  onProtectSelection: () => void;
  onProtectSheet: () => void;
  onRefreshConnectors: () => void;
  onInsertConnector: (type: AxosConnectorType) => void;
};

const TABS: Array<{ id: SheetWorkbenchInspectorTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'workbook', label: 'Workbook', icon: FileSpreadsheet },
  { id: 'cell', label: 'Cell', icon: Sigma },
  { id: 'data', label: 'Data', icon: Wrench },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'pivot', label: 'Pivot', icon: Table2 },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'protection', label: 'Protection', icon: Lock },
  { id: 'xlsx', label: 'XLSX', icon: ShieldAlert },
  { id: 'axos', label: 'AXOS', icon: Database },
];

export function SheetWorkbenchInspector({
  tab, onTab, health, compatibility, selection, sheets, activeSheetIndex, charts, pivots, comments, connectors, names, readOnly,
  onOpenValidation, onOpenConditional, onOpenNames, onOpenPivot, onOpenChart, onOpenScenarios, onOpenGoalSeek, onOpenSolver,
  onAddComment, onProtectSelection, onProtectSheet, onRefreshConnectors, onInsertConnector,
}: SheetWorkbenchInspectorProps) {
  const activeSheet = sheets[activeSheetIndex] ?? sheets[0] ?? {};
  const openComments = comments.filter((c: any) => !c.resolved);
  const protectedRanges = sheets.flatMap((s: any, i: number) => [
    ...(s?.axosProtection?.sheetLocked ? [{ sheet: s.name || `Hoja ${i + 1}`, range: 'Hoja completa', locked: true }] : []),
    ...(Array.isArray(s?.axosProtection?.ranges) ? s.axosProtection.ranges.map((r: any) => ({ ...r, sheet: s.name || `Hoja ${i + 1}` })) : []),
  ]);
  const criticalFindings = health.findings.filter((finding) => finding.severity === 'critical').length;
  const warningFindings = health.findings.filter((finding) => finding.severity === 'warning').length;
  const connectorStatus = connectors.length ? `${connectors.length} conectores` : 'sin conectores';

  return (
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-black/10 bg-gray-50/80 dark:border-white/10 dark:bg-[#101010]">
      <div className="border-b border-black/10 p-3 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AXOS Sheets Workbench v2</div>
            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Inspector industrial</div>
          </div>
          <ReadinessBadge score={health.score} critical={criticalFindings} warnings={warningFindings} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MiniKpi label="XLSX" value={`${compatibility.score}/100`} tone={compatibility.unsupportedCount ? 'danger' : compatibility.reviewCount ? 'warning' : 'ok'} />
          <MiniKpi label="AXOS" value={connectorStatus} tone={health.staleAxosConnectors ? 'warning' : connectors.length ? 'ok' : 'muted'} />
          <MiniKpi label="Rango" value={selection.range} tone={selection.protected ? 'warning' : 'muted'} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 border-b border-black/10 p-2 dark:border-white/10">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onTab(id)} className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${tab === id ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs text-gray-600 dark:text-gray-300">
        {tab === 'workbook' && <Panel title="Workbook Health">
          <Metric label="Hojas" value={health.sheets} /><Metric label="Celdas usadas" value={health.usedCells} /><Metric label="Fórmulas" value={health.formulas} /><Metric label="Charts" value={health.charts} /><Metric label="Pivots" value={health.pivots} /><Metric label="Validaciones" value={health.validations} /><Metric label="Comentarios" value={health.comments} /><Metric label="Rangos protegidos" value={health.protectedRanges} /><Metric label="Nombres definidos" value={health.namedRanges} /><Metric label="Conectores stale" value={health.staleAxosConnectors} />
          <FindingList findings={health.findings} />
        </Panel>}
        {tab === 'cell' && <Panel title="Selección / celda">
          <Metric label="Rango" value={selection.range} /><Metric label="Count" value={selection.count} /><Metric label="Números" value={selection.nums} /><Metric label="Sum" value={selection.sum.toLocaleString()} /><Metric label="Average" value={selection.average.toLocaleString()} /><Metric label="Min" value={selection.min ?? '—'} /><Metric label="Max" value={selection.max ?? '—'} /><Metric label="Fórmulas" value={selection.formulas} /><Metric label="Comentarios" value={selection.comments} /><Metric label="Inválidas" value={selection.invalid} /><Metric label="Estado" value={selection.protected ? 'Protected' : 'Ready'} />
        </Panel>}
        {tab === 'data' && <Panel title="Data Tools">
          <ToolButton disabled={readOnly} onClick={onOpenValidation} title="Validación de datos" description="Reglas por rango; bloquea entradas inválidas." />
          <ToolButton disabled={readOnly} onClick={onOpenConditional} title="Formato condicional" description="Resalta riesgos, excepciones y thresholds industriales." />
          <ToolButton disabled={readOnly} onClick={onOpenNames} title="Nombres definidos" description="Administra rangos usados por fórmulas y modelos." />
          <ToolButton disabled={readOnly} onClick={onOpenScenarios} title="Escenarios" description="What-if para costo, capacidad, demanda y OEE." />
          <ToolButton disabled={readOnly} onClick={onOpenGoalSeek} title="Goal Seek" description="Encuentra la variable que alcanza un objetivo." />
          <ToolButton disabled={readOnly} onClick={onOpenSolver} title="Solver" description="Optimización restringida para planning y mix." />
        </Panel>}
        {tab === 'charts' && <Panel title="Charts">
          <ToolButton disabled={readOnly} onClick={onOpenChart} title="Insertar sparkline" description="Crea un minigráfico desde el rango activo." />
          {charts.map((c: any) => <Card key={c.id}><b>{c.title || 'Chart'}</b><br />{c.type} · {c.range}</Card>)}{!charts.length && <Empty text="No hay charts persistidos; usa Insertar para construir visualizaciones." />}
        </Panel>}
        {tab === 'pivot' && <Panel title="Pivot Workbench">
          <ToolButton disabled={readOnly} onClick={onOpenPivot} title="Crear tabla dinámica" description="Agrupa el rango activo por filas, columnas y valores." />
          {pivots.map((p: any) => <Card key={p.id}><b>{p.sheetName}</b><br />Rows {(p.config?.rows ?? []).join(', ') || '—'} · Values {(p.config?.values ?? []).length}</Card>)}{!pivots.length && <Empty text="Sin definiciones de pivot guardadas." />}
        </Panel>}
        {tab === 'comments' && <Panel title="Comments">
          <ToolButton disabled={readOnly} onClick={onAddComment} title={`Comentar ${selection.range}`} description="Ancla una conversación de revisión a la selección." />
          {openComments.map((c: any) => <Card key={c.id}><b>{sheets[c.sheetIndex]?.name || 'Hoja'}</b> · {c.range}<br />{c.text || c.messages?.[0]?.text || 'Comentario'}</Card>)}{!openComments.length && <Empty text="No hay comentarios abiertos." />}
        </Panel>}
        {tab === 'protection' && <Panel title="Protection">
          <ToolButton disabled={readOnly} onClick={onProtectSelection} title="Bloquear rango" description={`Protege ${selection.range} contra cambios accidentales.`} />
          <ToolButton disabled={readOnly} onClick={onProtectSheet} title="Proteger hoja activa" description="Marca toda la hoja como protegida en metadata AXOS." />
          {protectedRanges.map((p: any, i: number) => <Card key={`${p.sheet}-${p.range}-${i}`}><b>{p.sheet}</b> · {p.range}</Card>)}{!protectedRanges.length && <Empty text="La hoja activa no tiene protección AXOS visible." />}
        </Panel>}
        {tab === 'xlsx' && <Panel title="XLSX Compatibility Review">
          <Metric label="Score" value={`${compatibility.score}/100`} /><Metric label="Revisión" value={compatibility.reviewCount} /><Metric label="No soportado" value={compatibility.unsupportedCount} />
          <div className="mt-3 space-y-2">{compatibility.features.map((f) => <Card key={f.key}><b>{f.label}</b> · {f.count} · {f.severity}<br /><span className="text-gray-500">{f.note}</span></Card>)}</div>
        </Panel>}
        {tab === 'axos' && <Panel title="AXOS Data">
          <ToolButton onClick={onRefreshConnectors} title="Refrescar conectores insertados" description="Actualiza solo conectores existentes en el workbook." />
          <div className="grid grid-cols-1 gap-2">{AXOS_SHEET_CONNECTORS.map((c) => <button key={c.type} disabled={readOnly} onClick={() => onInsertConnector(c.type)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-left shadow-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10"><b>{c.label}</b><br /><span className="text-gray-500">{c.domain} · {c.description}</span></button>)}</div>
          <div className="mt-3 rounded-xl border border-dashed border-black/10 p-3 text-[11px] text-gray-500 dark:border-white/10">Contratos reales ERP/MES: se insertan solo conectores soportados por metadata AXOS; endpoints externos quedan pendientes de contrato, sin simular refresh.</div>
          {connectors.map((c: any) => <Card key={c.id}><b>{c.label}</b> · {c.range}<br />Último refresh {c.lastRefreshedAt || '—'}</Card>)}
        </Panel>}
      </div>
      <div className="border-t border-black/10 p-3 text-[11px] text-gray-500 dark:border-white/10">Hoja activa: {activeSheet.name || `Hoja ${activeSheetIndex + 1}`} · {names.length} nombres · {connectors.length} conectores</div>
    </aside>
  );
}

function ReadinessBadge({ score, critical, warnings }: { score: number; critical: number; warnings: number }) {
  const tone = critical ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200' : warnings ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${tone}`}><CheckCircle2 className="h-3 w-3" />{score}/100</span>;
}
function MiniKpi({ label, value, tone }: { label: string; value: React.ReactNode; tone: 'ok' | 'warning' | 'danger' | 'muted' }) {
  const tones = { ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200', warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200', danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200', muted: 'border-black/10 bg-white text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300' };
  return <div className={`min-w-0 rounded-xl border p-2 ${tones[tone]}`}><div className="text-[9px] font-semibold uppercase tracking-wider opacity-70">{label}</div><div className="truncate text-[11px] font-semibold">{value}</div></div>;
}
function FindingList({ findings }: { findings: DerivedWorkbookHealth['findings'] }) {
  if (!findings.length) return <Card><Activity className="mr-1 inline h-3.5 w-3.5" /> Sin hallazgos relevantes para compartir/exportar.</Card>;
  return <div className="mt-3 space-y-2">{findings.slice(0, 6).map((f) => <Card key={f.code}><b>{f.severity}</b> · {f.message}</Card>)}</div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="space-y-2"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h3>{children}</div>; }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex items-center justify-between border-b border-black/5 py-1 dark:border-white/10"><span>{label}</span><b className="text-gray-900 dark:text-gray-100">{value}</b></div>; }
function ToolButton({ title, description, disabled, onClick }: { title: string; description: string; disabled?: boolean; onClick: () => void }) { return <button disabled={disabled} onClick={onClick} className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-left shadow-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10"><b>{title}</b><br /><span className="text-gray-500">{description}</span></button>; }
function Card({ children }: { children: React.ReactNode }) { return <div className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]">{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-black/10 p-3 text-gray-500 dark:border-white/10">{text}</div>; }
