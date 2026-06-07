'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Lightbulb,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
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

type Status = 'DRAFT' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED' | 'CLOSED' | 'CANCELLED';
type Methodology = 'KAIZEN' | 'LEAN' | 'SIX_SIGMA' | 'FIVE_S' | 'OTHER';

interface Initiative {
  id: string;
  folio: string | null;
  title: string;
  description?: string | null;
  methodology: Methodology;
  status: Status;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
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
  DRAFT: { label: 'Borrador', color: GRAY },
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

// Mirror of the backend state machine for rendering allowed next-actions.
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IMPLEMENTED', 'CANCELLED'],
  IMPLEMENTED: ['VERIFIED', 'IN_PROGRESS'],
  VERIFIED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: [],
};

const ORDER: Status[] = ['DRAFT', 'IN_PROGRESS', 'IMPLEMENTED', 'VERIFIED', 'CLOSED'];

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function ImprovementPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Initiative[]>('/improvement');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/improvement/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    methodology: 'KAIZEN' as Methodology,
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    area: '',
    estimatedSavings: 0,
    description: '',
  });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createInitiative() {
    if (form.title.trim().length < 3) {
      toast.error('El título debe tener al menos 3 caracteres.', 'Mejora continua');
      return;
    }
    setBusy('new');
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
      setBusy(null);
    }
  }

  async function transition(ini: Initiative, status: Status) {
    let actualSavings: number | undefined;
    if (status === 'VERIFIED') {
      const input = window.prompt('Ahorro realizado/verificado:', String(ini.estimatedSavings || 0));
      if (input === null) return;
      actualSavings = Number(input) || 0;
    }
    setBusy(ini.id);
    try {
      const res = await apiFetch(`${API_BASE}/improvement/${ini.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(actualSavings !== undefined && { actualSavings }) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Mejora continua');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'Mejora continua');
      refresh();
    } catch {
      toast.error('Error de red.', 'Mejora continua');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver mejora continua.</p>
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
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(245,158,11,0.14)' }}>
            <Lightbulb className="w-5 h-5" style={{ color: AMBER }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Mejora continua · OpEx</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Kaizen · Lean · Six Sigma — captura de ahorros</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: AMBER }}>
            <Plus className="w-4 h-4" /> Nueva iniciativa
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Iniciativas" value={kpis?.total ?? list.length} color={VIOLET} />
          <Kpi label="En progreso" value={kpis?.inProgress ?? 0} color={AMBER} />
          <Kpi label="Implementadas+" value={kpis?.implemented ?? 0} color={GREEN} />
          <Kpi label="Ahorro realizado" value={money(kpis?.realizedSavings ?? 0, kpis?.currency ?? 'USD')} sub={`est. ${money(kpis?.estimatedSavings ?? 0, kpis?.currency ?? 'USD')}`} color={GREEN} icon />
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
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Reducir scrap en SMT línea 3" className="ci-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Metodología</span>
                <select value={form.methodology} onChange={(e) => setForm({ ...form, methodology: e.target.value as Methodology })} className="ci-input">
                  {(['KAIZEN', 'LEAN', 'SIX_SIGMA', 'FIVE_S', 'OTHER'] as Methodology[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Prioridad</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })} className="ci-input">
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Área</span>
                <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className="ci-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ahorro anual estimado</span>
                <input type="number" min={0} value={form.estimatedSavings} onChange={(e) => setForm({ ...form, estimatedSavings: Number(e.target.value) })} className="ci-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createInitiative} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: AMBER }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        )}

        {/* List grouped by status */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin iniciativas todavía</h3>
            <p className="text-sm text-gray-400 mt-1">Captura la primera idea de mejora para empezar a medir ahorros.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((i) => i.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((ini) => (
                      <div key={ini.id} className={`${glass} rounded-2xl p-4`}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {ini.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{ini.folio}</span>}
                              <span className="font-semibold truncate">{ini.title}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                              <span>{METHOD_LABEL[ini.methodology]}</span>
                              {ini.area && <><span>•</span><span>{ini.area}</span></>}
                              <span>•</span>
                              <span>est. {money(ini.estimatedSavings, ini.currency)}</span>
                              {ini.actualSavings > 0 && <><span>•</span><span style={{ color: GREEN }}>real {money(ini.actualSavings, ini.currency)}</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {NEXT[ini.status].map((to) => (
                              <button
                                key={to}
                                onClick={() => transition(ini, to)}
                                disabled={busy === ini.id}
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
        .ci-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .ci-input:focus { border-color: #f59e0b; }
        :global(.dark) .ci-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function Kpi({ label, value, sub, color, icon }: { label: string; value: number | string; sub?: string; color: string; icon?: boolean }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">
        {icon && <TrendingUp className="w-3.5 h-3.5" />} {label}
      </div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
