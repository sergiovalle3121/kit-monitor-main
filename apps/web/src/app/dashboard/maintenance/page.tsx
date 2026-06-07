'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Wrench,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ArrowRight,
  HardDrive,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type MType = 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE';

interface Order {
  id: string;
  folio: string | null;
  title: string;
  type: MType;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: Status;
  assetName?: string | null;
  assignedTo?: string | null;
  downtimeMinutes: number;
  dueDate?: string | null;
}

interface Asset {
  id: string;
  name: string;
  code?: string | null;
  status: string;
}

interface Kpis {
  ordersOpen: number;
  ordersInProgress: number;
  ordersOverdue: number;
  ordersCompleted: number;
  pmCompliance: number | null;
  mttrHours: number | null;
  totalDowntimeMinutes: number;
  assetsTotal: number;
  assetsDown: number;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  OPEN: { label: 'Abierta', color: GRAY },
  IN_PROGRESS: { label: 'En progreso', color: VIOLET },
  COMPLETED: { label: 'Completada', color: GREEN },
  CANCELLED: { label: 'Cancelada', color: RED },
};
const TYPE_LABEL: Record<MType, string> = { PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo', PREDICTIVE: 'Predictivo' };
const NEXT: Record<Status, Status[]> = {
  OPEN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'OPEN', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
const ORDER_COLS: Status[] = ['OPEN', 'IN_PROGRESS', 'COMPLETED'];

export default function MaintenancePage() {
  const { data: orders, isLoading, forbidden, mutate } = useApi<Order[]>('/maintenance/orders');
  const { data: assets, mutate: mutateAssets } = useApi<Asset[]>('/maintenance/assets');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/maintenance/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    type: 'CORRECTIVE' as MType,
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    assetId: '',
    assignedTo: '',
    dueDate: '',
  });
  const [newAsset, setNewAsset] = useState('');

  const list = Array.isArray(orders) ? orders : [];
  const assetList = Array.isArray(assets) ? assets : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createOrder() {
    if (form.title.trim().length < 3) {
      toast.error('Describe la orden (mín. 3 caracteres).', 'Mantenimiento');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/maintenance/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, assetId: form.assetId || undefined, dueDate: form.dueDate || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear.', 'Mantenimiento');
        return;
      }
      toast.success('Orden creada.', 'Mantenimiento');
      setShowForm(false);
      setForm({ title: '', type: 'CORRECTIVE', priority: 'MEDIUM', assetId: '', assignedTo: '', dueDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Mantenimiento');
    } finally {
      setBusy(null);
    }
  }

  async function addAsset() {
    if (newAsset.trim().length < 2) return;
    setBusy('asset');
    try {
      const res = await apiFetch(`${API_BASE}/maintenance/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAsset.trim() }),
      });
      if (!res.ok) {
        toast.error('No se pudo crear el activo.', 'Mantenimiento');
        return;
      }
      toast.success('Activo agregado.', 'Mantenimiento');
      setNewAsset('');
      mutateAssets();
      mutateKpis();
    } catch {
      toast.error('Error de red.', 'Mantenimiento');
    } finally {
      setBusy(null);
    }
  }

  async function transition(o: Order, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'COMPLETED') {
      const dt = window.prompt('Minutos de paro (downtime):', String(o.downtimeMinutes || 0));
      if (dt === null) return;
      body.downtimeMinutes = Number(dt) || 0;
    }
    setBusy(o.id);
    try {
      const res = await apiFetch(`${API_BASE}/maintenance/orders/${o.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Mantenimiento');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'Mantenimiento');
      refresh();
    } catch {
      toast.error('Error de red.', 'Mantenimiento');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver mantenimiento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <Wrench className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Mantenimiento · TPM</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Activos y órdenes de mantenimiento (CMMS)</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Nueva orden
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Órdenes abiertas" value={kpis?.ordersOpen ?? 0} sub={`${kpis?.ordersInProgress ?? 0} en progreso`} color={AMBER} />
          <Kpi label="Vencidas" value={kpis?.ordersOverdue ?? 0} color={(kpis?.ordersOverdue ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="% PM cumplido" value={kpis?.pmCompliance === null || kpis?.pmCompliance === undefined ? '—' : `${kpis.pmCompliance}%`} color={GREEN} />
          <Kpi label="MTTR (h)" value={kpis?.mttrHours === null || kpis?.mttrHours === undefined ? '—' : kpis.mttrHours} sub={`${kpis?.totalDowntimeMinutes ?? 0} min paro`} color={VIOLET} />
        </div>

        {/* Assets strip */}
        <div className={`${glass} rounded-2xl p-4 mb-6`}>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold">Activos</h3>
            <span className="text-[11px] text-gray-400">({assetList.length}{kpis?.assetsDown ? ` · ${kpis.assetsDown} parados` : ''})</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {assetList.map((a) => (
              <span key={a.id} className="text-[12px] px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10">
                {a.name}{a.status === 'DOWN' && <span className="ml-1" style={{ color: RED }}>●</span>}
              </span>
            ))}
            <div className="inline-flex items-center gap-1">
              <input value={newAsset} onChange={(e) => setNewAsset(e.target.value)} placeholder="Agregar activo…" className="mt-px text-[12px] px-2 py-1 rounded-lg bg-transparent border border-black/10 dark:border-white/10 outline-none" />
              <button onClick={addAsset} disabled={busy === 'asset'} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {/* Create order form */}
        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nueva orden de mantenimiento</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Trabajo a realizar</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Cambiar termopar zona 3" className="mt-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Activo</span>
                <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="mt-input">
                  <option value="">— sin activo —</option>
                  {assetList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MType })} className="mt-input">
                  {(Object.keys(TYPE_LABEL) as MType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Prioridad</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })} className="mt-input">
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Vence</span>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createOrder} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {/* Orders by status */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin órdenes de mantenimiento</h3>
            <p className="text-sm text-gray-400 mt-1">Crea la primera orden (preventiva o correctiva) para empezar a medir MTTR y %PM.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER_COLS.map((status) => {
              const items = list.filter((o) => o.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((o) => (
                      <div key={o.id} className={`${glass} rounded-2xl p-4`}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {o.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{o.folio}</span>}
                              <span className="font-semibold truncate">{o.title}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                              <span>{TYPE_LABEL[o.type]}</span>
                              {o.assetName && <><span>•</span><span>{o.assetName}</span></>}
                              {o.assignedTo && <><span>•</span><span>{o.assignedTo}</span></>}
                              {o.dueDate && <><span>•</span><span>vence {new Date(o.dueDate).toLocaleDateString()}</span></>}
                              {o.downtimeMinutes > 0 && <><span>•</span><span>{o.downtimeMinutes} min paro</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {NEXT[o.status].map((to) => (
                              <button
                                key={to}
                                onClick={() => transition(o, to)}
                                disabled={busy === o.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                                style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}
                                title={`Mover a ${STATUS_META[to].label}`}
                              >
                                {to === 'CANCELLED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                                {STATUS_META[to].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <style jsx global>{`
        .mt-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .mt-input:focus { border-color: #7c3aed; }
        :global(.dark) .mt-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
