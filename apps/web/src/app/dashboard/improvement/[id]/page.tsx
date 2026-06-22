'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft,
  Loader2,
  Lock,
  X,
  CheckCircle2,
  Pencil,
  Lightbulb,
  ArrowRight,
  RotateCcw,
  Ban,
  Coins,
  TrendingUp,
  Target,
  MapPin,
  User,
  Flag,
  FileText,
  PlayCircle,
  Hammer,
  ShieldCheck,
  Flag as FlagIcon,
  Clock,
  Gauge,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Engineering / OpEx domain accent — indigo, distinct from CRM violet, legible
// on light + dark glass cards.
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
  description: string | null;
  methodology: Methodology;
  status: Status;
  priority: Priority;
  area: string | null;
  programId: string | null;
  ownerEmail: string | null;
  estimatedSavings: number;
  actualSavings: number;
  currency: string;
  startedAt: string | null;
  implementedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  created_at?: string | null;
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

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: GRAY },
  MEDIUM: { label: 'Media', color: AMBER },
  HIGH: { label: 'Alta', color: RED },
};

// Mirrors backend initiative-state.ts TRANSITIONS exactly.
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IMPLEMENTED', 'CANCELLED'],
  IMPLEMENTED: ['VERIFIED', 'IN_PROGRESS'],
  VERIFIED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: [],
};

// Linear lifecycle ladder for the hero stepper (CANCELLED is off-track).
const LIFECYCLE: { status: Status; icon: typeof FileText }[] = [
  { status: 'DRAFT', icon: FileText },
  { status: 'IN_PROGRESS', icon: PlayCircle },
  { status: 'IMPLEMENTED', icon: Hammer },
  { status: 'VERIFIED', icon: ShieldCheck },
  { status: 'CLOSED', icon: FlagIcon },
];

const ciInput =
  'w-full rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#5b63e0] transition-colors';

// ── Module-level helpers (no Date.now() in render bodies; react-hooks purity) ──
function nowMs(): number {
  return Date.now();
}
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs() - t) / 86_400_000));
}
function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
// Capture rate = realized ÷ estimated, clamped to a sane display range.
function captureRate(estimated: number, actual: number): number | null {
  if (!estimated || estimated <= 0) return null;
  return (actual / estimated) * 100;
}

