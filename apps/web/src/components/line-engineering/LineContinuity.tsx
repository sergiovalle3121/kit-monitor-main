'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Spline, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Line continuity panel (Fase 45). Read-only validation of the flow connector
 * graph topology: is it one continuous, ordered path through every station? It
 * surfaces the breaks — isolated stations, disconnected pieces, extra
 * starts/ends, splits/merges and back-flow links — with a single continuity
 * index. Isolated component so its fetch doesn't re-render the heavy editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface NodeRef { id: string; station: string }
interface BackLink { from: string; to: string; fromStation: string; toStation: string }
interface Continuity {
  stationCount: number;
  linkCount: number;
  danglingLinks: number;
  components: number;
  isolated: NodeRef[];
  sources: NodeRef[];
  sinks: NodeRef[];
  branches: NodeRef[];
  backFlow: BackLink[];
  reached: number;
  continuityPct: number;
  continuous: boolean;
  issues: string[];
}

const toneColor = (c: Continuity) =>
  c.continuous ? '#10b981' : c.continuityPct >= 60 ? '#f59e0b' : ROSE;

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
      {hint && <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/10 tabular-nums">{t}</span>
      ))}
    </div>
  );
}

export default function LineContinuity({
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
  const [data, setData] = useState<Continuity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    const id = setTimeout(async () => {
      setData(null); setError(null);
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/continuity?${qs}`);
        if (!alive) return;
        if (!r.ok) { setError('No se pudo evaluar la continuidad.'); return; }
        setData((await r.json()) as Continuity);
      } catch {
        if (alive) setError('No se pudo evaluar la continuidad.');
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
            <Spline className="w-4 h-4" style={{ color: ROSE }} /> Continuidad de la línea · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !data ? (
          <div className="py-10 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : data.stationCount === 0 ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 py-8 text-center">Agrega estaciones a la línea para evaluar el flujo.</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-bold tabular-nums" style={{ color: toneColor(data) }}>
                {Math.round(data.continuityPct)}<span className="text-base text-gray-500 dark:text-gray-400">%</span>
              </div>
              <div className="text-[12px]">
                <div className="inline-flex items-center gap-1.5 font-medium" style={{ color: toneColor(data) }}>
                  {data.continuous
                    ? <><CheckCircle2 className="w-4 h-4" /> Línea continua</>
                    : <><AlertTriangle className="w-4 h-4" /> Flujo con interrupciones</>}
                </div>
                <div className="text-gray-500 mt-0.5">
                  El recorrido alcanza {data.reached} de {data.stationCount} estaciones.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              <Stat label="Estaciones" value={data.stationCount} />
              <Stat label="Conexiones" value={data.linkCount} hint={data.danglingLinks ? `${data.danglingLinks} colgada(s)` : undefined} />
              <Stat label="Inicios" value={data.sources.length} hint="esperado 1" />
              <Stat label="Finales" value={data.sinks.length} hint="esperado 1" />
            </div>

            {data.continuous ? (
              <div className="rounded-xl p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-[12px] inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sin problemas de continuidad.
              </div>
            ) : (
              <div className="rounded-xl p-2.5 bg-rose-500/10 border border-rose-500/20 text-[12px] mb-3">
                <div className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Problemas</div>
                <ul className="list-disc pl-5 space-y-0.5 text-rose-700 dark:text-rose-300">
                  {data.issues.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}

            {data.isolated.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-medium text-gray-500 mb-1">Sin conectar ({data.isolated.length})</div>
                <Chips items={data.isolated.map((n) => n.station)} />
              </div>
            )}

            {data.branches.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] font-medium text-gray-500 mb-1">Ramificaciones ({data.branches.length})</div>
                <Chips items={data.branches.map((n) => n.station)} />
              </div>
            )}

            {data.backFlow.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-gray-500 mb-1">Contraflujo ({data.backFlow.length})</div>
                <div className="space-y-1">
                  {data.backFlow.map((b, i) => (
                    <div key={i} className="text-[12px] flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <span className="tabular-nums">{b.fromStation}</span> → <span className="tabular-nums">{b.toStation}</span>
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
