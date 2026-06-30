'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, Repeat } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Model-changeover (SMED) matrix (Fase 41). Read-only: for every ordered pair
 * of models on a flex line, the estimated switch effort (set up + tear down +
 * retool) as a heat matrix — the input to sequence models so total changeover
 * is minimized. Builds on the flex-line analysis (Fase 40). Isolated component
 * so its debounced refetch doesn't re-render the heavy editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface Pair { from: string; to: string; added: number; removed: number; retooled: number; unchanged: number; changeoverSec: number; }
interface Result {
  line: string;
  labels: string[];
  pairs: Pair[];
  matrix: number[][];
  worstSec: number;
  bestSec: number;
  setupSec: number;
  teardownSec: number;
  retoolSec: number;
}

function fmtMin(sec: number): string {
  if (sec <= 0) return '—';
  const m = sec / 60;
  return m >= 10 ? `${Math.round(m)}m` : `${m.toFixed(1)}m`;
}

// Green (cheap) → rose (expensive) by share of the worst changeover.
function cellColor(sec: number, worst: number): string {
  if (sec <= 0 || worst <= 0) return 'transparent';
  const t = Math.min(1, sec / worst);
  const hue = 145 - t * 145; // 145 (green) → 0 (red)
  return `hsla(${hue}, 70%, 50%, 0.22)`;
}

export default function ChangeoverMatrix({
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
  const [line, setLine] = useState('');
  const [setup, setSetup] = useState('300');
  const [teardown, setTeardown] = useState('120');
  const [retool, setRetool] = useState('180');
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const base = line.trim()
          ? `line=${encodeURIComponent(line.trim())}`
          : `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`;
        const q = `${base}&setupSec=${Number(setup) || 0}&teardownSec=${Number(teardown) || 0}&retoolSec=${Number(retool) || 0}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/changeover?${q}`);
        if (!alive) return;
        if (!r.ok) {
          setError('No se pudo calcular el cambio de modelo.');
          setData(null);
          return;
        }
        setError(null);
        setData((await r.json()) as Result);
      } catch {
        if (alive) setError('No se pudo calcular el cambio de modelo.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, line, setup, teardown, retool]);

  if (!open) return null;

  const pairByKey = new Map((data?.pairs ?? []).map((p) => [`${p.from}>${p.to}`, p]));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Repeat className="w-4 h-4" style={{ color: ROSE }} /> Cambio de modelo (SMED){data ? ` · ${data.line}` : ''}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-end gap-2.5 mb-3 text-[12px] text-gray-500 flex-wrap">
          <label>Línea<input value={line} onChange={(e) => setLine(e.target.value)} placeholder={`(de ${model})`} className="mt-1 w-28 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>Set up (s)<input type="number" min={0} value={setup} onChange={(e) => setSetup(e.target.value)} className="mt-1 w-20 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>Tear down (s)<input type="number" min={0} value={teardown} onChange={(e) => setTeardown(e.target.value)} className="mt-1 w-20 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
          <label>Retool (s)<input type="number" min={0} value={retool} onChange={(e) => setRetool(e.target.value)} className="mt-1 w-20 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" /></label>
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-10 text-center">{error}</p>
        ) : !data ? (
          <div className="py-14 grid place-items-center text-gray-500 dark:text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : data.labels.length < 2 ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 py-8 text-center">Se necesitan al menos dos modelos en la línea para estimar cambios.</p>
        ) : (
          <>
            <div className="max-h-[44vh] overflow-auto -mx-1 px-1">
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="p-1.5 text-[11px] text-gray-500 dark:text-gray-400 text-left sticky left-0">de \ a</th>
                    {data.labels.map((l) => (
                      <th key={l} className="p-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap text-center">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.labels.map((from, i) => (
                    <tr key={from} className="border-t border-black/5 dark:border-white/10">
                      <td className="p-1.5 text-[12px] font-medium whitespace-nowrap sticky left-0">{from}</td>
                      {data.labels.map((to, j) => {
                        if (i === j) return <td key={to} className="p-1.5 text-center text-gray-300 dark:text-gray-600">—</td>;
                        const sec = data.matrix[i][j];
                        const p = pairByKey.get(`${from}>${to}`);
                        return (
                          <td key={to} className="p-1.5 text-center tabular-nums" style={{ background: cellColor(sec, data.worstSec) }}>
                            <span title={p ? `+${p.added} set up · −${p.removed} tear down · ${p.retooled} retool` : ''}>{fmtMin(sec)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-3 text-[12px] text-gray-500">
              <span>cambio más caro <b style={{ color: ROSE }}>{fmtMin(data.worstSec)}</b></span>
              <span>más barato <b style={{ color: '#10b981' }}>{fmtMin(data.bestSec)}</b></span>
            </div>
          </>
        )}

        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3">
          Cada celda estima el cambio de modelo del renglón a la columna: estaciones a montar (set up), desmontar (tear down) y reherramentar (parte distinta en una estación compartida). Secuencia los modelos por celdas más verdes para minimizar el cambio total.
        </p>
      </div>
    </div>
  );
}
