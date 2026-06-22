'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Scale,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Office domain accent (slate base, indigo action).
const INDIGO = '#6366f1';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
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
const ORDER: Status[] = ['ACTIVE', 'DRAFT', 'EXPIRED', 'TERMINATED', 'CANCELLED'];

const lgInput =
  'w-full rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-indigo-500';

// ── Module-level helpers (no Date.now() in render bodies) ─────────────────────
function nowMs(): number {
  return Date.now();
}
function daysLeft(end?: string | null): number | null {
  if (!end) return null;
  return Math.floor((new Date(end).getTime() - nowMs()) / 86_400_000);
}
function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}
// Count of contracts whose endDate falls inside the next 90 days (active/draft,
// not yet past). Used as a client-side fallback / cross-check for the KPI strip.
function expiringWithin90(list: Contract[]): number {
  let n = 0;
  for (const c of list) {
    if (c.status !== 'ACTIVE' && c.status !== 'DRAFT') continue;
    const dl = daysLeft(c.endDate);
    if (dl !== null && dl >= 0 && dl <= 90) n += 1;
  }
  return n;
}

export default function LegalPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Contract[]>('/legal/contracts');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/legal/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [fType, setFType] = useState<CType | 'ALL'>('ALL');
  const [fStatus, setFStatus] = useState<Status | 'ALL'>('ALL');
  const [form, setForm] = useState({
    title: '',
    counterparty: '',
    type: 'CUSTOMER' as CType,
    value: 0,
    currency: 'USD',
    startDate: '',
    endDate: '',
  });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (fType !== 'ALL' && c.type !== fType) return false;
      if (fStatus !== 'ALL' && c.status !== fStatus) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        (c.counterparty || '').toLowerCase().includes(q) ||
        (c.folio || '').toLowerCase().includes(q)
      );
    });
  }, [list, search, fType, fStatus]);

  // Prefer the server KPI for "por vencer (90d)"; fall back to a client count.
  const serverExpiring = (kpis?.expiring30 ?? 0) + (kpis?.expiring60 ?? 0) + (kpis?.expiring90 ?? 0);
  const expiringTotal = kpis ? serverExpiring : expiringWithin90(list);
  const totalContracts = kpis?.total ?? list.length;

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

  const hasFilters = fType !== 'ALL' || fStatus !== 'ALL' || search.trim().length > 0;

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${INDIGO}1f` }}>
            <Scale className="w-5 h-5" style={{ color: INDIGO }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Legal · Contratos</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Repositorio de contratos y alertas de vencimiento</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: INDIGO }}>
            <Plus className="w-4 h-4" /> Nuevo contrato
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="Contratos" value={totalContracts} sub={`${kpis?.active ?? list.filter((c) => c.status === 'ACTIVE').length} activos`} color={INDIGO} />
          <div className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Por vencer (90d)
            </div>
            <div className="text-2xl font-semibold mt-1" style={{ color: expiringTotal > 0 ? AMBER : GREEN }}>{expiringTotal}</div>
            <div className="text-[12px] text-gray-400 mt-0.5">{kpis?.expiring30 ?? 0} en 30d</div>
          </div>
          <Kpi label="Vencidos" value={kpis?.expired ?? list.filter((c) => c.status === 'EXPIRED').length} color={(kpis?.expired ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="Valor activo" value={money(kpis?.activeValue ?? 0, kpis?.currency ?? 'USD')} color={INDIGO} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, contraparte o folio…"
              className="w-full rounded-xl pl-9 pr-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-indigo-500"
            />
          </div>
          <select value={fType} onChange={(e) => setFType(e.target.value as CType | 'ALL')} className="rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-indigo-500">
            <option value="ALL">Todos los tipos</option>
            {(Object.keys(TYPE_LABEL) as CType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as Status | 'ALL')} className="rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-indigo-500">
            <option value="ALL">Todos los estados</option>
            {(Object.keys(STATUS_META) as Status[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFType('ALL'); setFStatus('ALL'); }} className="px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-black/5 dark:hover:bg-white/10">Limpiar</button>
          )}
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
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Acuerdo de suministro EMS — Cliente A" className={lgInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Contraparte</span>
                <input value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} placeholder="Cliente A" className={lgInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CType })} className={lgInput}>
                  {(Object.keys(TYPE_LABEL) as CType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Valor</span>
                <input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className={lgInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Moneda</span>
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })} className={lgInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Inicio</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={lgInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Fin</span>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={lgInput} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createContract} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: INDIGO }}>
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
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Search className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin coincidencias</h3>
            <p className="text-sm text-gray-400 mt-1">Ajusta los filtros o la búsqueda.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = filtered.filter((c) => c.status === status);
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
                      const expiringSoon = (c.status === 'ACTIVE' || c.status === 'DRAFT') && dl !== null && dl >= 0 && dl <= 90;
                      const pastDue = (c.status === 'ACTIVE' || c.status === 'EXPIRED') && dl !== null && dl < 0;
                      return (
                        <button
                          key={c.id}
                          onClick={() => router.push(`/dashboard/legal/${c.id}`)}
                          className={`${glass} rounded-2xl p-4 w-full text-left hover:shadow-lg transition-shadow`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {c.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{c.folio}</span>}
                                <span className="font-semibold truncate">{c.title}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_META[c.status].color}1a`, color: STATUS_META[c.status].color }}>{STATUS_META[c.status].label}</span>
                                {c.autoRenew && <RefreshCw className="w-3 h-3 text-gray-400" />}
                                {pastDue ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${RED}1f`, color: RED }}>vencido</span>
                                ) : expiringSoon ? (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${(dl as number) <= 30 ? RED : AMBER}1f`, color: (dl as number) <= 30 ? RED : AMBER }}>
                                    vence en {dl} d
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                                <span className="px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-500">{TYPE_LABEL[c.type]}</span>
                                {c.counterparty && <span>{c.counterparty}</span>}
                                <span className="font-medium text-gray-600 dark:text-gray-300">{money(c.value, c.currency)}</span>
                                {c.endDate && <span>fin {new Date(c.endDate).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
