'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ShoppingCart,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'DRAFT' | 'ISSUED' | 'ACKNOWLEDGED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED';

interface PO {
  id: string;
  folio: string | null;
  title: string;
  supplierName?: string | null;
  status: Status;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  totalValue: number;
  currency: string;
  requiredDate?: string | null;
  promisedDate?: string | null;
}

interface Kpis {
  open: number;
  awaitingReceipt: number;
  overdue: number;
  received: number;
  committedValue: number;
  otdPct: number | null;
  currency: string;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: GRAY },
  ISSUED: { label: 'Emitida', color: VIOLET },
  ACKNOWLEDGED: { label: 'Confirmada', color: BLUE },
  RECEIVED: { label: 'Recibida', color: GREEN },
  CLOSED: { label: 'Cerrada', color: GRAY },
  CANCELLED: { label: 'Cancelada', color: RED },
};
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['ACKNOWLEDGED', 'RECEIVED', 'CANCELLED'],
  ACKNOWLEDGED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};
const ORDER: Status[] = ['DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'RECEIVED', 'CLOSED'];

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function ProcurementPage() {
  const { data, isLoading, forbidden, mutate } = useApi<PO[]>('/procurement/orders');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/procurement/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    supplierName: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    totalValue: 0,
    currency: 'USD',
    requiredDate: '',
  });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createPO() {
    if (form.title.trim().length < 3) {
      toast.error('Describe la compra (mín. 3 caracteres).', 'Compras');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/procurement/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, requiredDate: form.requiredDate || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear.', 'Compras');
        return;
      }
      toast.success('Orden de compra creada.', 'Compras');
      setShowForm(false);
      setForm({ title: '', supplierName: '', priority: 'MEDIUM', totalValue: 0, currency: 'USD', requiredDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Compras');
    } finally {
      setBusy(null);
    }
  }

  async function transition(po: PO, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'ACKNOWLEDGED') {
      const pd = window.prompt('Fecha prometida por el proveedor (YYYY-MM-DD):', '');
      if (pd === null) return;
      if (pd) body.promisedDate = pd;
    }
    setBusy(po.id);
    try {
      const res = await apiFetch(`${API_BASE}/procurement/orders/${po.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Compras');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'Compras');
      refresh();
    } catch {
      toast.error('Error de red.', 'Compras');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver compras.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <ShoppingCart className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Compras · Procurement</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Órdenes de compra y seguimiento de entrega</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Nueva PO
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="POs abiertas" value={kpis?.open ?? 0} sub={`${kpis?.awaitingReceipt ?? 0} por recibir`} color={AMBER} />
          <Kpi label="Vencidas" value={kpis?.overdue ?? 0} color={(kpis?.overdue ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="OTD proveedor" value={kpis?.otdPct === null || kpis?.otdPct === undefined ? '—' : `${kpis.otdPct}%`} color={GREEN} />
          <Kpi label="Valor comprometido" value={money(kpis?.committedValue ?? 0, kpis?.currency ?? 'USD')} color={VIOLET} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nueva orden de compra</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Resistencias 0402 10k — lote Q3" className="pc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Proveedor</span>
                <input value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} placeholder="Acme Components" className="pc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Prioridad</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })} className="pc-input">
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Valor total</span>
                <input type="number" min={0} value={form.totalValue} onChange={(e) => setForm({ ...form, totalValue: Number(e.target.value) })} className="pc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Requerido para</span>
                <input type="date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} className="pc-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createPO} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin órdenes de compra</h3>
            <p className="text-sm text-gray-400 mt-1">Crea la primera PO para empezar a seguir entregas y OTD.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((po) => po.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((po) => {
                      const overdue = (po.status === 'ISSUED' || po.status === 'ACKNOWLEDGED') && po.requiredDate && new Date(po.requiredDate).getTime() < Date.now();
                      return (
                        <div key={po.id} className={`${glass} rounded-2xl p-4`}>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {po.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{po.folio}</span>}
                                <span className="font-semibold truncate">{po.title}</span>
                                {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${RED}1f`, color: RED }}>vencida</span>}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                                {po.supplierName && <><span>{po.supplierName}</span><span>•</span></>}
                                <span>{money(po.totalValue, po.currency)}</span>
                                {po.requiredDate && <><span>•</span><span>req. {new Date(po.requiredDate).toLocaleDateString()}</span></>}
                                {po.promisedDate && <><span>•</span><span>prom. {new Date(po.promisedDate).toLocaleDateString()}</span></>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {NEXT[po.status].map((to) => (
                                <button
                                  key={to}
                                  onClick={() => transition(po, to)}
                                  disabled={busy === po.id}
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
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <style jsx global>{`
        .pc-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .pc-input:focus { border-color: #7c3aed; }
        :global(.dark) .pc-input {
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
