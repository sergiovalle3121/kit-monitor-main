'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Factory,
  Megaphone,
  PackageCheck,
  Plus,
  Lock,
  Loader2,
  Send,
  Boxes,
  X,
  Warehouse,
  HandHelping,
  Trash2,
  Gauge,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { PageHeader } from '@/components/ui/PageHeader';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';

interface Plan {
  id: number;
  workOrder: string;
  model: string;
  line: number;
  bahia?: number | null;
  quantity: number;
  shift: string;
  status: 'pending' | 'published' | 'released' | 'active' | 'completed' | 'cancelled';
  priority?: string;
  publishedAt?: string | null;
  publishedBy?: string | null;
  createdAt?: string;
  kitId?: number | null;
}

interface PickListLine {
  partNumber: string;
  description?: string | null;
  quantityRequired: number;
  quantityRemaining?: number | null;
  unit: string;
}
interface PickList {
  planId: number;
  kitId: number | null;
  published: boolean;
  lineCount: number;
  lines: PickListLine[];
}
interface Preview {
  planId: number;
  quantity: number;
  hasBom: boolean;
  lineCount: number;
  lines: PickListLine[];
}
interface ModelOption { id: string; modelNumber: string; name: string; status: string }
// Inteligencia de planeación (GET /plans/intelligence): carga vs capacidad por
// línea (CRP-lite), backlog y riesgos de readiness. Ya existe en el backend.
interface LineLoad {
  line: number | string;
  buildingId?: string | null;
  capacity: number;
  currentLoad: number;
  loadPercent: number;
  status: 'optimal' | 'warning' | 'overloaded';
}
interface Intelligence { backlog: number; lineLoad: LineLoad[]; readinessRisks: number }

