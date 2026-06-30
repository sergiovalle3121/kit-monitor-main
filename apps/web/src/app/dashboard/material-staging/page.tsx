'use client';

import React, { useMemo, useState } from 'react';
import {
  PackagePlus, Lock, Loader2, Inbox, CheckCircle2, AlertTriangle, Check, X,
  Truck, PackageCheck, Boxes, Zap, ClipboardList, ListChecks, RotateCcw,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModelName } from '@/components/ui/ModelName';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import {
  activeMaterialRequestQueue,
  materialRequestContextLabel,
  summarizeMaterialRequestQueue,
  type MaterialRequestQueueItem,
} from './material-request-queue';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const BLUE = '#3b82f6';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GRAY = '#6b7280';

type SStatus = 'PENDING' | 'STAGED' | 'SHORTAGE';
type RStatus = 'OPEN' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
// Carril 1 = planes publicados (plans → pick-list). Carril 2 = WO (SfWorkOrder).
type Source = 'plan' | 'wo';

interface WO { id: string; folio: string | null; model: string; revision: string; line: string; status: string; quantityPlanned: number; materialReady: boolean; }
interface Line { id: string; woId: string; station: string; sequence: number; part: string; requiredQty: number; stagedQty: number; minQty: number; status: SStatus; feederPosition: string | null; }
interface Call { id: string; woFolio: string | null; station: string; part: string; qty: number; priority: string; status: RStatus; reason: string | null; raisedAt: string | null; }
interface Kpis { totalLines: number; stagedLines: number; shortageLines: number; fillRatePct: number; openCalls: number; avgReplenishMinutes: number; stationsShort: number; }

// Carril 1 — planes publicados como cola de surtido + su pick-list.
interface PlanWO { planId: number; workOrder: string; model: string; line: number; quantity: number; priority: string; status: string; publishedAt: string | null; kitId: number | null; totalLines: number; stagedLines: number; shortageLines: number; fillRatePct: number; allStaged: boolean; }
interface PickLine { id: number; partNumber: string; description: string | null; unit: string; quantityRequired: number; requiredQty: number; stagedQty: number; stagingStatus: SStatus; staged: boolean; }
interface PlanPick { planId: number; workOrder: string; model: string; quantity: number; status: string; lines: PickLine[]; summary: { totalLines: number; stagedLines: number; shortageLines: number; fillRatePct: number; allStaged: boolean; }; }

const SMETA: Record<SStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: GRAY }, STAGED: { label: 'Montado', color: GREEN }, SHORTAGE: { label: 'Faltante', color: RED },
};
// Carril 1 usa "Surtido" en vez de "Montado" para la línea del pick-list.
const PMETA: Record<SStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: GRAY }, STAGED: { label: 'Surtido', color: GREEN }, SHORTAGE: { label: 'Faltante', color: RED },
};
const REQUEST_META: Record<'pending' | 'authorized', { label: string; color: string }> = {
  pending: { label: 'Por autorizar', color: AMBER },
  authorized: { label: 'Autorizada', color: GREEN },
};
const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

