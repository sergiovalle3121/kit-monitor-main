'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, Network, Check } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Flex-line (multi-model) analysis (Fase 40). Read-only: finds every model that
 * runs on a physical line and shows how much they share — the common station
 * backbone vs each model's changeover-specific stations — as a station×model
 * matrix plus a commonality score. High commonality = cheap, fast changeovers.
 * Isolated component so its debounced refetch doesn't re-render the editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';
const SHARED = '#10b981';

interface StationUsage { station: string; models: string[]; usageCount: number; sharedByAll: boolean; }
interface ModelSummary { model: string; revision: string; label: string; stationCount: number; uniqueStations: number; bottleneckSec: number; }
interface FlexResult {
  line: string;
  modelCount: number;
  models: ModelSummary[];
  stations: StationUsage[];
  sharedStations: number;
  totalUniqueStations: number;
  commonalityPct: number;
}

export default function FlexLine({
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
  const [line, setLine] = useState(''); // empty → derive from model
  const [data, setData] = useState<FlexResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const q = line.trim()
          ? `line=${encodeURIComponent(line.trim())}`
          : `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/flex-line?${q}`);
        if (!alive) return;
        if (!r.ok) {
          setError('No se pudo analizar la línea.');
          setData(null);
          return;
        }
        setError(null);
        setData((await r.json()) as FlexResult);
      } catch {
        if (alive) setError('No se pudo analizar la línea.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, line]);

  if (!open) return null;

  const commonColor = data && data.commonalityPct >= 70 ? SHARED : data && data.commonalityPct >= 40 ? '#f59e0b' : ROSE;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Network className="w-4 h-4" style={{ color: ROSE }} /> Línea flexible (multi-modelo){data ? ` · ${data.line}` : ''}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-end gap-3 mb-3 text-[12px] text-gray-500">
          <label>
            Línea física
            <input value={line} onChange={(e) => setLine(e.target.value)} placeholder={`(de ${model})`} className="mt-1 w-40 rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm block" />
          </label>
          {data && (
            <span className="ml-auto self-center inline-flex items-center gap-2 text-right">
              <span>{data.modelCount} modelos · {data.sharedStations}/{data.totalUniqueStations} compartidas</span>
              <span className="px-2.5 py-1 rounded-full text-white text-[12px] font-semibold" style={{ background: commonColor }}>{Math.round(data.commonalityPct)}% común</span>
            </span>
          )}
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-10 text-center">{error}</p>
        ) : !data ? (
          <div className="py-14 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : data.modelCount === 0 ? (
          <p className="text-[12px] text-gray-400 py-8 text-center">No hay modelos con estaciones activas en esta línea.</p>
        ) : (
          <>
            {/* per-model summary */}
            <div className="flex flex-wrap gap-2 mb-3">
              {data.models.map((m) => (
                <div key={m.label} className="rounded-lg px-2.5 py-1.5 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 text-[12px]">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-gray-400"> · {m.stationCount} est · {m.uniqueStations} propias · cuello {Math.round(m.bottleneckSec)}s</span>
                </div>
              ))}
            </div>

            {/* station × model matrix */}
            <div className="max-h-[44vh] overflow-auto -mx-1 px-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-[11px] text-gray-400">
                    <th className="py-1.5 px-2 text-left font-medium sticky left-0 bg-transparent">Estación</th>
                    {data.models.map((m) => (
                      <th key={m.label} className="py-1.5 px-2 font-medium text-center whitespace-nowrap">{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.stations.map((s) => (
                    <tr key={s.station} className="border-t border-black/5 dark:border-white/10" style={s.sharedByAll ? { background: 'rgba(16,185,129,0.07)' } : undefined}>
                      <td className="py-1.5 px-2 whitespace-nowrap sticky left-0">
                        <span className="inline-flex items-center gap-1.5">
                          {s.sharedByAll && <span className="w-1.5 h-1.5 rounded-full" style={{ background: SHARED }} title="Backbone compartido" />}
                          {s.station}
                        </span>
                      </td>
                      {data.models.map((m) => {
                        const used = s.models.includes(m.label);
                        return (
                          <td key={m.label} className="py-1.5 px-2 text-center">
                            {used ? <Check className="w-3.5 h-3.5 inline" style={{ color: s.sharedByAll ? SHARED : '#3b82f6' }} /> : <span className="text-gray-300 dark:text-gray-600">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-[11px] text-gray-400 mt-3">
          Las estaciones del backbone (verde) las usan todos los modelos de la línea; las propias de un modelo son su superficie de cambio. Más comunidad = cambios de modelo más rápidos y baratos.
        </p>
      </div>
    </div>
  );
}
