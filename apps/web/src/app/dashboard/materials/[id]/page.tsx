'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, Save, Package, Plus, Trash2, Check,
  Factory, ShoppingCart, ListChecks, GitBranch, ShieldCheck,
} from 'lucide-react';
import { IconTile } from '@/components/ui/IconTile';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type Lifecycle = 'DRAFT' | 'ACTIVE' | 'HOLD' | 'OBSOLETE';
type ItemType = 'PURCHASED' | 'MANUFACTURED' | 'PHANTOM' | 'NON_STOCK' | 'DOCUMENT';
type MakeBuy = 'MAKE' | 'BUY';
type AvlStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'OBSOLETE';

interface Material {
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
}

interface Avl {
  id: string;
  manufacturer: string;
  mpn: string;
  status: AvlStatus;
  preference: number;
  leadTimeDays?: number | null;
  notes?: string | null;
}

interface Alternate {
  id: string;
  altMaterialId: string;
  type: 'ALTERNATE' | 'SUBSTITUTE';
  bidirectional: boolean;
  ratio: number;
  notes?: string | null;
  altMaterial?: Material | null;
}

const LIFECYCLE_META: Record<Lifecycle, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: '#9ca3af' },
  ACTIVE: { label: 'Activo', color: '#10b981' },
  HOLD: { label: 'Retenido', color: '#f59e0b' },
  OBSOLETE: { label: 'Obsoleto', color: '#f43f5e' },
};

const ITEM_TYPE_META: Record<ItemType, { label: string }> = {
  PURCHASED: { label: 'Comprado' },
  MANUFACTURED: { label: 'Fabricado' },
  PHANTOM: { label: 'Fantasma' },
  NON_STOCK: { label: 'No-stock' },
  DOCUMENT: { label: 'Documento' },
};
const ITEM_TYPES: ItemType[] = ['PURCHASED', 'MANUFACTURED', 'PHANTOM', 'NON_STOCK', 'DOCUMENT'];

const AVL_STATUS_META: Record<AvlStatus, { label: string; color: string }> = {
  APPROVED: { label: 'Aprobado', color: '#10b981' },
  PENDING: { label: 'Pendiente', color: '#f59e0b' },
  REJECTED: { label: 'Rechazado', color: '#f43f5e' },
  OBSOLETE: { label: 'Obsoleto', color: '#9ca3af' },
};
const AVL_STATUSES: AvlStatus[] = ['APPROVED', 'PENDING', 'REJECTED', 'OBSOLETE'];

const NEXT_STATES: Record<Lifecycle, Lifecycle[]> = {
  DRAFT: ['ACTIVE', 'OBSOLETE'],
  ACTIVE: ['HOLD', 'OBSOLETE'],
  HOLD: ['ACTIVE', 'OBSOLETE'],
  OBSOLETE: ['ACTIVE'],
};
const TRANSITION_LABEL: Record<Lifecycle, string> = {
  ACTIVE: 'Activar',
  HOLD: 'Retener',
  OBSOLETE: 'Obsoletar',
  DRAFT: 'Borrador',
};

const field =
  'w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

type Tab = 'data' | 'avl' | 'alt';