export default function InitiativeDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const { data, isLoading, forbidden, mutate } = useApi<Initiative>(`/improvement/${id}`);

  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (forbidden) return <Guard />;
  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center text-black dark:text-white">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lightbulb className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Iniciativa no encontrada</h2>
          <p className="text-sm text-gray-400 mt-1">Pudo haber sido eliminada o el folio no existe.</p>
          <Link href="/dashboard/improvement" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: INDIGO }}>
            <ChevronLeft className="w-4 h-4" /> Volver a Mejora continua
          </Link>
        </div>
      </div>
    );
  }

  const ini = data;
  const sm = STATUS_META[ini.status];
  const pm = PRIORITY_META[ini.priority];
  const terminal = ini.status === 'CLOSED' || ini.status === 'CANCELLED';
  const capture = captureRate(ini.estimatedSavings, ini.actualSavings);

  async function transition(to: Status) {
    const body: Record<string, unknown> = { status: to };
    if (to === 'VERIFIED') {
      const input = window.prompt('Ahorro realizado / verificado:', String(ini.actualSavings || ini.estimatedSavings || 0));
      if (input === null) return;
      body.actualSavings = Number(input) || 0;
    } else if (to === 'CANCELLED') {
      if (!window.confirm('¿Cancelar esta iniciativa? Quedará fuera del flujo de mejora.')) return;
    }
    setBusy(to);
    try {
      const res = await apiFetch(`${API_BASE}/improvement/${ini.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar el estado.', 'Mejora continua');
        return;
      }
      toast.success(`→ ${STATUS_META[to].label}`, 'Mejora continua');
      mutate();
    } catch {
      toast.error('Error de red.', 'Mejora continua');
    } finally {
      setBusy(null);
    }
  }

  const ageDays = daysSince(ini.startedAt ?? ini.created_at);

  return (
    <div className="min-h-screen text-black dark:text-white">
      {/* Sticky glass header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/improvement" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${INDIGO}1f` }}>
            <Lightbulb className="w-5 h-5" style={{ color: INDIGO }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{ini.title}</h1>
            <p className="text-[12px] text-gray-400 leading-tight">
              <span className="font-mono">{ini.folio || 'Sin folio'}</span>
              {ini.area ? ` · ${ini.area}` : ''}
            </p>
          </div>
          <span className="hidden sm:inline text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${INDIGO}14`, color: INDIGO }}>{METHOD_LABEL[ini.methodology]}</span>
          <span className="hidden md:inline text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${pm.color}1f`, color: pm.color }}>{pm.label}</span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${sm.color}1a`, color: sm.color }}>{sm.label}</span>
          <button onClick={() => setEditOpen(true)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* Cancelled banner */}
        {ini.status === 'CANCELLED' && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px]" style={{ background: `${RED}12`, color: RED }}>
            <Ban className="w-5 h-5 flex-shrink-0" /> Esta iniciativa fue cancelada — queda fuera del flujo de mejora y no aporta ahorros.
          </div>
        )}

        {/* Metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric icon={Target} label="Ahorro estimado" value={money(ini.estimatedSavings, ini.currency)} color={INDIGO} />
          <Metric icon={TrendingUp} label="Ahorro real" value={money(ini.actualSavings, ini.currency)} color={ini.actualSavings > 0 ? GREEN : GRAY} />
          <Metric icon={Gauge} label="% de captura" value={capture === null ? '—' : `${Math.round(capture)}%`} color={capture === null ? GRAY : capture >= 100 ? GREEN : capture >= 60 ? AMBER : RED} />
          <Metric icon={MapPin} label="Área" value={ini.area || '—'} color={GRAY} />
          <Metric icon={User} label="Dueño" value={ini.ownerEmail ? ini.ownerEmail.split('@')[0] : '—'} color={GRAY} />
          <Metric icon={Flag} label="Prioridad" value={pm.label} color={pm.color} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — HERO stage pipeline + savings + description */}
          <div className="lg:col-span-2 space-y-6">
            {/* HERO: stage pipeline */}
            <div className={`${glass} rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: `${INDIGO}1f` }}>
                  <Gauge className="w-4 h-4" style={{ color: INDIGO }} />
                </span>
                <h3 className="text-sm font-semibold">Etapa de la iniciativa</h3>
              </div>
              <p className="text-[12px] text-gray-400 mb-5">
                Estado actual: <span className="font-medium" style={{ color: sm.color }}>{sm.label}</span>
                {ageDays != null && <span> · {ageDays} d en marcha</span>}
              </p>

              <Pipeline current={ini.status} />

              {/* Transition actions */}
              <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10">
                {terminal ? (
                  <div className="text-[13px] text-gray-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: ini.status === 'CLOSED' ? BLUE : RED }} />
                    {ini.status === 'CLOSED' ? `Cerrada el ${fmtDate(ini.closedAt)} — ciclo completado.` : 'Estado terminal — sin transiciones disponibles.'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-400">Avanzar a</span>
                    <div className="flex flex-wrap gap-2">
                      {NEXT[ini.status].map((to) => {
                        const m = STATUS_META[to];
                        const danger = to === 'CANCELLED';
                        const rework = to === 'IN_PROGRESS' && (ini.status === 'IMPLEMENTED' || ini.status === 'VERIFIED');
                        const Icon = danger ? Ban : rework ? RotateCcw : ArrowRight;
                        return (
                          <button
                            key={to}
                            onClick={() => transition(to)}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                            style={{ background: `${m.color}14`, color: m.color }}
                          >
                            {busy === to ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                            {rework ? 'Devolver a progreso' : m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Savings panel */}
            <SavingsPanel ini={ini} capture={capture} />

            {/* Editable detail */}
            <DetailEditor ini={ini} onSaved={mutate} />

            {/* Description (read view) */}
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">Descripción / alcance</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {ini.description?.trim() || 'Sin descripción. Edita la iniciativa para narrar el problema, la contramedida y el alcance esperado.'}
              </p>
            </div>
          </div>

          {/* Right column — dates timeline + facts */}
          <div className="space-y-6">
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">Línea de tiempo</h3>
              <div className="space-y-3">
                <TimelineRow icon={FileText} color={GRAY} label="Propuesta" value={fmtDateTime(ini.created_at)} done />
                <TimelineRow icon={PlayCircle} color={VIOLET} label="Iniciada" value={fmtDateTime(ini.startedAt)} done={!!ini.startedAt} />
                <TimelineRow icon={Hammer} color={AMBER} label="Implementada" value={fmtDateTime(ini.implementedAt)} done={!!ini.implementedAt} />
                <TimelineRow icon={ShieldCheck} color={GREEN} label="Verificada" value={fmtDateTime(ini.verifiedAt)} done={!!ini.verifiedAt} />
                <TimelineRow icon={FlagIcon} color={BLUE} label="Cerrada" value={fmtDateTime(ini.closedAt)} done={!!ini.closedAt} />
              </div>
              <p className="mt-3 text-[11px] text-gray-400">Las fechas se fijan automáticamente al avanzar por la máquina de estados.</p>
            </div>

            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">Ficha</h3>
              <div className="space-y-3">
                <Row icon={FileText} label="Folio" value={ini.folio || '—'} mono />
                <Row icon={Lightbulb} label="Metodología" value={METHOD_LABEL[ini.methodology]} />
                <Row icon={Flag} label="Prioridad" value={pm.label} />
                <Row icon={MapPin} label="Área" value={ini.area || '—'} />
                <Row icon={User} label="Dueño" value={ini.ownerEmail || '—'} />
                {ini.programId && <Row icon={FileText} label="Programa" value={ini.programId} mono />}
              </div>
            </div>
          </div>
        </div>
      </main>

      {editOpen && <EditModal ini={ini} onClose={() => setEditOpen(false)} onDone={() => { setEditOpen(false); mutate(); }} />}
    </div>
  );
}

// ── HERO pipeline (vertical stepper) ──────────────────────────────────────────
function Pipeline({ current }: { current: Status }) {
  if (current === 'CANCELLED') {
    return (
      <div className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: `${RED}0f` }}>
        <span className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0" style={{ background: RED }}><Ban className="w-4 h-4 text-white" /></span>
        <div>
          <div className="text-sm font-medium" style={{ color: RED }}>Cancelada</div>
          <div className="text-[11px] text-gray-400">Fuera del flujo de mejora</div>
        </div>
      </div>
    );
  }
  const currentIdx = LIFECYCLE.findIndex((s) => s.status === current);
  return (
    <div className="flex flex-col gap-0">
      {LIFECYCLE.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const m = STATUS_META[step.status];
        const color = done ? GREEN : active ? m.color : GRAY;
        const Icon = step.icon;
        const last = i === LIFECYCLE.length - 1;
        return (
          <div key={step.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0 transition-colors"
                style={{ background: done || active ? color : `${GRAY}22`, color: done || active ? '#fff' : GRAY }}
              >
                <Icon className="w-4 h-4" />
              </span>
              {!last && <span className="w-px flex-1 my-1" style={{ background: done ? GREEN : `${GRAY}33`, minHeight: 20 }} />}
            </div>
            <div className={`pb-3 ${last ? 'pb-0' : ''}`}>
              <div className="text-sm font-medium" style={{ color: active ? m.color : undefined }}>{m.label}</div>
              <div className="text-[11px] text-gray-400">{done ? 'Completada' : active ? 'En curso' : 'Pendiente'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Savings panel: estimated vs actual comparison + ROI/capture ───────────────
function SavingsPanel({ ini, capture }: { ini: Initiative; capture: number | null }) {
  const est = Math.max(0, ini.estimatedSavings || 0);
  const act = Math.max(0, ini.actualSavings || 0);
  const peak = Math.max(est, act, 1);
  const estPct = Math.round((est / peak) * 100);
  const actPct = Math.round((act / peak) * 100);
  const delta = act - est;
  const realized = ini.status === 'VERIFIED' || ini.status === 'CLOSED';

  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-4 h-4" style={{ color: INDIGO }} />
        <h3 className="text-sm font-semibold">Captura de ahorros</h3>
      </div>
      <p className="text-[12px] text-gray-400 mb-4">Estimado al proponer la iniciativa vs. realizado/verificado.</p>

      <div className="space-y-3">
        <Bar label="Estimado" value={money(est, ini.currency)} pct={estPct} color={INDIGO} />
        <Bar label="Real" value={money(act, ini.currency)} pct={actPct} color={act > 0 ? GREEN : GRAY} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl px-3.5 py-3" style={{ background: `${(capture ?? 0) >= 100 ? GREEN : INDIGO}0f` }}>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">% de captura</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: capture === null ? GRAY : capture >= 100 ? GREEN : capture >= 60 ? AMBER : RED }}>
            {capture === null ? '—' : `${Math.round(capture)}%`}
          </div>
        </div>
        <div className="rounded-xl px-3.5 py-3" style={{ background: `${delta >= 0 ? GREEN : RED}0f` }}>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Δ vs estimado</div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: act === 0 ? GRAY : delta >= 0 ? GREEN : RED }}>
            {act === 0 ? '—' : `${delta >= 0 ? '+' : ''}${money(delta, ini.currency)}`}
          </div>
        </div>
      </div>

      {!realized && (
        <p className="mt-3 text-[11px] text-gray-400">El ahorro real se contabiliza al verificar la iniciativa. Captúralo al pasar a «Verificada» o edítalo abajo.</p>
      )}
    </div>
  );
}

function Bar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

// ── Editable detail (PATCH) ───────────────────────────────────────────────────
function DetailEditor({ ini, onSaved }: { ini: Initiative; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    description: ini.description || '',
    estimatedSavings: ini.estimatedSavings ?? 0,
    actualSavings: ini.actualSavings ?? 0,
    area: ini.area || '',
    ownerEmail: ini.ownerEmail || '',
  });

  const dirty =
    (f.description || '') !== (ini.description || '') ||
    Number(f.estimatedSavings || 0) !== Number(ini.estimatedSavings || 0) ||
    Number(f.actualSavings || 0) !== Number(ini.actualSavings || 0) ||
    (f.area || '') !== (ini.area || '') ||
    (f.ownerEmail || '') !== (ini.ownerEmail || '');

  async function save() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/improvement/${ini.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: f.description || undefined,
          estimatedSavings: Number(f.estimatedSavings) || 0,
          actualSavings: Number(f.actualSavings) || 0,
          area: f.area || undefined,
          ownerEmail: f.ownerEmail || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo guardar.', 'Mejora continua');
        return;
      }
      toast.success('Iniciativa actualizada.', 'Mejora continua');
      onSaved();
    } catch {
      toast.error('Error de red.', 'Mejora continua');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-1">
        <Pencil className="w-4 h-4" style={{ color: INDIGO }} />
        <h3 className="text-sm font-semibold">Detalle y ahorros</h3>
      </div>
      <p className="text-[12px] text-gray-400 mb-4">Actualiza el alcance, los montos de ahorro y la asignación.</p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción / contramedida</span>
          <textarea
            className={ciInput}
            rows={4}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
            placeholder="Problema, contramedida (PDCA / DMAIC) y alcance esperado."
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Ahorro anual estimado ({ini.currency})</span>
            <input type="number" min={0} className={ciInput} value={f.estimatedSavings} onChange={(e) => setF({ ...f, estimatedSavings: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Ahorro real / verificado ({ini.currency})</span>
            <input type="number" min={0} className={ciInput} value={f.actualSavings} onChange={(e) => setF({ ...f, actualSavings: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Área</span>
            <input className={ciInput} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="SMT" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Dueño</span>
            <input className={ciInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} placeholder="dueno@empresa.com" />
          </label>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[12px] text-gray-400 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {ini.verifiedAt ? `Verificada el ${fmtDate(ini.verifiedAt)}` : 'Aún sin verificar'}
        </span>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: INDIGO }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
        </button>
      </div>
    </div>
  );
}

// ── Edit modal (title / methodology / priority / area / owner) ────────────────
function EditModal({ ini, onClose, onDone }: { ini: Initiative; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: ini.title,
    methodology: ini.methodology,
    priority: ini.priority,
    area: ini.area || '',
    ownerEmail: ini.ownerEmail || '',
    description: ini.description || '',
  });

  async function submit() {
    if (f.title.trim().length < 3) { toast.error('El título requiere mín. 3 caracteres.', 'Mejora continua'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/improvement/${ini.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title,
          methodology: f.methodology,
          priority: f.priority,
          area: f.area || undefined,
          ownerEmail: f.ownerEmail || undefined,
          description: f.description || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo guardar.', 'Mejora continua');
        return;
      }
      toast.success('Iniciativa actualizada.', 'Mejora continua');
      onDone();
    } catch {
      toast.error('Error de red.', 'Mejora continua');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full max-w-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Editar iniciativa</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Título</span>
            <input className={ciInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Metodología</span>
            <select className={ciInput} value={f.methodology} onChange={(e) => setF({ ...f, methodology: e.target.value as Methodology })}>
              {(Object.keys(METHOD_LABEL) as Methodology[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Prioridad</span>
            <select className={ciInput} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}>
              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Área</span>
            <input className={ciInput} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="SMT" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Dueño</span>
            <input className={ciInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} placeholder="dueno@empresa.com" />
          </label>
          <label className="block md:col-span-2">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
            <textarea className={ciInput} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: INDIGO }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small pieces ──────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, color }: { icon: typeof Lightbulb; label: string; value: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400"><Icon className="w-3 h-3" />{label}</div>
      <div className="text-sm font-semibold mt-1 tabular-nums truncate" style={{ color }} title={value}>{value}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value, mono }: { icon: typeof Lightbulb; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
        <div className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}

function TimelineRow({ icon: Icon, color, label, value, done }: { icon: typeof Lightbulb; color: string; label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-6 h-6 rounded-full grid place-items-center flex-shrink-0" style={{ background: done ? `${color}1f` : `${GRAY}14`, color: done ? color : GRAY }}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[11px] text-gray-400">{done ? value : 'Pendiente'}</div>
      </div>
    </div>
  );
}

function Guard() {
  return (
    <div className="min-h-screen grid place-items-center text-black dark:text-white">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
        <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
        <h2 className="text-lg font-semibold">Sin acceso</h2>
        <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver la iniciativa.</p>
      </div>
    </div>
  );
}
