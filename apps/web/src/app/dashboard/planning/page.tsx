'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  LineChart,
  Megaphone,
  PackageCheck,
  Plus,
  Lock,
  Loader2,
  CheckCircle2,
  Send,
  Boxes,
  X,
  Warehouse,
  HandHelping,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';

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
  const [pickLists, setPickLists] = useState<Record<number, PickList>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const list = Array.isArray(plans) ? plans : [];
  const counts = {
    pending: list.filter((p) => p.status === 'pending').length,
    published: list.filter((p) => ['published', 'released'].includes(p.status)).length,
    active: list.filter((p) => p.status === 'active').length,
  };

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
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
        flash(data?.message || 'No se pudo publicar el plan.');
        return;
      }
      setPickLists((prev) => ({ ...prev, [plan.id]: data }));
      flash(`Plan ${plan.model} publicado · ${data.lineCount} materiales para almacén`);
      mutate();
    } catch {
      flash('Error de red al publicar.');
    } finally {
      setBusy(null);
    }
  }

  async function requestMaterial(plan: Plan) {
    if (!plan.kitId) {
      flash('Este plan aún no tiene kit. Publícalo primero.');
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
        flash(data?.message || 'No se pudo enviar la solicitud.');
        return;
      }
      flash(`Solicitud enviada al almacén · ${plan.model}`);
    } catch {
      flash('Error de red al solicitar.');
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

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      {/* Top bar */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/almacen" className="flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-700 transition-colors">
            <Warehouse className="w-4 h-4" /> Almacén
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" /> Nuevo plan
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-500/10">
              <LineChart className="w-7 h-7 text-violet-500" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Planeación</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Muro de publicación · planeación publica, el almacén prepara el kit
              </p>
            </div>
          </div>
        </header>

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

        {/* New plan form */}
        <AnimatePresence>
          {showForm && (
            <NewPlanForm
              onClose={() => setShowForm(false)}
              onCreated={() => {
                setShowForm(false);
                mutate();
                flash('Plan creado. Ya puedes publicarlo.');
              }}
              onError={flash}
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

                  <div className="flex-shrink-0">
                    {plan.status === 'pending' ? (
                      <button
                        onClick={() => publish(plan)}
                        disabled={busy === plan.id}
                        className="flex items-center gap-2 bg-violet-600 text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-60"
                      >
                        {busy === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Publicar
                      </button>
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
              </motion.article>
            );
          })}
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`${glass} fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 z-50`}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
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
          <input className={field} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="OP-520-0001" />
        </div>
        <div>
          <label className="text-xs text-gray-500 ml-1">Cantidad</label>
          <input className={field} type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="100" />
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
      <div className="flex justify-end mt-4">
        <button
          type="submit"
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

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
