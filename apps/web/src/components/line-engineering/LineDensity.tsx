'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Grid2x2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Occupancy-density heat map panel (Fase 48). Read-only zonal view of the floor:
 * bins every placed footprint into a grid and paints each cell by how occupied
 * it is, surfacing congestion clusters next to dead space — what a single
 * utilisation number can't show. Isolated component so its fetch doesn't
 * re-render the heavy layout editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface Density {
  cols: number;
  rows: number;
  grid: number[][];
  utilizationPct: number;
  peakPct: number;
  avgPct: number;
  hotCells: number;
  emptyCells: number;
  busiest: { row: number; col: number; pct: number } | null;
  evennessPct: number;
  boxCount: number;
  issues: string[];
}

// Heat ramp: empty floor stays faint, fuller cells deepen toward rose; congested
// cells (>=80%) get a ring so clusters pop out.
function cellStyle(pct: number): React.CSSProperties {
  if (pct < 1) return { background: 'rgba(120,120,135,0.08)' };
  const a = 0.18 + 0.82 * Math.min(1, pct / 100);
  return {
    background: `rgba(244,63,94,${a.toFixed(3)})`,
    boxShadow: pct >= 80 ? 'inset 0 0 0 1.5px rgba(190,18,60,0.9)' : undefined,
  };
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function LineDensity({
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
  const [data, setData] = useState<Density | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    const id = setTimeout(async () => {
      setData(null); setError(null);
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/density?${qs}`);
        if (!alive) return;
        if (!r.ok) { setError('No se pudo calcular el mapa de ocupación.'); return; }
        setData((await r.json()) as Density);
      } catch {
        if (alive) setError('No se pudo calcular el mapa de ocupación.');
      }
    }, 0);
    return () => { alive = false; clearTimeout(id); };
  }, [open, model, revision]);

  if (!open) return null;

  // Portal to <body>: an ancestor of the editor is a `glass` card whose
  // backdrop-filter creates a containing block that would trap this
  // `fixed inset-0` overlay (rendered low / clipped). Rendering at the body root
  // re-anchors the overlay to the viewport so it centres correctly.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg max-h-[88vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Grid2x2 className="w-4 h-4" style={{ color: ROSE }} /> Mapa de ocupación · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !data ? (
          <div className="py-10 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : data.boxCount === 0 ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 py-8 text-center">Coloca estaciones o equipo en el plano para ver la ocupación.</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <Stat label="Aprovechamiento" value={`${Math.round(data.utilizationPct)}%`} />
              <Stat label="Pico" value={`${Math.round(data.peakPct)}%`} hint="celda más llena" />
              <Stat label="Uniformidad" value={`${Math.round(data.evennessPct)}%`} />
              <Stat label="Congestión" value={data.hotCells} hint="zonas ≥80%" />
            </div>

            <div
              className="grid gap-[2px] mb-1 rounded-lg overflow-hidden"
              style={{ gridTemplateColumns: `repeat(${data.cols}, minmax(0, 1fr))` }}
            >
              {data.grid.flatMap((row, r) =>
                row.map((pct, c) => (
                  <div
                    key={`${r}-${c}`}
                    className="aspect-square rounded-[2px]"
                    style={cellStyle(pct)}
                    title={`Fila ${r + 1}, Col ${c + 1}: ${Math.round(pct)}%`}
                  />
                )),
              )}
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-4">
              <span>Vista superior del piso · cada celda es una zona</span>
              <span className="inline-flex items-center gap-1">
                menos
                <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: 'rgba(244,63,94,0.18)' }} />
                <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: 'rgba(244,63,94,0.55)' }} />
                <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: 'rgba(244,63,94,1)' }} />
                más
              </span>
            </div>

            {data.issues.length === 0 ? (
              <div className="rounded-xl p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-[12px] inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ocupación equilibrada, sin congestión.
              </div>
            ) : (
              <div className="rounded-xl p-2.5 bg-rose-500/10 border border-rose-500/20 text-[12px]">
                <div className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Observaciones</div>
                <ul className="list-disc pl-5 space-y-0.5 text-rose-700 dark:text-rose-300">
                  {data.issues.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
