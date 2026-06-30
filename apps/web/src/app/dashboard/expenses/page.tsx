'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Receipt,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ChevronRight,
  Layers,
  Clock,
  CheckCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Finance domain accent — teal, distinct from CRM violet / legal indigo.
const TEAL = '#0fb39a';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
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
  byStatus: Record<Status, number>;
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
const STATUS_ORDER: Status[] = ['SUBMITTED', 'APPROVED', 'DRAFT', 'REJECTED', 'REIMBURSED', 'CANCELLED'];

const exInput =
  'w-full rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-teal-500';

// ── Module-level helpers (no Date.now() in render bodies) ─────────────────────
function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function ExpensesPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Expense[]>('/expenses');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/expenses/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ description: '', amount: 0, category: 'TRAVEL' as Category, currency: 'USD', expenseDate: '' });
  const [fStatus, setFStatus] = useState<'ALL' | Status>('ALL');
  const [fCategory, setFCategory] = useState<'ALL' | Category>('ALL');

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(
    () => list.filter((e) => (fStatus === 'ALL' || e.status === fStatus) && (fCategory === 'ALL' || e.category === fCategory)),
    [list, fStatus, fCategory],
  );

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

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver gastos.</p>
        </div>
      </div>
    );
  }

  const ccy = kpis?.currency ?? 'USD';

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" aria-label="Volver al inicio" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${TEAL}1f` }}>
            <Receipt className="w-5 h-5" style={{ color: TEAL }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Gastos · Viáticos</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight">Reportes de gasto, aprobación y reembolso</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: TEAL }}>
            <Plus className="w-4 h-4" /> Nuevo gasto
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-8 pb-24">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <Kpi icon={Layers} label="Reportes" value={String(kpis?.total ?? 0)} color={TEAL} />
          <Kpi icon={Clock} label="Pendientes de aprobar" value={String(kpis?.pendingApproval ?? 0)} sub={money(kpis?.pendingAmount ?? 0, ccy)} color={AMBER} />
          <Kpi icon={CheckCheck} label="Aprobado sin pagar" value={String(kpis?.approvedUnpaid ?? 0)} color={BLUE} />
          <Kpi icon={Wallet} label="Reembolsado" value={money(kpis?.reimbursedAmount ?? 0, ccy)} color={GREEN} />
          <Kpi icon={XCircle} label="Rechazados" value={String(kpis?.byStatus?.REJECTED ?? 0)} color={RED} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as 'ALL' | Status)} className={`${exInput} w-auto`}>
            <option value="ALL">Todos los estados</option>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select value={fCategory} onChange={(e) => setFCategory(e.target.value as 'ALL' | Category)} className={`${exInput} w-auto`}>
            <option value="ALL">Todas las categorías</option>
            {(Object.keys(CAT_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          {(fStatus !== 'ALL' || fCategory !== 'ALL') && (
            <button onClick={() => { setFStatus('ALL'); setFCategory('ALL'); }} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-[13px] text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
          <span className="ml-auto text-[12px] text-gray-500 dark:text-gray-400">{filtered.length} de {list.length}</span>
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
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Vuelo a planta Guadalajara" className={exInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Categoría</span>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })} className={exInput}>
                  {(Object.keys(CAT_LABEL) as Category[]).map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Monto</span>
                <input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className={exInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Fecha del gasto</span>
                <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={exInput} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createExpense} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold">{list.length === 0 ? 'Sin gastos' : 'Sin coincidencias'}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{list.length === 0 ? 'Crea un reporte de gasto para enviarlo a aprobación.' : 'Ajusta los filtros para ver más reportes.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((e) => {
              const m = STATUS_META[e.status];
              return (
                <button
                  key={e.id}
                  onClick={() => router.push(`/dashboard/expenses/${e.id}`)}
                  className={`${glass} rounded-2xl p-4 w-full text-left hover:ring-1 hover:ring-black/5 dark:hover:ring-white/10 transition`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {e.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{e.folio}</span>}
                        <span className="font-semibold truncate">{e.description}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${m.color}1f`, color: m.color }}>{m.label}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-500 dark:text-gray-400 flex-wrap">
                        <span>{e.employeeName}</span>
                        <span>•</span>
                        <span>{CAT_LABEL[e.category]}</span>
                        {e.status === 'REJECTED' && e.rejectReason && <><span>•</span><span style={{ color: RED }} className="truncate max-w-[16rem]">{e.rejectReason}</span></>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold tabular-nums" style={{ color: TEAL }}>{money(e.amount, e.currency)}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">{e.currency}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color }: { icon: typeof Receipt; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums truncate" style={{ color }} title={value}>{value}</div>
      {sub && <div className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
