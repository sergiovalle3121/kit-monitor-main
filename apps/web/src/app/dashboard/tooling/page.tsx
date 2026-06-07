'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Hammer,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
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

type ToolStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
type ToolType = 'MOLD' | 'FIXTURE' | 'STENCIL' | 'GAUGE' | 'OTHER';

interface Tool {
  id: string;
  folio: string | null;
  name: string;
  type: ToolType;
  cavities: number;
  lifeShots: number;
  shotsUsed: number;
  status: ToolStatus;
  location?: string | null;
  lifePercent: number;
  remainingShots: number;
  nearEol: boolean;
}

interface Kpis {
  total: number;
  active: number;
  inMaintenance: number;
  retired: number;
  nearEol: number;
  avgLifeConsumedPct: number | null;
}

const STATUS_META: Record<ToolStatus, { label: string; color: string }> = {
  AVAILABLE: { label: 'Disponible', color: GREEN },
  IN_USE: { label: 'En uso', color: BLUE },
  MAINTENANCE: { label: 'Mantenimiento', color: AMBER },
  RETIRED: { label: 'Retirado', color: GRAY },
};
const TYPE_LABEL: Record<ToolType, string> = { MOLD: 'Molde', FIXTURE: 'Fixture', STENCIL: 'Stencil', GAUGE: 'Galga', OTHER: 'Otro' };
const STATUSES: ToolStatus[] = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

export default function ToolingPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Tool[]>('/tooling');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/tooling/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'MOLD' as ToolType, cavities: 1, lifeShots: 1000000, location: '' });
  const [usageInputs, setUsageInputs] = useState<Record<string, string>>({});

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createTool() {
    if (form.name.trim().length < 2 || form.lifeShots <= 0) {
      toast.error('Nombre y vida en disparos son obligatorios.', 'Tooling');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/tooling`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, location: form.location || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo crear.', 'Tooling'); return; }
      toast.success('Herramental dado de alta.', 'Tooling');
      setShowForm(false);
      setForm({ name: '', type: 'MOLD', cavities: 1, lifeShots: 1000000, location: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Tooling');
    } finally {
      setBusy(null);
    }
  }

  async function recordUsage(t: Tool) {
    const raw = usageInputs[t.id];
    if (!raw || Number(raw) <= 0) { toast.error('Escribe los disparos.', 'Tooling'); return; }
    setBusy(t.id);
    try {
      const res = await apiFetch(`${API_BASE}/tooling/${t.id}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shots: Number(raw) }),
      });
      if (!res.ok) { toast.error('No se pudo registrar.', 'Tooling'); return; }
      toast.success('Uso registrado.', 'Tooling');
      setUsageInputs((s) => ({ ...s, [t.id]: '' }));
      refresh();
    } catch {
      toast.error('Error de red.', 'Tooling');
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(t: Tool, status: ToolStatus) {
    setBusy(t.id);
    try {
      const res = await apiFetch(`${API_BASE}/tooling/${t.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) { toast.error('No se pudo actualizar.', 'Tooling'); return; }
      refresh();
    } catch {
      toast.error('Error de red.', 'Tooling');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver herramentales.</p>
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
            <Hammer className="w-5 h-5" style={{ color: VIOLET }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Tooling · Herramentales</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Moldes, fixtures y vida en disparos</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: VIOLET }}>
            <Plus className="w-4 h-4" /> Alta herramental
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Activos" value={kpis?.active ?? 0} color={GREEN} />
          <Kpi label="Vida consumida prom." value={kpis?.avgLifeConsumedPct === null || kpis?.avgLifeConsumedPct === undefined ? '—' : `${kpis.avgLifeConsumedPct}%`} color={VIOLET} />
          <Kpi label="Próximos a EOL" value={kpis?.nearEol ?? 0} color={(kpis?.nearEol ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="En mantenimiento" value={kpis?.inMaintenance ?? 0} color={AMBER} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Alta de herramental</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Molde carcasa frontal" className="tl-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ToolType })} className="tl-input">
                  {(Object.keys(TYPE_LABEL) as ToolType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cavidades</span>
                <input type="number" min={1} value={form.cavities} onChange={(e) => setForm({ ...form, cavities: Number(e.target.value) })} className="tl-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Vida (disparos)</span>
                <input type="number" min={1} value={form.lifeShots} onChange={(e) => setForm({ ...form, lifeShots: Number(e.target.value) })} className="tl-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ubicación</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Tooling crib A" className="tl-input" />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createTool} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: VIOLET }}>
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
            <h3 className="font-semibold">Sin herramentales</h3>
            <p className="text-sm text-gray-400 mt-1">Da de alta un molde/fixture para seguir su vida en disparos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((t) => (
              <div key={t.id} className={`${glass} rounded-2xl p-4 ${t.status === 'RETIRED' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{t.folio}</span>}
                      <span className="font-semibold truncate">{t.name}</span>
                      <span className="text-[11px] text-gray-400">{TYPE_LABEL[t.type]} · {t.cavities} cav.</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${STATUS_META[t.status].color}1f`, color: STATUS_META[t.status].color }}>{STATUS_META[t.status].label}</span>
                      {t.nearEol && t.status !== 'RETIRED' && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${RED}1f`, color: RED }}>EOL</span>}
                    </div>
                    <div className="mt-1 text-[12px] text-gray-400">
                      {t.shotsUsed.toLocaleString()} / {t.lifeShots.toLocaleString()} disparos · {t.remainingShots.toLocaleString()} restantes
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${t.lifePercent}%`, background: t.nearEol ? RED : VIOLET }} />
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {t.status !== 'RETIRED' && (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          value={usageInputs[t.id] ?? ''}
                          onChange={(e) => setUsageInputs((s) => ({ ...s, [t.id]: e.target.value }))}
                          placeholder="disparos"
                          className="tl-input w-24"
                        />
                        <button onClick={() => recordUsage(t)} disabled={busy === t.id} className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white disabled:opacity-50" style={{ background: VIOLET }}>+</button>
                      </div>
                    )}
                    <select value={t.status} onChange={(e) => setStatus(t, e.target.value as ToolStatus)} disabled={busy === t.id} className="tl-input text-[12px] py-1">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        .tl-input {
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
          width: 100%;
        }
        .tl-input:focus { border-color: #7c3aed; }
        :global(.dark) .tl-input {
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
