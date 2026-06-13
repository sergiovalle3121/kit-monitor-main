'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Megaphone, Plus, Lock, Loader2, Inbox, X, CheckCircle2,
  ArrowRight, PackageCheck, ShieldCheck, FlaskConical, UserCheck,
  Factory, Layers, CalendarClock, Activity, Boxes, ChevronDown,
  ArrowUp, ArrowDown, Flag,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import {
  computeSchedule, paceLabel, type ScheduleInfo,
  buildActiveBomMap, buildInventoryMap, computeClearToBuild,
  type BomHeaderLite, type InventoryPositionLite, type ClearToBuild, type CheckState,
} from './wo-board';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const VIOLET = '#7c3aed';
const BLUE = '#3b82f6';
const AMBER = '#f59e0b';
const GREEN = '#10b981';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'RELEASED' | 'STAGED' | 'IN_EXECUTION' | 'COMPLETED' | 'CANCELLED';

interface WO {
  id: string; folio: string | null; model: string; revision: string; line: string; bay: string | null;
  quantityPlanned: number; quantityCompleted: number; scheduledDate: string | null; sequence: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; status: Status;
  consumptionMode: 'BY_UNIT' | 'BY_QTY_FACTOR'; serialControl: 'NONE' | 'BY_UNIT';
  materialReady: boolean; qualityClear: boolean; faiRequired: boolean; faiApproved: boolean;
  authorizedOperators: string[] | null; customer: string | null;
  taktTargetSec?: number | null; startedAt?: string | null;
}
interface Kpis {
  total: number; open: number; inExecution: number; unitsPlanned: number; unitsCompleted: number;
  planAdherencePct: number; woWithReadiness: number; pctWithReadiness: number; behindSchedule: number;
}
// Maestro de Modelo (mismo shape que usa `planning`) — para el dropdown del form.
interface ModelOption { id: string; modelNumber: string; name: string; status: string }

const STATUS_META: Record<Status, { label: string; color: string }> = {
  RELEASED: { label: 'Liberado', color: GRAY },
  STAGED: { label: 'Montado', color: BLUE },
  IN_EXECUTION: { label: 'En ejecución', color: VIOLET },
  COMPLETED: { label: 'Completado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: RED },
};
const NEXT: Record<Status, Status[]> = {
  RELEASED: ['STAGED', 'IN_EXECUTION', 'CANCELLED'],
  STAGED: ['IN_EXECUTION', 'RELEASED', 'CANCELLED'],
  IN_EXECUTION: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], CANCELLED: [],
};
const ORDER: Status[] = ['RELEASED', 'STAGED', 'IN_EXECUTION', 'COMPLETED'];
const TERMINAL: Status[] = ['COMPLETED', 'CANCELLED'];
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;
const bySequence = (a: WO, b: WO) => a.sequence - b.sequence;

const SCHEDULE_META: Record<ScheduleInfo['state'], { color: string }> = {
  late: { color: RED },
  'due-today': { color: AMBER },
  'on-track': { color: BLUE },
  done: { color: GREEN },
  cancelled: { color: GRAY },
  unscheduled: { color: GRAY },
};

const CLEAR_META: Record<ClearToBuild['status'], { color: string; label: string }> = {
  go: { color: GREEN, label: 'Clear to Build' },
  caution: { color: AMBER, label: 'Con reservas' },
  'no-go': { color: RED, label: 'No listo' },
  unknown: { color: GRAY, label: 'Sin datos' },
};

