'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Activity,
  GitFork,
  Gauge,
  Lock,
  Loader2,
  FlaskConical,
  Boxes,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { glass } from '@/lib/glass';
import { apiFetch } from '@/lib/apiFetch';

// Analytics endpoints live on the backend (global /api prefix), not as Next route
// handlers — call them via apiFetch against NEXT_PUBLIC_API_URL (ends in /api).
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface MetricVal {
  key: string;
  name: string;
  unit: string | null;
  domain: string | null;
  value: number | null;
  restricted: boolean;
  definitionOnly: boolean;
}
interface LinkT {
  key: string;
  fromObject: string;
  toObject: string;
  cardinality: string | null;
  verb: string | null;
}
interface Insight {
  object: {
    key: string;
    name: string;
    description: string | null;
    domain: string | null;
    sourceEntity: string | null;
    properties: { name: string; type: string }[] | null;
  };
  domain: string | null;
  pulse: {
    total: number;
    byAction: Record<string, number>;
    byLine: Record<string, number>;
    window: { sinceHours: number };
  };
  trend: { series: { date: string; count: number }[]; narrative: string };
  metrics: MetricVal[];
  links: LinkT[];
  entities: { ref: string; count: number }[];
  error?: string;
}
interface Projection {
  history: { date: string; count: number }[];
  projection: { date: string; count: number }[];
  bands: { date: string; p10: number; p50: number; p90: number }[];
  simulations: number;
  todayRate: number;
  endRate: number;
  adjustmentPct: number;
  horizonDays: number;
  narrative: string;
}

