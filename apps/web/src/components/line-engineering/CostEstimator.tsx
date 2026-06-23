'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, DollarSign } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Layout unit-economics estimator (Fase 35). Read-only planning tool: combines
 * the manning, takt, floor area and equipment count with the rates the planner
 * supplies into a cost-per-unit split across labor, space and amortized capex,
 * so two candidate layouts can be compared on cost — not just on balance.
 * Isolated component so its debounced refetch doesn't re-render the editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

const SEG = { labor: '#3b82f6', space: '#8b5cf6', capex: '#f59e0b' };

interface CostModel {
  taktSec: number;
  throughputPerHour: number;
  monthlyVolume: number;
  laborCostPerUnit: number;
  spaceCostPerUnit: number;
  capexPerUnit: number;
  totalCostPerUnit: number;
  laborCostPerMonth: number;
  spaceCostPerMonth: number;
  capexPerMonth: number;
  totalCostPerMonth: number;
  capexTotal: number;
  breakdownPct: { labor: number; space: number; capex: number };
  operatorCount: number;
  stationCount: number;
  assetCount: number;
  footprintAreaM2: number;
}

function money(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

export default function CostEstimator({
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
  const [space, setSpace] = useState('12');
  const [asset, setAsset] = useState('5000');
  const [amort, setAmort] = useState('36');
  const [data, setData] = useState<CostModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    const availSec = Math.max(0, Number(minutes) || 0) * 60;
    const units = Math.max(0, Number(demand) || 0);
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const qs =
          `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}` +
          `&availableTimeSec=${availSec}&demandUnits=${units}` +
          `&laborCostPerHour=${Number(labor) || 0}&spaceCostPerM2Month=${Number(space) || 0}` +
          `&assetUnitCost=${Number(asset) || 0}&amortizationMonths=${Number(amort) || 0}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/cost?${qs}`);
        if (!alive) return;
        if (!r.ok) {
          setError('Este modelo aún no tiene ruteo para estimar costo.');
          setData(null);
          return;
        }
        setError(null);
        setData((await r.json()) as CostModel);
      } catch {
        if (alive) setError('No se pudo estimar el costo.');
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [open, model, revision, minutes, demand, labor, space, asset, amort]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <DollarSign className="w-4 h-4" style={{ color: ROSE }} /> Costo por unidad · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <Field label="Tiempo (min/turno)" value={minutes} onChange={setMinutes} />
          <Field label="Demanda (u/turno)" value={demand} onChange={setDemand} />
          <Field label="M.O. ($/hora)" value={labor} onChange={setLabor} />
          <Field label="Piso ($/m²·mes)" value={space} onChange={setSpace} />
          <Field label="Equipo ($/u)" value={asset} onChange={setAsset} />
          <Field label="Amortización (meses)" value={amort} onChange={setAmort} />
        </div>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !data ? (
          <div className="py-10 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-end justify-between mb-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400">Costo total por unidad</div>
                <div className="text-3xl font-semibold" style={{ color: ROSE }}>{money(data.totalCostPerUnit)}</div>
              </div>
              <div className="text-right text-[12px] text-gray-500 leading-relaxed">
                <div>{data.operatorCount} operadores · {data.assetCount} equipos</div>
                <div>{Math.round(data.footprintAreaM2)} m² · {Math.round(data.throughputPerHour)} u/h</div>
                <div>{data.monthlyVolume.toLocaleString()} u/mes</div>
              </div>
            </div>

            {/* breakdown bar */}
            <div className="flex h-3 rounded-full overflow-hidden mb-2 bg-black/[0.06] dark:bg-white/[0.08]">
              <div style={{ width: `${data.breakdownPct.labor}%`, background: SEG.labor }} title={`Mano de obra ${data.breakdownPct.labor}%`} />
              <div style={{ width: `${data.breakdownPct.space}%`, background: SEG.space }} title={`Piso ${data.breakdownPct.space}%`} />
              <div style={{ width: `${data.breakdownPct.capex}%`, background: SEG.capex }} title={`Equipo ${data.breakdownPct.capex}%`} />
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <Bucket color={SEG.labor} title="Mano de obra" perUnit={money(data.laborCostPerUnit)} perMonth={money(data.laborCostPerMonth)} pct={data.breakdownPct.labor} />
              <Bucket color={SEG.space} title="Piso" perUnit={money(data.spaceCostPerUnit)} perMonth={money(data.spaceCostPerMonth)} pct={data.breakdownPct.space} />
              <Bucket color={SEG.capex} title="Equipo" perUnit={money(data.capexPerUnit)} perMonth={money(data.capexPerMonth)} pct={data.breakdownPct.capex} />
            </div>

            <div className="mt-3 pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[12px] text-gray-500">
              <span>Costo mensual total</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200">{money(data.totalCostPerMonth)}</span>
            </div>
          </>
        )}

        <p className="text-[11px] text-gray-400 mt-3">
          Estimación con las tarifas indicadas. M.O. = operadores × takt × tarifa; piso = área × tarifa; equipo = capex amortizado. El volumen mensual se deriva del takt si no se fija demanda.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-[11px] text-gray-500">
      {label}
      <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg px-2 py-1.5 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm" />
    </label>
  );
}

function Bucket({ color, title, perUnit, perMonth, pct }: { color: string; title: string; perUnit: string; perMonth: string; pct: number }) {
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-gray-400 inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} /> {title}
      </div>
      <div className="text-lg font-semibold mt-0.5" style={{ color }}>{perUnit}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{pct}% · {perMonth}/mes</div>
    </div>
  );
}
