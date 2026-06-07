'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Receipt,
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

type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED';
type Category = 'TRAVEL' | 'MEALS' | 'LODGING' | 'SUPPLIES' | 'TRAINING' | 'OTHER';

interface Expense {
  id: string;
  folio: string | null;
  employeeName: string;
  description: string;
  category: Category;
  amount: number;
  currency: string;
  status: Status;
  rejectReason?: string | null;
}

interface Kpis {
  total: number;
  pendingApproval: number;
  approvedUnpaid: number;
  reimbursedAmount: number;
  pendingAmount: number;
  avgAmount: number;
  currency: string;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: GRAY },
  SUBMITTED: { label: 'Enviado', color: AMBER },
  APPROVED: { label: 'Aprobado', color: BLUE },
  REJECTED: { label: 'Rechazado', color: RED },
  REIMBURSED: { label: 'Reembolsado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: GRAY },
};
const CAT_LABEL: Record<Category, string> = {
  TRAVEL: 'Viaje', MEALS: 'Comidas', LODGING: 'Hospedaje', SUPPLIES: 'Insumos', TRAINING: 'Capacitación', OTHER: 'Otro',
};
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['REIMBURSED'],
  REJECTED: ['DRAFT'],
  REIMBURSED: [],
  CANCELLED: [],
};
const ORDER: Status[] = ['SUBMITTED', 'APPROVED', 'DRAFT', 'REJECTED', 'REIMBURSED'];

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function ExpensesPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Expense[]>('/expenses');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/expenses/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ description: '', amount: 0, category: 'TRAVEL' as Category, currency: 'USD', expenseDate: '' });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createExpense() {
    if (form.description.trim().length < 3 || form.amount <= 0) {
      toast.error('Describe el gasto y el monto.', 'Gastos');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, expenseDate: form.expenseDate || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo crear.', 'Gastos'); return; }
      toast.success('Gasto creado.', 'Gastos');
      setShowForm(false);
      setForm({ description: '', amount: 0, category: 'TRAVEL', currency: 'USD', expenseDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Gastos');
    } finally {
      setBusy(null);
    }
  }

  async function transition(e: Expense, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'REJECTED') {
      const rr = window.prompt('Motivo de rechazo:', e.rejectReason || '');
      if (rr === null) return;
      if (rr) body.rejectReason = rr;
    }
    setBusy(e.id);
    try {
      const res = await apiFetch(`${API_BASE}/expenses/${e.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error('No se pudo actualizar.', 'Gastos'); return; }
      toast.success(`→ ${STATUS_META[status].label}`, 'Gastos');
      refresh();
    } catch {
      toast.error('Error de red.', 'Gastos');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver gastos.</p>
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
            <Receipt className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Gastos · Viáticos</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Reportes de gasto, aprobación y reembolso</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Nuevo gasto
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Pendientes aprobación" value={kpis?.pendingApproval ?? 0} color={AMBER} />
          <Kpi label="Aprobados sin pagar" value={kpis?.approvedUnpaid ?? 0} sub={money(kpis?.pendingAmount ?? 0, kpis?.currency ?? 'USD')} color={BLUE} />
          <Kpi label="Reembolsado" value={money(kpis?.reimbursedAmount ?? 0, kpis?.currency ?? 'USD')} color={GREEN} />
          <Kpi label="Monto promedio" value={money(kpis?.avgAmount ?? 0, kpis?.currency ?? 'USD')} color={VIOLET} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo gasto</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Vuelo a planta Guadalajara" className="ex-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Categoría</span>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })} className="ex-input">
                  {(Object.keys(CAT_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Monto</span>
                <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="ex-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Fecha del gasto</span>
                <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className="ex-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createExpense} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
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
            <h3 className="font-semibold">Sin gastos</h3>
            <p className="text-sm text-gray-400 mt-1">Crea un reporte de gasto para enviarlo a aprobación.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((e) => e.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((e) => (
                      <div key={e.id} className={`${glass} rounded-2xl p-4`}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {e.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{e.folio}</span>}
                              <span className="font-semibold truncate">{e.description}</span>
                              <span className="font-semibold" style={{ color: VIOLET }}>{money(e.amount, e.currency)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                              <span>{e.employeeName}</span>
                              <span>•</span>
                              <span>{CAT_LABEL[e.category]}</span>
                              {e.rejectReason && <><span>•</span><span style={{ color: RED }}>{e.rejectReason}</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {NEXT[e.status].map((to) => (
                              <button
                                key={to}
                                onClick={() => transition(e, to)}
                                disabled={busy === e.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                                style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}
                                title={`Mover a ${STATUS_META[to].label}`}
                              >
                                {to === 'CANCELLED' || to === 'REJECTED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
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
        .ex-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .ex-input:focus { border-color: #7c3aed; }
        :global(.dark) .ex-input {
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
      <div className="text-xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
