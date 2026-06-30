'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, Gauge, AlertTriangle } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Layout health scorecard (Fase 44). Read-only one-glance summary that rolls the
 * individual layout analyses (placement readiness, balance, flow direction,
 * circulation) into a single graded readiness index, surfaces the weakest
 * dimensions to fix first and the hard blockers that hold a release back.
 * Isolated component so its fetch doesn't re-render the heavy layout editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface ScorecardDimension { key: string; label: string; score: number; weight: number }
interface Scorecard {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  dimensions: ScorecardDimension[];
  weakest: { key: string; label: string; score: number }[];
  blockers: string[];
  scored: boolean;
}

const gradeColor = (g: string) => (g === 'A' ? '#10b981' : g === 'B' ? '#84cc16' : g === 'C' ? '#f59e0b' : '#ef4444');
const barColor = (s: number) => (s >= 85 ? '#10b981' : s >= 70 ? '#84cc16' : s >= 55 ? '#f59e0b' : '#ef4444');

export default function LayoutScorecard({
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
  const [card, setCard] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    // Reset + fetch inside a scheduled callback so no setState runs synchronously
    // in the effect body (matches the sibling analysis panels, keeps lint clean).
    const id = setTimeout(async () => {
      setCard(null); setError(null);
      try {
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/scorecard?${qs}`);
        if (!alive) return;
        if (!r.ok) { setError('No se pudo calcular la tarjeta de salud.'); return; }
        setCard((await r.json()) as Scorecard);
      } catch {
        if (alive) setError('No se pudo calcular la tarjeta de salud.');
      }
    }, 0);
    return () => { alive = false; clearTimeout(id); };
  }, [open, model, revision]);

  if (!open) return null;

  // Portal to <body>: an ancestor of the editor is a `glass` card whose
  // backdrop-filter creates a containing block, which would trap this
  // `fixed inset-0` overlay inside it (rendered low / clipped). Rendering at the
  // body root re-anchors the overlay to the viewport so it centres correctly.
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-md max-h-[88vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Gauge className="w-4 h-4" style={{ color: ROSE }} /> Tarjeta de salud · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !card ? (
          <div className="py-10 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : !card.scored ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 py-8 text-center">Coloca estaciones en el plano para evaluar el layout.</p>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="grid place-items-center w-20 h-20 rounded-2xl text-4xl font-bold text-white shrink-0" style={{ background: gradeColor(card.grade) }}>
                {card.grade}
              </div>
              <div>
                <div className="text-3xl font-semibold" style={{ color: gradeColor(card.grade) }}>{card.score}<span className="text-base text-gray-500 dark:text-gray-400"> / 100</span></div>
                <div className="text-[12px] text-gray-500 mt-0.5">
                  {card.blockers.length ? 'Con bloqueos para liberar' : card.grade === 'A' ? 'Listo para liberar' : 'Mejorable antes de liberar'}
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {card.dimensions.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-[12px] mb-0.5">
                    <span className="text-gray-600 dark:text-gray-300">{d.label} <span className="text-gray-500 dark:text-gray-400">· {Math.round(d.weight * 100)}%</span></span>
                    <span className="tabular-nums font-medium" style={{ color: barColor(d.score) }}>{Math.round(d.score)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, d.score))}%`, background: barColor(d.score) }} />
                  </div>
                </div>
              ))}
            </div>

            {card.weakest.length > 0 && (
              <p className="text-[12px] text-gray-500 mb-2">
                Empieza por: {card.weakest.map((w) => <b key={w.key} className="text-gray-700 dark:text-gray-200">{w.label}</b>).reduce((acc, el, i) => (i ? [...acc, ' y ', el] : [el]), [] as React.ReactNode[])}.
              </p>
            )}

            {card.blockers.length > 0 && (
              <div className="rounded-xl p-2.5 bg-rose-500/10 border border-rose-500/20 text-[12px]">
                <div className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Bloqueos</div>
                <ul className="list-disc pl-5 space-y-0.5 text-rose-700 dark:text-rose-300">
                  {card.blockers.map((b, i) => <li key={i}>{b}</li>)}
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