export default function MaterialStagingPage() {
  const toast = useToast();
  // Carril 1 por defecto (los planes del planeador); el carril 2 sigue accesible.
  const [source, setSource] = useState<Source>('plan');

  // ── Carril 1 (planes publicados → pick-list por planId) ──────────────────────
  const { data: plansData, forbidden: plansForbidden, mutate: mutatePlans } = useApi<PlanWO[]>(source === 'plan' ? '/material-staging/mes/plans' : null);
  const plans = Array.isArray(plansData) ? plansData : [];
  const [selPlan, setSelPlan] = useState<number | null>(null);
  const activePlan = selPlan ?? plans[0]?.planId ?? null;
  const { data: pickData, isLoading: pickLoading, forbidden: pickForbidden, mutate: mutatePick } = useApi<PlanPick>(source === 'plan' && activePlan ? `/material-staging/mes/plans/${activePlan}` : null);
  const pickLines = Array.isArray(pickData?.lines) ? pickData!.lines : [];
  const { data: requestData, mutate: mutateRequests } = useApi<MaterialRequestQueueItem[]>(source === 'plan' ? '/material-requests' : null);
  const materialRequests = useMemo(
    () => activeMaterialRequestQueue(Array.isArray(requestData) ? requestData : []),
    [requestData],
  );
  const materialRequestSummary = useMemo(
    () => summarizeMaterialRequestQueue(Array.isArray(requestData) ? requestData : []),
    [requestData],
  );

  // ── Carril 2 (WO / SfWorkOrder) — intacto, sólo se omite cuando no está activo ─
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>(source === 'wo' ? '/material-staging/kpis' : null);
  const { data: wosData } = useApi<WO[]>(source === 'wo' ? '/production-plan' : null);
  const { data: callsData, mutate: mutateCalls } = useApi<Call[]>(source === 'wo' ? '/material-staging/replenish' : null);
  const wos = useMemo(() => (Array.isArray(wosData) ? wosData.filter((w) => w.status !== 'COMPLETED' && w.status !== 'CANCELLED') : []), [wosData]);
  const calls = Array.isArray(callsData) ? callsData : [];

  const [selWo, setSelWo] = useState<string>('');
  const activeWo = selWo || wos[0]?.id || '';
  const { data: linesData, isLoading, forbidden: linesForbidden, mutate } = useApi<Line[]>(source === 'wo' && activeWo ? `/material-staging/wo/${activeWo}` : null);
  const lines = Array.isArray(linesData) ? linesData : [];
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});

  const forbidden = source === 'plan' ? (plansForbidden || pickForbidden) : linesForbidden;

  function refresh() { mutate(); mutateKpis(); mutateCalls(); }          // carril 2
  function refreshPlan() { mutatePick(); mutatePlans(); mutateRequests(); } // carril 1

  async function moveRequest(id: number, action: 'authorize' | 'reject' | 'fulfill') {
    setBusy(`mr-${id}`);
    try {
      const res = await apiFetch(`${API_BASE}/material-requests/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo actualizar la solicitud.', 'Solicitudes'); return; }
      toast.success(action === 'fulfill' ? 'Solicitud marcada como surtida.' : 'Solicitud actualizada.', 'Solicitudes');
      refreshPlan();
    } catch { toast.error('Error de red.', 'Solicitudes'); } finally { setBusy(null); }
  }

  // ── Carril 2 actions (sin cambios) ───────────────────────────────────────────
  async function generate() {
    if (!activeWo) return;
    setBusy('gen');
    try {
      const res = await apiFetch(`${API_BASE}/material-staging/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ woId: activeWo }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo generar.', 'Surtido'); return; }
      toast.success('Surtido generado desde el ruteo.', 'Surtido'); refresh();
    } catch { toast.error('Error de red.', 'Surtido'); } finally { setBusy(null); }
  }

  async function confirm(line: Line) {
    const qty = draft[line.id] ?? line.requiredQty;
    setBusy(line.id);
    try {
      const res = await apiFetch(`${API_BASE}/material-staging/${line.id}/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stagedQty: qty }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo confirmar.', 'Surtido'); return; }
      toast.success(`${line.part} montado.`, 'Surtido'); refresh();
    } catch { toast.error('Error de red.', 'Surtido'); } finally { setBusy(null); }
  }

  async function shortage(line: Line) {
    setBusy(line.id);
    try {
      const res = await apiFetch(`${API_BASE}/material-staging/${line.id}/shortage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo marcar.', 'Surtido'); return; }
      toast.success(`Faltante de ${line.part} → llamado de reposición.`, 'Surtido'); refresh();
    } catch { toast.error('Error de red.', 'Surtido'); } finally { setBusy(null); }
  }

  async function moveCall(call: Call, status: RStatus) {
    setBusy(call.id);
    try {
      const res = await apiFetch(`${API_BASE}/material-staging/replenish/${call.id}/transition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo mover.', 'Surtido'); return; }
      toast.success('Llamado actualizado.', 'Surtido'); refresh();
    } catch { toast.error('Error de red.', 'Surtido'); } finally { setBusy(null); }
  }

  // ── Carril 1 actions (puente MES) ────────────────────────────────────────────
  async function stagePlanAll() {
    if (!activePlan) return;
    setBusy('stage-all');
    try {
      const res = await apiFetch(`${API_BASE}/material-staging/mes/plans/${activePlan}/stage-all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo surtir.', 'Surtido'); return; }
      toast.success('Plan surtido completo.', 'Surtido'); refreshPlan();
    } catch { toast.error('Error de red.', 'Surtido'); } finally { setBusy(null); }
  }

  async function stagePlanLine(line: PickLine) {
    if (!activePlan) return;
    const qty = draft[`p${line.id}`] ?? line.requiredQty;
    setBusy(`p${line.id}`);
    try {
      const res = await apiFetch(`${API_BASE}/material-staging/mes/plans/${activePlan}/lines/${line.id}/stage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stagedQty: qty }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo surtir.', 'Surtido'); return; }
      toast.success(`${line.partNumber} surtido.`, 'Surtido'); refreshPlan();
    } catch { toast.error('Error de red.', 'Surtido'); } finally { setBusy(null); }
  }

  async function unstagePlanLine(line: PickLine) {
    if (!activePlan) return;
    setBusy(`p${line.id}`);
    try {
      const res = await apiFetch(`${API_BASE}/material-staging/mes/plans/${activePlan}/lines/${line.id}/unstage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d?.message || 'No se pudo revertir.', 'Surtido'); return; }
      toast.success(`${line.partNumber} de vuelta a pendiente.`, 'Surtido'); refreshPlan();
    } catch { toast.error('Error de red.', 'Surtido'); } finally { setBusy(null); }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Necesitas permiso de materiales para surtir a línea.</p>
        </div>
      </div>
    );
  }

  const activePlanWO = plans.find((p) => p.planId === activePlan) ?? null;
  const activePlanKitId = activePlanWO?.kitId ?? null;

  return (
    <div className="min-h-screen text-foreground font-sans pb-32">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader
          domain="staging"
          icon={PackagePlus}
          title="Surtido y e-kanban a línea"
          subtitle="El materialista monta el kit por estación · el operador ve si falta material"
        />

        {/* Fuente: carril 1 (planes) vs carril 2 (WO) */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="inline-flex rounded-xl p-1 bg-black/5 dark:bg-white/10">
            <button
              onClick={() => setSource('plan')}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors"
              style={{ background: source === 'plan' ? BLUE : 'transparent', color: source === 'plan' ? '#fff' : undefined }}
            >
              <ClipboardList className="w-4 h-4" /> Carril 1 · Planes
            </button>
            <button
              onClick={() => setSource('wo')}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 transition-colors"
              style={{ background: source === 'wo' ? BLUE : 'transparent', color: source === 'wo' ? '#fff' : undefined }}
            >
              <Boxes className="w-4 h-4" /> Carril 2 · WO
            </button>
          </div>
          <span className="text-[12px] text-gray-500 dark:text-gray-400">
            {source === 'plan'
              ? 'Surtiendo los planes publicados por el planeador (pick-list por plan).'
              : 'Surtiendo las órdenes de trabajo del plan de producción (por estación).'}
          </span>
        </div>

        {source === 'plan' ? (
          /* ─────────────── Carril 1 · Planes publicados ─────────────── */
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
              <Kpi label="Fill-rate del plan" value={pct(pickData?.summary?.fillRatePct ?? 0)} color={GREEN} />
              <Kpi label="Planes publicados" value={plans.length} color={BLUE} />
              <Kpi label="Líneas surtidas" value={`${pickData?.summary?.stagedLines ?? 0}/${pickData?.summary?.totalLines ?? 0}`} color={GREEN} />
              <Kpi label="Solicitudes activas" value={materialRequestSummary.active} color={materialRequestSummary.pending > 0 ? AMBER : GREEN} />
              <Kpi label="Estado del plan" value={activePlanWO?.allStaged ? 'Listo' : 'Pendiente'} color={activePlanWO?.allStaged ? GREEN : AMBER} />
            </div>

            {/* Plan selector */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-[12px] text-gray-500 dark:text-gray-400">Plan:</span>
              {plans.length === 0 && <span className="text-[12px] text-gray-500 dark:text-gray-400">No hay planes publicados — publica uno desde Planeación.</span>}
              {plans.map((p) => {
                const on = p.planId === activePlan;
                return (
                  <button key={p.planId} onClick={() => setSelPlan(p.planId)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5" style={{ background: on ? BLUE : 'rgba(0,0,0,0.05)', color: on ? '#fff' : undefined }}>
                    {p.workOrder} {p.allStaged && <PackageCheck className="w-3.5 h-3.5" style={{ color: on ? '#fff' : GREEN }} />}
                  </button>
                );
              })}
            </div>

            {/* Pick-list del plan */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2"><Boxes className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Pick-list del plan {activePlanWO ? <>· <ModelName code={activePlanWO.model} /></> : ''}</h3>
                  {activePlan && pickLines.length > 0 && (
                    <button onClick={stagePlanAll} disabled={busy === 'stage-all'} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-60" style={{ background: GREEN }}>
                      {busy === 'stage-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />} Surtir todo
                    </button>
                  )}
                </div>
                {pickLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
                ) : !activePlan ? (
                  <div className={`${glass} rounded-2xl p-10 text-center`}>
                    <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona un plan publicado para ver su pick-list.</p>
                  </div>
                ) : pickLines.length === 0 ? (
                  <div className={`${glass} rounded-2xl p-10 text-center`}>
                    <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Este plan no tiene pick-list (¿BOM sin explotar al publicar?).</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pickLines.map((l) => (
                      <div key={l.id} className={`${glass} rounded-xl p-3.5`}>
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-medium">{l.partNumber}</span>
                              {l.description && <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{l.description}</span>}
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${PMETA[l.stagingStatus].color}1f`, color: PMETA[l.stagingStatus].color }}>{PMETA[l.stagingStatus].label}</span>
                            </div>
                            <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Requerido {l.requiredQty} {l.unit} · surtido {l.stagedQty}</div>
                          </div>
                          <input
                            type="number" defaultValue={l.requiredQty}
                            onChange={(e) => setDraft({ ...draft, [`p${l.id}`]: Number(e.target.value) })}
                            onKeyDown={(e) => { if (e.key === 'Enter') stagePlanLine(l); }}
                            className="ci-input w-24" />
                          <button onClick={() => stagePlanLine(l)} disabled={busy === `p${l.id}`} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: GREEN }}>Surtir</button>
                          {l.staged && (
                            <button onClick={() => unstagePlanLine(l)} disabled={busy === `p${l.id}`} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50 inline-flex items-center gap-1" style={{ background: `${GRAY}1f`, color: GRAY }}><RotateCcw className="w-3 h-3" /> Revertir</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen del plan */}
              <div>
                <MaterialRequestQueue
                  requests={materialRequests}
                  activePlanKitId={activePlanKitId}
                  busy={busy}
                  onAction={moveRequest}
                />
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Planes publicados</h3>
                {plans.length === 0 ? (
                  <div className={`${glass} rounded-2xl p-8 text-center`}><Inbox className="w-6 h-6 mx-auto mb-2 text-gray-500 dark:text-gray-400" /><p className="text-[12px] text-gray-500 dark:text-gray-400">Sin planes publicados.</p></div>
                ) : (
                  <div className="space-y-2">
                    {plans.map((p) => (
                      <button key={p.planId} onClick={() => setSelPlan(p.planId)} className={`${glass} rounded-xl p-3 w-full text-left ${p.planId === activePlan ? 'ring-2' : ''}`} style={p.planId === activePlan ? { boxShadow: `inset 0 0 0 2px ${BLUE}` } : undefined}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium">{p.workOrder}</span>
                          <ModelName code={p.model} className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500" />

                          {p.allStaged
                            ? <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" style={{ background: `${GREEN}1f`, color: GREEN }}><CheckCircle2 className="w-3 h-3" /> Listo</span>
                            : <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${AMBER}1f`, color: AMBER }}>{pct(p.fillRatePct)}</span>}
                        </div>
                        <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{p.stagedLines}/{p.totalLines} líneas · {p.quantity} u · línea {p.line}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* ─────────────── Carril 2 · WO (sin cambios) ─────────────── */
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
              <Kpi label="Fill-rate a línea" value={pct(kpis?.fillRatePct ?? 0)} color={GREEN} />
              <Kpi label="Faltantes" value={kpis?.shortageLines ?? 0} color={RED} />
              <Kpi label="Llamados abiertos" value={kpis?.openCalls ?? 0} color={AMBER} />
              <Kpi label="Tiempo reposición" value={`${kpis?.avgReplenishMinutes ?? 0} min`} color={BLUE} />
              <Kpi label="Estaciones cortas" value={kpis?.stationsShort ?? 0} color={RED} />
            </div>

            {/* WO selector */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-[12px] text-gray-500 dark:text-gray-400">WO:</span>
              {wos.length === 0 && <span className="text-[12px] text-gray-500 dark:text-gray-400">No hay WOs activas — publica una en el muro del plan.</span>}
              {wos.map((w) => {
                const on = w.id === activeWo;
                return (
                  <button key={w.id} onClick={() => setSelWo(w.id)} className="px-3 py-1.5 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5" style={{ background: on ? BLUE : 'rgba(0,0,0,0.05)', color: on ? '#fff' : undefined }}>
                    {w.folio || w.model} {w.materialReady && <PackageCheck className="w-3.5 h-3.5" style={{ color: on ? '#fff' : GREEN }} />}
                  </button>
                );
              })}
            </div>

            {/* Staging lines */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2"><Boxes className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Material por estación</h3>
                  {activeWo && lines.length === 0 && (
                    <button onClick={generate} disabled={busy === 'gen'} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white disabled:opacity-60" style={{ background: BLUE }}>
                      {busy === 'gen' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Generar surtido
                    </button>
                  )}
                </div>
                {isLoading ? (
                  <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
                ) : lines.length === 0 ? (
                  <div className={`${glass} rounded-2xl p-10 text-center`}>
                    <Inbox className="w-7 h-7 mx-auto mb-2 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Sin líneas de surtido. Genera el kit desde el ruteo de IE.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lines.map((l) => (
                      <div key={l.id} className={`${glass} rounded-xl p-3.5`}>
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{l.station}</span>
                              <span className="font-mono font-medium">{l.part}</span>
                              {l.feederPosition && <span className="text-[11px] text-gray-500 dark:text-gray-400">feeder {l.feederPosition}</span>}
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${SMETA[l.status].color}1f`, color: SMETA[l.status].color }}>{SMETA[l.status].label}</span>
                            </div>
                            <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">Requerido {l.requiredQty} · en línea {l.stagedQty} · kanban {l.minQty}</div>
                          </div>
                          <input
                            type="number" defaultValue={l.requiredQty}
                            onChange={(e) => setDraft({ ...draft, [l.id]: Number(e.target.value) })}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirm(l); }}
                            className="ci-input w-24" />
                          <button onClick={() => confirm(l)} disabled={busy === l.id} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: GREEN }}>Montar</button>
                          <button onClick={() => shortage(l)} disabled={busy === l.id} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: `${RED}1f`, color: RED }}>Faltante</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Replenish board */}
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Llamados de reposición</h3>
                {calls.filter((c) => c.status === 'OPEN' || c.status === 'IN_TRANSIT').length === 0 ? (
                  <div className={`${glass} rounded-2xl p-8 text-center`}><CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: GREEN }} /><p className="text-[12px] text-gray-500 dark:text-gray-400">Sin llamados pendientes.</p></div>
                ) : (
                  <div className="space-y-2">
                    {calls.filter((c) => c.status === 'OPEN' || c.status === 'IN_TRANSIT').map((c) => (
                      <div key={c.id} className={`${glass} rounded-xl p-3`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium">{c.part}</span>
                          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: `${AMBER}1f`, color: AMBER }}>{c.station}</span>
                          {(c.priority === 'URGENT' || c.priority === 'HIGH') && <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5" style={{ background: `${RED}1f`, color: RED }}><AlertTriangle className="w-3 h-3" /> {c.priority}</span>}
                          {c.reason && <span className="text-[10px] text-gray-500 dark:text-gray-400">{c.reason}</span>}
                        </div>
                        <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{c.qty} u {c.woFolio ? `· ${c.woFolio}` : ''}</div>
                        <div className="mt-2 flex gap-1.5">
                          {c.status === 'OPEN' && <button onClick={() => moveCall(c, 'IN_TRANSIT')} disabled={busy === c.id} className="px-2 py-1 rounded text-[11px] font-medium disabled:opacity-50" style={{ background: `${BLUE}1f`, color: BLUE }}>En tránsito</button>}
                          <button onClick={() => moveCall(c, 'DELIVERED')} disabled={busy === c.id} className="px-2 py-1 rounded text-[11px] font-medium text-white disabled:opacity-50" style={{ background: GREEN }}>Entregado</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <style jsx global>{`
        .ci-input { border-radius: 0.6rem; padding: 0.4rem 0.6rem; background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.08); outline: none; font-size: 0.85rem; }
        .ci-input:focus { border-color: ${BLUE}; }
        :global(.dark) .ci-input { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

function MaterialRequestQueue({
  requests,
  activePlanKitId,
  busy,
  onAction,
}: {
  requests: MaterialRequestQueueItem[];
  activePlanKitId: number | null;
  busy: string | null;
  onAction: (id: number, action: 'authorize' | 'reject' | 'fulfill') => void;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Truck className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Solicitudes de material
        </h3>
        {requests.length > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: AMBER, backgroundColor: `${AMBER}1f` }}>
            {requests.length}
          </span>
        )}
      </div>
      {requests.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center`}>
          <CheckCircle2 className="w-6 h-6 mx-auto mb-2" style={{ color: GREEN }} />
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Sin solicitudes pendientes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => {
            const meta = REQUEST_META[request.status as 'pending' | 'authorized'] ?? { label: request.status, color: GRAY };
            const isBusy = busy === `mr-${request.id}`;
            const isActivePlan = activePlanKitId !== null && request.kitId === activePlanKitId;
            const contextLabel = materialRequestContextLabel(request);
            return (
              <div key={request.id} className={`${glass} rounded-xl p-3 ${isBusy ? 'opacity-70' : ''}`} style={isActivePlan ? { boxShadow: `inset 0 0 0 2px ${AMBER}` } : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${meta.color}1f`, color: meta.color }}>{meta.label}</span>
                      {request.workOrder && <span className="font-mono text-[12px] text-gray-500">{request.workOrder}</span>}
                      {isActivePlan && <span className="text-[10px] text-amber-500">plan activo</span>}
                    </div>
                    <div className="text-sm font-semibold mt-1 truncate">{request.model ? <ModelName code={request.model} /> : `Kit #${request.kitId}`}</div>
                    {contextLabel && <div className="mt-1 text-[12px] font-semibold text-gray-600 dark:text-gray-300 truncate">{contextLabel}</div>}
                    <div className="text-[12px] text-gray-500 dark:text-gray-400">
                      {request.quantity ? `${request.quantity} u plan · ` : ''}Solicito {request.requestedBy}
                    </div>
                    {request.note && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate">{request.note}</div>}
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {request.status === 'pending' && (
                    <>
                      <button onClick={() => onAction(request.id, 'authorize')} disabled={isBusy} className="px-2 py-1 rounded text-[11px] font-medium text-white disabled:opacity-50 inline-flex items-center gap-1" style={{ background: GREEN }}>
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Autorizar
                      </button>
                      <button onClick={() => onAction(request.id, 'reject')} disabled={isBusy} className="px-2 py-1 rounded text-[11px] font-medium disabled:opacity-50 inline-flex items-center gap-1" style={{ background: `${RED}1f`, color: RED }}>
                        <X className="w-3 h-3" /> Rechazar
                      </button>
                    </>
                  )}
                  {request.status === 'authorized' && (
                    <button onClick={() => onAction(request.id, 'fulfill')} disabled={isBusy} className="px-2 py-1 rounded text-[11px] font-medium text-white disabled:opacity-50 inline-flex items-center gap-1" style={{ background: GREEN }}>
                      {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />} Marcar surtido
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
