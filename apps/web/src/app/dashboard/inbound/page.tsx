'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  PackageCheck,
  Plus,
  Lock,
  Loader2,
  Inbox,
  ArrowRight,
  X,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';
const RED = '#ef4444';

type Status = 'RECEIVED' | 'INSPECTING' | 'RELEASED' | 'QUARANTINE' | 'REJECTED';

interface Receipt {
  id: string;
  folio: string | null;
  supplierName?: string | null;
  poFolio?: string | null;
  partNumber: string;
  quantity: number;
  uom: string;
  lotNumber?: string | null;
  status: Status;
  iqcResult?: 'PASS' | 'FAIL' | null;
  rejectCode?: string | null;
  inventoryPosted?: boolean;
}

interface Kpis {
  total: number;
  pendingIqc: number;
  inQuarantine: number;
  released: number;
  rejected: number;
  rejectRatePct: number | null;
  dockToStockAvgHours: number | null;
}

const STATUS_META: Record<Status, { label: string; color: string }> = {
  RECEIVED: { label: 'Recibido', color: GRAY },
  INSPECTING: { label: 'En IQC', color: AMBER },
  RELEASED: { label: 'Liberado', color: GREEN },
  QUARANTINE: { label: 'Cuarentena', color: RED },
  REJECTED: { label: 'Rechazado', color: RED },
};
const NEXT: Record<Status, Status[]> = {
  RECEIVED: ['INSPECTING', 'RELEASED'],
  INSPECTING: ['RELEASED', 'QUARANTINE'],
  QUARANTINE: ['RELEASED', 'REJECTED'],
  RELEASED: [],
  REJECTED: [],
};
const ORDER: Status[] = ['RECEIVED', 'INSPECTING', 'QUARANTINE', 'RELEASED', 'REJECTED'];

export default function InboundPage() {
  const { data, isLoading, forbidden, mutate } = useApi<Receipt[]>('/inbound/receipts');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/inbound/kpis');
  const toast = useToast();

  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    partNumber: '',
    quantity: 0,
    uom: 'PCS',
    supplierName: '',
    poFolio: '',
    lotNumber: '',
  });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function receive() {
    if (form.partNumber.trim().length < 1) {
      toast.error('Escanea o escribe el número de parte.', 'Recibo');
      return;
    }
    setBusy('new');
    try {
      const res = await apiFetch(`${API_BASE}/inbound/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          supplierName: form.supplierName || undefined,
          poFolio: form.poFolio || undefined,
          lotNumber: form.lotNumber || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo recibir.', 'Recibo');
        return;
      }
      toast.success(`Recibido ${form.partNumber}`, 'Recibo');
      setForm({ partNumber: '', quantity: 0, uom: 'PCS', supplierName: '', poFolio: '', lotNumber: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Recibo');
    } finally {
      setBusy(null);
    }
  }

  async function transition(r: Receipt, status: Status) {
    const body: Record<string, unknown> = { status };
    if (status === 'QUARANTINE' || status === 'REJECTED') {
      const rc = window.prompt('Código de rechazo:', r.rejectCode || '');
      if (rc === null) return;
      if (rc) body.rejectCode = rc;
    }
    setBusy(r.id);
    try {
      const res = await apiFetch(`${API_BASE}/inbound/receipts/${r.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo actualizar.', 'Recibo');
        return;
      }
      toast.success(`→ ${STATUS_META[status].label}`, 'Recibo');
      refresh();
    } catch {
      toast.error('Error de red.', 'Recibo');
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Inicia sesión para ver recibo.</p>
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
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <PackageCheck className="w-5 h-5" style={{ color: GREEN }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Recibo · Inbound + IQC</h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-tight">Recepción, inspección de entrada y liberación</p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-8 pb-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="Pendientes IQC" value={kpis?.pendingIqc ?? 0} color={AMBER} />
          <Kpi label="En cuarentena" value={kpis?.inQuarantine ?? 0} color={(kpis?.inQuarantine ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="% rechazo recibo" value={kpis?.rejectRatePct === null || kpis?.rejectRatePct === undefined ? '—' : `${kpis.rejectRatePct}%`} color={(kpis?.rejectRatePct ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="Dock-to-stock (h)" value={kpis?.dockToStockAvgHours === null || kpis?.dockToStockAvgHours === undefined ? '—' : kpis.dockToStockAvgHours} color={BLUE} />
        </div>

        {/* Receive form (scanner-friendly) */}
        <div className={`${glass} rounded-2xl p-5 mb-6`}>
          <h3 className="font-semibold mb-4">Recibir material</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="block md:col-span-2">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de parte</span>
              <input
                value={form.partNumber}
                autoFocus
                onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') receive(); }}
                placeholder="Escanea parte…"
                className="ib-input font-mono"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">Cantidad</span>
              <input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="ib-input" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">Lote</span>
              <input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="L-123" className="ib-input" />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">PO</span>
              <input value={form.poFolio} onChange={(e) => setForm({ ...form, poFolio: e.target.value })} placeholder="PO-2026-…" className="ib-input" />
            </label>
            <button onClick={receive} disabled={busy === 'new'} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: '#047857' }}>
              {busy === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Recibir
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-500 dark:text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
            <h3 className="font-semibold">Sin recibos</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recibe material para iniciar la cola de IQC.</p>
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
                              <span className="font-semibold font-mono truncate">{r.partNumber}</span>
                              {r.iqcResult && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${r.iqcResult === 'PASS' ? GREEN : RED}1f`, color: r.iqcResult === 'PASS' ? GREEN : RED }}>{r.iqcResult}</span>}
                              {r.inventoryPosted && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${BLUE}1f`, color: BLUE }}>en inventario</span>}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[12px] text-gray-500 dark:text-gray-400 flex-wrap">
                              <span>{r.quantity} {r.uom}</span>
                              {r.lotNumber && <><span>•</span><span>lote {r.lotNumber}</span></>}
                              {r.supplierName && <><span>•</span><span>{r.supplierName}</span></>}
                              {r.poFolio && <><span>•</span><span>{r.poFolio}</span></>}
                              {r.rejectCode && <><span>•</span><span style={{ color: RED }}>{r.rejectCode}</span></>}
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
                                {to === 'REJECTED' ? <X className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
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
        .ib-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .ib-input:focus { border-color: #10b981; }
        :global(.dark) .ib-input {
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
