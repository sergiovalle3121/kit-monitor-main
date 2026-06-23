'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, Layers } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * WIP / decoupling-buffer planner (Fase 33). Read-only lean tool: sizes the
 * inventory to hold between consecutive stations so a stoppage on one doesn't
 * immediately starve/block its neighbour, and shows the total decoupling WIP
 * plus the lead time it adds (Little's law) — the classic inventory-vs-flow
 * trade-off. Isolated component so its debounced refetch doesn't re-render the
 * heavy layout editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface BufferGap {
  fromStation: string;
  toStation: string;
  recommendedUnits: number;
  tightnessPct: number;
  critical: boolean;
}
interface BufferPlan {
  cadenceSec: number;
  taktSec: number;
  coverageSec: number;
  bottleneckStation: string | null;
  gaps: BufferGap[];
  totalWipUnits: number;
  addedLeadTimeSec: number;
  criticalGaps: number;
}

function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 90) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min`;
  return `${(m / 60).toFixed(1)} h`;
}

export default function BufferPlanner({
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
  const [coverage, setCoverage] = useState('120'); // seconds a buffer rides through
  const [plan, setPlan] = useState<BufferPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    const availSec = Math.max(0, Number(minutes) || 0) * 60;
    const units = Math.max(0, Number(demand) || 0);
    const cover = Math.max(0, Number(coverage) || 0);
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}&availableTimeSec=${availSec}&demandUnits=${units}&coverageSec=${cover}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/buffers?${qs}`);
        if (!alive) return;
        if (!r.ok) {
          setError('Este modelo aún no tiene ruteo para planear inventario.');
          setPlan(null);
          return;
        }
        setError(null);
        setPlan((await r.json()) as BufferPlan);
      } catch {
        if (alive) setError('No se pudo calcular el plan de inventario.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, minutes, demand, coverage]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Layers className="w-4 h-4" style={{ color: ROSE }} /> Inventario de desacople (WIP) · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <label className="text-[12px] text-gray-500">
            Tiempo (min/turno)
            <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
          </label>
          <label className="text-[12px] text-gray-500">
            Demanda (u/turno)
            <input type="number" min={0} value={demand} onChange={(e) => setDemand(e.target.value)} className="mt-1 w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
          </label>
          <label className="text-[12px] text-gray-500">
            Cobertura de paro (s)
            <input type="number" min={0} value={coverage} onChange={(e) => setCoverage(e.target.value)} className="mt-1 w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
          </label>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !plan ? (
          <div className="py-10 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <Stat title="WIP total" main={`${plan.totalWipUnits} u`} sub={`cadencia ${Math.round(plan.cadenceSec)}s`} tone="info" />
              <Stat title="Plazo agregado" main={fmtDuration(plan.addedLeadTimeSec)} sub="ley de Little" tone={plan.addedLeadTimeSec > 0 ? 'warn' : 'ok'} />
              <Stat title="Huecos críticos" main={`${plan.criticalGaps}`} sub={plan.bottleneckStation ? `cuello ${plan.bottleneckStation}` : 'sin cuello'} tone={plan.criticalGaps > 0 ? 'bad' : 'ok'} />
            </div>

            {plan.gaps.length === 0 ? (
              <p className="text-[12px] text-gray-400 py-6 text-center">Se necesitan al menos dos estaciones con tiempo de ciclo para planear inventario.</p>
            ) : (
              <div className="max-h-[40vh] overflow-y-auto -mx-1 px-1">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
                      <th className="py-1.5 font-medium">Entre estaciones</th>
                      <th className="py-1.5 font-medium text-right">Unidades</th>
                      <th className="py-1.5 font-medium text-right">Holgura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.gaps.map((g) => (
                      <tr key={`${g.fromStation}->${g.toStation}`} className="border-t border-black/5 dark:border-white/10">
                        <td className="py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            {g.critical && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} title="Protege el cuello de botella" />}
                            {g.fromStation} <span className="text-gray-400">→</span> {g.toStation}
                          </span>
                        </td>
                        <td className="py-1.5 text-right font-semibold" style={{ color: g.critical ? '#ef4444' : '#3b82f6' }}>{g.recommendedUnits}</td>
                        <td className="py-1.5 text-right text-gray-500">{g.tightnessPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <p className="text-[11px] text-gray-400 mt-3">
          Cada hueco se dimensiona para sostener un paro de {coverage || 0}s a la cadencia de la línea, escalado por qué tan cerca del takt corre la estación más lenta. Más WIP desacopla mejor pero alarga el plazo.
        </p>
      </div>
    </div>
  );
}

function Stat({ title, main, sub, tone }: { title: string; main: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  const color = tone === 'ok' ? '#10b981' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#3b82f6';
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{title}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color }}>{main}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sub}</div>
    </div>
  );
}
