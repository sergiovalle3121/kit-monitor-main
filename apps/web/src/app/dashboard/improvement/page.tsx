'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Lightbulb,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Target,
  Gauge,
  Filter,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Engineering / OpEx domain accent — indigo.
const INDIGO = '#5b63e0';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'DRAFT' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED' | 'CLOSED' | 'CANCELLED';
type Methodology = 'KAIZEN' | 'LEAN' | 'SIX_SIGMA' | 'FIVE_S' | 'OTHER';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

interface Initiative {
  id: string;
  folio: string | null;
  title: string;
  description?: string | null;
  methodology: Methodology;
  status: Status;
  priority: Priority;
  area?: string | null;
  ownerEmail?: string | null;
  estimatedSavings: number;
  actualSavings: number;
  currency: string;
}

interface Kpis {
  total: number;
  byStatus: Record<Status, number>;
  inProgress: number;
  implemented: number;
  estimatedSavings: number;
  realizedSavings: number;
  currency: string;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Propuesta', color: GRAY },
  IN_PROGRESS: { label: 'En progreso', color: VIOLET },
  IMPLEMENTED: { label: 'Implementada', color: AMBER },
  VERIFIED: { label: 'Verificada', color: GREEN },
  CLOSED: { label: 'Cerrada', color: BLUE },
  CANCELLED: { label: 'Cancelada', color: RED },
};

const METHOD_LABEL: Record<Methodology, string> = {
  KAIZEN: 'Kaizen',
  LEAN: 'Lean',
  SIX_SIGMA: 'Six Sigma',
  FIVE_S: '5S',
  OTHER: 'Otra',
};

const METHOD_ORDER: Methodology[] = ['KAIZEN', 'LEAN', 'SIX_SIGMA', 'FIVE_S', 'OTHER'];

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: GRAY },
  MEDIUM: { label: 'Media', color: AMBER },
  HIGH: { label: 'Alta', color: RED },
};

const ORDER: Status[] = ['DRAFT', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'CLOSED', 'CANCELLED'];

const ciInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#5b63e0] transition-colors';

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function ImprovementPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Initiative[]>('/improvement');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/improvement/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fMethod, setFMethod] = useState<'ALL' | Methodology>('ALL');
  const [fStatus, setFStatus] = useState<'ALL' | Status>('ALL');
  const [fPriority, setFPriority] = useState<'ALL' | Priority>('ALL');
  const [form, setForm] = useState({
    title: '',
    methodology: 'KAIZEN' as Methodology,
    priority: 'MEDIUM' as Priority,
    area: '',
    estimatedSavings: 0,
    description: '',
  });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const ccy = kpis?.currency ?? list[0]?.currency ?? 'USD';

  // Per-methodology counts for the KPI strip (cheap, derived from the list).
  const byMethod = useMemo(() => {
    const m: Record<Methodology, number> = { KAIZEN: 0, LEAN: 0, SIX_SIGMA: 0, FIVE_S: 0, OTHER: 0 };
    for (const i of list) m[i.methodology] = (m[i.methodology] ?? 0) + 1;
    return m;
  }, [list]);

  const captureRate = useMemo(() => {
    const est = kpis?.estimatedSavings ?? 0;
    const real = kpis?.realizedSavings ?? 0;
    if (est <= 0) return null;
    return Math.round((real / est) * 100);
  }, [kpis]);

  const filtered = useMemo(() => list.filter((i) =>
    (fMethod === 'ALL' || i.methodology === fMethod) &&
    (fStatus === 'ALL' || i.status === fStatus) &&
    (fPriority === 'ALL' || i.priority === fPriority),
  ), [list, fMethod, fStatus, fPriority]);

  const anyFilter = fMethod !== 'ALL' || fStatus !== 'ALL' || fPriority !== 'ALL';

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createInitiative() {
    if (form.title.trim().length < 3) {
      toast.error('El título debe tener al menos 3 caracteres.', 'Mejora continua');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/improvement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo crear.', 'Mejora continua');
        return;
      }
      toast.success('Iniciativa creada.', 'Mejora continua');
      setShowForm(false);
      setForm({ title: '', methodology: 'KAIZEN', priority: 'MEDIUM', area: '', estimatedSavings: 0, description: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Mejora continua');
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver mejora continua.</p>
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
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${INDIGO}1f` }}>
            <Lightbulb className="w-5 h-5" style={{ color: INDIGO }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Mejora continua · OpEx</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Kaizen · Lean · Six Sigma — captura de ahorros</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: INDIGO }}>
            <Plus className="w-4 h-4" /> Nueva iniciativa
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Kpi label="Activas" value={kpis?.inProgress ?? 0} color={VIOLET} hint="En progreso" />
          <Kpi label="Implementadas+" value={kpis?.implemented ?? 0} color={AMBER} hint="Impl. / verif. / cerr." />
          <Kpi label="Ahorro estimado" value={money(kpis?.estimatedSavings ?? 0, ccy)} color={INDIGO} icon={Target} />
          <Kpi label="Ahorro real" value={money(kpis?.realizedSavings ?? 0, ccy)} color={GREEN} icon={TrendingUp} />
          <Kpi label="% de captura" value={captureRate === null ? '—' : `${captureRate}%`} color={captureRate === null ? GRAY : captureRate >= 100 ? GREEN : captureRate >= 60 ? AMBER : RED} icon={Gauge} />
          <Kpi label="Total" value={kpis?.total ?? list.length} color={GRAY} />
        </div>

        {/* Methodology mini-strip */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {METHOD_ORDER.filter((m) => byMethod[m] > 0).map((m) => (
            <button
              key={m}
              onClick={() => setFMethod((cur) => (cur === m ? 'ALL' : m))}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors"
              style={fMethod === m ? { background: INDIGO, color: '#fff' } : { background: `${INDIGO}14`, color: INDIGO }}
            >
              {METHOD_LABEL[m]} <span className="opacity-70">{byMethod[m]}</span>
            </button>
          ))}
        </div>

        {/* Create form */}
        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nueva iniciativa</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Título</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Reducir scrap en SMT línea 3" className={ciInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Metodología</span>
                <select value={form.methodology} onChange={(e) => setForm({ ...form, methodology: e.target.value as Methodology })} className={ciInput}>
                  {METHOD_ORDER.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Prioridad</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })} className={ciInput}>
                  {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Área</span>
                <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className={ciInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ahorro anual estimado</span>
                <input type="number" min={0} value={form.estimatedSavings} onChange={(e) => setForm({ ...form, estimatedSavings: Number(e.target.value) })} className={ciInput} />
              </label>
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Problema y contramedida propuesta." className={ciInput} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createInitiative} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: INDIGO }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 mr-1"><Filter className="w-3.5 h-3.5" /> Filtros</span>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as 'ALL' | Status)} className="rounded-lg px-2.5 py-1.5 text-[12px] bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none">
            <option value="ALL">Todos los estados</option>
            {ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select value={fMethod} onChange={(e) => setFMethod(e.target.value as 'ALL' | Methodology)} className="rounded-lg px-2.5 py-1.5 text-[12px] bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none">
            <option value="ALL">Toda metodología</option>
            {METHOD_ORDER.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
          <select value={fPriority} onChange={(e) => setFPriority(e.target.value as 'ALL' | Priority)} className="rounded-lg px-2.5 py-1.5 text-[12px] bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none">
            <option value="ALL">Toda prioridad</option>
            {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
          {anyFilter && (
            <button onClick={() => { setFStatus('ALL'); setFMethod('ALL'); setFPriority('ALL'); }} className="text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline underline-offset-2">
              Limpiar
            </button>
          )}
          <span className="ml-auto text-[12px] text-gray-400">{filtered.length} de {list.length}</span>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin iniciativas todavía</h3>
            <p className="text-sm text-gray-400 mt-1">Captura la primera idea de mejora para empezar a medir ahorros.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Filter className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Nada coincide con los filtros</h3>
            <p className="text-sm text-gray-400 mt-1">Ajusta o limpia los filtros para ver más iniciativas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((ini) => {
              const sm = STATUS_META[ini.status];
              const pm = PRIORITY_META[ini.priority];
              return (
                <button
                  key={ini.id}
                  onClick={() => router.push(`/dashboard/improvement/${ini.id}`)}
                  className={`${glass} rounded-2xl p-4 w-full text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ini.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{ini.folio}</span>}
                        <span className="font-semibold truncate">{ini.title}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <Badge color={sm.color}>{sm.label}</Badge>
                        <Badge color={INDIGO}>{METHOD_LABEL[ini.methodology]}</Badge>
                        <Badge color={pm.color}>{pm.label}</Badge>
                        {ini.area && <span className="text-[12px] text-gray-400">· {ini.area}</span>}
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                        <span>est. {money(ini.estimatedSavings, ini.currency)}</span>
                        {ini.actualSavings > 0 && <span style={{ color: GREEN }}>real {money(ini.actualSavings, ini.currency)}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
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

function Kpi({ label, value, color, hint, icon: Icon }: { label: string; value: number | string; color: string; hint?: string; icon?: typeof Target }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </div>
      <div className="text-xl font-semibold mt-1 tabular-nums truncate" style={{ color }} title={String(value)}>{value}</div>
      {hint && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>{children}</span>
  );
}
