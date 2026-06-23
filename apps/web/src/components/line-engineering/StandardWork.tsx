'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, Footprints } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Standard Work Combination Table (Fase 38). Read-only: takes the operator
 * loops (manual time) and layers the WALK between the placed stations of each
 * loop, combining manual + walk against takt — surfacing loops that hold takt
 * on paper but bust it once walking is counted. Isolated component so its
 * debounced refetch doesn't re-render the heavy editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';
const MANUAL = '#3b82f6';
const WALK = '#f59e0b';

interface Step { station: string; manualSec: number; walkSec: number; }
interface Loop {
  index: number;
  steps: Step[];
  manualSec: number;
  walkSec: number;
  totalSec: number;
  utilizationPct: number;
  withinTakt: boolean;
}
interface Result {
  cadenceSec: number;
  taktSec: number;
  walkSpeedMps: number;
  loops: Loop[];
  totalManualSec: number;
  totalWalkSec: number;
  walkPct: number;
  loopsOverTakt: number;
  placedRatioPct: number;
}

export default function StandardWork({
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
  const [speed, setSpeed] = useState('1.0');
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    const availSec = Math.max(0, Number(minutes) || 0) * 60;
    const units = Math.max(0, Number(demand) || 0);
    const v = Math.max(0, Number(speed) || 0);
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}&availableTimeSec=${availSec}&demandUnits=${units}&walkSpeedMps=${v}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/standard-work?${qs}`);
        if (!alive) return;
        if (!r.ok) {
          setError('Este modelo aún no tiene ruteo para la hoja de trabajo estándar.');
          setData(null);
          return;
        }
        setError(null);
        setData((await r.json()) as Result);
      } catch {
        if (alive) setError('No se pudo calcular el trabajo estándar.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, minutes, demand, speed]);

  if (!open) return null;

  const cadence = data ? Math.max(1, data.cadenceSec) : 1;
  // Scale bars so the longest loop (or takt) fills the track.
  const scaleMax = data ? Math.max(cadence, ...data.loops.map((l) => l.totalSec), 1) : 1;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Footprints className="w-4 h-4" style={{ color: ROSE }} /> Trabajo estándar (manual + caminado) · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-end gap-3 mb-3 text-[12px] text-gray-500 flex-wrap">
          <label>Tiempo (min/turno)<input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 w-24 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>Demanda (u/turno)<input type="number" min={0} value={demand} onChange={(e) => setDemand(e.target.value)} className="mt-1 w-24 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>Velocidad (m/s)<input type="number" min={0} step={0.1} value={speed} onChange={(e) => setSpeed(e.target.value)} className="mt-1 w-20 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          {data && (
            <span className="ml-auto self-center text-right leading-relaxed">
              caminado <b style={{ color: WALK }}>{data.walkPct}%</b> · sobre takt <b style={{ color: data.loopsOverTakt ? ROSE : undefined }}>{data.loopsOverTakt}</b><br />
              <span className="text-[11px] text-gray-400">{data.placedRatioPct}% de estaciones colocadas</span>
            </span>
          )}
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-10 text-center">{error}</p>
        ) : !data ? (
          <div className="py-14 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : data.loops.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-8 text-center">Se necesita al menos una estación con tiempo manual.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-2 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: MANUAL }} /> manual</span>
              <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: WALK }} /> caminado</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 border-t-2 border-dashed" style={{ borderColor: ROSE }} /> takt {Math.round(data.cadenceSec)}s</span>
            </div>
            <div className="space-y-2.5 max-h-[44vh] overflow-y-auto -mx-1 px-1">
              {data.loops.map((l) => {
                const taktX = (cadence / scaleMax) * 100;
                return (
                  <div key={l.index} className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
                    <div className="flex items-center justify-between mb-1.5 text-sm">
                      <span className="font-medium inline-flex items-center gap-1.5">
                        <span className="grid place-items-center w-5 h-5 rounded-full text-[11px] font-semibold text-white" style={{ background: l.withinTakt ? MANUAL : ROSE }}>{l.index + 1}</span>
                        Operador {l.index + 1}
                        {!l.withinTakt && <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white" style={{ background: ROSE }}>sobre takt</span>}
                      </span>
                      <span className="text-[12px] text-gray-500">{Math.round(l.totalSec)}s · {l.utilizationPct}% · <span style={{ color: WALK }}>{Math.round(l.walkSec)}s cam.</span></span>
                    </div>
                    {/* stacked manual+walk bar with takt marker */}
                    <div className="relative h-3.5 rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                      <div className="absolute inset-y-0 left-0 flex">
                        <div style={{ width: `${(l.manualSec / scaleMax) * 100}%`, background: MANUAL }} />
                        <div style={{ width: `${(l.walkSec / scaleMax) * 100}%`, background: WALK }} />
                      </div>
                      <div className="absolute inset-y-0" style={{ left: `${taktX}%`, borderLeft: `1.5px dashed ${ROSE}` }} />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {l.steps.map((s) => (
                        <span key={s.station} className="text-[11px] px-1.5 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08]">
                          {s.station} <span className="text-gray-400">{Math.round(s.manualSec)}s{s.walkSec > 0 ? ` +${Math.round(s.walkSec)}` : ''}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p className="text-[11px] text-gray-400 mt-3">
          Cada barra combina el tiempo manual (azul) y el caminado entre estaciones del bucle (naranja) contra el takt. Un bucle que cabe en manual pero pasa la línea de takt al sumar el caminado es la causa clásica de que una línea «balanceada» no sostenga su ciclo.
        </p>
      </div>
    </div>
  );
}
