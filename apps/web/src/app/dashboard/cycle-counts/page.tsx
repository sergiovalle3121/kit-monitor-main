'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ClipboardList,
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
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'OPEN' | 'COUNTED' | 'RECONCILED' | 'ADJUSTED' | 'CANCELLED';

interface Count {
  id: string;
  folio: string | null;
  partNumber: string;
  location?: string | null;
  uom: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  status: Status;
}

interface Kpis {
  total: number;
  open: number;
  inventoryAccuracyPct: number | null;
  countsWithVariance: number;
  totalAbsVariance: number;
  adjustments: number;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  OPEN: { label: 'Abierto', color: AMBER },
  COUNTED: { label: 'Contado', color: VIOLET },
  RECONCILED: { label: 'Conciliado', color: GREEN },
  ADJUSTED: { label: 'Ajustado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: GRAY },
};
const ORDER: Status[] = ['OPEN', 'COUNTED', 'ADJUSTED', 'RECONCILED'];

export default function CycleCountsPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Count[]>('/cycle-counts');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/cycle-counts/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ partNumber: '', location: '', systemQty: 0, uom: 'PCS' });
  const [countInputs, setCountInputs] = useState<Record<string, string>>({});

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createCount() {
    if (form.partNumber.trim().length < 1) {
      toast.error('Indica el número de parte.', 'Conteos');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/cycle-counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, location: form.location || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo crear.', 'Conteos'); return; }
      toast.success('Conteo creado.', 'Conteos');
      setShowForm(false);
      setForm({ partNumber: '', location: '', systemQty: 0, uom: 'PCS' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Conteos');
    } finally {
      setBusy(null);
    }
  }

  async function recordCount(c: Count) {
    const raw = countInputs[c.id];
    if (raw === undefined || raw === '') {
      toast.error('Escribe la cantidad contada.', 'Conteos');
      return;
    }
    setBusy(c.id);
    try {
      const res = await apiFetch(`${API_BASE}/cycle-counts/${c.id}/count`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedQty: Number(raw) }),
      });
      if (!res.ok) { toast.error('No se pudo registrar el conteo.', 'Conteos'); return; }
      toast.success('Conteo registrado.', 'Conteos');
      setCountInputs((s) => ({ ...s, [c.id]: '' }));
      refresh();
    } catch {
      toast.error('Error de red.', 'Conteos');
    } finally {
      setBusy(null);
    }
  }

  async function transition(c: Count, status: Status) {
    setBusy(c.id);
    try {
      const res = await apiFetch(`${API_BASE}/cycle-counts/${c.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { toast.error('No se pudo actualizar.', 'Conteos'); return; }
      toast.success(`→ ${STATUS_META[status].label}`, 'Conteos');
      refresh();
    } catch {
      toast.error('Error de red.', 'Conteos');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver conteos.</p>
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
            <ClipboardList className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Conteos Cíclicos</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Exactitud de inventario y reconciliación</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Nuevo conteo
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Exactitud inventario" value={kpis?.inventoryAccuracyPct === null || kpis?.inventoryAccuracyPct === undefined ? '—' : `${kpis.inventoryAccuracyPct}%`} color={(kpis?.inventoryAccuracyPct ?? 100) >= 95 ? GREEN : AMBER} />
          <Kpi label="Conteos abiertos" value={kpis?.open ?? 0} color={AMBER} />
          <Kpi label="Con varianza" value={kpis?.countsWithVariance ?? 0} color={(kpis?.countsWithVariance ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="Ajustes" value={kpis?.adjustments ?? 0} color={VIOLET} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Nuevo conteo</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de parte</span>
                <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} placeholder="RES-0402-10K" className="cc-input font-mono" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ubicación</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="A-12-03" className="cc-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cant. sistema</span>
                <input type="number" min={0} value={form.systemQty} onChange={(e) => setForm({ ...form, systemQty: Number(e.target.value) })} className="cc-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createCount} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
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
            <h3 className="font-semibold">Sin conteos</h3>
            <p className="text-sm text-gray-400 mt-1">Crea un conteo para medir la exactitud de inventario.</p>
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
                    {items.map((c) => (
                      <div key={c.id} className={`${glass} rounded-2xl p-4`}>
                        <div className="flex items-start gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {c.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{c.folio}</span>}
                              <span className="font-semibold font-mono truncate">{c.partNumber}</span>
                              {c.location && <span className="text-[11px] text-gray-400">{c.location}</span>}
                              {c.variance !== null && c.variance !== 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${RED}1f`, color: RED }}>
                                  var {c.variance > 0 ? '+' : ''}{c.variance}
                                </span>
                              )}
                              {c.variance === 0 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${GREEN}1f`, color: GREEN }}>exacto</span>}
                            </div>
                            <div className="mt-1 text-[12px] text-gray-400">
                              sistema {c.systemQty} {c.uom}{c.countedQty !== null && <> · contado {c.countedQty} {c.uom}</>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {c.status === 'OPEN' && (
                              <>
                                <input
                                  type="number"
                                  value={countInputs[c.id] ?? ''}
                                  onChange={(e) => setCountInputs((s) => ({ ...s, [c.id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') recordCount(c); }}
                                  placeholder="contado"
                                  className="cc-input w-24"
                                />
                                <button onClick={() => recordCount(c)} disabled={busy === c.id} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: VIOLET }}>
                                  Contar
                                </button>
                              </>
                            )}
                            {c.status === 'COUNTED' && (
                              <>
                                <button onClick={() => transition(c, 'RECONCILED')} disabled={busy === c.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN }}>
                                  <ArrowRight className="w-3 h-3" /> Conciliar
                                </button>
                                <button onClick={() => transition(c, 'ADJUSTED')} disabled={busy === c.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" style={{ background: `${AMBER}1f`, color: AMBER }}>
                                  <ArrowRight className="w-3 h-3" /> Ajustar
                                </button>
                              </>
                            )}
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
        .cc-input {
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
          width: 100%;
        }
        .cc-input:focus { border-color: #7c3aed; }
        :global(.dark) .cc-input {
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