const LOAD_COLOR: Record<LineLoad['status'], string> = {
  optimal: GREEN,
  warning: AMBER,
  overloaded: '#ef4444',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Por publicar', color: AMBER, bg: 'rgba(245,158,11,0.12)' },
  published: { label: 'Publicado', color: VIOLET, bg: 'rgba(124,58,237,0.12)' },
  released: { label: 'Liberado', color: VIOLET, bg: 'rgba(124,58,237,0.12)' },
  active: { label: 'En producción', color: GREEN, bg: 'rgba(16,185,129,0.12)' },
  completed: { label: 'Completado', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  cancelled: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export default function PlanningPage() {
  const { data: plans, isLoading, forbidden, mutate } = useApi<Plan[]>('/plans');
  const { data: intel } = useApi<Intelligence>('/plans/intelligence');
  const [pickLists, setPickLists] = useState<Record<number, PickList>>({});
  const [previews, setPreviews] = useState<Record<number, Preview>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const toast = useToast();

  const list = Array.isArray(plans) ? plans : [];
  const counts = {
    pending: list.filter((p) => p.status === 'pending').length,
    published: list.filter((p) => ['published', 'released'].includes(p.status)).length,
    active: list.filter((p) => p.status === 'active').length,
  };

  async function deletePlan(plan: Plan) {
    setBusy(plan.id);
    try {
      const res = await apiFetch(`${API_BASE}/plans/${plan.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || 'No se pudo borrar el plan.', 'Planeación');
        return;
      }
      toast.success(`Plan ${plan.model} eliminado.`, 'Planeación');
      setConfirmId(null);
      mutate();
    } catch {
      toast.error('Error de red al borrar.', 'Planeación');
    } finally {
      setBusy(null);
    }
  }

  async function publish(plan: Plan) {
    setBusy(plan.id);
    try {
      const res = await apiFetch(`${API_BASE}/pick-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message || 'No se pudo publicar el plan.', 'Planeación');
        return;
      }
      setPickLists((prev) => ({ ...prev, [plan.id]: data }));
      toast.success(`Plan ${plan.model} publicado · ${data.lineCount} materiales para almacén`, 'Planeación');
      mutate();
    } catch {
      toast.error('Error de red al publicar.', 'Planeación');
    } finally {
      setBusy(null);
    }
  }

  async function requestMaterial(plan: Plan) {
    if (!plan.kitId) {
      toast.info('Este plan aún no tiene kit. Publícalo primero.', 'Planeación');
      return;
    }
    setBusy(plan.id);
    try {
      const res = await apiFetch(`${API_BASE}/material-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitId: plan.kitId, note: `Solicitud de ${plan.model}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message || 'No se pudo enviar la solicitud.', 'Almacén');
        return;
      }
      toast.success(`Solicitud enviada al almacén · ${plan.model}`, 'Almacén');
    } catch {
      toast.error('Error de red al solicitar.', 'Almacén');
    } finally {
      setBusy(null);
    }
  }

  async function loadPickList(planId: number) {
    if (pickLists[planId]) {
      setPickLists((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE}/pick-lists/${planId}`);
      const data = await res.json();
      if (res.ok) setPickLists((prev) => ({ ...prev, [planId]: data }));
    } catch {
      /* ignore */
    }
  }

  // Preview the BOM-derived materials for a pending plan (no commit).
  async function loadPreview(planId: number) {
    if (previews[planId]) {
      setPreviews((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE}/pick-lists/preview/${planId}`);
      const data = await res.json();
      if (res.ok) setPreviews((prev) => ({ ...prev, [planId]: data }));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        {/* Header */}
        <PageHeader
          domain="planning"
          title="Planeación"
          subtitle="Muro de publicación · planeación publica, el almacén prepara el kit"
          right={
            <>
              <Link href="/dashboard/operador" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800 transition-colors">
                <Factory className="w-4 h-4" /> Piso (MES)
              </Link>
              <Link href="/dashboard/almacen" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-700 transition-colors">
                <Warehouse className="w-4 h-4" /> Almacén
              </Link>
              <button
                data-testid="plan-new-btn"
                onClick={() => setShowForm((v) => !v)}
                className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" /> Nuevo plan
              </button>
            </>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Por publicar', value: counts.pending, color: AMBER },
            { label: 'Publicados', value: counts.published, color: VIOLET },
            { label: 'En producción', value: counts.active, color: GREEN },
          ].map((k) => (
            <div key={k.label} className={`${glass} rounded-2xl p-4`}>
              <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Carga vs capacidad por línea (CRP-lite) — del API /plans/intelligence */}
        <LineLoadPanel intel={intel} />

        {/* New plan form */}
        <AnimatePresence>
          {showForm && (
            <NewPlanForm
              onClose={() => setShowForm(false)}
              onCreated={() => {
                setShowForm(false);
                mutate();
                toast.success('Plan creado. Ya puedes publicarlo.', 'Planeación');
              }}
              onError={(m) => toast.error(m, 'Planeación')}
            />
          )}
        </AnimatePresence>

        {/* States */}
        {forbidden && (
          <EmptyState
            icon={<Lock className="w-6 h-6" />}
            title="Sin acceso al backend"
            body="Tu sesión aún no tiene un token válido del backend. Verifica que el servicio de API esté conectado."
          />
        )}
        {!forbidden && isLoading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}
        {!forbidden && !isLoading && list.length === 0 && (
          <EmptyState
            icon={<Megaphone className="w-6 h-6" />}
            title="Aún no hay planes"
            body="Crea tu primer plan de producción con “Nuevo plan”. Al publicarlo, el sistema explota el BOM y genera la lista de surtido para el almacén."
          />
        )}

        {/* Feed */}
        <div className="space-y-4">
          {list.map((plan) => {
            const meta = STATUS_META[plan.status] ?? STATUS_META.pending;
            const isPublished = ['published', 'released', 'active', 'completed'].includes(plan.status);
            const pick = pickLists[plan.id];
            return (
              <motion.article
                key={plan.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${glass} rounded-3xl p-5`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ color: meta.color, backgroundColor: meta.bg }}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-gray-400 font-mono">WO {plan.workOrder}</span>
                    </div>
                    <h3 className="text-xl font-bold tracking-tight truncate">{plan.model}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {plan.quantity} unidades · Línea {plan.line}
                      {plan.bahia ? ` · Bahía ${plan.bahia}` : ''} · Turno {plan.shift}
                    </p>
                    {plan.publishedBy && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Publicado por {plan.publishedBy}
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    {confirmId === plan.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => deletePlan(plan)}
                          disabled={busy === plan.id}
                          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-rose-500 text-white hover:bg-rose-600 active:scale-95 transition disabled:opacity-60"
                        >
                          {busy === plan.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Borrar
                        </button>
                        <button onClick={() => setConfirmId(null)} className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(plan.id)} aria-label="Borrar plan" className="p-2 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    {plan.status === 'pending' ? (
                      <div className="flex flex-col items-stretch gap-2">
                        <button
                          data-testid="plan-publish"
                          onClick={() => publish(plan)}
                          disabled={busy === plan.id}
                          className="flex items-center justify-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-60"
                        >
                          {busy === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Publicar
                        </button>
                        <button
                          onClick={() => loadPreview(plan.id)}
                          className="flex items-center justify-center gap-2 text-violet-600 dark:text-violet-300 text-sm font-semibold px-4 py-2 rounded-full border border-violet-200 dark:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                        >
                          <Boxes className="w-4 h-4" />
                          {previews[plan.id] ? 'Ocultar' : 'Materiales'}
                        </button>
                      </div>
                    ) : isPublished ? (
                      <div className="flex flex-col items-stretch gap-2">
                        <button
                          onClick={() => requestMaterial(plan)}
                          disabled={busy === plan.id}
                          className="flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-60"
                        >
                          {busy === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandHelping className="w-4 h-4" />}
                          Solicitar
                        </button>
                        <button
                          onClick={() => loadPickList(plan.id)}
                          className="flex items-center justify-center gap-2 text-violet-600 dark:text-violet-300 text-sm font-semibold px-4 py-2 rounded-full border border-violet-200 dark:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                        >
                          <Boxes className="w-4 h-4" />
                          {pick ? 'Ocultar' : 'Pick list'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* PickList */}
                <AnimatePresence>
                  {pick && pick.lines?.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
                        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <PackageCheck className="w-4 h-4 text-emerald-500" />
                          Lista de surtido · {pick.lineCount} materiales
                        </div>
                        <div className="space-y-1.5">
                          {pick.lines.map((l) => (
                            <div
                              key={l.partNumber}
                              className="flex items-center justify-between text-sm px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5"
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-medium">{l.partNumber}</span>
                                {l.description && (
                                  <span className="text-gray-400 ml-2 text-xs truncate">{l.description}</span>
                                )}
                              </div>
                              <span className="font-semibold tabular-nums flex-shrink-0">
                                {l.quantityRequired} {l.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* BOM-derived materials preview (pending plans, before publish) */}
                <AnimatePresence>
                  {previews[plan.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
                        {previews[plan.id].hasBom ? (
                          <>
                            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <Boxes className="w-4 h-4 text-violet-500" />
                              Materiales del BOM · {previews[plan.id].lineCount} · requerimiento para {plan.quantity} u
                            </div>
                            <div className="space-y-1.5">
                              {previews[plan.id].lines.map((l) => (
                                <div key={l.partNumber} className="flex items-center justify-between text-sm px-3 py-2 rounded-xl bg-gray-50 dark:bg-white/5">
                                  <div className="min-w-0">
                                    <span className="font-mono font-medium">{l.partNumber}</span>
                                    {l.description && <span className="text-gray-400 ml-2 text-xs truncate">{l.description}</span>}
                                  </div>
                                  <span className="font-semibold tabular-nums flex-shrink-0">{l.quantityRequired} {l.unit}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-amber-600 dark:text-amber-400 flex items-start gap-2">
                            <Boxes className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>Este modelo no tiene un BOM activo. Defínelo y actívalo en <Link href="/dashboard/models" className="underline">Modelos · NPI</Link> para poder surtir materiales al publicar.</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function NewPlanForm({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({ model: '', line: '1', quantity: '', shift: 'T1', bahia: '' });
  const [saving, setSaving] = useState(false);

  // Plans reference models from the canonical master (no free-text models).
  const { data: modelsData } = useApi<ModelOption[]>('/product-models');
  const models = (Array.isArray(modelsData) ? modelsData : []).filter((m) => m.status !== 'OBSOLETE');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.model.trim() || !form.quantity) {
      onError('Modelo y cantidad son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`${API_BASE}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: form.model.trim(),
          line: Number(form.line),
          quantity: Number(form.quantity),
          shift: form.shift,
          bahia: form.bahia ? Number(form.bahia) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data?.message || 'No se pudo crear el plan.');
        return;
      }
      onCreated();
    } catch {
      onError('Error de red al crear el plan.');
    } finally {
      setSaving(false);
    }
  }

  const field = 'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 transition-all';

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={`${glass} rounded-3xl p-5 mb-6 overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Nuevo plan de producción</h3>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-black dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2 md:col-span-1">
          <label className="text-xs text-gray-500 ml-1">Modelo</label>
          <select data-testid="plan-model-select" className={field} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}>
            <option value="">Selecciona un modelo…</option>
            {models.map((m) => (
              <option key={m.id} value={m.modelNumber}>{m.modelNumber} · {m.name}{m.status === 'DRAFT' ? ' (borrador)' : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 ml-1">Cantidad</label>
          <input className={field} type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Unidades a producir" />
        </div>
        <div>
          <label className="text-xs text-gray-500 ml-1">Línea</label>
          <input className={field} type="number" min={1} max={7} value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-500 ml-1">Bahía (opcional)</label>
          <input className={field} type="number" min={1} value={form.bahia} onChange={(e) => setForm({ ...form, bahia: e.target.value })} placeholder="—" />
        </div>
        <div>
          <label className="text-xs text-gray-500 ml-1">Turno</label>
          <select className={field} value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
            <option value="T1">T1</option>
            <option value="T2">T2</option>
            <option value="T3">T3</option>
          </select>
        </div>
      </div>
      {models.length === 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
          No hay modelos en el maestro. <Link href="/dashboard/models" className="underline">Crea uno primero en Modelos · NPI</Link>.
        </p>
      )}
      <div className="flex justify-end mt-4">
        <button
          type="submit"
          data-testid="plan-create-submit"
          disabled={saving}
          className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-5 py-2.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear plan
        </button>
      </div>
    </motion.form>
  );
}

function LineLoadPanel({ intel }: { intel?: Intelligence }) {
  if (!intel) return null;
  const lines = Array.isArray(intel.lineLoad) ? intel.lineLoad : [];
  const hasSignal = lines.length > 0 || intel.backlog > 0 || intel.readinessRisks > 0;
  if (!hasSignal) return null;

  return (
    <div className={`${glass} rounded-3xl p-5 mb-6`}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="w-8 h-8 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
          <Gauge className="w-4 h-4" style={{ color: VIOLET }} />
        </span>
        <h3 className="font-bold">Carga de líneas</h3>
        <span className="text-xs text-gray-400">capacidad vs carga activa</span>
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <Layers className="w-3 h-3" /> {intel.backlog} en backlog
          </span>
          {intel.readinessRisks > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
              <AlertTriangle className="w-3 h-3" /> {intel.readinessRisks} en riesgo
            </span>
          )}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aún no hay capacidades de línea configuradas. Cuando se definan, aquí verás la carga (unidades activas) contra la capacidad diaria de cada línea.
        </p>
      ) : (
        <div className="space-y-3">
          {lines.map((l) => {
            const color = LOAD_COLOR[l.status] ?? VIOLET;
            const width = Math.min(100, Math.max(0, l.loadPercent));
            return (
              <div key={`${l.line}-${l.buildingId ?? ''}`}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">Línea {l.line}</span>
                  <span className="tabular-nums text-gray-500">
                    {l.currentLoad}/{l.capacity} u · <span style={{ color }}>{l.loadPercent}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
