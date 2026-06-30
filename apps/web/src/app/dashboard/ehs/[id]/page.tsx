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
  ShieldAlert,
  HeartPulse,
  MapPin,
  CalendarDays,
  User,
  Clock,
  ArrowRight,
  Search,
  ClipboardCheck,
  ListChecks,
  AlertTriangle,
  Ban,
  Activity as ActivityIcon,
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
  description: string | null;
  type: IType;
  severity: Severity;
  status: Status;
  area: string | null;
  location: string | null;
  programId: string | null;
  reportedBy: string | null;
  injuredPerson: string | null;
  lostDays: number;
  rootCause: string | null;
  correctiveAction: string | null;
  capaOwner: string | null;
  capaDueDate: string | null;
  occurredAt: string | null;
  investigatedAt: string | null;
  closedAt: string | null;
  created_at?: string | null;
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

const RECORDABLE_TYPES: IType[] = ['RECORDABLE', 'LOST_TIME'];

// Mirrors incident-state.ts transitions (kept in sync with the backend state machine).
const NEXT: Record<Status, Status[]> = {
  REPORTED: ['INVESTIGATING', 'CLOSED', 'CANCELLED'],
  INVESTIGATING: ['ACTION_PENDING', 'CLOSED', 'CANCELLED'],
  ACTION_PENDING: ['CLOSED', 'INVESTIGATING'],
  CLOSED: [],
  CANCELLED: [],
};

// Linear lifecycle for the stepper (CANCELLED is rendered as an off-track terminal).
const LIFECYCLE: { status: Status; icon: typeof Search }[] = [
  { status: 'REPORTED', icon: ShieldAlert },
  { status: 'INVESTIGATING', icon: Search },
  { status: 'ACTION_PENDING', icon: ListChecks },
  { status: 'CLOSED', icon: CheckCircle2 },
];

const ehsInput =
  'w-full rounded-xl px-3 py-2.5 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-[#ff4d8d] transition-colors';

// Date.now() must not run in render (react-hooks purity); compute elapsed days here.
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
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

// Clasificación regulatoria derivada del tipo (campo ya existente). El KPI de
// "registrables" usa exactamente RECORDABLE_TYPES, así que cuadra con esto.
function classificationMeta(type: IType): { label: string; detail: string; color: string } {
  switch (type) {
    case 'RECORDABLE':
      return { label: 'Registrable (OSHA / IATF)', detail: 'Debe documentarse en el OSHA 300 log.', color: RED };
    case 'LOST_TIME':
      return { label: 'Registrable · Tiempo perdido (LTI)', detail: 'Afecta el LTIR; registra los días perdidos al cerrar.', color: RED };
    case 'FIRST_AID':
      return { label: 'Primeros auxilios (no registrable)', detail: 'Atención menor; no entra al OSHA 300.', color: '#0a84ff' };
    case 'NEAR_MISS':
      return { label: 'Casi-accidente', detail: 'Sin lesión; oportunidad de prevención.', color: VIOLET };
    case 'ENVIRONMENTAL':
      return { label: 'Ambiental', detail: 'Evento ambiental (derrame, residuo, emisión).', color: GREEN };
    case 'PROPERTY_DAMAGE':
      return { label: 'Daño material', detail: 'Daño a equipo o instalación, sin lesión.', color: AMBER };
  }
}

// Estado de la CAPA respecto a su fecha de compromiso (null = sin fecha).
function capaInfo(iso: string | null | undefined): { days: number; overdue: boolean; dueSoon: boolean } | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((t - Date.now()) / 86_400_000);
  return { days, overdue: days < 0, dueSoon: days >= 0 && days <= 7 };
}

