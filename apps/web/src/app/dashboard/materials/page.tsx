'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import {
  Plus, Loader2, Lock, Search, X, CheckCircle2, Package, Inbox, SlidersHorizontal,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { IconTile } from '@/components/ui/IconTile';
import { HoverArrow } from '@/components/ui/HoverArrow';
import { glass } from '@/lib/glass';
import { containerRM, itemRM, hoverRM, pressRM } from '@/lib/motion';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export type Lifecycle = 'DRAFT' | 'ACTIVE' | 'HOLD' | 'OBSOLETE';
export type ItemType = 'PURCHASED' | 'MANUFACTURED' | 'PHANTOM' | 'NON_STOCK' | 'DOCUMENT';
export type MakeBuy = 'MAKE' | 'BUY';

export interface Material {
  id: string;
  partNumber: string;
  description: string;
  itemType: ItemType;
  category?: string | null;
  baseUom: string;
  makeBuy: MakeBuy;
  lifecycle: Lifecycle;
  standardCost: number;
  currency: string;
  weight?: number | null;
  weightUom?: string;
  notes?: string | null;
  createdAt?: string;
}

interface Kpis {
  total: number;
  byStatus: Record<Lifecycle, number>;
  byType: Record<ItemType, number>;
  make: number;
  buy: number;
}

export const LIFECYCLE_META: Record<Lifecycle, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  HOLD: { label: 'Retenido', color: '#f59e0b' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};

export const ITEM_TYPE_META: Record<ItemType, { label: string; color: string }> = {
  PURCHASED: { label: 'Comprado', color: '#0a84ff' },
  MANUFACTURED: { label: 'Fabricado', color: '#7c5cff' },
  PHANTOM: { label: 'Fantasma', color: '#9ca3af' },
  NON_STOCK: { label: 'No-stock', color: '#f59e0b' },
  DOCUMENT: { label: 'Documento', color: '#64748b' },
};

const ITEM_TYPES: ItemType[] = ['PURCHASED', 'MANUFACTURED', 'PHANTOM', 'NON_STOCK', 'DOCUMENT'];

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

