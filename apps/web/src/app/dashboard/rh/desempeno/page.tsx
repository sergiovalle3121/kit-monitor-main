'use client';

import React, { useMemo, useState } from 'react';
import { Target, Plus, X, Loader2, CheckCircle2, Star } from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { RhShell, Kpi, Forbidden, Spinner, RhStyles, COLORS, fmtInt } from '../_components/ui';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface NineCell {
  index: number;
  key: string;
  label: string;
  action: string;
  count: number;
  people: { name: string; area: string | null; score: number | null }[];
}
interface NineBox {
  cells: NineCell[];
  total: number;
  successionReadyNow: number;
}
interface Review {
  id: string;
  folio: string | null;
  employeeName: string;
  area: string | null;
  period: string;
  performanceScore: number | null;
  potential: 'LOW' | 'MED' | 'HIGH' | null;
  nineBoxKey: string | null;
  status: string;
  successionReadiness: string | null;
  reviewDate: string | null;
}
interface Employee { id: string; firstName: string; lastName: string; area: string | null }

const CELL_COLOR: Record<string, string> = {
  STAR: COLORS.green, HIGH_IMPACT: '#22c55e', EMERGING: '#14b8a6',
  EXPERT: COLORS.blue, CORE: COLORS.blue, SOLID: COLORS.gray,
  ENIGMA: COLORS.amber, DEVELOP: COLORS.amber, RISK: COLORS.red,
};
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', SUBMITTED: 'Enviada', CALIBRATED: 'Calibrada', CLOSED: 'Cerrada' };
const POT_LABEL: Record<string, string> = { LOW: 'Bajo', MED: 'Medio', HIGH: 'Alto' };

const EMPTY = { employeeName: '', employeeId: '', area: '', period: '2026-H1', performanceScore: '3', potential: 'MED', goalsMetPct: '', successionReadiness: '', comments: '' };

