'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  PackageX,
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
const ORANGE = '#f97316';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'OPEN' | 'INVESTIGATING' | 'DISPOSITION' | 'CLOSED' | 'CANCELLED';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type Disposition = 'REPAIR' | 'REPLACE' | 'CREDIT' | 'REJECT';

interface Rma {
  id: string;
  folio: string | null;
  customerName?: string | null;
  partNumber?: string | null;
  serialNumber?: string | null;
  failureDescription: string;
  severity: Severity;
  status: Status;
  disposition?: Disposition | null;
  quantity: number;
}

interface Kpis {
  total: number;
  open: number;
  investigating: number;
  closed: number;
  avgCloseDays: number | null;
  byDisposition: Record<string, number>;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  OPEN: { label: 'Abierto', color: GRAY },
  INVESTIGATING: { label: 'Investigando', color: VIOLET },
  DISPOSITION: { label: 'Disposición', color: AMBER },
  CLOSED: { label: 'Cerrado', color: GREEN },
  CANCELLED: { label: 'Cancelado', color: RED },
};
const SEV_COLOR: Record<Severity, string> = { LOW: GRAY, MEDIUM: AMBER, HIGH: ORANGE, CRITICAL: RED };
const SEV_LABEL: Record<Severity, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };
const DISPOSITIONS: Disposition[] = ['REPAIR', 'REPLACE', 'CREDIT', 'REJECT'];
const DISP_LABEL: Record<Disposition, string> = { REPAIR: 'Reparar', REPLACE: 'Reemplazar', CREDIT: 'Nota crédito', REJECT: 'Rechazar' };
const NEXT: Record<Status, Status[]> = {
  OPEN: ['INVESTIGATING', 'CANCELLED'],
  INVESTIGATING: ['DISPOSITION', 'CANCELLED'],
  DISPOSITION: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};
const ORDER: Status[] = ['OPEN', 'INVESTIGATING', 'DISPOSITION', 'CLOSED'];

export default function RmaPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Rma[]>('/rma');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/rma/kpis');
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ failureDescription: '', customerName: '', partNumber: '', serialNumber: '', severity: 'MEDIUM' as Severity, quantity: 1 });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function createRma() {
    if (form.failureDescription.trim().length < 3) {
      toast.error('Describe la falla.', 'RMA');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/rma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, customerName: form.customerName || undefined, partNumber: form.partNumber || undefined, serialNumber: form.serialNumber || undefined }),
      });
      if (!res.ok) { toast.error('No se pudo abrir.', 'RMA'); return; }
      toast.success('RMA abierto.', 'RMA');
      setShowForm(false);
      setForm({ failureDescription: '', customerName: '', partNumber: '', serialNumber: '', severity: 'MEDIUM', quantity: 1 });
      refresh();
    } catch {
      toast.error('Error de red.', 'RMA');
    } finally {
      setBusy(null);
    }
  }

  async function transition(r: Rma, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'DISPOSITION') {
      const d = window.prompt('Disposición (REPAIR / REPLACE / CREDIT / REJECT):', 'REPAIR');
      if (d === null) return;
      const up = d.trim().toUpperCase();
      if (!DISPOSITIONS.includes(up as Disposition)) { toast.error('Disposición inválida.', 'RMA'); return; }
      body.disposition = up;
    }
    setBusy(r.id);
    try {
      const res = await apiFetch(`${API_BASE}/rma/${r.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const dd = await res.json().catch(() => ({}));
        toast.error(dd?.message || 'No se pudo actualizar.', 'RMA');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'RMA');
      refresh();
    } catch {
      toast.error('Error de red.', 'RMA');
    } finally {
      setBusy(null);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver RMA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" aria-label="Volver al inicio" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(239,68,68,0.12)' }}>
            <PackageX className="w-5 h-5" style={{ color: RED }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">RMA · Quejas de Cliente</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight">Devoluciones, investigación y disposición</p>
          </div>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: RED }}>
            <Plus className="w-4 h-4" /> Abrir RMA
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Abiertas" value={kpis?.open ?? 0} color={AMBER} />
          <Kpi label="En investigación" value={kpis?.investigating ?? 0} color={VIOLET} />
          <Kpi label="Cierre promedio (d)" value={kpis?.avgCloseDays === null || kpis?.avgCloseDays === undefined ? '—' : kpis.avgCloseDays} color={GREEN} />
          <Kpi label="Cerradas" value={kpis?.closed ?? 0} color={GRAY} />
        </div>

        {showForm && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Abrir RMA</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="block md:col-span-2">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Descripción de la falla</span>
                <input value={form.failureDescription} onChange={(e) => setForm({ ...form, failureDescription: e.target.value })} placeholder="Unidad no enciende tras 2 semanas" className="rma-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Cliente</span>
                <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Cliente A" className="rma-input" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de parte</span>
                <input value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} className="rma-input font-mono" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de serie</span>
                <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className="rma-input font-mono" />
              </label>
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Severidad</span>
                <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })} className="rma-input">
                  {(Object.keys(SEV_LABEL) as Severity[]).map((s) => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-sm hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
              <button onClick={createRma} disabled={busy === 'new'} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: RED }}>
                {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Abrir
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold">Sin casos RMA</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Abre un caso al recibir una queja o devolución de cliente.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ORDER.map((status) => {
              const items = list.filter((r) => r.status === status);
              if (items.length === 0) return null;
              return (
                <section key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_META[status].color }} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">({items.length})</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((r) => (
                      <div key={r.id} className={`${glass} rounded-2xl p-4`}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {r.folio && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{r.folio}</span>}
                              <span className="font-semibold truncate">{r.failureDescription}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${SEV_COLOR[r.severity]}1f`, color: SEV_COLOR[r.severity] }}>{SEV_LABEL[r.severity]}</span>
                              {r.disposition && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${VIOLET}1f`, color: VIOLET }}>{DISP_LABEL[r.disposition]}</span>}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-500 dark:text-gray-400 flex-wrap">
                              {r.customerName && <><span>{r.customerName}</span><span>•</span></>}
                              {r.partNumber && <><span>{r.partNumber}</span><span>•</span></>}
                              {r.serialNumber && <><span>SN {r.serialNumber}</span><span>•</span></>}
                              <span>{r.quantity} pza</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {NEXT[r.status].map((to) => (
                              <button
                                key={to}
                                onClick={() => transition(r, to)}
                                disabled={busy === r.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                                style={{ background: `${STATUS_META[to].color}1f`, color: STATUS_META[to].color }}
                                title={`Mover a ${STATUS_META[to].label}`}
                              >
                                {to === 'CANCELLED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
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
        .rma-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .rma-input:focus { border-color: #ef4444; }
        :global(.dark) .rma-input {
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
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
