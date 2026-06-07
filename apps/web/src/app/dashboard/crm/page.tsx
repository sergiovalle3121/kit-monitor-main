'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Target,
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
const VIOLET = '#7c3aed';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';

interface Opp {
  id: string;
  folio: string | null;
  title: string;
  customerName?: string | null;
  status: Status;
  estimatedValue: number;
  currency: string;
  probability: number;
  expectedCloseDate?: string | null;
}

interface Kpis {
  total: number;
  open: number;
  pipelineValue: number;
  weightedValue: number;
  wonValue: number;
  winRatePct: number | null;
  currency: string;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  LEAD: { label: 'Lead', color: GRAY },
  QUALIFIED: { label: 'Calificada', color: BLUE },
  PROPOSAL: { label: 'Propuesta', color: VIOLET },
  WON: { label: 'Ganada', color: GREEN },
  LOST: { label: 'Perdida', color: RED },
};
const NEXT: Record<Status, Status[]> = {
  LEAD: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};
const ORDER: Status[] = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function CrmPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Opp[]>('/crm/opportunities');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/crm/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', customerName: '', estimatedValue: 0, currency: 'USD', expectedCloseDate: '' });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createOpp() {
    if (form.title.trim().length < 3) {
      toast.error('Describe la oportunidad (mín. 3 caracteres).', 'CRM');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/crm/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, expectedCloseDate: form.expectedCloseDate || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo crear.', 'CRM'); return; }
      toast.success('Oportunidad creada.', 'CRM');
      setShowForm(false);
      setForm({ title: '', customerName: '', estimatedValue: 0, currency: 'USD', expectedCloseDate: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'CRM');
    } finally {
      setBusy(null);
    }
  }

  async function transition(o: Opp, status: Status) {
    setBusy(o.id);
    try {
      const res = await apiFetch(`${API_BASE}/crm/opportunities/${o.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { toast.error('No se pudo actualizar.', 'CRM'); return; }
      toast.success(`→ ${STATUS_META[status].label}`, 'CRM');
      refresh();
    } catch {
      toast.error('Error de red.', 'CRM');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver el CRM.</p>
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
            <Target className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">CRM · Pipeline</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Oportunidades de venta y pronóstico</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Nueva oportunidad
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Pipeline" value={money(kpis?.pipelineValue ?? 0, kpis?.currency ?? 'USD')} sub={`${kpis?.open ?? 0} abiertas`} color={VIOLET} />
          <Kpi label="Ponderado" value={money(kpis?.weightedValue ?? 0, kpis?.currency ?? 'USD')} color={BLUE} />
          <Kpi label="Ganado" value={money(kpis?.wonValue ?? 0, kpis?.currency ?? 'USD')} color={GREEN} />
          <Kpi label="Win-rate" value={kpis?.winRatePct === null || kpis?.winRatePct === undefined ? '—' : `${kpis.winRatePct}%`} color={GREEN} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nueva oportunidad</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Oportunidad</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Programa Servers Gen6 — Cliente C" className="crm-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cliente</span>
                <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Cliente C" className="crm-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Valor estimado</span>
                <input type="number" min={0} value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: Number(e.target.value) })} className="crm-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cierre esperado</span>
                <input type="date" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} className="crm-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createOpp} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
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
            <h3 className="font-semibold">Sin oportunidades</h3>
            <p className="text-sm text-gray-400 mt-1">Crea la primera oportunidad para construir el pipeline.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((o) => o.status === status);
              if (items.length === 0) return null;
              const stageValue = items.reduce((a, o) => a + (o.estimatedValue || 0), 0);
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-400">({items.length} · {money(stageValue, items[0]?.currency ?? 'USD')})</span>
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
                              {o.customerName && <><span>{o.customerName}</span><span>•</span></>}
                              <span>{money(o.estimatedValue, o.currency)}</span>
                              <span>•</span>
                              <span>{o.probability}%</span>
                              {o.expectedCloseDate && <><span>•</span><span>cierre {new Date(o.expectedCloseDate).toLocaleDateString()}</span></>}
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
                                {to === 'LOST' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
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
        .crm-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .crm-input:focus { border-color: #7c3aed; }
        :global(.dark) .crm-input {
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
