'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Scale,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
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

type Status = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'CANCELLED';
type CType = 'CUSTOMER' | 'SUPPLIER' | 'NDA' | 'LEASE' | 'SERVICE' | 'OTHER';

interface Contract {
  id: string;
  folio: string | null;
  title: string;
  counterparty?: string | null;
  type: CType;
  status: Status;
  value: number;
  currency: string;
  endDate?: string | null;
  autoRenew: boolean;
}

interface Kpis {
  total: number;
  active: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  activeValue: number;
  currency: string;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: GRAY },
  ACTIVE: { label: 'Activo', color: GREEN },
  EXPIRED: { label: 'Vencido', color: AMBER },
  TERMINATED: { label: 'Terminado', color: GRAY },
  CANCELLED: { label: 'Cancelado', color: RED },
};
const TYPE_LABEL: Record<CType, string> = {
  CUSTOMER: 'Cliente',
  SUPPLIER: 'Proveedor',
  NDA: 'NDA',
  LEASE: 'Arrendamiento',
  SERVICE: 'Servicios',
  OTHER: 'Otro',
};
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
  CANCELLED: [],
};
const ORDER: Status[] = ['ACTIVE', 'DRAFT', 'EXPIRED', 'TERMINATED', 'CANCELLED'];

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}
function daysLeft(end?: string | null): number | null {
  if (!end) return null;
  return Math.floor((new Date(end).getTime() - Date.now()) / 86_400_000);
}

export default function LegalPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Contract[]>('/legal/contracts');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/legal/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    counterparty: '',
    type: 'CUSTOMER' as CType,
    value: 0,
    currency: 'USD',
    startDate: '',
    endDate: '',
  });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createContract() {
    if (form.title.trim().length < 3) {
      toast.error('El título debe tener al menos 3 caracteres.', 'Legal');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/legal/contracts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, startDate: form.startDate || undefined, endDate: form.endDate || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear.', 'Legal');
        return;
      }
      toast.success('Contrato creado.', 'Legal');
      setShowForm(false);
      setForm({ title: '', counterparty: '', type: 'CUSTOMER', value: 0, currency: 'USD', startDate: '', endDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Legal');
    } finally {
      setBusy(null);
    }
  }

  async function transition(c: Contract, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'ACTIVE' && c.status === 'EXPIRED') {
      const nd = window.prompt('Nueva fecha de fin (renovación, YYYY-MM-DD):', '');
      if (nd === null) return;
      if (nd) body.endDate = nd;
    }
    setBusy(c.id);
    try {
      const res = await apiFetch(`${API_BASE}/legal/contracts/${c.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Legal');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'Legal');
      refresh();
    } catch {
      toast.error('Error de red.', 'Legal');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver contratos.</p>
        </div>
      </div>
    );
  }

  const expiringTotal = (kpis?.expiring30 ?? 0) + (kpis?.expiring60 ?? 0) + (kpis?.expiring90 ?? 0);

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(124,58,237,0.12)' }}>
            <Scale className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Legal · Contratos</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Repositorio de contratos y alertas de vencimiento</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Nuevo contrato
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Contratos activos" value={kpis?.active ?? 0} color={GREEN} />
          <div className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Por vencer (90d)
            </div>
            <div className="text-2xl font-semibold mt-1" style={{ color: expiringTotal > 0 ? AMBER : GREEN }}>{expiringTotal}</div>
            <div className="text-[12px] text-gray-400 mt-0.5">{kpis?.expiring30 ?? 0} en 30d</div>
          </div>
          <Kpi label="Vencidos" value={kpis?.expired ?? 0} color={(kpis?.expired ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="Valor activo" value={money(kpis?.activeValue ?? 0, kpis?.currency ?? 'USD')} color={VIOLET} />
        </div>

        {/* Create form */}
        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo contrato</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Título</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Acuerdo de suministro EMS — Cliente A" className="lg-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Contraparte</span>
                <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="Cliente A" className="lg-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CType })} className="lg-input">
                  {(Object.keys(TYPE_LABEL) as CType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Valor</span>
                <input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="lg-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Moneda</span>
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} className="lg-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Inicio</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="lg-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Fin</span>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="lg-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createContract} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {/* List by status */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin contratos registrados</h3>
            <p className="text-sm text-gray-400 mt-1">Registra contratos para recibir alertas de vencimiento.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((c) => c.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((c) => {
                      const dl = daysLeft(c.endDate);
                      const expiringSoon = c.status === 'ACTIVE' && dl !== null && dl <= 90;
                      return (
                        <div key={c.id} className={`${glass} rounded-2xl p-4`}>
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {c.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{c.folio}</span>}
                                <span className="font-semibold truncate">{c.title}</span>
                                {expiringSoon && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${(dl as number) <= 30 ? RED : AMBER}1f`, color: (dl as number) <= 30 ? RED : AMBER }}>
                                    vence en {dl}d
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                                <span>{TYPE_LABEL[c.type]}</span>
                                {c.counterparty && <><span>•</span><span>{c.counterparty}</span></>}
                                <span>•</span>
                                <span>{money(c.value, c.currency)}</span>
                                {c.endDate && <><span>•</span><span>fin {new Date(c.endDate).toLocaleDateString()}</span></>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {NEXT[c.status].map((to) => (
                                <button
                                  key={to}
                                  onClick={() => transition(c, to)}
                                  disabled={busy === c.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                                  style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}
                                  title={`Mover a ${STATUS_META[to].label}`}
                                >
                                  {to === 'CANCELLED' || to === 'TERMINATED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
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
        .lg-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .lg-input:focus { border-color: #7c3aed; }
        :global(.dark) .lg-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
