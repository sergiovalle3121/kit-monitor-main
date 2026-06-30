'use client';

import React, { useMemo, useState } from 'react';
import { Scale, X, AlertTriangle, Gauge } from 'lucide-react';
import { glass } from '@/lib/glass';
import {
  buildCadLineBalanceReport,
  type CadLineBalanceStation,
} from '@/lib/cad/line-balance';

/**
 * Local line-balance panel (FASE 1 · UI surface). This is a *thin presentational
 * surface* for the existing deterministic `buildCadLineBalanceReport` helper — it
 * adds no new balancing logic and makes no server call. It reads the stations
 * already placed on the CAD plan (cycle times are parsed from their labels by the
 * same helper) and renders takt load, the bottleneck, efficiency and the helper's
 * own recommendations.
 *
 * It is intentionally distinct from the server-backed "Yamazumi (balanceo)" panel:
 * this one is offline/deterministic and reflects exactly what is on screen.
 */

function fmtSeconds(value: number | undefined): string {
  return value == null ? 'Sin dato' : `${Math.round(value * 10) / 10}s`;
}

export default function LineBalancePanel({
  stations,
  unit,
  open,
  onClose,
}: {
  stations: CadLineBalanceStation[];
  unit?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [taktText, setTaktText] = useState('');

  const taktTimeSec = useMemo(() => {
    const value = Number(taktText.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [taktText]);

  const report = useMemo(
    () => buildCadLineBalanceReport({ stations, taktTimeSec }),
    [stations, taktTimeSec],
  );

  if (!open) return null;

  const tone =
    report.balanceScore >= 85 ? 'ok' : report.balanceScore >= 60 ? 'warn' : 'bad';
  const enough = report.stationCount >= 2;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Scale className="w-4 h-4" style={{ color: '#22d3ee' }} /> Balance de línea (local)
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mb-3 leading-snug">
          Cálculo determinístico sobre las estaciones del plano. Los tiempos de ciclo se leen de la etiqueta
          (p. ej. <span className="font-mono">“SMT (45s)”</span> o <span className="font-mono">“CT 30s”</span>).
        </p>

        <label className="block text-[12px] text-gray-500 dark:text-gray-400 mb-4">
          Takt time objetivo (s) — vacío usa el cuello de botella como referencia
          <input
            type="number" min={0} value={taktText} onChange={(e) => setTaktText(e.target.value)}
            placeholder={report.effectiveTaktSec ? `${Math.round(report.effectiveTaktSec)}` : 'auto'}
            className="mt-1 w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm"
          />
        </label>

        {!enough ? (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 py-8 text-center">
            Coloca al menos 2 estaciones en el plano para analizar el balanceo.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <Stat title="Balance" main={`${report.balanceScore}/100`} sub={`${report.measuredStationCount}/${report.stationCount} con CT`} tone={tone} />
              <Stat title="Takt efectivo" main={fmtSeconds(report.effectiveTaktSec)} sub={report.taktTimeSec ? 'objetivo' : 'cuello de botella'} tone="info" />
              <Stat title="Eficiencia" main={report.balanceEfficiencyPercent == null ? 'Sin dato' : `${report.balanceEfficiencyPercent}%`} sub={report.maxLoadPercent == null ? '—' : `pico ${report.maxLoadPercent}%`} tone={report.balanceEfficiencyPercent != null && report.balanceEfficiencyPercent >= 85 ? 'ok' : 'warn'} />
            </div>

            {report.bottleneck && (
              <div className="mb-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 px-3 py-2 text-[12.5px] inline-flex items-center gap-2 w-full">
                <Gauge className="w-3.5 h-3.5 shrink-0" style={{ color: '#f59e0b' }} />
                <span className="text-gray-600 dark:text-gray-300">Cuello de botella:</span>
                <span className="font-medium truncate">{report.bottleneck.label}</span>
                <span className="ml-auto tabular-nums shrink-0 text-amber-600 dark:text-amber-300">{fmtSeconds(report.bottleneck.cycleTimeSec)}</span>
              </div>
            )}

            <div className="space-y-1.5 max-h-[38vh] overflow-y-auto -mx-1 px-1 mb-3">
              {report.stations.map((station) => {
                const load = station.loadPercent;
                const over = station.overTakt || (load != null && load > 100);
                const barColor = station.missingCycleTime ? '#64748b' : over ? '#ef4444' : load != null && load >= 85 ? '#f59e0b' : '#10b981';
                return (
                  <div key={station.id} className="rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 px-2.5 py-1.5">
                    <div className="flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="truncate text-gray-700 dark:text-gray-200">{station.label}</span>
                      <span className="tabular-nums shrink-0 text-gray-500 dark:text-gray-400">
                        {fmtSeconds(station.cycleTimeSec)}{load != null ? ` · ${load}%` : ''}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, load ?? 0))}%`, background: barColor }} />
                    </div>
                    {station.missingCycleTime && (
                      <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">Sin tiempo de ciclo en la etiqueta.</div>
                    )}
                  </div>
                );
              })}
            </div>

            {report.recommendations.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wide mb-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                  <AlertTriangle className="w-3 h-3" /> Recomendaciones
                </div>
                <ul className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/10">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="px-3 py-1.5 text-[12px] text-gray-700 dark:text-gray-300">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {unit ? <div className="mt-3 text-[10px] text-gray-400 dark:text-gray-500 text-right">Unidad del plano: {unit}</div> : null}
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
