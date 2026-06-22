'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, X, CheckCircle2, Pencil, Scale, ArrowRight,
  AlertTriangle, CalendarDays, RefreshCw, Building2, User, Coins, Clock,
  FileText, Ban, ShieldCheck, RotateCcw,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Office domain accent (slate base, indigo action) — distinct from CRM violet,
// legible on light + dark cards.
const INDIGO = '#6366f1';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'CANCELLED';
type CType = 'CUSTOMER' | 'SUPPLIER' | 'NDA' | 'LEASE' | 'SERVICE' | 'OTHER';

interface Contract {
  id: string;
  folio: string | null;
  title: string;
  counterparty: string | null;
  type: CType;
  status: Status;
  value: number;
  currency: string;
  ownerEmail: string | null;
  autoRenew: boolean;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: GRAY },
  ACTIVE: { label: 'Activo', color: GREEN },
  EXPIRED: { label: 'Vencido', color: AMBER },
  TERMINATED: { label: 'Terminado', color: GRAY },
  CANCELLED: { label: 'Cancelado', color: RED },
};
const TYPE_LABEL: Record<CType, string> = {
  CUSTOMER: 'Cliente',
  SUPPLIER: 'Proveedor',
  NDA: 'NDA',
  LEASE: 'Arrendamiento',
  SERVICE: 'Servicios',
  OTHER: 'Otro',
};
// Mirrors backend contract-state.ts TRANSITIONS exactly.
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['EXPIRED', 'TERMINATED'],
  EXPIRED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
  CANCELLED: [],
};
// Lifecycle stepper: the "happy path" ladder a contract walks.
const LIFECYCLE: Status[] = ['DRAFT', 'ACTIVE', 'EXPIRED'];

const lgInput =
  'w-full rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-indigo-500';

