'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, SlidersHorizontal } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * What-if capacity simulator (Fase 25). Read-only planning tool: set demand and
 * available time and see the resulting takt, line balance, bottleneck, hourly
 * throughput and operators needed — recomputed live from the existing balance
 * and staffing endpoints. Isolated component so its debounced refetches don't
 * re-render the heavy layout editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface BalanceResult {
  taktSec: number;
  lineCycleTimeSec: number;
  bottleneckStation: string | null;
  balancePct: number;
  throughputPerHour: number;
  theoreticalMinStations: number;
  stationsOverTakt: string[];
  stationCount: number;
}
interface StaffingResult {
  totalOperators: number;
  avgUtilizationPct: number;
}

export default function WhatIfSimulator({
  model,
  revision,
  open,
  onClose,
}: {
  model: string;
  revision: string;
  open: boolean;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState('480'); // available minutes / shift
  const [demand, setDemand] = useState('400'); // units / shift
  const [balance, setBalance] = useState<BalanceResult | null>(null);
  const [staffing, setStaffing] = useState<StaffingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    const availSec = Math.max(0, Number(minutes) || 0) * 60;
    const units = Math.max(0, Number(demand) || 0);
    let alive = true;
    const id = setTimeout(async () => {
      if (alive) setBusy(true);
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}&availableTimeSec=${availSec}&demandUnits=${units}`;
        const [rb, rs] = await Promise.all([
          apiFetch(`${API_BASE}/line-engineering/balance?${qs}`),
          apiFetch(`${API_BASE}/line-engineering/layout/staffing?${qs}`),
        ]);
        if (!alive) return;
        if (!rb.ok) {
          setError('Este modelo aún no tiene ruteo para simular.');
          setBalance(null);
          setStaffing(null);
          return;
        }
        setError(null);
        setBalance((await rb.json()) as BalanceResult);
        if (rs.ok) setStaffing((await rs.json()) as StaffingResult);
      } catch {
        if (alive) setError('No se pudo simular.');
      } finally {
        if (alive) setBusy(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, minutes, demand]);

  if (!open) return null;

  const takt = balance?.taktSec ?? 0;
  const feasible = balance ? balance.lineCycleTimeSec <= takt + 1e-6 : false;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" style={{ color: ROSE }} /> Simulador de capacidad · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="text-[12px] text-gray-500">
            Tiempo disponible (min/turno)
            <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
          </label>
          <label className="text-[12px] text-gray-500">
            Demanda (unidades/turno)
            <input type="number" min={0} value={demand} onChange={(e) => setDemand(e.target.value)} className="mt-1 w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
          </label>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-6 text-center">{error}</p>
        ) : !balance ? (
          <div className="py-10 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <SimCard title="Takt" main={`${Math.round(takt)}s`} sub="ritmo objetivo" tone="info" />
            <SimCard title="Ciclo de línea" main={`${Math.round(balance.lineCycleTimeSec)}s`} sub={`cuello: ${balance.bottleneckStation ?? '—'}`} tone={feasible ? 'ok' : 'bad'} />
            <SimCard title="Balance" main={`${Math.round(balance.balancePct * 100)}%`} sub={`${balance.stationCount} estaciones`} tone={balance.balancePct >= 0.85 ? 'ok' : 'warn'} />
            <SimCard title="Throughput" main={`${Math.round(balance.throughputPerHour)}/h`} sub="al cuello de botella" tone="info" />
            <SimCard title="Operadores" main={`${staffing?.totalOperators ?? '—'}`} sub={staffing ? `${staffing.avgUtilizationPct}% util.` : ''} tone="info" />
            <SimCard title="Sobre takt" main={`${balance.stationsOverTakt.length}`} sub={`mín. teórico ${balance.theoreticalMinStations} est`} tone={balance.stationsOverTakt.length > 0 ? 'bad' : 'ok'} />
          </div>
        )}

        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-4">
          {busy ? 'recalculando…' : balance ? (feasible ? 'La línea sostiene la demanda con el ruteo actual.' : 'El cuello de botella excede el takt: la línea NO sostiene la demanda.') : ''}
        </p>
      </div>
    </div>
  );
}

function SimCard({ title, main, sub, tone }: { title: string; main: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  const color = tone === 'ok' ? '#10b981' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#3b82f6';
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color }}>{main}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sub}</div>
    </div>
  );
}