export default function ProductionPlanPage() {
  const toast = useToast();
  const { data, isLoading, forbidden, mutate } = useApi<WO[]>('/production-plan');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/production-plan/kpis');
  const { data: modelsData } = useApi<ModelOption[]>('/product-models');
  // Clear-to-Build se compone de endpoints existentes (sin backend nuevo):
  // BOM activo del modelo + disponible en inventario + FAI de la propia WO.
  const { data: bomData } = useApi<BomHeaderLite[]>('/bom/headers?status=ACTIVE');
  const { data: invData } = useApi<InventoryPositionLite[]>('/inventory/positions');
  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const models = Array.isArray(modelsData) ? modelsData : [];
  const bomByModel = useMemo(() => buildActiveBomMap(Array.isArray(bomData) ? bomData : []), [bomData]);
  const invByPart = useMemo(() => buildInventoryMap(Array.isArray(invData) ? invData : []), [invData]);
  const board = useMemo(() => ({ bomByModel, invByPart }), [bomByModel, invByPart]);

  const [view, setView] = useState<'line' | 'status'>('line');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    model: '', revision: 'A', line: 'SMT-1', bay: '', quantityPlanned: 100, scheduledDate: '',
    priority: 'MEDIUM' as WO['priority'], consumptionMode: 'BY_UNIT' as WO['consumptionMode'],
    serialControl: 'NONE' as WO['serialControl'], faiRequired: false, customer: '',
  });

  // WOs grouped by line, each sorted by run sequence (the operational board).
  const byLine = useMemo(() => {
    const map = new Map<string, WO[]>();
    for (const wo of list) {
      const arr = map.get(wo.line) ?? [];
      arr.push(wo);
      map.set(wo.line, arr);
    }
    return Array.from(map.entries())
      .map(([line, wos]) => ({ line, wos: [...wos].sort(bySequence) }))
      .sort((a, b) => a.line.localeCompare(b.line));
  }, [list]);

  // Resumen Clear-to-Build a nivel tablero: WOs abiertas que NO están listas para
  // construir (no-go = sin BOM, faltante total, o hold). Vistazo de readiness real
  // (BOM+material+FAI), más honesto que el flag materialReady del backend.
  const ctbNotReady = useMemo(
    () => list.filter((w) => !TERMINAL.includes(w.status) && computeClearToBuild(w, bomByModel, invByPart).status === 'no-go').length,
    [list, bomByModel, invByPart],
  );

  function refresh() { mutate(); mutateKpis(); }

  async function publish() {
    if (!form.model.trim() || !form.line.trim() || form.quantityPlanned < 1) {
      toast.error('Modelo, línea y cantidad son obligatorios.', 'Plan'); return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/production-plan/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo publicar.', 'Plan'); return; }
      toast.success('WO publicada al plan.', 'Plan'); setShowForm(false); refresh();
    } catch { toast.error('Error de red.', 'Plan'); } finally { setBusy(null); }
  }

  async function transition(wo: WO, status: Status) {
    setBusy(wo.id);
    try {
      const res = await apiFetch(`${API_BASE}/production-plan/${wo.id}/transition`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo mover.', 'Plan'); return; }
      toast.success(`→ ${STATUS_META[status].label}`, 'Plan'); refresh();
    } catch { toast.error('Error de red.', 'Plan'); } finally { setBusy(null); }
  }

  async function authorize(wo: WO) {
    const input = window.prompt('Correos de operadores autorizados (separados por coma):', (wo.authorizedOperators ?? []).join(', '));
    if (input === null) return;
    const operators = input.split(',').map((s) => s.trim()).filter(Boolean);
    if (operators.length === 0) return;
    setBusy(wo.id);
    try {
      const res = await apiFetch(`${API_BASE}/production-plan/${wo.id}/authorize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operators }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo autorizar.', 'Plan'); return; }
      toast.success('Operadores autorizados.', 'Plan'); refresh();
    } catch { toast.error('Error de red.', 'Plan'); } finally { setBusy(null); }
  }

  // Re-secuencia dentro de la línea: reasigna secuencia en pasos de 10 (deja huecos)
  // y solo PATCHea las WOs cuyo número cambió. Robusto ante empates de secuencia.
  async function reorderLine(wo: WO, dir: 'up' | 'down') {
    const siblings = list.filter((w) => w.line === wo.line).sort(bySequence);
    const i = siblings.findIndex((w) => w.id === wo.id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    const patches = reordered
      .map((w, idx) => ({ w, sequence: (idx + 1) * 10 }))
      .filter(({ w, sequence }) => w.sequence !== sequence);
    if (patches.length === 0) return;
    setBusy(wo.id);
    try {
      const results = await Promise.all(
        patches.map(({ w, sequence }) =>
          apiFetch(`${API_BASE}/production-plan/${w.id}/resequence`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sequence }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) toast.error('No se pudo re-secuenciar la línea.', 'Plan');
      else toast.success('Secuencia actualizada.', 'Plan');
      refresh();
    } catch { toast.error('Error de red.', 'Plan'); } finally { setBusy(null); }
  }

  async function setPriority(wo: WO, priority: WO['priority']) {
    if (priority === wo.priority) return;
    setBusy(wo.id);
    try {
      const res = await apiFetch(`${API_BASE}/production-plan/${wo.id}/resequence`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sequence: wo.sequence, priority }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo cambiar la prioridad.', 'Plan'); return; }
      toast.success('Prioridad actualizada.', 'Plan'); refresh();
    } catch { toast.error('Error de red.', 'Plan'); } finally { setBusy(null); }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Necesitas permiso de producción para ver el plan.</p>
        </div>
      </div>
    );
  }

  const cardProps = { busy, onTransition: transition, onAuthorize: authorize };

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.14)' }}><Megaphone className="w-5 h-5" style={{ color: VIOLET }} /></span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Muro de WOs · tablero operativo</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Planeación publica · operadores, materialistas y supervisión ven el mismo plan en vivo.</p>
          </div>
          <Link href="/dashboard/planning" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-700 transition-colors"><Layers className="w-4 h-4" /> Planeación</Link>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}><Plus className="w-4 h-4" /> Publicar WO</button>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Kpi label="WO abiertas" value={kpis?.open ?? 0} color={VIOLET} />
          <Kpi label="En ejecución" value={kpis?.inExecution ?? 0} color={BLUE} />
          <Kpi label="Adherencia al plan" value={pct(kpis?.planAdherencePct ?? 0)} color={GREEN} />
          <Kpi label="% con readiness" value={pct(kpis?.pctWithReadiness ?? 0)} color={AMBER} />
          <Kpi label="Atrasadas" value={kpis?.behindSchedule ?? 0} color={RED} />
          <Kpi label="No listas (CTB)" value={ctbNotReady} color={RED} title="Clear-to-Build no-go entre WOs abiertas: sin BOM activo, faltante total de material, o retención de calidad." />
        </div>

        {/* View toggle */}
        {list.length > 0 && (
          <div className="flex items-center gap-1 mb-6 p-1 rounded-xl w-fit" style={{ background: 'rgba(0,0,0,0.04)' }}>
            <ViewTab active={view === 'line'} onClick={() => setView('line')} icon={Factory} label="Por línea / estación" />
            <ViewTab active={view === 'status'} onClick={() => setView('status')} icon={Layers} label="Por estado" />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin WOs publicadas</h3>
            <p className="text-sm text-gray-400 mt-1">Publica la primera orden de trabajo para que el piso la vea en vivo.</p>
          </div>
        ) : view === 'line' ? (
          <div className="space-y-8">
            {byLine.map(({ line, wos }) => (
              <LineSection key={line} line={line} wos={wos} board={board} onReorder={reorderLine} onSetPriority={setPriority} {...cardProps} />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((w) => w.status === status).sort(bySequence);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {items.map((wo) => <WOCard key={wo.id} wo={wo} board={board} {...cardProps} />)}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className={`${glass} rounded-2xl p-5 w-full max-w-xl`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Publicar orden de trabajo</h3><button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-4">
              <F label="Modelo">
                {models.length > 0 ? (
                  <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="ci-input">
                    <option value="">Selecciona un modelo…</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.modelNumber}>{m.modelNumber} · {m.name}{m.status === 'DRAFT' ? ' (borrador)' : ''}</option>
                    ))}
                  </select>
                ) : (
                  <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="ci-input" placeholder="AX-1000" />
                )}
              </F>
              <F label="Revisión"><input value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} className="ci-input" /></F>
              <F label="Línea"><input value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} className="ci-input" /></F>
              <F label="Bahía / estación"><input value={form.bay} onChange={(e) => setForm({ ...form, bay: e.target.value })} className="ci-input" placeholder="(opcional)" /></F>
              <F label="Cantidad"><input type="number" min={1} value={form.quantityPlanned} onChange={(e) => setForm({ ...form, quantityPlanned: Number(e.target.value) })} className="ci-input" /></F>
              <F label="Fecha programada"><input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="ci-input" /></F>
              <F label="Prioridad"><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as WO['priority'] })} className="ci-input"><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></F>
              <F label="Consumo"><select value={form.consumptionMode} onChange={(e) => setForm({ ...form, consumptionMode: e.target.value as WO['consumptionMode'] })} className="ci-input"><option value="BY_UNIT">Por unidad (1 Enter = 1 pza)</option><option value="BY_QTY_FACTOR">Cantidad × factor de uso</option></select></F>
              <F label="Serie"><select value={form.serialControl} onChange={(e) => setForm({ ...form, serialControl: e.target.value as WO['serialControl'] })} className="ci-input"><option value="NONE">Solo cantidad / lote</option><option value="BY_UNIT">Serial por unidad (genealogía)</option></select></F>
              <label className="flex items-center gap-2 mt-6"><input type="checkbox" checked={form.faiRequired} onChange={(e) => setForm({ ...form, faiRequired: e.target.checked })} /> <span className="text-sm">Exigir FAI (primera pieza)</span></label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={publish} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>{busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Publicar</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .ci-input { width: 100%; border-radius: 0.75rem; padding: 0.55rem 0.75rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.08); outline: none; font-size: 0.875rem; }
        .ci-input:focus { border-color: ${VIOLET}; }
        :global(.dark) .ci-input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

// ── Line section (board view) ────────────────────────────────────────────────
interface CardActions {
  busy: string | null;
  onTransition: (wo: WO, status: Status) => void;
  onAuthorize: (wo: WO) => void;
}
interface BoardData {
  bomByModel: Map<string, BomHeaderLite>;
  invByPart: Map<string, number>;
}
// Controles de secuencia (solo en la vista por línea, donde hay contexto de orden).
interface SequenceControls {
  index: number;
  count: number;
  onReorder: (wo: WO, dir: 'up' | 'down') => void;
  onSetPriority: (wo: WO, p: WO['priority']) => void;
}

function LineSection({ line, wos, board, onReorder, onSetPriority, ...actions }: {
  line: string; wos: WO[]; board: BoardData;
  onReorder: (wo: WO, dir: 'up' | 'down') => void;
  onSetPriority: (wo: WO, p: WO['priority']) => void;
} & CardActions) {
  const active = wos.filter((w) => !TERMINAL.includes(w.status));
  const planned = active.reduce((s, w) => s + (w.quantityPlanned || 0), 0);
  const done = active.reduce((s, w) => s + (w.quantityCompleted || 0), 0);
  const now = new Date();
  const late = active.filter((w) => computeSchedule(w, now).state === 'late').length;
  const running = wos.filter((w) => w.status === 'IN_EXECUTION').length;
  const notReady = active.filter((w) => computeClearToBuild(w, board.bomByModel, board.invByPart).status === 'no-go').length;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: `${BLUE}1f` }}>
          <Factory className="w-4 h-4" style={{ color: BLUE }} />
        </span>
        <h2 className="text-sm font-semibold">Línea {line}</h2>
        <span className="text-[11px] text-gray-400">({wos.length} WO)</span>
        <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>{done}/{planned} u activas</span>
        {running > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${VIOLET}1f`, color: VIOLET }}>{running} en ejecución</span>}
        {late > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${RED}1f`, color: RED }}>{late} atrasada{late > 1 ? 's' : ''}</span>}
        {notReady > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${RED}1f`, color: RED }}>{notReady} no lista{notReady > 1 ? 's' : ''}</span>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {wos.map((wo, idx) => (
          <WOCard
            key={wo.id}
            wo={wo}
            board={board}
            showSequence
            seq={{ index: idx, count: wos.length, onReorder, onSetPriority }}
            {...actions}
          />
        ))}
      </div>
    </section>
  );
}