// ── Module-level helpers (no Date.now() in render bodies) ─────────────────────
function nowMs(): number {
  return Date.now();
}
function daysLeft(end: string | null): number | null {
  if (!end) return null;
  return Math.floor((new Date(end).getTime() - nowMs()) / 86_400_000);
}
function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}
function toDateInput(d: string | null): string {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

export default function ContractDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const { data: c, isLoading, forbidden, mutate } = useApi<Contract>(`/legal/contracts/${id}`);
  const [modal, setModal] = useState<null | 'edit' | 'renew'>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (forbidden) return <Guard />;
  if (isLoading || !c) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const sm = STATUS_META[c.status];
  const dl = daysLeft(c.endDate);
  const isExpiringSoon = c.status === 'ACTIVE' && dl !== null && dl >= 0 && dl <= 90;
  const isPastDue = dl !== null && dl < 0 && (c.status === 'ACTIVE' || c.status === 'EXPIRED');

  async function transition(to: Status) {
    // EXPIRED → ACTIVE is a renewal: collect a new end date through a modal.
    if (to === 'ACTIVE' && c?.status === 'EXPIRED') {
      setModal('renew');
      return;
    }
    setBusy(to);
    try {
      const res = await apiFetch(`${API_BASE}/legal/contracts/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Legal');
        return;
      }
      toast.success(`→ ${STATUS_META[to].label}`, 'Legal');
      mutate();
    } catch {
      toast.error('Error de red.', 'Legal');
    } finally {
      setBusy(null);
    }
  }

  const term = c.startDate || c.endDate
    ? `${fmtDate(c.startDate)} → ${fmtDate(c.endDate)}`
    : 'Sin plazo definido';

  return (
    <div className="min-h-screen text-black dark:text-white">
      {/* Sticky glass header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/legal" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${INDIGO}1f` }}>
            <Scale className="w-5 h-5" style={{ color: INDIGO }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{c.title}</h1>
            <p className="text-[12px] text-gray-400 leading-tight font-mono">{c.folio || 'Sin folio'}{c.counterparty ? ` · ${c.counterparty}` : ''}</p>
          </div>
          <span className="hidden sm:inline text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${INDIGO}14`, color: INDIGO }}>{TYPE_LABEL[c.type]}</span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${sm.color}1a`, color: sm.color }}>{sm.label}</span>
          <button onClick={() => setModal('edit')} className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* Metric strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric icon={Building2} label="Contraparte" value={c.counterparty || '—'} color={GRAY} />
          <Metric icon={Coins} label="Valor" value={money(c.value, c.currency)} color={INDIGO} />
          <Metric icon={CalendarDays} label="Vigencia" value={term} color={GRAY} />
          <Metric
            icon={Clock}
            label="Días a vencer"
            value={dl === null ? '—' : dl < 0 ? `${Math.abs(dl)} d vencido` : `${dl} d`}
            color={dl === null ? GRAY : dl < 0 ? RED : dl <= 90 ? AMBER : GREEN}
          />
          <Metric icon={RefreshCw} label="Renovación" value={c.autoRenew ? 'Automática' : 'Manual'} color={c.autoRenew ? GREEN : GRAY} />
          <Metric icon={User} label="Responsable" value={c.ownerEmail || '—'} color={GRAY} />
        </div>

        {/* Renewal / expiry callout */}
        {(isExpiringSoon || isPastDue) && (
          <div
            className="rounded-2xl px-4 py-3 mb-6 flex items-start gap-3"
            style={{ background: `${isPastDue ? RED : AMBER}14`, border: `1px solid ${isPastDue ? RED : AMBER}33` }}
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: isPastDue ? RED : AMBER }} />
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: isPastDue ? RED : AMBER }}>
                {isPastDue ? 'Contrato vencido' : 'Por vencer'}
              </div>
              <div className="text-[13px] text-gray-500 mt-0.5">
                {isPastDue
                  ? `Venció el ${fmtDate(c.endDate)} (${Math.abs(dl as number)} días). ${c.autoRenew ? 'Renovación automática activa — confirma la nueva vigencia.' : 'Renovación manual — define el siguiente periodo o termínalo.'}`
                  : `Vence el ${fmtDate(c.endDate)} en ${dl} días. ${c.autoRenew ? 'Se renovará automáticamente.' : 'Sin renovación automática — agenda la renovación.'}`}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: detail + notes */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-4">Detalle del contrato</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Row icon={FileText} label="Folio" value={c.folio || '—'} mono />
                <Row icon={Scale} label="Tipo" value={TYPE_LABEL[c.type]} />
                <Row icon={Building2} label="Contraparte" value={c.counterparty || '—'} />
                <Row icon={Coins} label="Valor del contrato" value={money(c.value, c.currency)} />
                <Row icon={CalendarDays} label="Inicio" value={fmtDate(c.startDate)} />
                <Row icon={CalendarDays} label="Fin" value={fmtDate(c.endDate)} />
                <Row icon={RefreshCw} label="Renovación automática" value={c.autoRenew ? 'Sí' : 'No'} />
                <Row icon={User} label="Responsable" value={c.ownerEmail || '—'} />
              </div>
              {c.notes && <p className="mt-4 text-sm text-gray-500 border-t border-black/5 dark:border-white/10 pt-4 whitespace-pre-wrap">{c.notes}</p>}
            </div>
          </div>

          {/* Right: lifecycle stepper + actions */}
          <div className="space-y-6">
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-4">Ciclo de vida</h3>
              <Stepper status={c.status} />

              <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10">
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Acciones</div>
                {NEXT[c.status].length === 0 ? (
                  <p className="text-[13px] text-gray-400">Estado terminal — sin transiciones disponibles.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {NEXT[c.status].map((to) => {
                      const m = STATUS_META[to];
                      const renewal = to === 'ACTIVE' && c.status === 'EXPIRED';
                      const Icon = to === 'CANCELLED' ? Ban : to === 'TERMINATED' ? ShieldCheck : renewal ? RotateCcw : ArrowRight;
                      return (
                        <button
                          key={to}
                          onClick={() => transition(to)}
                          disabled={busy === to}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium disabled:opacity-50"
                          style={{ background: `${m.color}1f`, color: m.color }}
                        >
                          {busy === to ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                          {renewal ? 'Renovar' : m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-3">Renovación</h3>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray-400">Modo</span>
                <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: c.autoRenew ? GREEN : GRAY }}>
                  <RefreshCw className="w-3.5 h-3.5" />{c.autoRenew ? 'Automática' : 'Manual'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px] mt-2">
                <span className="text-gray-400">Vence</span>
                <span className="font-medium" style={{ color: isPastDue ? RED : isExpiringSoon ? AMBER : undefined }}>{fmtDate(c.endDate)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {modal === 'edit' && <EditModal contract={c} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
      {modal === 'renew' && <RenewModal contract={c} onClose={() => setModal(null)} onDone={() => { setModal(null); mutate(); }} />}
    </div>
  );
}

// ── Lifecycle stepper ─────────────────────────────────────────────────────────
function Stepper({ status }: { status: Status }) {
  // Off-ladder terminal states render their own chip after the ladder.
  const idx = LIFECYCLE.indexOf(status);
  const offLadder = idx === -1; // CANCELLED or TERMINATED
  return (
    <div>
      <div className="space-y-0">
        {LIFECYCLE.map((s, i) => {
          const m = STATUS_META[s];
          const reached = !offLadder && i <= idx;
          const current = !offLadder && i === idx;
          const last = i === LIFECYCLE.length - 1;
          return (
            <div key={s} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold flex-shrink-0"
                  style={reached
                    ? { background: m.color, color: '#fff' }
                    : { background: 'transparent', color: GRAY, border: `1.5px solid ${GRAY}55` }}
                >
                  {reached ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </span>
                {!last && <span className="w-px flex-1 my-1" style={{ background: reached ? `${m.color}66` : `${GRAY}33`, minHeight: 16 }} />}
              </div>
              <div className={`pb-3 ${current ? '' : 'opacity-80'}`}>
                <div className="text-[13px] font-semibold leading-6" style={current ? { color: m.color } : undefined}>{m.label}</div>
                {current && <div className="text-[11px] text-gray-400 -mt-0.5">Estado actual</div>}
              </div>
            </div>
          );
        })}
      </div>
      {offLadder && (
        <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full" style={{ background: `${STATUS_META[status].color}1f`, color: STATUS_META[status].color }}>
          {status === 'CANCELLED' ? <Ban className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
          {STATUS_META[status].label}
        </div>
      )}
    </div>
  );
}

// ── Renew modal (EXPIRED → ACTIVE with a new end date) ────────────────────────
function RenewModal({ contract, onClose, onDone }: { contract: Contract; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [endDate, setEndDate] = useState(toDateInput(contract.endDate));
  async function submit() {
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/legal/contracts/${contract.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE', endDate: endDate || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo renovar.', 'Legal');
        return;
      }
      toast.success('Contrato renovado.', 'Legal');
      onDone();
    } catch {
      toast.error('Error de red.', 'Legal');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Renovar contrato" onClose={onClose}>
      <p className="text-[13px] text-gray-500 mb-4">Reactiva el contrato y define la nueva fecha de fin del periodo de renovación.</p>
      <Field label="Nueva fecha de fin">
        <input type="date" className={lgInput} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </Field>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} label="Renovar" />
    </Modal>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ contract, onClose, onDone }: { contract: Contract; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    title: contract.title,
    counterparty: contract.counterparty || '',
    type: contract.type,
    value: contract.value ?? 0,
    currency: contract.currency || 'USD',
    ownerEmail: contract.ownerEmail || '',
    autoRenew: contract.autoRenew,
    startDate: toDateInput(contract.startDate),
    endDate: toDateInput(contract.endDate),
    notes: contract.notes || '',
  });
  async function submit() {
    if (f.title.trim().length < 3) { toast.error('El título debe tener al menos 3 caracteres.', 'Legal'); return; }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/legal/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.title,
          counterparty: f.counterparty,
          type: f.type,
          value: Number(f.value) || 0,
          currency: f.currency.toUpperCase().slice(0, 3),
          ownerEmail: f.ownerEmail || undefined,
          autoRenew: f.autoRenew,
          startDate: f.startDate || null,
          endDate: f.endDate || null,
          notes: f.notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo guardar.', 'Legal');
        return;
      }
      toast.success('Contrato actualizado.', 'Legal');
      onDone();
    } catch {
      toast.error('Error de red.', 'Legal');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Editar contrato" onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Título" full><input className={lgInput} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Contraparte"><input className={lgInput} value={f.counterparty} onChange={(e) => setF({ ...f, counterparty: e.target.value })} /></Field>
        <Field label="Tipo"><select className={lgInput} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CType })}>{(Object.keys(TYPE_LABEL) as CType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></Field>
        <Field label="Valor"><input type="number" min={0} className={lgInput} value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} /></Field>
        <Field label="Moneda"><input className={lgInput} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase().slice(0, 3) })} /></Field>
        <Field label="Inicio"><input type="date" className={lgInput} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label="Fin"><input type="date" className={lgInput} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        <Field label="Responsable" full><input className={lgInput} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} placeholder="responsable@empresa.com" /></Field>
        <Field label="Notas" full><textarea rows={3} className={lgInput} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      <label className="flex items-center gap-2 mt-3 text-sm"><input type="checkbox" checked={f.autoRenew} onChange={(e) => setF({ ...f, autoRenew: e.target.checked })} /> Renovación automática</label>
      <ModalActions busy={busy} onClose={onClose} onSubmit={submit} />
    </Modal>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, color }: { icon: typeof Scale; label: string; value: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-sm font-semibold mt-1 tabular-nums truncate" style={{ color }} title={value}>{value}</div>
    </div>
  );
}
function Row({ icon: Icon, label, value, mono }: { icon: typeof Scale; label: string; value: React.ReactNode; mono?: boolean }) {
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
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={`block ${full ? 'md:col-span-full' : ''}`}><span className="block text-[12px] font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}
function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ busy, onClose, onSubmit, label }: { busy: boolean; onClose: () => void; onSubmit: () => void; label?: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
      <button onClick={onSubmit} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: INDIGO }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {label || 'Guardar'}</button>
    </div>
  );
}
function Guard() {
  return (
    <div className="min-h-screen grid place-items-center text-black dark:text-white">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2><p className="text-sm text-gray-400 mt-1">Inicia sesión para ver el contrato.</p></div>
    </div>
  );
}
