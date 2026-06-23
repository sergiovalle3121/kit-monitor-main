'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X, Move, AlertTriangle } from 'lucide-react';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

/**
 * Clearance / aisle analysis (Fase 43). Read-only layout check that complements
 * collision: instead of "do things overlap", it asks "is there enough room
 * between and around the placed stations and equipment to move and work
 * safely". Shows the tight pairs, overlaps, objects crowding the walls or
 * spilling off the plan, and a single circulation score. Isolated component so
 * its debounced refetch doesn't re-render the heavy layout editor.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const ROSE = '#f43f5e';

interface ClearancePair { a: string; b: string; aLabel: string; bLabel: string; gap: number }
interface ClearanceResult {
  minClearance: number;
  boxCount: number;
  tightPairs: ClearancePair[];
  overlaps: ClearancePair[];
  outOfBounds: string[];
  perimeterTight: string[];
  minGap: number;
  clearancePct: number;
}

export default function ClearanceAnalysis({
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
  const [min, setMin] = useState('');
  const [res, setRes] = useState<ClearanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !model) return;
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const minQs = min && Number(min) > 0 ? `&min=${Number(min)}` : '';
        const qs = `model=${encodeURIComponent(model)}&revision=${encodeURIComponent(revision)}${minQs}`;
        const r = await apiFetch(`${API_BASE}/line-engineering/layout/clearance?${qs}`);
        if (!alive) return;
        if (!r.ok) { setError('No se pudo calcular las holguras.'); setRes(null); return; }
        setError(null);
        setRes((await r.json()) as ClearanceResult);
      } catch {
        if (alive) setError('No se pudo calcular las holguras.');
      }
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [open, model, revision, min]);

  if (!open) return null;

  const tone = !res ? 'info' : res.clearancePct >= 90 ? 'ok' : res.clearancePct >= 70 ? 'warn' : 'bad';
  const fmt = (n: number) => Math.round(n).toLocaleString('es-MX');

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className={`${glass} rounded-2xl p-5 w-full max-w-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold inline-flex items-center gap-2">
            <Move className="w-4 h-4" style={{ color: ROSE }} /> Holguras y pasillos · {model} · {revision}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        <label className="block text-[12px] text-gray-500 mb-4">
          Holgura mínima requerida (deja vacío para 2 celdas de grilla)
          <input
            type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)}
            placeholder={res ? `${fmt(res.minClearance)}` : 'auto'}
            className="mt-1 w-full rounded-lg px-2.5 py-2 bg-black/[0.03] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm"
          />
        </label>

        {error ? (
          <p className="text-[12px] text-amber-500 py-8 text-center">{error}</p>
        ) : !res ? (
          <div className="py-10 grid place-items-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <Stat title="Circulación" main={`${res.clearancePct}%`} sub={`${res.boxCount} objetos`} tone={tone} />
              <Stat title="Holgura mínima" main={fmt(res.minGap)} sub="entre objetos" tone={res.minGap < res.minClearance ? 'bad' : 'ok'} />
              <Stat title="Requerido" main={fmt(res.minClearance)} sub="mín. configurado" tone="info" />
            </div>

            {res.boxCount === 0 ? (
              <p className="text-[12px] text-gray-400 py-6 text-center">Coloca estaciones o equipo en el plano para revisar holguras.</p>
            ) : (
              <div className="space-y-3 max-h-[44vh] overflow-y-auto -mx-1 px-1">
                {res.overlaps.length > 0 && (
                  <Section title={`Traslapes (${res.overlaps.length})`} color="#ef4444">
                    {res.overlaps.map((p, i) => (
                      <Row key={i} left={`${p.aLabel} ↔ ${p.bLabel}`} right="se traslapan" bad />
                    ))}
                  </Section>
                )}
                {res.tightPairs.length > 0 && (
                  <Section title={`Demasiado juntos (${res.tightPairs.length})`} color="#f59e0b">
                    {res.tightPairs.slice(0, 30).map((p, i) => (
                      <Row key={i} left={`${p.aLabel} ↔ ${p.bLabel}`} right={`${fmt(p.gap)}`} />
                    ))}
                  </Section>
                )}
                {(res.perimeterTight.length > 0 || res.outOfBounds.length > 0) && (
                  <Section title="Perímetro" color="#f59e0b">
                    {res.outOfBounds.length > 0 && <Row left="Fuera del plano" right={`${res.outOfBounds.length}`} bad />}
                    {res.perimeterTight.length > 0 && <Row left="Pegados al muro" right={`${res.perimeterTight.length}`} />}
                  </Section>
                )}
                {res.overlaps.length === 0 && res.tightPairs.length === 0 && res.perimeterTight.length === 0 && res.outOfBounds.length === 0 && (
                  <p className="text-[12px] text-emerald-600 dark:text-emerald-400 py-6 text-center inline-flex items-center justify-center gap-1.5 w-full">
                    Sin problemas de holgura: todo respeta el mínimo de {fmt(res.minClearance)}.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide mb-1 inline-flex items-center gap-1" style={{ color }}>
        <AlertTriangle className="w-3 h-3" /> {title}
      </div>
      <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/10">
        {children}
      </div>
    </div>
  );
}

function Row({ left, right, bad }: { left: string; right: string; bad?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-[12.5px]">
      <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{left}</span>
      <span className="tabular-nums shrink-0" style={{ color: bad ? '#ef4444' : '#f59e0b' }}>{right}</span>
    </div>
  );
}

function Stat({ title, main, sub, tone }: { title: string; main: string; sub: string; tone: 'ok' | 'warn' | 'bad' | 'info' }) {
  const color = tone === 'ok' ? '#10b981' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#3b82f6';
  return (
    <div className="rounded-xl p-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{title}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color }}>{main}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">{sub}</div>
    </div>
  );
}
