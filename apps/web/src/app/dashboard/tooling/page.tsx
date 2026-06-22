'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Hammer,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Wrench,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const INDIGO = '#5b63e0';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
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
const TYPES: ToolType[] = ['MOLD', 'FIXTURE', 'STENCIL', 'GAUGE', 'OTHER'];

const tlInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#5b63e0] transition-colors';

/** Life-gauge color band: green <70%, amber 70–90%, red >90% / beyond life. */
function lifeColor(pct: number): string {
  if (pct > 90) return RED;
  if (pct >= 70) return AMBER;
  return GREEN;
}

export default function ToolingPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Tool[]>('/tooling');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/tooling/kpis');
  const toast = useToast();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'MOLD' as ToolType, cavities: 1, lifeShots: 1000000, location: '' });
  const [typeFilter, setTypeFilter] = useState<'ALL' | ToolType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ToolStatus>('ALL');

  const list = Array.isArray(data) ? data : [];
  const filtered = list.filter(
    (t) => (typeFilter === 'ALL' || t.type === typeFilter) && (statusFilter === 'ALL' || t.status === statusFilter),
  );

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createTool() {
    if (form.name.trim().length < 2 || form.lifeShots <= 0) {
      toast.error('Nombre y vida en disparos son obligatorios.', 'Tooling');
      return;
    }
    setBusy(true);
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
      setBusy(false);
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
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${INDIGO}1f` }}>
            <Hammer className="w-5 h-5" style={{ color: INDIGO }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Tooling · Herramentales</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Moldes, fixtures y vida en disparos</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: INDIGO }}>
            <Plus className="w-4 h-4" /> Alta herramental
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Kpi icon={Layers} label="Total" value={kpis?.total ?? 0} color={INDIGO} />
          <Kpi icon={CheckCircle2} label="Activos" value={kpis?.active ?? 0} color={GREEN} />
          <Kpi icon={Gauge} label="Vida consumida" value={kpis?.avgLifeConsumedPct == null ? '—' : `${kpis.avgLifeConsumedPct}%`} color={kpis?.avgLifeConsumedPct == null ? GRAY : lifeColor(kpis.avgLifeConsumedPct)} />
          <Kpi icon={AlertTriangle} label="Próximos a EOL" value={kpis?.nearEol ?? 0} color={(kpis?.nearEol ?? 0) > 0 ? RED : GREEN} />
          <Kpi icon={Wrench} label="En mantenimiento" value={kpis?.inMaintenance ?? 0} color={(kpis?.inMaintenance ?? 0) > 0 ? AMBER : GREEN} />
          <Kpi icon={X} label="Retirados" value={kpis?.retired ?? 0} color={GRAY} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <FilterGroup
            label="Tipo"
            options={[{ value: 'ALL', label: 'Todos' }, ...TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]}
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as 'ALL' | ToolType)}
          />
          <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1 hidden sm:block" />
          <FilterGroup
            label="Estado"
            options={[{ value: 'ALL', label: 'Todos' }, ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as 'ALL' | ToolStatus)}
          />
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
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Molde carcasa frontal" className={tlInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ToolType })} className={tlInput}>
                  {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cavidades</span>
                <input type="number" min={1} value={form.cavities} onChange={(e) => setForm({ ...form, cavities: Number(e.target.value) })} className={tlInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Vida (disparos)</span>
                <input type="number" min={1} value={form.lifeShots} onChange={(e) => setForm({ ...form, lifeShots: Number(e.target.value) })} className={tlInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ubicación</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Tooling crib A" className={tlInput} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createTool} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: INDIGO }}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Crear
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
        ) : filtered.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin resultados</h3>
            <p className="text-sm text-gray-400 mt-1">Ningún herramental coincide con los filtros.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => {
              const barColor = lifeColor(t.lifePercent);
              return (
                <button
                  key={t.id}
                  onClick={() => router.push(`/dashboard/tooling/${t.id}`)}
                  className={`${glass} w-full text-left rounded-2xl p-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04] ${t.status === 'RETIRED' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{t.folio}</span>}
                        <span className="font-semibold truncate">{t.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${INDIGO}1a`, color: INDIGO }}>{TYPE_LABEL[t.type]}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${STATUS_META[t.status].color}1f`, color: STATUS_META[t.status].color }}>{STATUS_META[t.status].label}</span>
                        {t.nearEol && t.status !== 'RETIRED' && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${RED}1f`, color: RED }}>EOL</span>}
                      </div>
                      <div className="mt-1 text-[12px] text-gray-400 tabular-nums">
                        {t.shotsUsed.toLocaleString()} / {t.lifeShots.toLocaleString()} disparos · {t.remainingShots.toLocaleString()} restantes · {t.cavities} cav.
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, t.lifePercent)}%`, background: barColor }} />
                        </div>
                        <span className="text-[11px] font-medium tabular-nums w-10 text-right" style={{ color: barColor }}>{t.lifePercent}%</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
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

function Kpi({ icon: Icon, label, value, color }: { icon: typeof Gauge; label: string; value: number | string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400"><Icon className="w-3 h-3" />{label}</div>
      <div className="text-xl font-semibold mt-0.5 tabular-nums truncate" style={{ color }}>{value}</div>
    </div>
  );
}

function FilterGroup({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] uppercase tracking-wide text-gray-400 mr-0.5">{label}</span>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`text-[12px] px-2.5 py-1 rounded-full font-medium transition-colors ${active ? 'text-white' : 'text-gray-500 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}
            style={active ? { background: INDIGO } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
