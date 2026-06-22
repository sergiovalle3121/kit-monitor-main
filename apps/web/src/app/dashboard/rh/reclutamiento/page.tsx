'use client';

import React, { useState } from 'react';
import { UserPlus, Plus, X, Loader2, CheckCircle2, Inbox, ChevronRight } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { RhShell, Kpi, Bar, Forbidden, Spinner, RhStyles, COLORS, fmtInt, fmtPct } from '../_components/ui';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Requisition {
  id: string;
  folio: string | null;
  title: string;
  area: string | null;
  shift: string | null;
  laborType: 'DIRECT' | 'INDIRECT';
  openings: number;
  filledCount: number;
  status: 'OPEN' | 'ON_HOLD' | 'FILLED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: 'GROWTH' | 'REPLACEMENT' | 'RAMP';
  program: string | null;
  customer: string | null;
  openedDate: string | null;
}

interface Candidate {
  id: string;
  requisitionId: string | null;
  name: string;
  stage: 'APPLIED' | 'SCREEN' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
  source: string | null;
  appliedDate: string | null;
}

interface Funnel {
  openRequisitions: number;
  totalOpenings: number;
  filledOpenings: number;
  fillRatePct: number;
  avgTimeToFillDays: number | null;
  agingRequisitions: number;
  byStage: { stage: string; count: number }[];
  offerAcceptPct: number | null;
  rampRequisitions: number;
}

const STAGE_LABEL: Record<string, string> = {
  APPLIED: 'Postulados', SCREEN: 'Filtro', INTERVIEW: 'Entrevista', OFFER: 'Oferta',
  HIRED: 'Contratados', REJECTED: 'Rechazados', WITHDRAWN: 'Declinaron',
};
const REQ_STATUS: Record<Requisition['status'], { label: string; color: string }> = {
  OPEN: { label: 'Abierta', color: COLORS.green },
  ON_HOLD: { label: 'En pausa', color: COLORS.amber },
  FILLED: { label: 'Cubierta', color: COLORS.blue },
  CANCELLED: { label: 'Cancelada', color: COLORS.gray },
};
const PRIORITY_COLOR: Record<string, string> = { LOW: COLORS.gray, MEDIUM: COLORS.blue, HIGH: COLORS.amber, CRITICAL: COLORS.red };
const NEXT_STAGE: Record<string, { to: string; label: string }[]> = {
  APPLIED: [{ to: 'SCREEN', label: 'A filtro' }, { to: 'REJECTED', label: 'Rechazar' }],
  SCREEN: [{ to: 'INTERVIEW', label: 'A entrevista' }, { to: 'REJECTED', label: 'Rechazar' }],
  INTERVIEW: [{ to: 'OFFER', label: 'Hacer oferta' }, { to: 'REJECTED', label: 'Rechazar' }],
  OFFER: [{ to: 'HIRED', label: 'Contratar' }, { to: 'REJECTED', label: 'Rechazar' }],
};

const EMPTY_REQ = { title: '', area: '', shift: '', laborType: 'DIRECT', openings: '1', priority: 'MEDIUM', reason: 'GROWTH', program: '', customer: '' };

