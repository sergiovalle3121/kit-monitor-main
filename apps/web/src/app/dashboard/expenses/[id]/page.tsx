'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ChevronLeft, Loader2, Lock, X, Receipt, ArrowRight, CheckCircle2, Send,
  Ban, RotateCcw, Wallet, ShieldCheck, XCircle, User, Coins, Tag, CalendarDays,
  UserCheck, FolderKanban, AlertTriangle, Clock, FileText,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

// Finance domain accent — teal, distinct from CRM violet / legal indigo.
const TEAL = '#0fb39a';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED';
type Category = 'TRAVEL' | 'MEALS' | 'LODGING' | 'SUPPLIES' | 'TRAINING' | 'OTHER';

interface Expense {
  id: string;
  folio: string | null;
  employeeName: string;
  description: string;
  category: Category;
  amount: number;
  currency: string;
  status: Status;
  approverEmail: string | null;
  rejectReason: string | null;
  programId: string | null;
  expenseDate: string | null;
  approvedAt: string | null;
  reimbursedAt: string | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  DRAFT: { label: 'Borrador', color: GRAY },
  SUBMITTED: { label: 'Enviado', color: AMBER },
  APPROVED: { label: 'Aprobado', color: BLUE },
  REJECTED: { label: 'Rechazado', color: RED },
  REIMBURSED: { label: 'Reembolsado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: GRAY },
};
const CAT_LABEL: Record<Category, string> = {
  TRAVEL: 'Viaje', MEALS: 'Comidas', LODGING: 'Hospedaje', SUPPLIES: 'Insumos', TRAINING: 'Capacitación', OTHER: 'Otro',
};
// Mirrors backend expense-state.ts TRANSITIONS exactly.
const NEXT: Record<Status, Status[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['REIMBURSED'],
  REJECTED: ['DRAFT'],
  REIMBURSED: [],
  CANCELLED: [],
};
// Approval ladder: the happy path a report walks. REJECTED + CANCELLED are off-ladder.
const LIFECYCLE: Status[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REIMBURSED'];

const ACTION_META: Record<Status, { verb: string; icon: typeof ArrowRight }> = {
  SUBMITTED: { verb: 'Enviar a aprobación', icon: Send },
  APPROVED: { verb: 'Aprobar', icon: CheckCircle2 },
  REJECTED: { verb: 'Rechazar', icon: XCircle },
  REIMBURSED: { verb: 'Marcar reembolsado', icon: Wallet },
  CANCELLED: { verb: 'Cancelar', icon: Ban },
  DRAFT: { verb: 'Reabrir borrador', icon: RotateCcw },
};

const exInput =
  'w-full rounded-xl px-3 py-2 text-sm bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/10 outline-none focus:border-teal-500';

// ── Module-level helpers (no Date.now() in render bodies) ─────────────────────
function money(n: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: ccy || 'USD', maximumFractionDigits: 2 }).format(n || 0);
  } catch {
    return `${(n || 0).toLocaleString()} ${ccy}`;
  }
}
function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ExpenseDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const { data: e, isLoading, forbidden, mutate } = useApi<Expense>(`/expenses/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  if (forbidden) return <Guard />;
  if (isLoading || !e) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>;
  }

  const sm = STATUS_META[e.status];
  const cat = CAT_LABEL[e.category] || e.category;

  async function transition(to: Status, rejectReason?: string) {
    setBusy(to);
    try {
      const body: Record<string, unknown> = { status: to };
      if (to === 'REJECTED' && rejectReason) body.rejectReason = rejectReason;
      const res = await apiFetch(`${API_BASE}/expenses/${id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Gastos');
        return;
      }
      toast.success(`→ ${STATUS_META[to].label}`, 'Gastos');
      setRejecting(false);
      mutate();
    } catch {
      toast.error('Error de red.', 'Gastos');
    } finally {
      setBusy(null);
    }
  }

  function onAction(to: Status) {
    if (to === 'REJECTED') { setRejecting(true); return; }
    transition(to);
  }

  return (
    <div className="min-h-screen text-foreground">
      {/* Sticky glass header */}
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard/expenses" aria-label="Volver" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"><ChevronLeft className="w-5 h-5" /></Link>
          <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: `${TEAL}1f` }}>
            <Receipt className="w-5 h-5" style={{ color: TEAL }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{e.description}</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight font-mono">{e.folio || 'Sin folio'}{e.employeeName ? ` · ${e.employeeName}` : ''}</p>
          </div>
          <span className="hidden sm:inline text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${TEAL}14`, color: TEAL }}>{cat}</span>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${sm.color}1a`, color: sm.color }}>{sm.label}</span>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-6 pb-24">
        {/* Metric / info strip — amount is the prominent figure */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className={`${glass} rounded-2xl p-3.5 col-span-2`}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400"><Coins className="w-3 h-3" />Monto</div>
            <div className="text-2xl font-bold mt-0.5 tabular-nums truncate" style={{ color: TEAL }} title={money(e.amount, e.currency)}>{money(e.amount, e.currency)}</div>
          </div>
          <Metric icon={User} label="Empleado" value={e.employeeName || '—'} color={GRAY} />
          <Metric icon={Tag} label="Categoría" value={cat} color={GRAY} />
          <Metric icon={CalendarDays} label="Fecha de gasto" value={fmtDate(e.expenseDate)} color={GRAY} />
          <Metric icon={UserCheck} label="Aprobador" value={e.approverEmail || '—'} color={e.approverEmail ? BLUE : GRAY} />
        </div>

        {/* Rejection callout */}
        {e.status === 'REJECTED' && (
          <div className="rounded-2xl px-4 py-3 mb-6 flex items-start gap-3" style={{ background: `${RED}14`, border: `1px solid ${RED}33` }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: RED }} />
            <div className="min-w-0">
              <div className="text-sm font-semibold" style={{ color: RED }}>Gasto rechazado</div>
              <div className="text-[13px] text-gray-500 mt-0.5">
                {e.rejectReason ? e.rejectReason : 'Sin motivo registrado.'}{e.approverEmail ? ` — ${e.approverEmail}` : ''}. Corrige y reábrelo como borrador para reenviar.
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: detail + dates timeline */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-4">Detalle del gasto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Row icon={FileText} label="Folio" value={e.folio || '—'} mono />
                <Row icon={Tag} label="Categoría" value={cat} />
                <Row icon={User} label="Empleado" value={e.employeeName || '—'} />
                <Row icon={Coins} label="Monto" value={money(e.amount, e.currency)} />
                <Row icon={CalendarDays} label="Fecha de gasto" value={fmtDate(e.expenseDate)} />
                <Row icon={FolderKanban} label="Programa" value={e.programId || '—'} mono />
                <Row icon={UserCheck} label="Aprobador" value={e.approverEmail || '—'} />
                <Row icon={ShieldCheck} label="Estado" value={sm.label} />
              </div>
            </div>

            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-4">Cronología</h3>
              <Timeline e={e} />
            </div>
          </div>

          {/* Right: HERO — approval workflow */}
          <div className="space-y-6">
            <div className={`${glass} rounded-2xl p-5`}>
              <h3 className="text-sm font-semibold mb-4">Flujo de aprobación</h3>
              <Stepper status={e.status} />

              <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/10">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Acciones</div>
                {NEXT[e.status].length === 0 ? (
                  <p className="text-[13px] text-gray-500 dark:text-gray-400">Estado terminal — sin transiciones disponibles.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {NEXT[e.status].map((to) => {
                      const m = STATUS_META[to];
                      const a = ACTION_META[to];
                      const Icon = a.icon;
                      return (
                        <button
                          key={to}
                          onClick={() => onAction(to)}
                          disabled={busy === to}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-medium disabled:opacity-50"
                          style={{ background: `${m.color}1f`, color: m.color }}
                        >
                          {busy === to ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                          {a.verb}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {rejecting && (
        <RejectModal busy={busy === 'REJECTED'} initial={e.rejectReason || ''} onClose={() => setRejecting(false)} onSubmit={(r) => transition('REJECTED', r)} />
      )}
    </div>
  );
}

// ── Approval workflow stepper (HERO) ──────────────────────────────────────────
function Stepper({ status }: { status: Status }) {
  const idx = LIFECYCLE.indexOf(status);
  const offLadder = idx === -1; // REJECTED or CANCELLED
  // When off-ladder, mark how far the report had walked before falling off:
  // REJECTED happens at SUBMITTED; CANCELLED happens at DRAFT.
  const stalledAt = status === 'REJECTED' ? LIFECYCLE.indexOf('SUBMITTED') : status === 'CANCELLED' ? LIFECYCLE.indexOf('DRAFT') : -1;
  return (
    <div>
      <div className="space-y-0">
        {LIFECYCLE.map((s, i) => {
          const m = STATUS_META[s];
          const reached = offLadder ? i <= stalledAt : i <= idx;
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
                {current && <div className="text-[11px] text-gray-500 dark:text-gray-400 -mt-0.5">Estado actual</div>}
              </div>
            </div>
          );
        })}
      </div>
      {offLadder && (
        <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full" style={{ background: `${STATUS_META[status].color}1f`, color: STATUS_META[status].color }}>
          {status === 'CANCELLED' ? <Ban className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {STATUS_META[status].label}
        </div>
      )}
    </div>
  );
}

// ── Dates timeline (gasto → enviado/aprobado → reembolsado) ───────────────────
function Timeline({ e }: { e: Expense }) {
  const steps: { label: string; date: string | null; color: string; done: boolean }[] = [
    { label: 'Gasto realizado', date: e.expenseDate, color: GRAY, done: !!e.expenseDate },
    { label: 'Aprobado', date: e.approvedAt, color: BLUE, done: !!e.approvedAt },
    { label: 'Reembolsado', date: e.reimbursedAt, color: GREEN, done: !!e.reimbursedAt },
  ];
  return (
    <div className="space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <div key={s.label} className="flex items-stretch gap-3">
            <div className="flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: s.done ? s.color : `${GRAY}55` }} />
              {!last && <span className="w-px flex-1 my-1" style={{ background: `${GRAY}33`, minHeight: 18 }} />}
            </div>
            <div className={`pb-3 min-w-0 ${s.done ? '' : 'opacity-60'}`}>
              <div className="text-[13px] font-medium leading-5">{s.label}</div>
              <div className="text-[12px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><Clock className="w-3 h-3" />{s.done ? fmtDate(s.date) : 'Pendiente'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Reject modal (captures rejectReason) ──────────────────────────────────────
function RejectModal({ busy, initial, onClose, onSubmit }: { busy: boolean; initial: string; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState(initial);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className={`${glass} rounded-3xl p-6 w-full max-w-xl`} onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold flex items-center gap-2"><XCircle className="w-5 h-5" style={{ color: RED }} /> Rechazar gasto</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[13px] text-gray-500 mb-4">Indica el motivo del rechazo. El empleado podrá corregir y reenviar el reporte.</p>
        <label className="block">
          <span className="block text-[12px] font-medium text-gray-500 mb-1">Motivo de rechazo</span>
          <textarea rows={3} className={exInput} value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="Falta comprobante fiscal, monto excede política…" />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button onClick={() => onSubmit(reason.trim())} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: RED }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Rechazar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function Metric({ icon: Icon, label, value, color }: { icon: typeof Receipt; label: string; value: string; color: string }) {
  return (
    <div className={`${glass} rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400"><Icon className="w-3 h-3" />{label}</div>
      <div className="text-sm font-semibold mt-1 tabular-nums truncate" style={{ color }} title={value}>{value}</div>
    </div>
  );
}
function Row({ icon: Icon, label, value, mono }: { icon: typeof Receipt; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
        <div className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
    </div>
  );
}
function Guard() {
  return (
    <div className="min-h-screen grid place-items-center text-foreground">
      <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}><Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" /><h2 className="text-lg font-semibold">Sin acceso</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver el gasto.</p></div>
    </div>
  );
}
