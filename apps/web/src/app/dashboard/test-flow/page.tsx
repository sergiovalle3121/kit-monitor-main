'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Workflow,
  Lock,
  Loader2,
  Inbox,
  PackageCheck,
  ShieldX,
  Search,
  CircleDot,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GRAY = '#6b7280';

type Stage = 'AWAITING_TEST' | 'READY_FOR_PACKAGING' | 'IN_DISPOSITION';

interface UnitFlow {
  id: string;
  serialNumber: string;
  stage: Stage;
  workOrder: string | null;
  model: string | null;
  executionId: number | null;
  assemblyStation: string | null;
  testResult: 'PASS' | 'FAIL' | null;
  failureCode: string | null;
  destination: 'PACKAGING' | 'DISPOSITION' | null;
  holdId: string | null;
  enqueuedAt: string | null;
  testedAt: string | null;
  routedAt: string | null;
}

interface Summary {
  total: number;
  awaitingTest: number;
  readyForPackaging: number;
  inDisposition: number;
}

interface LedgerEvent {
  action: string;
  domain: string;
  timestamp: string;
}

interface Trace extends Omit<UnitFlow, 'id' | 'assemblyStation'> {
  serial: string;
  events: LedgerEvent[];
}

const STAGES: { key: Stage; label: string; color: string; icon: typeof Inbox }[] = [
  { key: 'AWAITING_TEST', label: 'En cola de Pruebas', color: AMBER, icon: Inbox },
  { key: 'READY_FOR_PACKAGING', label: 'Listo para Empaque', color: GREEN, icon: PackageCheck },
  { key: 'IN_DISPOSITION', label: 'En disposición', color: RED, icon: ShieldX },
];

export default function TestFlowPage() {
  const { data: summary, forbidden } = useApi<Summary>('/test-flow/summary');
  const [stage, setStage] = useState<Stage>('AWAITING_TEST');
  const { data, isLoading } = useApi<UnitFlow[]>(`/test-flow/queue?stage=${stage}`);
  const list = Array.isArray(data) ? data : [];
  const toast = useToast();

  const [serial, setSerial] = useState('');
  const [trace, setTrace] = useState<Trace | null>(null);
  const [tracing, setTracing] = useState(false);

  async function runTrace() {
    const s = serial.trim();
    if (!s) {
      toast.error('Escanea o escribe el número de serie.', 'Flujo de Pruebas');
      return;
    }
    setTracing(true);
    try {
      const res = await apiFetch(`${API_BASE}/test-flow/trace/${encodeURIComponent(s)}`);
      if (!res.ok) {
        setTrace(null);
        toast.error(res.status === 404 ? `Sin flujo para ${s}.` : 'No se pudo trazar.', 'Flujo de Pruebas');
        return;
      }
      setTrace((await res.json()) as Trace);
    } catch {
      toast.error('Error de red.', 'Flujo de Pruebas');
    } finally {
      setTracing(false);
    }
  }

  if (forbidden) {
    return (
      <div className="min-h-screen grid place-items-center text-foreground">
        <div className={`${glass} rounded-3xl p-10 text-center max-w-sm`}>
          <Lock className="w-8 h-8 mx-auto mb-3 text-gray-400" />
          <h2 className="text-lg font-semibold">Sin acceso</h2>
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver el flujo de unidades.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <Workflow className="w-5 h-5" style={{ color: GREEN }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Flujo de Unidades · Pruebas</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Ensamble → Prueba → Empaque / Disposición · por número de serie</p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pt-8 pb-24">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="En cola de Pruebas" value={summary?.awaitingTest ?? 0} color={AMBER} />
          <Kpi label="Listo para Empaque" value={summary?.readyForPackaging ?? 0} color={GREEN} />
          <Kpi label="En disposición" value={summary?.inDisposition ?? 0} color={RED} />
          <Kpi label="Total en flujo" value={summary?.total ?? 0} color={GRAY} />
        </div>

        {/* Trace */}
        <div className={`${glass} rounded-2xl p-5 mb-6`}>
          <h3 className="font-semibold mb-4">Trazabilidad por serie</h3>
          <div className="flex gap-2 items-end">
            <label className="block flex-1">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de serie</span>
              <input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runTrace(); }}
                placeholder="Escanea SN…"
                className="tf-input font-mono"
              />
            </label>
            <button onClick={runTrace} disabled={tracing} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: GREEN }}>
              {tracing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Trazar
            </button>
          </div>
          {trace && (
            <div className="mt-4 rounded-xl border border-black/5 dark:border-white/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-sm">{trace.serial}</span>
                <StageBadge stage={trace.stage} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                <Field label="WO" value={trace.workOrder} />
                <Field label="Modelo" value={trace.model} />
                <Field label="Resultado" value={trace.testResult} />
                <Field label="Destino" value={trace.destination} />
              </div>
              {trace.events?.length > 0 && (
                <div className="mt-4">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">Bitácora (Event Ledger)</div>
                  <div className="space-y-1">
                    {trace.events.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <CircleDot className="w-3 h-3 text-gray-400" />
                        <span className="font-mono">{e.action}</span>
                        <span className="text-gray-400 ml-auto">{e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stage tabs */}
        <div className="flex gap-2 mb-4">
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStage(s.key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] font-medium border ${stage === s.key ? 'border-transparent text-white' : 'border-black/10 dark:border-white/15 text-gray-500'}`}
              style={stage === s.key ? { background: s.color } : undefined}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </div>

        {/* Queue list */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin unidades en esta etapa</h3>
            <p className="text-sm text-gray-400 mt-1">Las unidades aparecen aquí al completarse en la última estación del MES.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((u) => (
              <div key={u.id} className={`${glass} rounded-xl p-3 flex items-center gap-3`}>
                <span className="font-mono text-sm truncate flex-1">{u.serialNumber}</span>
                {u.workOrder && <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{u.workOrder}</span>}
                {u.model && <span className="text-[11px] text-gray-400">{u.model}</span>}
                {u.failureCode && <span className="text-[11px]" style={{ color: RED }}>{u.failureCode}</span>}
                <StageBadge stage={u.stage} />
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        .tf-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .tf-input:focus { border-color: #10b981; }
        :global(.dark) .tf-input {
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium">{value ?? '—'}</div>
    </div>
  );
}

function StageBadge({ stage }: { stage: Stage }) {
  const meta = STAGES.find((s) => s.key === stage);
  if (!meta) return null;
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${meta.color}22`, color: meta.color }}>
      {meta.label}
    </span>
  );
}