export default function IncidentDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const { data, isLoading, forbidden, mutate } = useApi<Incident>(`/ehs/incidents/${id}`);

  const [busy, setBusy] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  if (forbidden) return <Guard />;
  if (isLoading) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>;
  }
  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <ShieldAlert className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Incidente no encontrado</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Pudo haber sido eliminado o el folio no existe.</p>
          <Link href="/dashboard/ehs" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: ROSE }}>
            <ChevronLeft className="w-4 h-4" /> Volver a EHS
          </Link>
        </div>
      </div>
    );
  }

  const inc = data;
  const recordable = RECORDABLE_TYPES.includes(inc.type);
  const terminal = inc.status === 'CLOSED' || inc.status === 'CANCELLED';
  const sm = STATUS_META[inc.status];
  const cls = classificationMeta(inc.type);
  const capa = capaInfo(inc.capaDueDate);
  const capaActive = !terminal && capa !== null;

  async function transition(to: Status) {
    const body: Record<string, unknown> = { status: to };
    if (to === 'INVESTIGATING') {
      const rc = window.prompt('Causa raíz (opcional, podrás ampliarla luego):', inc.rootCause || '');
      if (rc === null) return;
      if (rc) body.rootCause = rc;
    } else if (to === 'ACTION_PENDING') {
      const ca = window.prompt('Acción correctiva (opcional):', inc.correctiveAction || '');
      if (ca === null) return;
      if (ca) body.correctiveAction = ca;
    } else if (to === 'CLOSED') {
      if (RECORDABLE_TYPES.includes(inc.type)) {
        const ld = window.prompt('Días perdidos (LTIR):', String(inc.lostDays || 0));
        if (ld === null) return;
        body.lostDays = Number(ld) || 0;
      } else if (!window.confirm('¿Cerrar este incidente? Confirma que la acción correctiva quedó implementada.')) {
        return;
      }
    } else if (to === 'CANCELLED') {
      if (!window.confirm('¿Cancelar este incidente? Se marcará como inválido/duplicado.')) return;
    }
    setBusy(to);
    try {
      const res = await apiFetch(`${API_BASE}/ehs/incidents/${inc.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar el estado.', 'EHS');
        return;
      }
      toast.success(`→ ${STATUS_META[to].label}`, 'EHS');
      mutate();
    } catch {
      toast.error('Error de red.', 'EHS');
    } finally {
      setBusy(null);
    }
  }

  const occurredDays = daysSince(inc.occurredAt ?? inc.created_at);

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/ehs" aria-label="Volver" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${ROSE}1f` }}>
            <ShieldAlert className="w-5 h-5" style={{ color: ROSE }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold leading-tight truncate">{inc.title}</h1>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400 leading-tight flex-wrap">
              {inc.folio && <span className="font-mono">{inc.folio}</span>}
              <span>·</span><span>{TYPE_LABEL[inc.type]}</span>
            </div>
          </div>
          <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${SEV_COLOR[inc.severity]}1f`, color: SEV_COLOR[inc.severity] }}>{SEV_LABEL[inc.severity]}</span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${sm.color}1a`, color: sm.color }}>{sm.label}</span>
          <button onClick={() => setEditOpen(true)} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* Clasificación regulatoria (siempre visible, derivada del tipo) */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-gray-500 dark:text-gray-400">Clasificación:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium" style={{ background: `${cls.color}1a`, color: cls.color }}>
            <ClipboardCheck className="h-3.5 w-3.5" /> {cls.label}
          </span>
          <span className="text-gray-500 dark:text-gray-400">{cls.detail}</span>
        </div>

        {/* CAPA por vencer / vencida — alerta visible al responsable */}
        {capaActive && capa && (capa.overdue || capa.dueSoon) && (
          <div
            className="mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px]"
            style={{ background: capa.overdue ? `${RED}12` : `${AMBER}14`, color: capa.overdue ? RED : '#b45309' }}
          >
            <Clock className="mt-px h-5 w-5 flex-shrink-0" style={{ color: capa.overdue ? RED : AMBER }} />
            <div>
              <span className="font-semibold">
                {capa.overdue ? `CAPA vencida hace ${Math.abs(capa.days)} ${Math.abs(capa.days) === 1 ? 'día' : 'días'}.` : `CAPA vence en ${capa.days} ${capa.days === 1 ? 'día' : 'días'}.`}
              </span>{' '}
              Compromiso {fmtDate(inc.capaDueDate)}
              {inc.capaOwner ? ` · responsable ${inc.capaOwner}` : ' · sin responsable asignado'}.
            </div>
          </div>
        )}

        {/* OSHA recordable banner */}
        {recordable && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl px-4 py-3 text-[13px]" style={{ background: `${AMBER}14`, color: '#b45309' }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-px" style={{ color: AMBER }} />
            <div>
              <span className="font-semibold">Incidente registrable OSHA.</span>{' '}
              {inc.type === 'LOST_TIME'
                ? 'Lesión con tiempo perdido (LTI) — afecta el LTIR. Registra los días perdidos al cerrar.'
                : 'Caso registrable — debe documentarse en el OSHA 300 log.'}
            </div>
          </div>
        )}
        {inc.status === 'CANCELLED' && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px]" style={{ background: `${RED}12`, color: RED }}>
            <Ban className="w-5 h-5 flex-shrink-0" /> Este incidente fue cancelado (inválido o duplicado).
          </div>
        )}

        {/* Metric / info strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric icon={CalendarDays} label="Ocurrió" value={fmtDate(inc.occurredAt ?? inc.created_at)} sub={occurredDays != null ? `hace ${occurredDays} d` : undefined} color={ROSE} />
          <Metric icon={MapPin} label="Área" value={inc.area || '—'} sub={inc.location || undefined} color={GRAY} />
          <Metric icon={User} label="Persona" value={inc.injuredPerson || '—'} color={inc.injuredPerson ? ORANGE : GRAY} />
          <Metric icon={HeartPulse} label="Días perdidos" value={String(inc.lostDays ?? 0)} color={(inc.lostDays ?? 0) > 0 ? RED : GREEN} />
          <Metric icon={ActivityIcon} label="Severidad" value={SEV_LABEL[inc.severity]} color={SEV_COLOR[inc.severity]} />
          <Metric icon={User} label="Reportó" value={inc.reportedBy ? inc.reportedBy.split('@')[0] : '—'} sub={inc.reportedBy ? '' : undefined} color={GRAY} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">¿Qué pasó?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {inc.description?.trim() || 'Sin descripción. Edita el incidente para narrar el evento (qué, cómo, condiciones).'}
              </p>
            </div>

            {/* Investigation editor */}
            <InvestigationCard inc={inc} onSaved={mutate} />
          </div>

          {/* Right column — workflow */}
          <div className="space-y-6">
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-1">Flujo del incidente</h3>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">Estado actual: <span className="font-medium" style={{ color: sm.color }}>{sm.label}</span></p>

              {/* Stepper */}
              <Stepper current={inc.status} />

              {/* Transition actions */}
              <div className="mt-5">
                {terminal ? (
                  <div className="text-[13px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: inc.status === 'CLOSED' ? GREEN : RED }} />
                    {inc.status === 'CLOSED' ? `Cerrado el ${fmtDate(inc.closedAt)}.` : 'Estado terminal — sin transiciones.'}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Avanzar a</span>
                    {NEXT[inc.status].map((to) => {
                      const m = STATUS_META[to];
                      const danger = to === 'CANCELLED';
                      return (
                        <button
                          key={to}
                          onClick={() => transition(to)}
                          disabled={busy !== null}
                          className="inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                          style={{ background: `${m.color}14`, color: m.color }}
                        >
                          <span className="inline-flex items-center gap-2">
                            {danger ? <Ban className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                            {m.label}
                          </span>
                          {busy === to && <Loader2 className="w-4 h-4 animate-spin" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Timeline of key dates */}
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">Línea de tiempo</h3>
              <div className="space-y-3">
                <TimelineRow icon={ShieldAlert} color={GRAY} label="Reportado" value={fmtDateTime(inc.created_at)} done />
                <TimelineRow icon={CalendarDays} color={ROSE} label="Ocurrió" value={fmtDateTime(inc.occurredAt)} done={!!inc.occurredAt} />
                <TimelineRow icon={Search} color={VIOLET} label="Investigado" value={fmtDateTime(inc.investigatedAt)} done={!!inc.investigatedAt} />
                <TimelineRow icon={CheckCircle2} color={GREEN} label="Cerrado" value={fmtDateTime(inc.closedAt)} done={!!inc.closedAt} />
              </div>
              <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">La fecha de investigación se fija al pasar a «Investigando».</p>
            </div>
          </div>
        </div>
      </main>

      {editOpen && <EditModal inc={inc} onClose={() => setEditOpen(false)} onDone={() => { setEditOpen(false); mutate(); }} />}
    </div>
  );
}

// ── Investigation card ───────────────────────────────────────────────────────
function InvestigationCard({ inc, onSaved }: { inc: Incident; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    rootCause: inc.rootCause || '',
    correctiveAction: inc.correctiveAction || '',
    capaOwner: inc.capaOwner || '',
    capaDueDate: inc.capaDueDate ? inc.capaDueDate.slice(0, 10) : '',
    injuredPerson: inc.injuredPerson || '',
    lostDays: inc.lostDays ?? 0,
  });

  const dirty =
    (f.rootCause || '') !== (inc.rootCause || '') ||
    (f.correctiveAction || '') !== (inc.correctiveAction || '') ||
    (f.capaOwner || '') !== (inc.capaOwner || '') ||
    (f.capaDueDate || '') !== (inc.capaDueDate ? inc.capaDueDate.slice(0, 10) : '') ||
    (f.injuredPerson || '') !== (inc.injuredPerson || '') ||
    Number(f.lostDays || 0) !== Number(inc.lostDays || 0);

  async function save() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/ehs/incidents/${inc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootCause: f.rootCause || undefined,
          correctiveAction: f.correctiveAction || undefined,
          // Cadena vacía = limpiar (el backend lo normaliza a null).
          capaOwner: f.capaOwner,
          capaDueDate: f.capaDueDate,
          injuredPerson: f.injuredPerson || undefined,
          lostDays: Number(f.lostDays) || 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo guardar.', 'EHS');
        return;
      }
      toast.success('Investigación guardada.', 'EHS');
      onSaved();
    } catch {
      toast.error('Error de red.', 'EHS');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <div className="flex items-center gap-2 mb-1">
        <Search className="w-4 h-4" style={{ color: VIOLET }} />
        <h3 className="text-sm font-semibold">Investigación</h3>
      </div>
      <p className="text-[12px] text-gray-500 dark:text-gray-400 mb-4">Análisis de causa raíz (5-Por qué) y acción correctiva (CAPA).</p>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Causa raíz · 5-Por qué</span>
          <textarea
            className={ehsInput}
            rows={5}
            value={f.rootCause}
            onChange={(e) => setF({ ...f, rootCause: e.target.value })}
            placeholder={'1. ¿Por qué ocurrió? …\n2. ¿Por qué? …\n3. ¿Por qué? …\n4. ¿Por qué? …\n5. Causa raíz: …'}
          />
        </label>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1 inline-flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> Acción correctiva (CAPA)</span>
          <textarea
            className={ehsInput}
            rows={3}
            value={f.correctiveAction}
            onChange={(e) => setF({ ...f, correctiveAction: e.target.value })}
            placeholder="Acción para eliminar la causa y prevenir recurrencia."
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1 inline-flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Responsable de la CAPA</span>
            <input className={ehsInput} value={f.capaOwner} onChange={(e) => setF({ ...f, capaOwner: e.target.value })} placeholder="correo@planta.com" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1 inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Fecha de compromiso</span>
            <input type="date" className={ehsInput} value={f.capaDueDate} onChange={(e) => setF({ ...f, capaDueDate: e.target.value })} />
          </label>
        </div>
        {f.capaDueDate && (() => {
          const ci = capaInfo(f.capaDueDate);
          if (!ci) return null;
          const color = ci.overdue ? RED : ci.dueSoon ? AMBER : GREEN;
          const text = ci.overdue
            ? `Vencida hace ${Math.abs(ci.days)} ${Math.abs(ci.days) === 1 ? 'día' : 'días'}`
            : ci.days === 0
              ? 'Vence hoy'
              : `Vence en ${ci.days} ${ci.days === 1 ? 'día' : 'días'}`;
          return (
            <div className="flex items-center gap-1.5 text-[12px] font-medium" style={{ color }}>
              <Clock className="w-3.5 h-3.5" /> {text}
            </div>
          );
        })()}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Persona lesionada</span>
            <input className={ehsInput} value={f.injuredPerson} onChange={(e) => setF({ ...f, injuredPerson: e.target.value })} placeholder="Nombre o N/A" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Días perdidos (LTIR)</span>
            <input type="number" min={0} className={ehsInput} value={f.lostDays} onChange={(e) => setF({ ...f, lostDays: Number(e.target.value) })} />
          </label>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[12px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {inc.investigatedAt ? `Investigado el ${fmtDate(inc.investigatedAt)}` : 'Aún sin marcar como investigado'}
        </span>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: ROSE }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
        </button>
      </div>
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: Status }) {
  if (current === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ background: `${RED}0f` }}>
        <span className="w-7 h-7 rounded-full grid place-items-center flex-shrink-0" style={{ background: RED }}><Ban className="w-4 h-4 text-white" /></span>
        <span className="text-sm font-medium" style={{ color: RED }}>Cancelado</span>
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
                className="w-8 h-8 rounded-full grid place-items-center flex-shrink-0 transition-colors"
                style={{ background: done || active ? color : `${GRAY}22`, color: done || active ? '#fff' : GRAY }}
              >
                <Icon className="w-4 h-4" />
              </span>
              {!last && <span className="w-px flex-1 my-1" style={{ background: done ? GREEN : `${GRAY}33`, minHeight: 18 }} />}
            </div>
            <div className={`pb-3 ${last ? 'pb-0' : ''}`}>
              <div className="text-sm font-medium" style={{ color: active ? m.color : undefined }}>{m.label}</div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">{done ? 'Completado' : active ? 'En curso' : 'Pendiente'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, sub, color }: { icon: typeof Search; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400"><Icon className="w-3 h-3" />{label}</div>
      <div className="text-base font-semibold mt-0.5 truncate" style={{ color }} title={value}>{value}</div>
      {sub && <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate" title={sub}>{sub}</div>}
    </div>
  );
}

function TimelineRow({ icon: Icon, color, label, value, done }: { icon: typeof Search; color: string; label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-6 h-6 rounded-full grid place-items-center flex-shrink-0" style={{ background: done ? `${color}1f` : `${GRAY}14`, color: done ? color : GRAY }}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400">{done ? value : 'Pendiente'}</div>
      </div>
    </div>
  );
}

// ── Edit modal ───────────────────────────────────────────────────────────────
function EditModal({ inc, onClose, onDone }: { inc: Incident; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: inc.title,
    description: inc.description || '',
    type: inc.type,
    severity: inc.severity,
    area: inc.area || '',
    location: inc.location || '',
  });

  async function submit() {
    if (f.title.trim().length < 3) { toast.error('El título requiere mín. 3 caracteres.', 'EHS'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/ehs/incidents/${inc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title,
          description: f.description || undefined,
          type: f.type,
          severity: f.severity,
          area: f.area || undefined,
          location: f.location || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo guardar.', 'EHS');
        return;
      }
      toast.success('Incidente actualizado.', 'EHS');
      onDone();
    } catch {
      toast.error('Error de red.', 'EHS');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full max-w-xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Editar incidente</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">¿Qué pasó?</span>
            <input className={ehsInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Tipo</span>
            <select className={ehsInput} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as IType })}>
              {(Object.keys(TYPE_LABEL) as IType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Severidad</span>
            <select className={ehsInput} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Severity })}>
              {(Object.keys(SEV_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Área</span>
            <input className={ehsInput} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="SMT" />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Ubicación</span>
            <input className={ehsInput} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Pasillo B" />
          </label>
          <label className="block md:col-span-2">
            <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción</span>
            <textarea className={ehsInput} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={submit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: ROSE }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Guard() {
  return (
    <div className="min-h-screen grid place-items-center text-foreground">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
        <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-semibold">Sin acceso</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver el incidente.</p>
      </div>
    </div>
  );
}