function shortDate(d: string): string {
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}` : d;
}
function fmtValue(v: number | null, unit: string | null): string {
  if (v === null || v === undefined) return '—';
  if (unit === 'USD')
    return v.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  if (unit === '%') return `${v.toLocaleString('es-MX')}%`;
  return v.toLocaleString('es-MX');
}

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: { value: number | string; name?: string }[];
}
function ChartTip({ active, payload, label }: TipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-black/10 bg-white/95 px-2.5 py-1.5 text-xs shadow-lg dark:border-white/10 dark:bg-zinc-900/95">
      <p className="font-medium">{shortDate(String(label ?? ''))}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-black/60 dark:text-white/60">
          {p.value} eventos
        </p>
      ))}
    </div>
  );
}

export default function ObjectDrilldownPage() {
  const params = useParams<{ key: string }>();
  const objectKey = params?.key ?? '';
  const [data, setData] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);

  // What-if controls.
  const [adj, setAdj] = useState(0);
  const [horizon, setHorizon] = useState(14);
  const [proj, setProj] = useState<Projection | null>(null);
  const [projLoading, setProjLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await apiFetch(`${API_BASE}/analytics/object/${objectKey}`, {
          cache: 'no-store',
        });
        if (r.ok) setData(await r.json());
      } finally {
        setLoading(false);
      }
    }
    if (objectKey) load();
  }, [objectKey]);

  const domain = data?.domain ?? '';
  const runProjection = useCallback(async () => {
    setProjLoading(true);
    try {
      const qs = new URLSearchParams({
        horizon: String(horizon),
        adjustmentPct: String(adj),
      });
      if (domain) qs.set('domain', domain);
      const r = await apiFetch(`${API_BASE}/analytics/project?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (r.ok) setProj(await r.json());
    } finally {
      setProjLoading(false);
    }
  }, [adj, horizon, domain]);

  useEffect(() => {
    if (data && !data.error) runProjection();
  }, [data, runProjection]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-semibold">Objeto no encontrado</p>
        <Link
          href="/dashboard/intelligence"
          className="mt-4 inline-block text-violet-600 underline"
        >
          Volver al Centro de Inteligencia
        </Link>
      </div>
    );
  }

  const actions = Object.entries(data.pulse.byAction)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 8);

  // Merge history + Monte Carlo bands (P10/P50/P90) into one series for the chart.
  type Row = {
    date: string;
    actual: number | null;
    p50: number | null;
    p10: number | null;
    p90: number | null;
  };
  const merged: Row[] = proj
    ? [
        ...proj.history.map((p) => ({
          date: p.date,
          actual: p.count,
          p50: null as number | null,
          p10: null as number | null,
          p90: null as number | null,
        })),
        ...proj.bands.map((b) => ({
          date: b.date,
          actual: null as number | null,
          p50: b.p50,
          p10: b.p10,
          p90: b.p90,
        })),
      ]
    : [];
  if (proj && proj.history.length && merged.length > proj.history.length) {
    // Connect the projection lines to the last real point.
    const lastReal = proj.history[proj.history.length - 1].count;
    const join = merged[proj.history.length - 1];
    join.p50 = lastReal;
    join.p10 = lastReal;
    join.p90 = lastReal;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link
        href="/dashboard/intelligence"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Centro de Inteligencia
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
          <Boxes className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{data.object.name}</h1>
          <p className="text-sm text-black/55 dark:text-white/55">
            Objeto · {data.object.domain ?? '—'} ·{' '}
            <span className="font-mono text-xs">{data.object.sourceEntity}</span>
          </p>
        </div>
      </div>

      {/* Pulse */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Eventos · 7 días" value={data.pulse.total.toLocaleString('es-MX')} />
        <Stat label="Acciones distintas" value={String(Object.keys(data.pulse.byAction).length)} />
        <Stat label="Métricas ligadas" value={String(data.metrics.length)} />
        <Stat label="Relaciones" value={String(data.links.length)} />
      </div>

      {/* Trend */}
      <section className={`${glass} mb-6 rounded-2xl p-4`}>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-violet-500" /> Tendencia de actividad
        </h2>
        <p className="mb-3 text-xs text-black/55 dark:text-white/55">
          {data.trend.narrative}
        </p>
        <div className="h-40">
          <ResponsiveContainer>
            <AreaChart
              data={data.trend.series}
              margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
            >
              <defs>
                <linearGradient id="objTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.85)' }} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.85)' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="count" stroke="#7c5cff" strokeWidth={2} fill="url(#objTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* What-if simulator */}
      <section className={`${glass} mb-6 rounded-2xl p-4`}>
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <FlaskConical className="h-4 w-4 text-violet-500" /> Simulador what-if
          {projLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />}
        </h2>
        <p className="mb-3 text-xs text-black/55 dark:text-white/55">
          {proj
            ? proj.narrative
            : 'Proyección lineal de la actividad a partir de su tendencia.'}
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
            Ajuste hipotético
            <input
              type="range"
              min={-50}
              max={100}
              step={5}
              value={adj}
              onChange={(e) => setAdj(parseInt(e.target.value, 10))}
              className="accent-violet-600"
            />
            <span className="w-10 font-mono text-xs font-semibold text-violet-600 dark:text-violet-300">
              {adj > 0 ? '+' : ''}
              {adj}%
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-black/60 dark:text-white/60">
            Horizonte
            <select
              value={horizon}
              onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
              className="rounded-lg border border-black/10 bg-white/60 px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
            >
              <option value={7}>7 días</option>
              <option value={14}>14 días</option>
              <option value={30}>30 días</option>
            </select>
          </label>
          {proj && (
            <span className="text-xs text-black/55 dark:text-white/55">
              hoy ~<strong>{proj.todayRate}</strong>/día → proyectado ~
              <strong>{proj.endRate}</strong>/día
            </span>
          )}
        </div>

        <div className="h-44">
          <ResponsiveContainer>
            <LineChart data={merged} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.85)' }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.85)' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="p90" stroke="rgba(120,120,120,0.55)" strokeWidth={1} strokeDasharray="2 3" dot={false} connectNulls />
              <Line type="monotone" dataKey="p10" stroke="rgba(120,120,120,0.55)" strokeWidth={1} strokeDasharray="2 3" dot={false} connectNulls />
              <Line type="monotone" dataKey="actual" stroke="#7c5cff" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="p50" stroke="#ec4899" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-black/50 dark:text-white/50">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-[#7c5cff]" /> histórico
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-[#ec4899]" /> proyección (P50)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dotted border-zinc-400" /> banda P10–P90
          </span>
          {proj && (
            <span className="ml-auto text-black/40 dark:text-white/40">
              Monte Carlo · {proj.simulations} sims
            </span>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Related metrics */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Gauge className="h-4 w-4 text-violet-500" /> Métricas relacionadas
          </h2>
          <div className="space-y-2">
            {data.metrics.length === 0 && (
              <p className="text-sm text-black/45 dark:text-white/45">Sin métricas en este dominio.</p>
            )}
            {data.metrics.map((m) => (
              <div key={m.key} className={`${glass} flex items-center justify-between rounded-xl px-3 py-2`}>
                <span className="text-sm">{m.name}</span>
                <span className="text-sm font-semibold">
                  {m.restricted ? (
                    <Lock className="h-3.5 w-3.5 text-black/40 dark:text-white/40" />
                  ) : m.definitionOnly ? (
                    <span className="text-xs text-black/40 dark:text-white/40">definición</span>
                  ) : (
                    fmtValue(m.value, m.unit)
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Top actions */}
          {actions.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-xs font-semibold text-black/55 dark:text-white/55">
                Acciones más frecuentes (7 días)
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {actions.map((a) => (
                  <span key={a.k} className="rounded-md bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-600 dark:text-violet-300">
                    {a.k} · {a.v}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Graph neighbors + entities */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <GitFork className="h-4 w-4 text-violet-500" /> Relaciones
          </h2>
          <div className={`${glass} mb-5 divide-y divide-black/5 rounded-2xl dark:divide-white/5`}>
            {data.links.length === 0 && (
              <p className="px-4 py-3 text-sm text-black/45 dark:text-white/45">Sin relaciones.</p>
            )}
            {data.links.map((l) => {
              const other = l.fromObject === data.object.key ? l.toObject : l.fromObject;
              const out = l.fromObject === data.object.key;
              return (
                <Link
                  key={l.key}
                  href={`/dashboard/intelligence/object/${other}`}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="text-violet-500">{out ? `${l.verb} →` : `← ${l.verb}`}</span>
                  <span className="font-medium">{other}</span>
                  <span className="ml-auto text-[10px] text-black/40 dark:text-white/40">{l.cardinality}</span>
                </Link>
              );
            })}
          </div>

          <h3 className="mb-2 text-xs font-semibold text-black/55 dark:text-white/55">
            Entidades recientes
          </h3>
          {data.entities.length === 0 ? (
            <p className="text-sm text-black/45 dark:text-white/45">Sin entidades recientes en el ledger.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.entities.map((e) => (
                <span key={e.ref} className="rounded-md bg-black/5 px-2 py-0.5 font-mono text-[11px] text-black/60 dark:bg-white/10 dark:text-white/60">
                  {e.ref}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${glass} rounded-2xl px-3 py-2.5`}>
      <p className="text-[11px] text-black/50 dark:text-white/50">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
