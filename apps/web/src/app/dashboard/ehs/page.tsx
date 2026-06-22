'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ShieldAlert,
  Plus,
  Lock,
  Loader2,
  Inbox,
  X,
  CheckCircle2,
  ArrowRight,
  HeartPulse,
  Search,
  ChevronRight,
  CalendarDays,
  MapPin,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const ROSE = '#ff4d8d';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const ORANGE = '#f97316';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'REPORTED' | 'INVESTIGATING' | 'ACTION_PENDING' | 'CLOSED' | 'CANCELLED';
type IType = 'NEAR_MISS' | 'FIRST_AID' | 'RECORDABLE' | 'LOST_TIME' | 'ENVIRONMENTAL' | 'PROPERTY_DAMAGE';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface Incident {
  id: string;
  folio: string | null;
  title: string;
  type: IType;
  severity: Severity;
  status: Status;
  area?: string | null;
  location?: string | null;
  lostDays: number;
  rootCause?: string | null;
  correctiveAction?: string | null;
  occurredAt?: string | null;
  created_at?: string | null;
}

interface Kpis {
  total: number;
  open: number;
  recordableCount: number;
  lostTimeCount: number;
  nearMissCount: number;
  totalLostDays: number;
  daysSinceLastRecordable: number | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  REPORTED: { label: 'Reportado', color: GRAY },
  INVESTIGATING: { label: 'Investigando', color: VIOLET },
  ACTION_PENDING: { label: 'Acción pendiente', color: AMBER },
  CLOSED: { label: 'Cerrado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: RED },
};

const TYPE_LABEL: Record<IType, string> = {
  NEAR_MISS: 'Casi-accidente',
  FIRST_AID: 'Primeros auxilios',
  RECORDABLE: 'Registrable',
  LOST_TIME: 'Tiempo perdido',
  ENVIRONMENTAL: 'Ambiental',
  PROPERTY_DAMAGE: 'Daño material',
};

const SEV_COLOR: Record<Severity, string> = { LOW: GRAY, MEDIUM: AMBER, HIGH: ORANGE, CRITICAL: RED };
const SEV_LABEL: Record<Severity, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };

const NEXT: Record<Status, Status[]> = {
  REPORTED: ['INVESTIGATING', 'CLOSED', 'CANCELLED'],
  INVESTIGATING: ['ACTION_PENDING', 'CLOSED', 'CANCELLED'],
  ACTION_PENDING: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [],
  CANCELLED: [],
};

const ORDER: Status[] = ['REPORTED', 'INVESTIGATING', 'ACTION_PENDING', 'CLOSED', 'CANCELLED'];

const ehsInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#ff4d8d] transition-colors';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EhsPage() {
  const router = useRouter();
  const { data, isLoading, forbidden, mutate } = useApi<Incident[]>('/ehs/incidents');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/ehs/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [fType, setFType] = useState<IType | 'ALL'>('ALL');
  const [fStatus, setFStatus] = useState<Status | 'ALL' | 'OPEN'>('ALL');
  const [form, setForm] = useState({
    title: '',
    type: 'NEAR_MISS' as IType,
    severity: 'LOW' as Severity,
    area: '',
    location: '',
  });

  const all = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((i) => {
      if (fType !== 'ALL' && i.type !== fType) return false;
      if (fStatus === 'OPEN') {
        if (i.status === 'CLOSED' || i.status === 'CANCELLED') return false;
      } else if (fStatus !== 'ALL' && i.status !== fStatus) return false;
      if (needle) {
        const hay = `${i.folio ?? ''} ${i.title} ${i.area ?? ''} ${i.location ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, fType, fStatus]);

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function report() {
    if (form.title.trim().length < 3) {
      toast.error('Describe el incidente (mín. 3 caracteres).', 'EHS');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/ehs/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo reportar.', 'EHS');
        return;
      }
      toast.success('Incidente reportado.', 'EHS');
      setShowForm(false);
      setForm({ title: '', type: 'NEAR_MISS', severity: 'LOW', area: '', location: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'EHS');
    } finally {
      setBusy(null);
    }
  }

  async function transition(inc: Incident, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'INVESTIGATING') {
      const rc = window.prompt('Causa raíz (opcional):', inc.rootCause || '');
      if (rc === null) return;
      if (rc) body.rootCause = rc;
    } else if (status === 'ACTION_PENDING') {
      const ca = window.prompt('Acción correctiva (opcional):', inc.correctiveAction || '');
      if (ca === null) return;
      if (ca) body.correctiveAction = ca;
    } else if (status === 'CLOSED' && inc.type === 'LOST_TIME') {
      const ld = window.prompt('Días perdidos:', String(inc.lostDays || 0));
      if (ld === null) return;
      body.lostDays = Number(ld) || 0;
    }
    setBusy(inc.id);
    try {
      const res = await apiFetch(`${API_BASE}/ehs/incidents/${inc.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'EHS');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'EHS');
      refresh();
    } catch {
      toast.error('Error de red.', 'EHS');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver EHS.</p>
        </div>
      </div>
    );
  }

  const daysSafe = kpis?.daysSinceLastRecordable;
  const filtered = q.trim() !== '' || fType !== 'ALL' || fStatus !== 'ALL';

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: `${ROSE}1f` }}>
            <ShieldAlert className="w-5 h-5" style={{ color: ROSE }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">EHS · Seguridad y Medio Ambiente</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Incidentes, casi-accidentes e investigación</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: ROSE }}>
            <Plus className="w-4 h-4" /> Reportar
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <div className={`${glass} rounded-2xl p-4`}>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-400">
              <HeartPulse className="w-3.5 h-3.5" /> Días sin registrable
            </div>
            <div className="text-3xl font-semibold mt-1" style={{ color: daysSafe === null || daysSafe === undefined ? GREEN : daysSafe > 30 ? GREEN : daysSafe > 7 ? AMBER : RED }}>
              {daysSafe === null || daysSafe === undefined ? '—' : daysSafe}
            </div>
            <div className="text-[12px] text-gray-400 mt-0.5">{daysSafe === null || daysSafe === undefined ? 'sin registrables' : 'desde el último'}</div>
          </div>
          <Kpi label="Abiertos" value={kpis?.open ?? 0} sub={`${kpis?.total ?? 0} en total`} color={(kpis?.open ?? 0) > 0 ? AMBER : GREEN} />
          <Kpi label="Registrables" value={kpis?.recordableCount ?? 0} sub={`${kpis?.lostTimeCount ?? 0} con tiempo perdido`} color={(kpis?.recordableCount ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="Tiempo perdido" value={`${kpis?.totalLostDays ?? 0} d`} color={(kpis?.totalLostDays ?? 0) > 0 ? ORANGE : GREEN} />
          <Kpi label="Casi-accidentes" value={kpis?.nearMissCount ?? 0} sub="reportados" color={VIOLET} />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por folio, título, área…"
              className={`${ehsInput} pl-9`}
            />
          </div>
          <select value={fType} onChange={(e) => setFType(e.target.value as IType | 'ALL')} className={`${ehsInput} sm:w-52`}>
            <option value="ALL">Todos los tipos</option>
            {(Object.keys(TYPE_LABEL) as IType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as Status | 'ALL' | 'OPEN')} className={`${ehsInput} sm:w-48`}>
            <option value="ALL">Todos los estados</option>
            <option value="OPEN">Solo abiertos</option>
            {ORDER.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>

        {/* Report form */}
        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Reportar incidente</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">¿Qué pasó?</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Casi-caída por derrame de aceite en pasillo B" className={ehsInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as IType })} className={ehsInput}>
                  {(Object.keys(TYPE_LABEL) as IType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Severidad</span>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })} className={ehsInput}>
                  {(Object.keys(SEV_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Área</span>
                <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="SMT" className={ehsInput} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Ubicación</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Pasillo B" className={ehsInput} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={report} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: ROSE }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Reportar
              </button>
            </div>
          </div>
        )}

        {/* List by status */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : all.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin incidentes registrados</h3>
            <p className="text-sm text-gray-400 mt-1">Reporta casi-accidentes para prevenir lesiones — toda observación cuenta.</p>
          </div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Search className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin resultados</h3>
            <p className="text-sm text-gray-400 mt-1">Ningún incidente coincide con los filtros.</p>
          </div>
        ) : filtered ? (
          <div className="space-y-3">
            {list.map((inc) => (
              <IncidentRow key={inc.id} inc={inc} busy={busy === inc.id} onOpen={() => router.push(`/dashboard/ehs/${inc.id}`)} onTransition={(to) => transition(inc, to)} />
            ))}
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
                    {items.map((inc) => (
                      <IncidentRow key={inc.id} inc={inc} busy={busy === inc.id} onOpen={() => router.push(`/dashboard/ehs/${inc.id}`)} onTransition={(to) => transition(inc, to)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Report form (mobile/overlay handled inline above) */}
    </div>
  );
}

function IncidentRow({ inc, busy, onOpen, onTransition }: { inc: Incident; busy: boolean; onOpen: () => void; onTransition: (to: Status) => void }) {
  const occurred = fmtDate(inc.occurredAt ?? inc.created_at);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={`${glass} rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-shadow`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {inc.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{inc.folio}</span>}
            <span className="font-semibold truncate">{inc.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: `${STATUS_META[inc.status].color}1a`, color: STATUS_META[inc.status].color }}>{STATUS_META[inc.status].label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${SEV_COLOR[inc.severity]}1f`, color: SEV_COLOR[inc.severity] }}>{SEV_LABEL[inc.severity]}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-400 flex-wrap">
            <span>{TYPE_LABEL[inc.type]}</span>
            {inc.area && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{inc.area}{inc.location ? ` · ${inc.location}` : ''}</span>}
            {occurred && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{occurred}</span>}
            {inc.lostDays > 0 && <span style={{ color: RED }}>{inc.lostDays} días perdidos</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {NEXT[inc.status].map((to) => (
            <button
              key={to}
              onClick={() => onTransition(to)}
              disabled={busy}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
              style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}
              title={`Mover a ${STATUS_META[to].label}`}
            >
              {to === 'CANCELLED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
              {STATUS_META[to].label}
            </button>
          ))}
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-gray-400 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}
