'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';

interface Asset {
  id: string;
  folio: string | null;
  name: string;
  category?: string | null;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  currency: string;
  status: 'IN_SERVICE' | 'DISPOSED';
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

function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}

export default function FixedAssetsPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Asset[]>('/fixed-assets');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/fixed-assets/kpis');
  const toast = useToast();
  const confirm = useConfirm();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: '', acquisitionCost: 0, salvageValue: 0, usefulLifeMonths: 60, currency: 'USD', acquisitionDate: '' });

  const list = Array.isArray(data) ? data : [];

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

  async function dispose(a: Asset) {
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
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver activos fijos.</p>
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
            <Building className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Activos Fijos · Depreciación</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Capitalización y valor en libros (línea recta)</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Capitalizar
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Valor en libros" value={money(kpis?.totalBookValue ?? 0, kpis?.currency ?? 'USD')} color={GREEN} />
          <Kpi label="Costo total" value={money(kpis?.totalCost ?? 0, kpis?.currency ?? 'USD')} color={VIOLET} />
          <Kpi label="Depreciación acum." value={money(kpis?.totalAccumulatedDepreciation ?? 0, kpis?.currency ?? 'USD')} color={AMBER} />
          <Kpi label="En servicio" value={kpis?.inService ?? 0} sub={`${kpis?.disposed ?? 0} dados de baja`} color={GRAY} />
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
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Línea SMT Fuji NXT III" className="fa-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Categoría</span>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Maquinaria" className="fa-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Costo de adquisición</span>
                <input type="number" min={0} value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: Number(e.target.value) })} className="fa-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Valor de rescate</span>
                <input type="number" min={0} value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: Number(e.target.value) })} className="fa-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Vida útil (meses)</span>
                <input type="number" min={1} value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: Number(e.target.value) })} className="fa-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Fecha de adquisición</span>
                <input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className="fa-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createAsset} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Capitalizar
              </button>
            </div>
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
        ) : (
          <div className="space-y-3">
            {list.map((a) => {
              const pctDep = a.acquisitionCost > 0 ? Math.min(100, Math.round((a.accumulatedDepreciation / a.acquisitionCost) * 100)) : 0;
              return (
                <div key={a.id} className={`${glass} rounded-2xl p-4 ${a.status === 'DISPOSED' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{a.folio}</span>}
                        <span className="font-semibold truncate">{a.name}</span>
                        {a.category && <span className="text-[11px] text-gray-400">{a.category}</span>}
                        {a.status === 'DISPOSED' && <span className="text-[10px] px-1.5 py-0.5 rounded text-gray-500" style={{ background: 'rgba(107,114,128,0.12)' }}>baja</span>}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
                        <span>costo {money(a.acquisitionCost, a.currency)}</span>
                        <span>•</span>
                        <span style={{ color: GREEN }}>libros {money(a.bookValue, a.currency)}</span>
                        <span>•</span>
                        <span>{money(a.monthlyDepreciation, a.currency)}/mes · {a.usefulLifeMonths}m</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pctDep}%`, background: AMBER }} />
                      </div>
                    </div>
                    {a.status === 'IN_SERVICE' && (
                      <button onClick={() => dispose(a)} disabled={busy === a.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50">
                        <Archive className="w-3.5 h-3.5" /> Baja
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style jsx global>{`
        .fa-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .fa-input:focus { border-color: #7c3aed; }
        :global(.dark) .fa-input {
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