const PRIORITY_OPTS: { value: WO['priority']; label: string }[] = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

// ── WO card (shared by both views) ───────────────────────────────────────────
function WOCard({ wo, board, showSequence, seq, busy, onTransition, onAuthorize }: { wo: WO; board: BoardData; showSequence?: boolean; seq?: SequenceControls } & CardActions) {
  const progress = wo.quantityPlanned > 0 ? Math.min(100, Math.round((wo.quantityCompleted / wo.quantityPlanned) * 100)) : 0;
  const schedule = useMemo(() => computeSchedule(wo), [wo]);
  const ctb = useMemo(() => computeClearToBuild(wo, board.bomByModel, board.invByPart), [wo, board]);
  const [openCtb, setOpenCtb] = useState(false);
  const clear = CLEAR_META[ctb.status];

  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {showSequence && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-400" title="Secuencia en la línea">#{wo.sequence}</span>}
            {wo.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{wo.folio}</span>}
            <span className="font-semibold truncate">{wo.model} · {wo.revision}</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: `${BLUE}1f`, color: BLUE }}>{wo.line}{wo.bay ? ` / ${wo.bay}` : ''}</span>
            {wo.priority !== 'MEDIUM' && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: `${AMBER}1f`, color: AMBER }}>{wo.priority}</span>}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[12px] text-gray-400 flex-wrap">
            <span className="inline-flex items-center gap-1" style={{ color: STATUS_META[wo.status].color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[wo.status].color }} />
              {STATUS_META[wo.status].label}
            </span>
            <span>•</span>
            <span className="font-medium text-gray-500 dark:text-gray-300 tabular-nums">{wo.quantityCompleted}/{wo.quantityPlanned} u</span>
            <span>•</span>
            <span>{wo.consumptionMode === 'BY_UNIT' ? 'por unidad' : 'cant×factor'}</span>
            {wo.serialControl === 'BY_UNIT' && <><span>•</span><span>serial</span></>}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${progress}%`, background: STATUS_META[wo.status].color }} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <ScheduleChip schedule={schedule} />
            <Chip on={wo.materialReady} icon={PackageCheck} label="Material" />
            <Chip on={wo.qualityClear} icon={ShieldCheck} label="Calidad" warn />
            {wo.faiRequired && <Chip on={wo.faiApproved} icon={FlaskConical} label="FAI" />}
            {wo.authorizedOperators && wo.authorizedOperators.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: `${GREEN}1f`, color: GREEN }}><UserCheck className="w-3 h-3" /> {wo.authorizedOperators.length} op.</span>
            )}
          </div>
        </div>
      </div>

      {/* Semáforo Clear-to-Build (BOM activo + material + FAI, compuesto del API) */}
      <button
        onClick={() => setOpenCtb((v) => !v)}
        className="mt-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left transition-colors hover:brightness-95"
        style={{ background: `${clear.color}14` }}
        aria-expanded={openCtb}
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold min-w-0" style={{ color: clear.color }}>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: clear.color }} />
          Clear-to-Build · {clear.label}
          {ctb.reasons.length > 0 && <span className="text-gray-400 font-normal truncate hidden sm:inline">· {ctb.reasons[0]}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${openCtb ? 'rotate-180' : ''}`} />
      </button>
      {openCtb && <ClearDetail ctb={ctb} />}

      <div className="mt-3 flex items-center gap-1.5 flex-wrap">
        {seq && (
          <span className="inline-flex items-center gap-1 mr-0.5 pr-1.5 border-r border-black/10 dark:border-white/10">
            <button
              onClick={() => seq.onReorder(wo, 'up')}
              disabled={busy === wo.id || seq.index === 0}
              title="Subir en la secuencia de la línea"
              aria-label="Subir en la secuencia"
              className="p-1.5 rounded-lg disabled:opacity-30 hover:brightness-95"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => seq.onReorder(wo, 'down')}
              disabled={busy === wo.id || seq.index === seq.count - 1}
              title="Bajar en la secuencia de la línea"
              aria-label="Bajar en la secuencia"
              className="p-1.5 rounded-lg disabled:opacity-30 hover:brightness-95"
              style={{ background: 'rgba(0,0,0,0.05)' }}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <span className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.05)' }} title="Prioridad">
              <Flag className="w-3 h-3 text-gray-400" />
              <select
                value={wo.priority}
                onChange={(e) => seq.onSetPriority(wo, e.target.value as WO['priority'])}
                disabled={busy === wo.id}
                aria-label="Prioridad de la WO"
                className="bg-transparent text-[12px] font-medium outline-none disabled:opacity-50 cursor-pointer"
              >
                {PRIORITY_OPTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </span>
          </span>
        )}
        {NEXT[wo.status].map((to) => (
          <button key={to} onClick={() => onTransition(wo, to)} disabled={busy === wo.id}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
            style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}>
            {to === 'CANCELLED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />} {STATUS_META[to].label}
          </button>
        ))}
        <button onClick={() => onAuthorize(wo)} disabled={busy === wo.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: 'rgba(0,0,0,0.05)' }}>
          <UserCheck className="w-3 h-3" /> Autorizar operador
        </button>
      </div>
    </div>
  );
}

