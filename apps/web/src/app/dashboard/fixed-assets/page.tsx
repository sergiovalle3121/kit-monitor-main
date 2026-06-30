'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Building,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  Archive,
  Layers,
  Wallet,
  TrendingDown,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Finance domain accent (teal) — distinct from the Office indigo / CRM violet.
const TEAL = '#0fb39a';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const GRAY = '#6b7280';

type Status = 'IN_SERVICE' | 'DISPOSED';

interface Asset {
  id: string;
  folio: string | null;
  name: string;
  category?: string | null;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  currency: string;
  status: Status;
  location?: string | null;
  monthlyDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

interface Kpis {
  total: number;
  inService: number;
  disposed: number;
  totalCost: number;
  totalBookValue: number;
  totalAccumulatedDepreciation: number;
  currency: string;
}

const faInput =
  'w-full rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-teal-500';

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function FixedAssetsPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Asset[]>('/fixed-assets');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/fixed-assets/kpis');
  const toast = useToast();
  const confirm = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | Status>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [form, setForm] = useState({ name: '', category: '', acquisitionCost: 0, salvageValue: 0, usefulLifeMonths: 60, currency: 'USD', acquisitionDate: '' });

  const list = Array.isArray(data) ? data : [];
  const ccy = kpis?.currency ?? list[0]?.currency ?? 'USD';

  // Categories present in the data, for the filter dropdown.
  const categories = Array.from(new Set(list.map((a) => a.category).filter((c): c is string => !!c))).sort();

  const filtered = list.filter(
    (a) =>
      (statusFilter === 'ALL' || a.status === statusFilter) &&
      (categoryFilter === 'ALL' || a.category === categoryFilter),
  );

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createAsset() {
    if (form.name.trim().length < 2 || form.acquisitionCost <= 0 || form.usefulLifeMonths <= 0) {
      toast.error('Nombre, costo y vida útil son obligatorios.', 'Activos');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/fixed-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, category: form.category || undefined, acquisitionDate: form.acquisitionDate || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo capitalizar.', 'Activos'); return; }
      toast.success('Activo capitalizado.', 'Activos');
      setShowForm(false);
      setForm({ name: '', category: '', acquisitionCost: 0, salvageValue: 0, usefulLifeMonths: 60, currency: 'USD', acquisitionDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Activos');
    } finally {
      setBusy(null);
    }
  }

  async function dispose(e: React.MouseEvent, a: Asset) {
    e.stopPropagation();
    if (!(await confirm({ message: `¿Dar de baja "${a.name}"?`, tone: 'danger', confirmLabel: 'Dar de baja' }))) return;
    setBusy(a.id);
    try {
      const res = await apiFetch(`${API_BASE}/fixed-assets/${a.id}/dispose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) { toast.error('No se pudo dar de baja.', 'Activos'); return; }
      toast.success('Activo dado de baja.', 'Activos');
      refresh();
    } catch {
      toast.error('Error de red.', 'Activos');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver activos fijos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" aria-label="Volver al inicio" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${TEAL}1f` }}>
            <Building className="w-5 h-5" style={{ color: TEAL }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Activos Fijos · Depreciación</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Capitalización y valor en libros (línea recta)</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: TEAL }}>
            <Plus className="w-4 h-4" /> Capitalizar
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <Kpi icon={Layers} label="Activos" value={String(kpis?.total ?? list.length)} sub={`${kpis?.inService ?? 0} en servicio`} color={TEAL} />
          <Kpi icon={Wallet} label="Costo bruto" value={money(kpis?.totalCost ?? 0, ccy)} color={GRAY} />
          <Kpi icon={CheckCircle2} label="Valor en libros" value={money(kpis?.totalBookValue ?? 0, ccy)} color={GREEN} />
          <Kpi icon={TrendingDown} label="Depreciación acum." value={money(kpis?.totalAccumulatedDepreciation ?? 0, ccy)} color={AMBER} />
          <Kpi icon={Archive} label="Dados de baja" value={String(kpis?.disposed ?? 0)} color={GRAY} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Capitalizar activo</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Línea SMT Fuji NXT III" className={faInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Categoría</span>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Maquinaria" className={faInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Costo de adquisición</span>
                <input type="number" min={0} value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: Number(e.target.value) })} className={faInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Valor de rescate</span>
                <input type="number" min={0} value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: Number(e.target.value) })} className={faInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Vida útil (meses)</span>
                <input type="number" min={1} value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: Number(e.target.value) })} className={faInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Fecha de adquisición</span>
                <input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className={faInput} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createAsset} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: TEAL }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Capitalizar
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        {list.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <div className="inline-flex rounded-xl overflow-hidden border border-black/[0.08] dark:border-white/10 text-[12px]">
              {(['ALL', 'IN_SERVICE', 'DISPOSED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 font-medium transition-colors ${statusFilter === s ? 'text-white' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}
                  style={statusFilter === s ? { background: TEAL } : undefined}
                >
                  {s === 'ALL' ? 'Todos' : s === 'IN_SERVICE' ? 'En servicio' : 'Baja'}
                </button>
              ))}
            </div>
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl px-3 py-1.5 text-[12px] bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-teal-500"
              >
                <option value="ALL">Todas las categorías</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <span className="text-[12px] text-gray-400 ml-auto">{filtered.length} de {list.length}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin activos fijos</h3>
            <p className="text-sm text-gray-400 mt-1">Capitaliza un activo para calcular su depreciación y valor en libros.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center text-sm text-gray-400`}>Ningún activo coincide con los filtros.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => {
              const pctDep = a.acquisitionCost > 0 ? Math.min(100, Math.round((a.accumulatedDepreciation / a.acquisitionCost) * 100)) : 0;
              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/dashboard/fixed-assets/${a.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/dashboard/fixed-assets/${a.id}`); }}
                  className={`${glass} rounded-2xl p-4 cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04] ${a.status === 'DISPOSED' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{a.folio}</span>}
                        <span className="font-semibold truncate">{a.name}</span>
                        {a.category && <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: `${TEAL}14`, color: TEAL }}>{a.category}</span>}
                        {a.status === 'DISPOSED'
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full text-gray-500" style={{ background: `${GRAY}1f` }}>baja</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${GREEN}1f`, color: GREEN }}>en servicio</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                        <span>costo {money(a.acquisitionCost, a.currency)}</span>
                        <span>•</span>
                        <span style={{ color: GREEN }}>libros {money(a.bookValue, a.currency)}</span>
                        <span>•</span>
                        <span>{money(a.monthlyDepreciation, a.currency)}/mes · {a.usefulLifeMonths}m</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pctDep}%`, background: AMBER }} />
                        </div>
                        <span className="text-[11px] text-gray-400 tabular-nums w-12 text-right">{pctDep}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {a.status === 'IN_SERVICE' && (
                        <button onClick={(e) => dispose(e, a)} disabled={busy === a.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50">
                          {busy === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} Baja
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, color }: { icon: typeof Layers; label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-xl font-semibold mt-1 tabular-nums truncate" style={{ color }} title={String(value)}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
