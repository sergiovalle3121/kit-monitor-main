'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Plus, Loader2, Lock, Search, X, CheckCircle2, Boxes, Inbox, Rocket, ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { containerRM, itemRM, hoverRM } from '@/lib/motion';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Status = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';

export interface ProductModel {
  id: string;
  modelNumber: string;
  name: string;
  customer?: string | null;
  revision: string;
  status: Status;
  description?: string | null;
  programId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  activatedAt?: string | null;
}

interface Kpis {
  total: number;
  byStatus: Record<Status, number>;
  active: number;
}

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

export default function ModelsPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const toast = useToast();

  const { data, isLoading, forbidden, mutate } = useApi<ProductModel[]>('/product-models');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/product-models/kpis');

  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    modelNumber: '',
    customer: '',
    revision: '1.0',
    description: '',
    notes: '',
  });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      `${m.modelNumber} ${m.name} ${m.customer ?? ''}`.toLowerCase().includes(q),
    );
  }, [list, query]);

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createModel() {
    if (form.name.trim().length < 2) {
      toast.error('El nombre debe tener al menos 2 caracteres.', 'Modelos');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/product-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          modelNumber: form.modelNumber.trim() || undefined,
          customer: form.customer.trim() || undefined,
          revision: form.revision.trim() || '1.0',
          description: form.description.trim() || undefined,
          metadata: form.notes.trim() ? { notes: form.notes.trim() } : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo crear el modelo.', 'Modelos');
        return;
      }
      toast.success(`Modelo ${d.modelNumber} creado.`, 'Modelos');
      setShowForm(false);
      setForm({ name: '', modelNumber: '', customer: '', revision: '1.0', description: '', notes: '' });
      refresh();
      router.push(`/dashboard/models/${d.id}`);
    } catch {
      toast.error('Error de red al crear el modelo.', 'Modelos');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver el maestro de modelos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-28">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader
          domain="engineering"
          title="Modelos · Product Master"
          subtitle="El maestro canónico de productos. Crea un modelo y todo lo demás (BOM, proceso, planeación, NPI) lo referencia."
          icon={Boxes}
          right={
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> Nuevo modelo
            </button>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Kpi label="Modelos" value={kpis?.total ?? list.length} color="#5b5bd6" />
          <Kpi label="Activos" value={kpis?.byStatus?.ACTIVE ?? 0} color="#10b981" />
          <Kpi label="Borradores" value={kpis?.byStatus?.DRAFT ?? 0} color="#9ca3af" />
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              className={`${glass} rounded-2xl p-5 mb-6 overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Nuevo modelo</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Nombre del modelo *</span>
                  <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Controlador EV — Gen 2" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Número (opcional)</span>
                  <input className={field} value={form.modelNumber} onChange={(e) => setForm({ ...form, modelNumber: e.target.value })} placeholder="Auto · MDL-…" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Cliente</span>
                  <input className={field} value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} placeholder="ACME Robotics" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Revisión</span>
                  <input className={field} value={form.revision} onChange={(e) => setForm({ ...form, revision: e.target.value })} placeholder="1.0" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Notas</span>
                  <input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Programa, contacto, comentarios" />
                </label>
                <label className="block md:col-span-2">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
                  <textarea className={field} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Qué es este producto…" />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
                <button onClick={createModel} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear modelo
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        {list.length > 0 && (
          <div className={`${glass} flex items-center gap-2 px-3 py-2 rounded-2xl mb-5`}>
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, nombre o cliente…"
              className="bg-transparent outline-none text-sm w-full"
            />
            {query && <button onClick={() => setQuery('')} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>}
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Aún no hay modelos</h3>
            <p className="text-sm text-gray-400 mt-1 mb-4">Crea tu primer modelo para empezar a definir su BOM y publicar planes.</p>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full">
              <Plus className="w-4 h-4" /> Crea tu primer modelo
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-10 text-center text-sm text-gray-400`}>Sin resultados para “{query}”.</div>
        ) : (
          <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((m) => (
              <motion.div
                key={m.id}
                variants={itemRM(reduce)}
                whileHover={hoverRM(reduce)}
                className={`${glass} group rounded-2xl p-4 flex flex-col gap-3`}
              >
                <Link
                  href={`/dashboard/models/${m.id}`}
                  className="flex items-center gap-3 text-left"
                >
                  <IconTile domain="engineering" size={44} icon={Boxes} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-mono text-gray-500">{m.modelNumber}</span>
                      <StatusPill status={m.status} />
                    </div>
                    <div className="font-semibold truncate">{m.name}</div>
                    <div className="text-xs text-gray-400 truncate">{m.customer || 'Sin cliente'} · rev {m.revision}</div>
                  </div>
                </Link>
                <div className="flex items-center gap-3 border-t border-black/5 dark:border-white/5 pt-2.5">
                  <Link
                    href={`/dashboard/models/${m.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-300 hover:underline"
                  >
                    Abrir modelo <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link
                    href="/dashboard/npi"
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-black dark:hover:text-white"
                  >
                    <Rocket className="w-3.5 h-3.5" /> Launch / NPI
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
