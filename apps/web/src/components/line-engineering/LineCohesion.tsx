'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Group, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Line cohesion panel (Fase 46). Read-only check of how well each logical line
 * keeps to its own region of the floor: per-line compactness (fill), stations
 * intruding into another line's region, and overlapping regions, rolled into a
 * single cohesion index. Isolated component so its fetch doesn't re-render the
 * heavy layout editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface CohesionGroup { line: string; stationCount: number; fillPct: number; bboxW: number; bboxH: number; cx: number; cy: number }
interface Intruder { id: string; station: string; line: string; insideLine: string }
interface Cohesion {
  placedCount: number;
  lineCount: number;
  groups: CohesionGroup[];
  intruders: Intruder[];
  overlapPairs: number;
  cohesionPct: number;
  cohesive: boolean;
  mostScattered: { line: string; fillPct: number } | null;
  issues: string[];
}

const toneColor = (c: Cohesion) => (c.cohesive ? '#10b981' : c.cohesionPct >= 60 ? '#f59e0b' : ROSE);
const fillColor = (s: number) => (s >= 60 ? '#10b981' : s >= 30 ? '#f59e0b' : ROSE);

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function LineCohesion({
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
  const [data, setData] = useState<Cohesion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    const id = setTimeout(async () => {
      setData(null); setError(null);
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/cohesion?${qs}`);
        if (!alive) return;
        if (!r.ok) { setError('No se pudo evaluar la cohesión.'); return; }
        setData((await r.json()) as Cohesion);
      } catch {
        if (alive) setError('No se pudo evaluar la cohesión.');
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
            <Group className="w-4 h-4" style={{ color: ROSE }} /> Cohesión de líneas · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !data ? (
          <div className="py-10 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : data.placedCount === 0 ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 py-8 text-center">Coloca estaciones en el plano para evaluar la agrupación de líneas.</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold tabular-nums" style={{ color: toneColor(data) }}>
                {Math.round(data.cohesionPct)}<span className="text-base text-gray-500 dark:text-gray-400">%</span>
              </div>
              <div className="text-[12px]">
                <div className="inline-flex items-center gap-1.5 font-medium" style={{ color: toneColor(data) }}>
                  {data.cohesive
                    ? <><CheckCircle2 className="w-4 h-4" /> Líneas bien agrupadas</>
                    : <><AlertTriangle className="w-4 h-4" /> Líneas intercaladas</>}
                </div>
                <div className="text-gray-500 mt-0.5">
                  {data.lineCount} línea(s) · {data.placedCount} estación(es) en el plano.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <Stat label="Líneas" value={data.lineCount} />
              <Stat label="Estaciones" value={data.placedCount} />
              <Stat label="Intercaladas" value={data.intruders.length} />
              <Stat label="Traslapes" value={data.overlapPairs} hint="regiones" />
            </div>

            <div className="space-y-2 mb-4">
              <div className="text-[11px] font-medium text-gray-500">Compacidad por línea</div>
              {data.groups.map((g) => (
                <div key={g.line}>
                  <div className="flex items-center justify-between text-[12px] mb-0.5">
                    <span className="text-gray-600 dark:text-gray-300">{g.line} <span className="text-gray-500 dark:text-gray-400">· {g.stationCount} est.</span></span>
                    <span className="tabular-nums font-medium" style={{ color: fillColor(g.fillPct) }}>{Math.round(g.fillPct)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, g.fillPct))}%`, background: fillColor(g.fillPct) }} />
                  </div>
                </div>
              ))}
            </div>

            {data.cohesive && data.issues.length === 0 ? (
              <div className="rounded-xl p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-[12px] inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sin problemas de agrupación.
              </div>
            ) : data.issues.length > 0 ? (
              <div className="rounded-xl p-2.5 bg-rose-500/10 border border-rose-500/20 text-[12px] mb-3">
                <div className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Problemas</div>
                <ul className="list-disc pl-5 space-y-0.5 text-rose-700 dark:text-rose-300">
                  {data.issues.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            ) : null}

            {data.intruders.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-gray-500 mb-1">Intercaladas ({data.intruders.length})</div>
                <div className="space-y-1">
                  {data.intruders.map((it) => (
                    <div key={it.id} className="text-[12px] flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <span className="tabular-nums">{it.station}</span>
                      <span className="text-gray-500 dark:text-gray-400">({it.line})</span> dentro de <span className="tabular-nums">{it.insideLine}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