const CHECK_COLOR: Record<CheckState, string> = {
  ok: GREEN, partial: AMBER, fail: RED, pending: AMBER, na: GRAY, unknown: GRAY,
};

function ClearDetail({ ctb }: { ctb: ClearToBuild }) {
  return (
    <div className="mt-2 rounded-xl border border-black/5 dark:border-white/10 p-3 space-y-2">
      <CheckRow
        icon={Boxes}
        label="BOM activo"
        state={ctb.bom.state}
        detail={ctb.bom.state === 'ok' ? `Rev ${ctb.bom.revision ?? '—'}` : 'Sin BOM activo'}
        link={ctb.bom.state !== 'ok' ? { href: '/dashboard/models', label: 'Modelos' } : undefined}
      />
      <CheckRow
        icon={PackageCheck}
        label="Material disponible"
        state={ctb.material.state}
        detail={
          ctb.material.state === 'unknown'
            ? 'Sin BOM para evaluar'
            : ctb.material.totalParts === 0
              ? 'Sin componentes'
              : `${ctb.material.totalParts - ctb.material.shortParts}/${ctb.material.totalParts} partes cubiertas`
        }
        link={ctb.material.shortParts > 0 ? { href: '/dashboard/almacen', label: 'Almacén' } : undefined}
      />
      <CheckRow
        icon={FlaskConical}
        label="Primera pieza (FAI)"
        state={ctb.fai.state}
        detail={ctb.fai.state === 'na' ? 'No requerida' : ctb.fai.state === 'ok' ? 'Aprobada' : 'Pendiente'}
      />
      {ctb.quality.state !== 'ok' && (
        <CheckRow icon={ShieldCheck} label="Calidad" state="fail" detail="Retención activa" />
      )}

      {ctb.material.lines.length > 0 && (
        <div className="pt-1">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Faltantes para terminar</div>
          <div className="space-y-1">
            {ctb.material.lines.slice(0, 6).map((l) => (
              <div key={l.partNumber} className="flex items-center justify-between gap-2 text-[12px] px-2 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05]">
                <span className="font-mono truncate" title={l.description ?? undefined}>{l.partNumber}</span>
                <span className="tabular-nums text-gray-500 flex-shrink-0">
                  req {l.required} · disp {l.available} · <span style={{ color: RED }}>falta {l.shortage} {l.unit}</span>
                </span>
              </div>
            ))}
            {ctb.material.lines.length > 6 && (
              <div className="text-[11px] text-gray-400">+{ctb.material.lines.length - 6} parte(s) más con faltante</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckRow({ icon: Icon, label, state, detail, link }: { icon: React.ElementType; label: string; state: CheckState; detail: string; link?: { href: string; label: string } }) {
  const color = CHECK_COLOR[state];
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="inline-flex items-center gap-2 min-w-0">
        <span className="w-6 h-6 rounded-lg grid place-items-center flex-shrink-0" style={{ background: `${color}1f` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </span>
        <span className="truncate">{label}</span>
      </span>
      <span className="inline-flex items-center gap-2 text-gray-500 flex-shrink-0">
        <span style={{ color }}>{detail}</span>
        {link && <Link href={link.href} className="text-blue-500 hover:text-blue-700 text-[12px] font-medium">{link.label}</Link>}
      </span>
    </div>
  );
}

function ScheduleChip({ schedule }: { schedule: ScheduleInfo }) {
  const color = SCHEDULE_META[schedule.state].color;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: `${color}1f`, color }}>
        <CalendarClock className="w-3 h-3" /> {schedule.label}
      </span>
      {schedule.pace && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
          style={{
            background: `${schedule.pace.state === 'behind' ? RED : schedule.pace.state === 'ahead' ? GREEN : BLUE}1f`,
            color: schedule.pace.state === 'behind' ? RED : schedule.pace.state === 'ahead' ? GREEN : BLUE,
          }}
          title="Ritmo: unidades producidas vs esperadas por el takt"
        >
          <Activity className="w-3 h-3" /> {paceLabel(schedule.pace)}
        </span>
      )}
    </span>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${active ? 'bg-white dark:bg-white/15 shadow-sm' : 'text-gray-500 hover:text-black dark:hover:text-white'}`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function Kpi({ label, value, color, title }: { label: string; value: number | string; color: string; title?: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`} title={title}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
function Chip({ on, icon: Icon, label, warn }: { on: boolean; icon: React.ElementType; label: string; warn?: boolean }) {
  const okColor = GREEN; const offColor = warn ? RED : AMBER;
  const color = on ? okColor : offColor;
  return <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: `${color}1f`, color }}><Icon className="w-3 h-3" /> {label}{warn ? (on ? '' : ' · hold') : (on ? '' : ' ✗')}</span>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