export default function MaterialsPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const toast = useToast();

  const { data, isLoading, forbidden, mutate } = useApi<Material[]>('/material-master');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/material-master/kpis');

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    description: '',
    partNumber: '',
    itemType: 'PURCHASED' as ItemType,
    category: '',
    baseUom: 'EA',
    makeBuy: '' as MakeBuy | '',
    standardCost: '',
    weight: '',
    notes: '',
  });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    let rows = list;
    if (typeFilter) rows = rows.filter((m) => m.itemType === typeFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      rows = rows.filter((m) =>
        `${m.partNumber} ${m.description} ${m.category ?? ''}`.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [list, query, typeFilter]);

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createMaterial() {
    if (form.description.trim().length < 2) {
      toast.error('La descripción debe tener al menos 2 caracteres.', 'Materiales');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/material-master`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description.trim(),
          partNumber: form.partNumber.trim() || undefined,
          itemType: form.itemType,
          category: form.category.trim() || undefined,
          baseUom: form.baseUom.trim() || 'EA',
          makeBuy: form.makeBuy || undefined,
          standardCost: form.standardCost ? Number(form.standardCost) : undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.message || 'No se pudo crear el material.', 'Materiales');
        return;
      }
      toast.success(`Material ${d.partNumber} creado.`, 'Materiales');
      setShowForm(false);
      setForm({
        description: '', partNumber: '', itemType: 'PURCHASED', category: '',
        baseUom: 'EA', makeBuy: '', standardCost: '', weight: '', notes: '',
      });
      refresh();
      router.push(`/dashboard/materials/${d.id}`);
    } catch {
      toast.error('Error de red al crear el material.', 'Materiales');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver el maestro de materiales.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground font-sans pb-28">
      <main className="max-w-7xl mx-auto px-6 pt-10">
        <PageHeader
          domain="engineering"
          title="Maestro de Materiales · MM"
          subtitle="La fuente única de partes. Cada material se elige aquí para BOM, ruteo y planeación — sin texto libre."
          icon={Package}
          right={
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full hover:scale-[1.02] active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> Nuevo material
            </button>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Materiales" value={kpis?.total ?? list.length} color="#5b5bd6" />
          <Kpi label="Activos" value={kpis?.byStatus?.ACTIVE ?? 0} color="#10b981" />
          <Kpi label="Fabricados (make)" value={kpis?.make ?? 0} color="#7c5cff" />
          <Kpi label="Comprados (buy)" value={kpis?.buy ?? 0} color="#0a84ff" />
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
                <h3 className="font-semibold">Nuevo material</h3>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block md:col-span-2">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción *</span>
                  <input className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Resistor 10kΩ 0402 1%" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Número de parte (opcional)</span>
                  <input className={field} value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="Auto · MAT-…" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo de item</span>
                  <select className={field} value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value as ItemType })}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{ITEM_TYPE_META[t].label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Categoría</span>
                  <input className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Resistores" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">UoM base</span>
                  <input className={field} value={form.baseUom} onChange={(e) => setForm({ ...form, baseUom: e.target.value })} placeholder="EA" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Make / Buy</span>
                  <select className={field} value={form.makeBuy} onChange={(e) => setForm({ ...form, makeBuy: e.target.value as MakeBuy | '' })}>
                    <option value="">Auto (por tipo)</option>
                    <option value="MAKE">MAKE — fabricado</option>
                    <option value="BUY">BUY — comprado</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Costo estándar</span>
                  <input className={field} type="number" step="any" value={form.standardCost} onChange={(e) => setForm({ ...form, standardCost: e.target.value })} placeholder="0.00" />
                </label>
                <label className="block">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Peso</span>
                  <input className={field} type="number" step="any" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="0.00" />
                </label>
                <label className="block md:col-span-2">
                  <span className="block text-[12px] font-medium text-gray-500 mb-1">Notas</span>
                  <input className={field} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Especificación, equivalencias, comentarios" />
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
                <button onClick={createMaterial} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear material
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search + filter */}
        {list.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <div className={`${glass} flex items-center gap-2 px-3 py-2 rounded-2xl flex-1`}>
              <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por número, descripción o categoría…"
                className="bg-transparent outline-none text-sm w-full"
              />
              {query && <button onClick={() => setQuery('')} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className={`${glass} flex items-center gap-2 px-3 py-2 rounded-2xl`}>
              <SlidersHorizontal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as ItemType | '')} className="bg-transparent outline-none text-sm">
                <option value="">Todos los tipos</option>
                {ITEM_TYPES.map((t) => <option key={t} value={t}>{ITEM_TYPE_META[t].label}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold">Aún no hay materiales</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Crea tu primera parte para empezar a armar BOMs y rutas eligiendo del maestro.</p>
            <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2.5 rounded-full">
              <Plus className="w-4 h-4" /> Crea tu primer material
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-10 text-center text-sm text-gray-500 dark:text-gray-400`}>Sin resultados.</div>
        ) : (
          <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((m) => (
              <motion.button
                key={m.id}
                variants={itemRM(reduce)}
                whileHover={hoverRM(reduce)}
                whileTap={pressRM(reduce)}
                onClick={() => router.push(`/dashboard/materials/${m.id}`)}
                className={`${glass} group rounded-2xl p-4 text-left flex items-center gap-3`}
              >
                <IconTile domain="engineering" size={44} icon={Package} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-mono text-gray-500">{m.partNumber}</span>
                    <TypePill type={m.itemType} />
                    <LifecyclePill status={m.lifecycle} />
                  </div>
                  <div className="font-semibold truncate">{m.description}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {m.category || 'Sin categoría'} · {m.baseUom} · {m.makeBuy}
                  </div>
                </div>
                <HoverArrow />
              </motion.button>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}

export function LifecyclePill({ status }: { status: Lifecycle }) {
  const meta = LIFECYCLE_META[status];
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

export function TypePill({ type }: { type: ItemType }) {
  const meta = ITEM_TYPE_META[type];
  return (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}14` }}>
      {meta.label}
    </span>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
