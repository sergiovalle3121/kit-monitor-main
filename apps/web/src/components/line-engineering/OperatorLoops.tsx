'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, Users } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Operator-loop balancing (Fase 34). Read-only IE tool: greedily packs
 * consecutive stations into operator loops capped at takt, answering "how few
 * operators run this line if one can tend several quick adjacent stations" —
 * the assignment complement to per-station staffing. Isolated component so its
 * debounced refetch doesn't re-render the heavy layout editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface OperatorLoop {
  index: number;
  stations: string[];
  totalTimeSec: number;
  idleSec: number;
  utilizationPct: number;
  overTakt: boolean;
}
interface LoopPlan {
  cadenceSec: number;
  taktSec: number;
  loops: OperatorLoop[];
  operatorCount: number;
  stationCount: number;
  balanceEfficiencyPct: number;
  maxLoopTimeSec: number;
  constraintLoopIndex: number | null;
}

function utilColor(pct: number, overTakt: boolean): string {
  if (overTakt) return '#ef4444';
  if (pct >= 90) return '#f97316';
  if (pct >= 70) return '#f59e0b';
  return '#10b981';
}

export default function OperatorLoops({
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
  const [plan, setPlan] = useState<LoopPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    const availSec = Math.max(0, Number(minutes) || 0) * 60;
    const units = Math.max(0, Number(demand) || 0);
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}&availableTimeSec=${availSec}&demandUnits=${units}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/operator-loops?${qs}`);
        if (!alive) return;
        if (!r.ok) {
          setError('Este modelo aún no tiene ruteo para balancear.');
          setPlan(null);
          return;
        }
        setError(null);
        setPlan((await r.json()) as LoopPlan);
      } catch {
        if (alive) setError('No se pudo calcular el balanceo por bucles.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, minutes, demand]);

  if (!open) return null;

  const cadence = plan ? Math.round(plan.cadenceSec) : 0;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: ROSE }} /> Bucles de operador · {model} · {revision}
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
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !plan ? (
          <div className="py-10 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <Stat title="Operadores" main={`${plan.operatorCount}`} sub={`${plan.stationCount} estaciones`} tone="info" />
              <Stat title="Eficiencia" main={`${Math.round(plan.balanceEfficiencyPct)}%`} sub={`takt ${cadence}s`} tone={plan.balanceEfficiencyPct >= 85 ? 'ok' : plan.balanceEfficiencyPct >= 70 ? 'warn' : 'bad'} />
              <Stat title="Bucle límite" main={`${Math.round(plan.maxLoopTimeSec)}s`} sub={plan.constraintLoopIndex !== null ? `bucle ${plan.constraintLoopIndex + 1}` : '—'} tone={plan.maxLoopTimeSec > cadence ? 'bad' : 'ok'} />
            </div>

            {plan.loops.length === 0 ? (
              <p className="text-[12px] text-gray-500 dark:text-gray-400 py-6 text-center">Se necesita al menos una estación con tiempo de ciclo para balancear.</p>
            ) : (
              <div className="space-y-2 max-h-[42vh] overflow-y-auto -mx-1 px-1">
                {plan.loops.map((l) => {
                  const color = utilColor(l.utilizationPct, l.overTakt);
                  return (
                    <div key={l.index} className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium inline-flex items-center gap-1.5">
                          <span className="grid place-items-center w-5 h-5 rounded-full text-[11px] font-semibold text-white" style={{ background: color }}>{l.index + 1}</span>
                          Operador {l.index + 1}
                          {l.overTakt && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white" style={{ background: '#ef4444' }}>sobre takt</span>}
                        </span>
                        <span className="text-[12px] text-gray-500">{Math.round(l.totalTimeSec)}s · {l.utilizationPct}%</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {l.stations.map((s) => (
                          <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08]">{s}</span>
                        ))}
                      </div>
                      <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, l.utilizationPct)}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
          Un operador puede atender varias estaciones rápidas y contiguas mientras su trabajo total no pase el takt. Menos bucles = menos operadores; los bucles «sobre takt» son una sola estación que excede el takt y requiere división.
        </p>
      </div>
    </div>
  );
}

function Stat({ title, main, sub, tone }: { title: string; main: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  const color = tone === 'ok' ? '#10b981' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#3b82f6';
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color }}>{main}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sub}</div>
    </div>
  );
}