export default function MaterialDetailPage() {
  const params = useParams();
  const id = String((params as Record<string, string>)?.id || '');
  const toast = useToast();

  const { data: material, isLoading, forbidden, mutate } = useApi<Material>(
    id ? `/material-master/${id}` : null,
  );

  const [tab, setTab] = useState<Tab>('data');
  const [busy, setBusy] = useState<string | null>(null);

  async function transition(to: Lifecycle) {
    setBusy(`t-${to}`);
    try {
      const res = await apiFetch(`${API_BASE}/material-master/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'Transición inválida.', 'Materiales'); return; }
      toast.success(`Material → ${LIFECYCLE_META[to].label}.`, 'Materiales');
      mutate();
    } catch {
      toast.error('Error de red.', 'Materiales');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
        </div>
      </div>
    );
  }

  if (isLoading || !material) {
    return <div className="min-h-screen flex justify-center pt-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const lc = LIFECYCLE_META[material.lifecycle];

  return (
    <div className="min-h-screen text-foreground font-sans pb-28">
      <main className="max-w-4xl mx-auto px-6 pt-8">
        <Link href="/dashboard/materials" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black dark:hover:text-white mb-6">
          <ChevronLeft className="w-4 h-4" /> Maestro de materiales
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <IconTile domain="engineering" size={52} icon={material.makeBuy === 'MAKE' ? Factory : ShoppingCart} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-mono text-gray-500">{material.partNumber}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: lc.color, background: `${lc.color}1a` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: lc.color }} />{lc.label}
              </span>
              <span className="text-[11px] text-gray-400">{ITEM_TYPE_META[material.itemType].label} · {material.makeBuy}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight truncate">{material.description}</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {NEXT_STATES[material.lifecycle].map((to) => (
              <button
                key={to}
                onClick={() => transition(to)}
                disabled={!!busy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
              >
                {busy === `t-${to}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {material.lifecycle === 'OBSOLETE' && to === 'ACTIVE' ? 'Reactivar' : TRANSITION_LABEL[to]}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100 dark:border-white/10">
          <TabBtn active={tab === 'data'} onClick={() => setTab('data')} icon={Package} label="Datos" />
          <TabBtn active={tab === 'avl'} onClick={() => setTab('avl')} icon={ShieldCheck} label="AVL · Fabricantes" />
          <TabBtn active={tab === 'alt'} onClick={() => setTab('alt')} icon={GitBranch} label="Alternantes" />
        </div>

        {tab === 'data' && <DataTab material={material} onSaved={mutate} />}
        {tab === 'avl' && <AvlTab materialId={id} />}
        {tab === 'alt' && <AltTab materialId={id} />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Package; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-violet-500 text-foreground' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

// ── Data tab ──────────────────────────────────────────────────────────────────
function DataTab({ material, onSaved }: { material: Material; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    description: material.description,
    itemType: material.itemType,
    category: material.category ?? '',
    baseUom: material.baseUom,
    makeBuy: material.makeBuy,
    standardCost: String(material.standardCost ?? 0),
    currency: material.currency ?? 'USD',
    weight: material.weight != null ? String(material.weight) : '',
    weightUom: material.weightUom ?? 'kg',
    notes: material.notes ?? '',
  });

  async function save() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/material-master/${material.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description.trim(),
          itemType: form.itemType,
          category: form.category.trim(),
          baseUom: form.baseUom.trim(),
          makeBuy: form.makeBuy,
          standardCost: Number(form.standardCost) || 0,
          currency: form.currency.trim().toUpperCase(),
          weight: form.weight ? Number(form.weight) : undefined,
          weightUom: form.weightUom.trim(),
          notes: form.notes.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo guardar.', 'Materiales'); return; }
      toast.success('Material actualizado.', 'Materiales');
      onSaved();
    } catch {
      toast.error('Error de red.', 'Materiales');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block md:col-span-2">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
          <input className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo de item</span>
          <select className={field} value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value as ItemType })}>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{ITEM_TYPE_META[t].label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Make / Buy</span>
          <select className={field} value={form.makeBuy} onChange={(e) => setForm({ ...form, makeBuy: e.target.value as MakeBuy })}>
            <option value="MAKE">MAKE — fabricado</option>
            <option value="BUY">BUY — comprado</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Categoría</span>
          <input className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">UoM base</span>
          <input className={field} value={form.baseUom} onChange={(e) => setForm({ ...form, baseUom: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Costo estándar</span>
          <div className="flex gap-2">
            <input className={field} type="number" step="any" value={form.standardCost} onChange={(e) => setForm({ ...form, standardCost: e.target.value })} />
            <input className={`${field} w-20`} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Peso</span>
          <div className="flex gap-2">
            <input className={field} type="number" step="any" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            <input className={`${field} w-20`} value={form.weightUom} onChange={(e) => setForm({ ...form, weightUom: e.target.value })} />
          </div>
        </label>
        <label className="block md:col-span-2">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Notas</span>
          <textarea className={field} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </label>
      </div>
      <div className="mt-5 flex justify-end">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cambios
        </button>
      </div>
    </div>
  );
}

// ── AVL tab ───────────────────────────────────────────────────────────────────
function AvlTab({ materialId }: { materialId: string }) {
  const toast = useToast();
  const { data, isLoading, mutate } = useApi<Avl[]>(`/material-master/${materialId}/avl`);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ manufacturer: '', mpn: '', status: 'APPROVED' as AvlStatus, preference: '1', leadTimeDays: '' });
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  async function add() {
    if (!form.manufacturer.trim() || !form.mpn.trim()) { toast.error('Fabricante y MPN son obligatorios.', 'AVL'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/material-master/${materialId}/avl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manufacturer: form.manufacturer.trim(),
          mpn: form.mpn.trim(),
          status: form.status,
          preference: Number(form.preference) || 1,
          leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo agregar.', 'AVL'); return; }
      toast.success('Fabricante agregado.', 'AVL');
      setForm({ manufacturer: '', mpn: '', status: 'APPROVED', preference: '1', leadTimeDays: '' });
      mutate();
    } catch {
      toast.error('Error de red.', 'AVL');
    } finally {
      setBusy(false);
    }
  }

  async function remove(avlId: string) {
    try {
      const res = await apiFetch(`${API_BASE}/material-master/${materialId}/avl/${avlId}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('No se pudo eliminar.', 'AVL'); return; }
      mutate();
    } catch { toast.error('Error de red.', 'AVL'); }
  }

  return (
    <div className="space-y-4">
      <div className={`${glass} rounded-2xl p-4`}>
        <h3 className="font-semibold text-sm mb-3">Agregar fabricante aprobado</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <input className={field} placeholder="Fabricante" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          <input className={field} placeholder="MPN" value={form.mpn} onChange={(e) => setForm({ ...form, mpn: e.target.value })} />
          <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AvlStatus })}>
            {AVL_STATUSES.map((s) => <option key={s} value={s}>{AVL_STATUS_META[s].label}</option>)}
          </select>
          <input className={field} type="number" min="1" placeholder="Pref." value={form.preference} onChange={(e) => setForm({ ...form, preference: e.target.value })} />
          <input className={field} type="number" min="0" placeholder="Lead (d)" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar a AVL
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>
          <ListChecks className="w-7 h-7 mx-auto mb-2 text-gray-300" />
          Sin fabricantes aprobados. Una parte interna puede mapear a varios MPN.
        </div>
      ) : (
        <div className={`${glass} rounded-2xl divide-y divide-gray-100 dark:divide-white/10`}>
          {rows.map((a) => {
            const meta = AVL_STATUS_META[a.status];
            return (
              <div key={a.id} className="flex items-center gap-3 p-4">
                <div className="text-xs font-mono text-gray-400 w-8 text-center" title="Preferencia">#{a.preference}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.manufacturer}</div>
                  <div className="text-xs font-mono text-gray-500 truncate">{a.mpn}</div>
                </div>
                {a.leadTimeDays != null && <div className="text-xs text-gray-400">{a.leadTimeDays} d</div>}
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: meta.color, background: `${meta.color}1a` }}>{meta.label}</span>
                <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Alternates tab ────────────────────────────────────────────────────────────
function AltTab({ materialId }: { materialId: string }) {
  const toast = useToast();
  const { data, isLoading, mutate } = useApi<Alternate[]>(`/material-master/${materialId}/alternates`);
  const { data: allMaterials } = useApi<Material[]>('/material-master');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ altMaterialId: '', type: 'ALTERNATE' as 'ALTERNATE' | 'SUBSTITUTE', ratio: '1', notes: '' });
  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const options = useMemo(
    () => (Array.isArray(allMaterials) ? allMaterials.filter((m) => m.id !== materialId) : []),
    [allMaterials, materialId],
  );

  async function add() {
    if (!form.altMaterialId) { toast.error('Elige un material alternante.', 'Alternantes'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/material-master/${materialId}/alternates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          altMaterialId: form.altMaterialId,
          type: form.type,
          ratio: Number(form.ratio) || 1,
          notes: form.notes.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(d?.message || 'No se pudo agregar.', 'Alternantes'); return; }
      toast.success('Alternante agregado.', 'Alternantes');
      setForm({ altMaterialId: '', type: 'ALTERNATE', ratio: '1', notes: '' });
      mutate();
    } catch {
      toast.error('Error de red.', 'Alternantes');
    } finally {
      setBusy(false);
    }
  }

  async function remove(altId: string) {
    try {
      const res = await apiFetch(`${API_BASE}/material-master/${materialId}/alternates/${altId}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('No se pudo eliminar.', 'Alternantes'); return; }
      mutate();
    } catch { toast.error('Error de red.', 'Alternantes'); }
  }

  return (
    <div className="space-y-4">
      <div className={`${glass} rounded-2xl p-4`}>
        <h3 className="font-semibold text-sm mb-3">Agregar alternante / sustituto</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select className={`${field} col-span-2`} value={form.altMaterialId} onChange={(e) => setForm({ ...form, altMaterialId: e.target.value })}>
            <option value="">Elegir material…</option>
            {options.map((m) => <option key={m.id} value={m.id}>{m.partNumber} · {m.description}</option>)}
          </select>
          <select className={field} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'ALTERNATE' | 'SUBSTITUTE' })}>
            <option value="ALTERNATE">Alternante</option>
            <option value="SUBSTITUTE">Sustituto</option>
          </select>
          <input className={field} type="number" step="any" placeholder="Ratio" value={form.ratio} onChange={(e) => setForm({ ...form, ratio: e.target.value })} />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white dark:text-black bg-black dark:bg-white disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center text-sm text-gray-400`}>
          <GitBranch className="w-7 h-7 mx-auto mb-2 text-gray-300" />
          Sin alternantes. Define sustitutos form-fit-function para no parar la línea.
        </div>
      ) : (
        <div className={`${glass} rounded-2xl divide-y divide-gray-100 dark:divide-white/10`}>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-4">
              <GitBranch className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {r.altMaterial ? `${r.altMaterial.partNumber} · ${r.altMaterial.description}` : r.altMaterialId}
                </div>
                <div className="text-xs text-gray-400">
                  {r.type === 'SUBSTITUTE' ? 'Sustituto' : 'Alternante'} · ratio {r.ratio}{r.bidirectional ? ' · ↔' : ''}
                </div>
              </div>
              <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
