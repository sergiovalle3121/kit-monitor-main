'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  FlaskConical,
  Plus,
  Lock,
  Loader2,
  Inbox,
  CheckCircle2,
  XCircle,
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

type Station = 'ICT' | 'FCT' | 'AOI' | 'FINAL' | 'OTHER';
type Result = 'PASS' | 'FAIL';

interface TestRecord {
  id: string;
  folio: string | null;
  serialNumber: string;
  station: Station;
  result: Result;
  model?: string | null;
  failureCode?: string | null;
  testedAt?: string | null;
}

interface Kpis {
  totalTests: number;
  pass: number;
  fail: number;
  yieldPct: number | null;
  firstPassYieldPct: number | null;
  distinctSerials: number;
  pareto: { failureCode: string; count: number; pct: number }[];
}

export default function TestEngineeringPage() {
  const { data, isLoading, forbidden, mutate } = useApi<TestRecord[]>('/testing/records/recent');
  const { data: kpis, mutate: mutateKpis } = useApi<Kpis>('/testing/kpis');
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    serialNumber: '',
    station: 'FCT' as Station,
    result: 'PASS' as Result,
    model: '',
    failureCode: '',
  });

  const list = Array.isArray(data) ? data : [];

  function refresh() {
    mutate();
    mutateKpis();
  }

  async function capture() {
    if (form.serialNumber.trim().length < 1) {
      toast.error('Escanea o escribe el número de serie.', 'Test Engineering');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/testing/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serialNumber: form.serialNumber.trim(),
          station: form.station,
          result: form.result,
          model: form.model || undefined,
          failureCode: form.result === 'FAIL' ? form.failureCode || undefined : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || 'No se pudo capturar.', 'Test Engineering');
        return;
      }
      toast.success(`${form.serialNumber} → ${form.result}`, 'Test Engineering');
      setForm({ ...form, serialNumber: '', failureCode: '' });
      refresh();
    } catch {
      toast.error('Error de red.', 'Test Engineering');
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
          <p className="text-sm text-gray-400 mt-1">Inicia sesión para ver Test Engineering.</p>
        </div>
      </div>
    );
  }

  const fpy = kpis?.firstPassYieldPct;
  const yld = kpis?.yieldPct;

  return (
    <div className="min-h-screen text-black dark:text-white">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <FlaskConical className="w-5 h-5" style={{ color: GREEN }} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight">Test Engineering · Yields</h1>
            <p className="text-[12px] text-gray-400 leading-tight">Captura de pruebas · FPY · Pareto de fallas</p>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <Kpi label="First-Pass Yield" value={fpy === null || fpy === undefined ? '—' : `${fpy}%`} color={fpy !== null && fpy !== undefined && fpy >= 95 ? GREEN : AMBER} />
          <Kpi label="Yield total" value={yld === null || yld === undefined ? '—' : `${yld}%`} color={GREEN} />
          <Kpi label="Pruebas" value={kpis?.totalTests ?? 0} sub={`${kpis?.distinctSerials ?? 0} series`} color={GRAY} />
          <Kpi label="Fallas" value={kpis?.fail ?? 0} color={(kpis?.fail ?? 0) > 0 ? RED : GREEN} />
        </div>

        {/* Capture form (scanner-friendly) */}
        <div className={`${glass} rounded-2xl p-5 mb-6`}>
          <h3 className="font-semibold mb-4">Capturar resultado</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <label className="block md:col-span-2">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">N° de serie</span>
              <input
                value={form.serialNumber}
                autoFocus
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') capture(); }}
                placeholder="Escanea SN…"
                className="te-input font-mono"
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">Estación</span>
              <select value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value as Station })} className="te-input">
                {(['ICT', 'FCT', 'AOI', 'FINAL', 'OTHER'] as Station[]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-gray-500 mb-1">Resultado</span>
              <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value as Result })} className="te-input">
                <option value="PASS">PASS</option>
                <option value="FAIL">FAIL</option>
              </select>
            </label>
            {form.result === 'FAIL' ? (
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Código de falla</span>
                <input value={form.failureCode} onChange={(e) => setForm({ ...form, failureCode: e.target.value })} placeholder="F-101" className="te-input" />
              </label>
            ) : (
              <label className="block">
                <span className="block text-[12px] font-medium text-gray-500 mb-1">Modelo</span>
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="opcional" className="te-input" />
              </label>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={capture} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60" style={{ background: form.result === 'PASS' ? GREEN : RED }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Capturar {form.result}
            </button>
          </div>
        </div>

        {/* Pareto */}
        {kpis && kpis.pareto.length > 0 && (
          <div className={`${glass} rounded-2xl p-5 mb-6`}>
            <h3 className="font-semibold mb-4">Pareto de fallas</h3>
            <div className="space-y-2">
              {kpis.pareto.map((b) => (
                <div key={b.failureCode} className="flex items-center gap-3">
                  <span className="w-20 text-[12px] font-mono truncate">{b.failureCode}</span>
                  <div className="flex-1 h-5 rounded-md overflow-hidden bg-black/5 dark:bg-white/10">
                    <div className="h-full rounded-md" style={{ width: `${b.pct}%`, background: RED, opacity: 0.7 }} />
                  </div>
                  <span className="w-16 text-right text-[12px] text-gray-400">{b.count} · {b.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent records */}
        <h3 className="text-sm font-semibold mb-3">Capturas recientes</h3>
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : list.length === 0 ? (
          <div className={`${glass} rounded-3xl p-12 text-center`}>
            <Inbox className="w-8 h-8 mx-auto mb-3 text-gray-400" />
            <h3 className="font-semibold">Sin pruebas capturadas</h3>
            <p className="text-sm text-gray-400 mt-1">Captura el primer resultado para empezar a medir yields.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div key={r.id} className={`${glass} rounded-xl p-3 flex items-center gap-3`}>
                {r.result === 'PASS' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} /> : <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: RED }} />}
                <span className="font-mono text-sm truncate flex-1">{r.serialNumber}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-gray-500">{r.station}</span>
                {r.failureCode && <span className="text-[11px]" style={{ color: RED }}>{r.failureCode}</span>}
                <span className="text-[11px] text-gray-400">{r.testedAt ? new Date(r.testedAt).toLocaleTimeString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <style jsx global>{`
        .te-input {
          width: 100%;
          border-radius: 0.75rem;
          padding: 0.55rem 0.75rem;
          background: rgba(0, 0, 0, 0.03);
          border: 1px solid rgba(0, 0, 0, 0.08);
          outline: none;
          font-size: 0.875rem;
        }
        .te-input:focus { border-color: #10b981; }
        :global(.dark) .te-input {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
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
