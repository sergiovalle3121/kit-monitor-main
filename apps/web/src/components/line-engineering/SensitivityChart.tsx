'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, LineChart } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Demand-sensitivity chart (Fase 36). Read-only: sweeps demand and plots, per
 * level, the cost per unit (rose, left axis) and operators needed (blue, right
 * axis), marking the feasibility ceiling and the cheapest feasible demand — so
 * the planner sees how the layout scales, not just one point. Isolated
 * component so its debounced refetch doesn't re-render the heavy editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';
const BLUE = '#3b82f6';
const GREEN = '#10b981';

interface Point {
  demandUnits: number;
  taktSec: number;
  operators: number;
  feasible: boolean;
  throughputPerHour: number;
  costPerUnit: number;
}
interface Result {
  availableTimeSec: number;
  bottleneckCycleSec: number;
  maxFeasibleDemand: number | null;
  minCostDemand: number | null;
  minCostPerUnit: number | null;
  points: Point[];
}

const W = 540;
const H = 260;
const PAD_L = 44;
const PAD_R = 40;
const PAD_B = 40;
const PAD_T = 14;

export default function SensitivityChart({
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
  const [labor, setLabor] = useState('8');
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    const availSec = Math.max(0, Number(minutes) || 0) * 60;
    const units = Math.max(0, Number(demand) || 0);
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}&availableTimeSec=${availSec}&demandUnits=${units}&laborCostPerHour=${Number(labor) || 0}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/sensitivity?${qs}`);
        if (!alive) return;
        if (!r.ok) {
          setError('Este modelo aún no tiene ruteo para analizar.');
          setData(null);
          return;
        }
        setError(null);
        setData((await r.json()) as Result);
      } catch {
        if (alive) setError('No se pudo calcular la sensibilidad.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, minutes, demand, labor]);

  if (!open) return null;

  const pts = data?.points ?? [];
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;
  const minD = pts.length ? pts[0].demandUnits : 0;
  const maxD = pts.length ? pts[pts.length - 1].demandUnits : 1;
  const maxCost = Math.max(0.0001, ...pts.map((p) => p.costPerUnit));
  const maxOps = Math.max(1, ...pts.map((p) => p.operators));
  const xOf = (d: number) => PAD_L + (maxD > minD ? ((d - minD) / (maxD - minD)) * chartW : 0);
  const yCost = (c: number) => PAD_T + chartH - (c / maxCost) * chartH;
  const yOps = (o: number) => PAD_T + chartH - (o / maxOps) * chartH;
  const costPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.demandUnits).toFixed(1)} ${yCost(p.costPerUnit).toFixed(1)}`).join(' ');
  const opsPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.demandUnits).toFixed(1)} ${yOps(p.operators).toFixed(1)}`).join(' ');
  const ceiling = data?.maxFeasibleDemand ?? null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <LineChart className="w-4 h-4" style={{ color: ROSE }} /> Sensibilidad a la demanda · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-end gap-3 mb-3 text-[12px] text-gray-500 flex-wrap">
          <label>Tiempo (min/turno)<input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 w-24 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>Demanda centro (u/turno)<input type="number" min={0} value={demand} onChange={(e) => setDemand(e.target.value)} className="mt-1 w-28 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>M.O. ($/hora)<input type="number" min={0} value={labor} onChange={(e) => setLabor(e.target.value)} className="mt-1 w-20 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          {data && (
            <span className="ml-auto self-center text-right leading-relaxed">
              techo factible <b>{ceiling ?? '—'}</b> u<br />
              menor costo <b>{data.minCostDemand ?? '—'}</b> u · <b style={{ color: GREEN }}>${data.minCostPerUnit?.toFixed(2) ?? '—'}</b>
            </span>
          )}
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-12 text-center">{error}</p>
        ) : !data ? (
          <div className="py-16 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            {/* infeasible region shading (demand beyond the ceiling) */}
            {ceiling !== null && ceiling < maxD && (
              <rect x={xOf(ceiling)} y={PAD_T} width={Math.max(0, W - PAD_R - xOf(ceiling))} height={chartH} fill={ROSE} opacity={0.06} />
            )}
            {/* axes */}
            <line x1={PAD_L} y1={PAD_T + chartH} x2={W - PAD_R} y2={PAD_T + chartH} stroke="rgba(148,163,184,0.5)" />
            <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke="rgba(148,163,184,0.3)" />
            {/* ceiling marker */}
            {ceiling !== null && ceiling < maxD && (
              <g>
                <line x1={xOf(ceiling)} y1={PAD_T} x2={xOf(ceiling)} y2={PAD_T + chartH} stroke={ROSE} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                <text x={xOf(ceiling) + 3} y={PAD_T + 10} fontSize={9} fill={ROSE}>techo</text>
              </g>
            )}
            {/* operators (right axis) */}
            <path d={opsPath} fill="none" stroke={BLUE} strokeWidth={1.5} opacity={0.55} strokeDasharray="5 3" />
            {/* cost per unit (left axis) */}
            <path d={costPath} fill="none" stroke={ROSE} strokeWidth={2} />
            {pts.map((p) => (
              <circle
                key={p.demandUnits}
                cx={xOf(p.demandUnits)}
                cy={yCost(p.costPerUnit)}
                r={p.demandUnits === data.minCostDemand ? 4.5 : 2.5}
                fill={p.demandUnits === data.minCostDemand ? GREEN : p.feasible ? ROSE : '#fff'}
                stroke={p.feasible ? 'none' : ROSE}
                strokeWidth={p.feasible ? 0 : 1.2}
              >
                <title>{`${p.demandUnits} u → takt ${Math.round(p.taktSec)}s · ${p.operators} op · $${p.costPerUnit.toFixed(2)}/u${p.feasible ? '' : ' (no factible)'}`}</title>
              </circle>
            ))}
            {/* x labels: first, ceiling-ish, last */}
            {[pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].filter(Boolean).map((p, i) => (
              <text key={i} x={xOf(p.demandUnits)} y={H - PAD_B + 14} fontSize={9} fill="#94a3b8" textAnchor="middle">{p.demandUnits}</text>
            ))}
            <text x={PAD_L} y={PAD_T - 4} fontSize={9} fill={ROSE}>$/u</text>
            <text x={W - PAD_R} y={PAD_T - 4} fontSize={9} fill={BLUE} textAnchor="end">operadores</text>
          </svg>
        )}
        <p className="text-[11px] text-gray-400 mt-2">
          Línea rosa: costo por unidad (eje izq.). Línea azul punteada: operadores (eje der.). La zona sombreada es demanda no factible (el cuello supera el takt); el punto verde es el menor costo factible.
        </p>
      </div>
    </div>
  );
}