export default function DesempenoPage() {
  const { data: nine, isLoading, forbidden, mutate } = useApi<NineBox>('/hr/analytics/nine-box');
  const { data: reviews, mutate: mutateReviews } = useApi<Review[]>('/hr/reviews');
  const { data: employees } = useApi<Employee[]>('/hr/employees');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const reviewList = Array.isArray(reviews) ? reviews : [];
  const emps = Array.isArray(employees) ? employees : [];
  const cellByIndex = useMemo(() => {
    const m = new Map<number, NineCell>();
    (nine?.cells ?? []).forEach((c) => m.set(c.index, c));
    return m;
  }, [nine]);

  function refresh() {
    mutate();
    mutateReviews();
  }

  async function createReview() {
    if (form.employeeName.trim().length < 2) { toast.error('Indica el colaborador.', 'Desempeño'); return; }
    setBusy(true);
    try {
      const matched = emps.find((e) => `${e.firstName} ${e.lastName}` === form.employeeName);
      const body = {
        employeeName: form.employeeName,
        employeeId: matched?.id || undefined,
        area: form.area || matched?.area || undefined,
        period: form.period,
        performanceScore: Number(form.performanceScore),
        potential: form.potential,
        goalsMetPct: form.goalsMetPct ? Number(form.goalsMetPct) : undefined,
        successionReadiness: form.successionReadiness || undefined,
        comments: form.comments || undefined,
      };
      const res = await apiFetch(`${API_BASE}/hr/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error('No se pudo guardar.', 'Desempeño'); return; }
      toast.success('Evaluación registrada.', 'Desempeño');
      setShowForm(false);
      setForm({ ...EMPTY });
      refresh();
    } catch {
      toast.error('Error de red.', 'Desempeño');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return <Forbidden />;

  return (
    <RhShell
      title="Desempeño y talento (9-box)"
      subtitle="Evaluaciones, matriz desempeño × potencial y sucesión"
      icon={Target}
      color={COLORS.blue}
      action={
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: COLORS.blue }}>
          <Plus className="w-4 h-4" /> Evaluar
        </button>
      }
    >
      <RhStyles />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Evaluados" value={fmtInt(nine?.total)} color={COLORS.blue} />
        <Kpi label="Listos para promover" value={fmtInt(nine?.successionReadyNow)} sub="sucesión inmediata" color={COLORS.green} />
        <Kpi label="Estrellas" value={fmtInt(cellByIndex.get(9)?.count)} sub="alto desempeño + potencial" color={COLORS.green} />
        <Kpi label="En riesgo" value={fmtInt(cellByIndex.get(1)?.count)} sub="acción requerida" color={COLORS.red} />
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {/* 9-box grid */}
          <section className={`${glass} rounded-2xl p-5 mb-6`}>
            <h3 className="font-semibold mb-1">Matriz 9-box</h3>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">Eje vertical: desempeño · Eje horizontal: potencial</p>
            <div className="flex gap-3">
              <div className="flex flex-col justify-between py-2 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                <span>Desempeño →</span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-2">
                  {[2, 1, 0].map((perf) =>
                    [0, 1, 2].map((pot) => {
                      const index = perf * 3 + pot + 1;
                      const cell = cellByIndex.get(index);
                      const color = CELL_COLOR[cell?.key ?? ''] ?? COLORS.gray;
                      return (
                        <div key={index} className="rounded-xl p-3 min-h-[104px] border" style={{ background: `${color}0f`, borderColor: `${color}33` }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold" style={{ color }}>{cell?.label ?? '—'}</span>
                            <span className="text-[11px] tabular-nums font-bold" style={{ color }}>{cell?.count ?? 0}</span>
                          </div>
                          <div className="mt-1.5 space-y-0.5">
                            {(cell?.people ?? []).slice(0, 3).map((p, i) => (
                              <div key={i} className="text-[11px] text-gray-600 dark:text-gray-300 truncate">{p.name}</div>
                            ))}
                            {(cell?.people?.length ?? 0) > 3 && <div className="text-[10px] text-gray-500 dark:text-gray-400">+{(cell?.people.length ?? 0) - 3} más</div>}
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 text-center">
                  <span>Potencial bajo</span><span>Medio</span><span>Alto</span>
                </div>
              </div>
            </div>
          </section>

          {showForm && (
            <div className={`${glass} rounded-2xl p-5 mb-6`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Nueva evaluación</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Colaborador">
                  <input list="emp-list" value={form.employeeName} onChange={(e) => setForm({ ...form, employeeName: e.target.value })} placeholder="Nombre" className="rh-input" />
                  <datalist id="emp-list">{emps.map((e) => <option key={e.id} value={`${e.firstName} ${e.lastName}`} />)}</datalist>
                </Field>
                <Field label="Área"><input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className="rh-input" /></Field>
                <Field label="Periodo"><input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-H1" className="rh-input" /></Field>
                <Field label="Desempeño (1-5)">
                  <select value={form.performanceScore} onChange={(e) => setForm({ ...form, performanceScore: e.target.value })} className="rh-input">
                    <option value="1">1 · Bajo</option><option value="2">2</option><option value="3">3 · Cumple</option><option value="4">4</option><option value="5">5 · Sobresale</option>
                  </select>
                </Field>
                <Field label="Potencial">
                  <select value={form.potential} onChange={(e) => setForm({ ...form, potential: e.target.value })} className="rh-input">
                    <option value="LOW">Bajo</option><option value="MED">Medio</option><option value="HIGH">Alto</option>
                  </select>
                </Field>
                <Field label="% objetivos"><input type="number" value={form.goalsMetPct} onChange={(e) => setForm({ ...form, goalsMetPct: e.target.value })} placeholder="85" className="rh-input" /></Field>
                <Field label="Sucesión">
                  <select value={form.successionReadiness} onChange={(e) => setForm({ ...form, successionReadiness: e.target.value })} className="rh-input">
                    <option value="">—</option><option value="READY_NOW">Listo ahora</option><option value="ONE_TWO_YEARS">1-2 años</option><option value="NOT_READY">No listo</option>
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Comentarios"><input value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} className="rh-input" /></Field>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
                <button onClick={createReview} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: COLORS.blue }}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
                </button>
              </div>
            </div>
          )}

          {/* Reviews list */}
          <section>
            <h3 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-3">Evaluaciones recientes</h3>
            {reviewList.length === 0 ? (
              <div className={`${glass} rounded-3xl p-12 text-center`}>
                <Star className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
                <h3 className="font-semibold">Sin evaluaciones</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Registra evaluaciones para poblar la matriz 9-box.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {reviewList.map((v) => {
                  const color = CELL_COLOR[v.nineBoxKey ?? ''] ?? COLORS.gray;
                  return (
                    <div key={v.id} className={`${glass} rounded-xl p-4 flex items-center gap-3`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate">{v.employeeName}</span>
                          {v.nineBoxKey && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${color}1f`, color }}>{cellLabel(v.nineBoxKey)}</span>}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">{STATUS_LABEL[v.status] ?? v.status}</span>
                        </div>
                        <div className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                          {v.period}{v.area && ` · ${v.area}`}
                          {v.performanceScore != null && ` · desempeño ${v.performanceScore}/5`}
                          {v.potential && ` · potencial ${POT_LABEL[v.potential]}`}
                        </div>
                      </div>
                      {v.successionReadiness === 'READY_NOW' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1" style={{ background: `${COLORS.green}1f`, color: COLORS.green }}>
                          <Star className="w-3 h-3" /> Sucesión
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </RhShell>
  );
}

const CELL_LABEL: Record<string, string> = {
  STAR: 'Estrella', HIGH_IMPACT: 'Alto impacto', EMERGING: 'Alto potencial',
  EXPERT: 'Experto', CORE: 'Clave', SOLID: 'Sólido',
  ENIGMA: 'Enigma', DEVELOP: 'En desarrollo', RISK: 'Riesgo',
};
function cellLabel(key: string): string {
  return CELL_LABEL[key] ?? key;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
