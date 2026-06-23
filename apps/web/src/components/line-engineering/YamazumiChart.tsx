'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, BarChart3 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Yamazumi (line-balance stacked-bar) chart for the layout (Fase 26). The
 * classic IE balancing view: one bar per station = its cycle time, with the
 * takt line overlaid, so the imbalance jumps out and you see which station to
 * unload. Read-only; reuses the heatmap endpoint. Isolated component so its
 * debounced refetch doesn't re-render the heavy editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

type HeatLevel = 'cold' | 'cool' | 'warm' | 'hot' | 'over';
const LEVEL_COLOR: Record<HeatLevel, string> = {
  cold: '#3b82f6', cool: '#06b6d4', warm: '#f59e0b', hot: '#f97316', over: '#ef4444',
};
interface HeatStation {
  station: string; sequence: number; cycleTimeSec: number; utilizationPct: number;
  level: HeatLevel; bottleneck: boolean; overTakt: boolean;
}
interface HeatSummary {
  taktSec: number; lineCycleTimeSec: number; bottleneckStation: string | null;
  maxCycleTimeSec: number; avgCycleTimeSec: number; balancePct: number; stations: HeatStation[];
}

const W = 520;
const H = 240;
const PAD_L = 36;
const PAD_B = 46;
const PAD_T = 12;

export default function YamazumiChart({
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
  const [minutes, setMinutes] = useState('480');
  const [demand, setDemand] = useState('400');
  const [data, setData] = useState<HeatSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    const availSec = Math.max(0, Number(minutes) || 0) * 60;
    const units = Math.max(0, Number(demand) || 0);
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/heatmap?model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}&availableTimeSec=${availSec}&demandUnits=${units}`);
        if (!alive) return;
        if (!r.ok) { setError('Este modelo aún no tiene ruteo.'); setData(null); return; }
        setError(null);
        setData((await r.json()) as HeatSummary);
      } catch {
        if (alive) setError('No se pudo cargar el balanceo.');
      }
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [open, model, revision, minutes, demand]);

  if (!open) return null;

  const stations = data?.stations ?? [];
  const takt = data?.taktSec ?? 0;
  const scaleMax = Math.max(takt, data?.maxCycleTimeSec ?? 0, 1) * 1.1;
  const chartW = W - PAD_L;
  const chartH = H - PAD_B - PAD_T;
  const barGap = 6;
  const barW = stations.length ? Math.max(4, (chartW - barGap) / stations.length - barGap) : 0;
  const yOf = (sec: number) => PAD_T + chartH - (sec / scaleMax) * chartH;
  const taktY = yOf(takt);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: ROSE }} /> Yamazumi · balanceo · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-end gap-3 mb-3 text-[12px] text-gray-500">
          <label>Tiempo (min/turno)<input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 w-24 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>Demanda (u/turno)<input type="number" min={0} value={demand} onChange={(e) => setDemand(e.target.value)} className="mt-1 w-24 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          {data && (
            <span className="ml-auto self-center">takt <b>{Math.round(takt)}s</b> · cuello <b>{data.bottleneckStation ?? '—'}</b> · balance <b>{Math.round(data.balancePct * 100)}%</b></span>
          )}
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-10 text-center">{error}</p>
        ) : !data ? (
          <div className="py-16 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            {/* y baseline */}
            <line x1={PAD_L} y1={PAD_T + chartH} x2={W} y2={PAD_T + chartH} stroke="rgba(148,163,184,0.5)" />
            {/* takt line */}
            {takt > 0 && (
              <g>
                <line x1={PAD_L} y1={taktY} x2={W} y2={taktY} stroke={ROSE} strokeWidth={1.5} strokeDasharray="6 4" />
                <text x={PAD_L + 2} y={taktY - 4} fontSize={10} fill={ROSE}>takt {Math.round(takt)}s</text>
              </g>
            )}
            {stations.map((s, i) => {
              const x = PAD_L + barGap + i * (barW + barGap);
              const y = yOf(s.cycleTimeSec);
              const h = PAD_T + chartH - y;
              return (
                <g key={s.station}>
                  <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx={2} fill={LEVEL_COLOR[s.level]} opacity={0.85}>
                    <title>{`${s.station}: ${Math.round(s.cycleTimeSec)}s (${s.utilizationPct}% takt)`}</title>
                  </rect>
                  {s.bottleneck && <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx={2} fill="none" stroke="#0f172a" strokeWidth={1.5} />}
                  <text x={x + barW / 2} y={H - PAD_B + 14} fontSize={9} fill="#94a3b8" textAnchor="end" transform={`rotate(-40 ${x + barW / 2} ${H - PAD_B + 14})`}>{s.station}</text>
                </g>
              );
            })}
          </svg>
        )}
        <p className="text-[11px] text-gray-400 mt-2">Cada barra = tiempo de ciclo de la estación. Las que pasan la línea de takt (rojo) son las restricciones a rebalancear.</p>
      </div>
    </div>
  );
}