export default function ReclutamientoPage() {
  const { data: reqs, isLoading, forbidden, mutate } = useApi<Requisition[]>('/hr/requisitions');
  const { data: cands, mutate: mutateCands } = useApi<Candidate[]>('/hr/candidates');
  const { data: funnel, mutate: mutateFunnel } = useApi<Funnel>('/hr/analytics/recruiting');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_REQ });
  const [newCand, setNewCand] = useState<{ reqId: string; name: string } | null>(null);

  const requisitions = Array.isArray(reqs) ? reqs : [];
  const candidates = Array.isArray(cands) ? cands : [];

  function refresh() {
    mutate();
    mutateCands();
    mutateFunnel();
  }

  async function post(url: string, body: unknown, ok: string, err: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error(err, 'Reclutamiento'); return false; }
      toast.success(ok, 'Reclutamiento');
      refresh();
      return true;
    } catch {
      toast.error('Error de red.', 'Reclutamiento');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createReq() {
    if (form.title.trim().length < 2) { toast.error('Indica el puesto.', 'Reclutamiento'); return; }
    const ok = await post('/hr/requisitions', { ...form, openings: Number(form.openings) || 1 }, 'Requisición abierta.', 'No se pudo abrir.');
    if (ok) { setShowForm(false); setForm({ ...EMPTY_REQ }); }
  }

  async function addCandidate(reqId: string) {
    if (!newCand || newCand.name.trim().length < 2) return;
    const ok = await post('/hr/candidates', { name: newCand.name, requisitionId: reqId, source: 'WALK_IN' }, 'Candidato agregado.', 'No se pudo agregar.');
    if (ok) setNewCand(null);
  }

  if (forbidden) return <Forbidden />;

  const maxStage = Math.max(1, ...(funnel?.byStage ?? []).filter((s) => ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED'].includes(s.stage)).map((s) => s.count));

  return (
    <RhShell
      title="Reclutamiento y selección"
      subtitle="Vacantes, pipeline de candidatos y time-to-fill"
      icon={UserPlus}
      color={COLORS.green}
      action={
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.green }}>
          <Plus className="w-4 h-4" /> Requisición
        </button>
      }
    >
      <RhStyles />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Vacantes abiertas" value={fmtInt(funnel?.openRequisitions)} sub={`${fmtInt(funnel?.totalOpenings)} posiciones`} color={COLORS.green} />
        <Kpi label="% cubierto" value={fmtPct(funnel?.fillRatePct, 0)} color={COLORS.blue} />
        <Kpi label="Time-to-fill prom." value={funnel?.avgTimeToFillDays != null ? `${funnel.avgTimeToFillDays}d` : '—'} sub={`${fmtInt(funnel?.agingRequisitions)} > 45d`} color={COLORS.amber} />
        <Kpi label="Vacantes de rampa" value={fmtInt(funnel?.rampRequisitions)} sub="programas nuevos" color={COLORS.violet} />
      </div>

      {/* Funnel */}
      <section className={`${glass} rounded-2xl p-5 mb-6`}>
        <h3 className="font-semibold mb-4">Embudo de selección</h3>
        <div className="space-y-3">
          {['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED'].map((stage) => {
            const count = funnel?.byStage?.find((s) => s.stage === stage)?.count ?? 0;
            return <Bar key={stage} label={STAGE_LABEL[stage]} value={count} max={maxStage} color={stage === 'HIRED' ? COLORS.green : COLORS.violet} />;
          })}
        </div>
      </section>

      {showForm && (
        <div className={`${glass} rounded-2xl p-5 mb-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Nueva requisición</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Puesto"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Operador SMT" className="rh-input" /></Field>
            <Field label="Área"><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className="rh-input" /></Field>
            <Field label="Turno">
              <select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} className="rh-input">
                <option value="">—</option><option value="A">A</option><option value="B">B</option><option value="C">C</option>
              </select>
            </Field>
            <Field label="Posiciones"><input type="number" value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} className="rh-input" /></Field>
            <Field label="Mano de obra">
              <select value={form.laborType} onChange={(e) => setForm({ ...form, laborType: e.target.value })} className="rh-input">
                <option value="DIRECT">Directa</option><option value="INDIRECT">Indirecta</option>
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rh-input">
                <option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option>
              </select>
            </Field>
            <Field label="Motivo">
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="rh-input">
                <option value="GROWTH">Crecimiento</option><option value="REPLACEMENT">Reemplazo</option><option value="RAMP">Rampa de programa</option>
              </select>
            </Field>
            <Field label="Programa / cliente"><input value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} placeholder="Axos Mobility" className="rh-input" /></Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={createReq} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: COLORS.green }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Abrir requisición
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : requisitions.length === 0 ? (
        <div className={`${glass} rounded-3xl p-12 text-center`}>
          <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h3 className="font-semibold">Sin requisiciones</h3>
          <p className="text-sm text-gray-400 mt-1">Abre una vacante para empezar a construir el pipeline.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requisitions.map((r) => {
            const st = REQ_STATUS[r.status];
            const mine = candidates.filter((c) => c.requisitionId === r.id);
            return (
              <div key={r.id} className={`${glass} rounded-2xl p-4`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{r.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${st.color}1f`, color: st.color }}>{st.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${PRIORITY_COLOR[r.priority]}1f`, color: PRIORITY_COLOR[r.priority] }}>{r.priority}</span>
                      {r.reason === 'RAMP' && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${COLORS.violet}1f`, color: COLORS.violet }}>Rampa</span>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-gray-400">
                      {r.folio && <span>{r.folio} · </span>}
                      {r.area ?? 'Sin área'}{r.shift && ` · T${r.shift}`} · {r.filledCount}/{r.openings} cubiertas
                      {r.program && <span> · {r.program}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {r.status === 'OPEN' && (
                      <button onClick={() => post(`/hr/requisitions/${r.id}/transition`, { to: 'ON_HOLD' }, 'En pausa.', 'No se pudo.')} disabled={busy} className="px-2.5 py-1.5 rounded-lg text-[12px] hover:bg-black/5 dark:hover:bg-white/10">Pausar</button>
                    )}
                    {r.status === 'ON_HOLD' && (
                      <button onClick={() => post(`/hr/requisitions/${r.id}/transition`, { to: 'OPEN' }, 'Reabierta.', 'No se pudo.')} disabled={busy} className="px-2.5 py-1.5 rounded-lg text-[12px] hover:bg-black/5 dark:hover:bg-white/10">Reabrir</button>
                    )}
                    {(r.status === 'OPEN' || r.status === 'ON_HOLD') && (
                      <button onClick={() => post(`/hr/requisitions/${r.id}/transition`, { to: 'FILLED' }, 'Marcada como cubierta.', 'No se pudo.')} disabled={busy} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: `${COLORS.blue}1f`, color: COLORS.blue }}>Cubrir</button>
                    )}
                  </div>
                </div>

                {/* candidate pipeline for this req */}
                <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">Pipeline · {mine.length}</span>
                    {newCand?.reqId === r.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={newCand.name} onChange={(e) => setNewCand({ reqId: r.id, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addCandidate(r.id)} placeholder="Nombre del candidato" className="rh-input !w-48 !py-1 !text-[12px]" />
                        <button onClick={() => addCandidate(r.id)} disabled={busy} className="p-1.5 rounded-lg" style={{ color: COLORS.green }}><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setNewCand(null)} className="p-1.5 rounded-lg text-gray-400"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setNewCand({ reqId: r.id, name: '' })} className="text-[12px] inline-flex items-center gap-1" style={{ color: COLORS.green }}><Plus className="w-3.5 h-3.5" /> Candidato</button>
                    )}
                  </div>
                  {mine.length > 0 && (
                    <div className="space-y-1.5">
                      {mine.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-[12px]">
                          <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] w-20 text-center flex-shrink-0">{STAGE_LABEL[c.stage]}</span>
                          <span className="flex-1 min-w-0 truncate">{c.name}</span>
                          {(NEXT_STAGE[c.stage] ?? []).map((n) => (
                            <button key={n.to} onClick={() => post(`/hr/candidates/${c.id}/advance`, { to: n.to, createEmployee: n.to === 'HIRED' }, n.label, 'No se pudo.')} disabled={busy} className="text-[11px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10" style={{ color: n.to === 'REJECTED' ? COLORS.gray : COLORS.green }}>
                              {n.label}{n.to !== 'REJECTED' && <ChevronRight className="w-3 h-3" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </RhShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
