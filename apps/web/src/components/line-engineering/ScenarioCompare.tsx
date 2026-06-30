'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, Scale } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Scenario comparison (Fase 37). Read-only capstone: pits two layouts (two
 * revisions, or two models on the same line) head-to-head across the whole KPI
 * suite — readiness, balance, floor use, manning, cost, flow — scoring each
 * metric for the better side and giving an overall verdict. Distinct from the
 * snapshot diff (geometry); this compares the analytics. Isolated component so
 * its debounced refetch doesn't re-render the heavy editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';
const WIN = '#10b981';

interface Side {
  model: string;
  revision: string;
}
interface Delta {
  key: string;
  label: string;
  a: number | null;
  b: number | null;
  delta: number | null;
  lowerIsBetter: boolean;
  betterSide: 'a' | 'b' | 'tie' | 'na';
}
interface Comparison {
  a: Side;
  b: Side;
  deltas: Delta[];
  scoreA: number;
  scoreB: number;
  verdict: 'a' | 'b' | 'tie';
}

const PCT_KEYS = new Set(['readinessPct', 'balancePct', 'utilizationPct']);
const MONEY_KEYS = new Set(['costPerUnit']);

function fmt(key: string, v: number | null): string {
  if (v === null) return '—';
  if (MONEY_KEYS.has(key)) return `$${v.toFixed(2)}`;
  if (PCT_KEYS.has(key)) return `${Math.round(v)}%`;
  return `${Math.round(v * 100) / 100}`;
}

export default function ScenarioCompare({
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
  const [modelA, setModelA] = useState(model);
  const [revA, setRevA] = useState(revision);
  const [modelB, setModelB] = useState(model);
  const [revB, setRevB] = useState(revision);
  const [takt, setTakt] = useState('60');
  const [labor, setLabor] = useState('8');
  const [data, setData] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !modelA || !modelB) return;
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const qs =
          `modelA=${encodeURIComponent(modelA)}&revisionA=${encodeURIComponent(revA)}` +
          `&modelB=${encodeURIComponent(modelB)}&revisionB=${encodeURIComponent(revB)}` +
          `&taktTargetSec=${Number(takt) || 0}&laborCostPerHour=${Number(labor) || 0}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/compare?${qs}`);
        if (!alive) return;
        if (!r.ok) {
          setError('No se pudo comparar (revisa los modelos).');
          setData(null);
          return;
        }
        setError(null);
        setData((await r.json()) as Comparison);
      } catch {
        if (alive) setError('No se pudo comparar.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, modelA, revA, modelB, revB, takt, labor]);

  if (!open) return null;

  const verdictText =
    data?.verdict === 'a' ? `Gana A · ${modelA}` : data?.verdict === 'b' ? `Gana B · ${modelB}` : 'Empate';
  const verdictColor = data?.verdict === 'tie' ? '#94a3b8' : WIN;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Scale className="w-4 h-4" style={{ color: ROSE }} /> Comparar escenarios
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-xl p-2.5 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Escenario A</div>
            <div className="flex gap-2">
              <input value={modelA} onChange={(e) => setModelA(e.target.value)} placeholder="Modelo A" className="flex-1 min-w-0 rounded-lg px-2 py-1.5 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
              <input value={revA} onChange={(e) => setRevA(e.target.value)} className="w-12 rounded-lg px-2 py-1.5 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
            </div>
          </div>
          <div className="rounded-xl p-2.5 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Escenario B</div>
            <div className="flex gap-2">
              <input value={modelB} onChange={(e) => setModelB(e.target.value)} placeholder="Modelo B" className="flex-1 min-w-0 rounded-lg px-2 py-1.5 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
              <input value={revB} onChange={(e) => setRevB(e.target.value)} className="w-12 rounded-lg px-2 py-1.5 bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
            </div>
          </div>
        </div>

        <div className="flex items-end gap-3 mb-3 text-[12px] text-gray-500">
          <label>Takt (s)<input type="number" min={0} value={takt} onChange={(e) => setTakt(e.target.value)} className="mt-1 w-20 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>M.O. ($/hora)<input type="number" min={0} value={labor} onChange={(e) => setLabor(e.target.value)} className="mt-1 w-20 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          {data && (
            <span className="ml-auto self-center inline-flex items-center gap-2">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">A {data.scoreA} · {data.scoreB} B</span>
              <span className="px-2.5 py-1 rounded-full text-white text-[12px] font-semibold" style={{ background: verdictColor }}>{verdictText}</span>
            </span>
          )}
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-10 text-center">{error}</p>
        ) : !data ? (
          <div className="py-14 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="max-h-[44vh] overflow-y-auto -mx-1 px-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 text-left">
                  <th className="py-1.5 font-medium">KPI</th>
                  <th className="py-1.5 font-medium text-right">A</th>
                  <th className="py-1.5 font-medium text-right">B</th>
                </tr>
              </thead>
              <tbody>
                {data.deltas.map((d) => (
                  <tr key={d.key} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-1.5 text-gray-600 dark:text-gray-300">
                      {d.label}
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">{d.lowerIsBetter ? '↓' : '↑'}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums" style={{ color: d.betterSide === 'a' ? WIN : undefined, fontWeight: d.betterSide === 'a' ? 600 : 400 }}>{fmt(d.key, d.a)}</td>
                    <td className="py-1.5 text-right tabular-nums" style={{ color: d.betterSide === 'b' ? WIN : undefined, fontWeight: d.betterSide === 'b' ? 600 : 400 }}>{fmt(d.key, d.b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
          ↑ = más alto es mejor, ↓ = más bajo es mejor. La celda verde gana ese KPI. El veredicto cuenta KPIs ganados por cada lado; los no disponibles no puntúan.
        </p>
      </div>
    </div>
  );
}
