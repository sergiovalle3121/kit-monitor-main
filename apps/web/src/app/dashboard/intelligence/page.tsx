'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BrainCircuit,
  Boxes,
  GitFork,
  Gauge,
  Lock,
  Loader2,
  Sparkles,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { glass } from '@/lib/glass';

interface MetricDef {
  key: string;
  name: string;
  description: string | null;
  unit: string | null;
  domain: string | null;
  grain: string | null;
  formula: string | null;
  direction: string | null;
  version: number;
}
interface OntObject {
  key: string;
  name: string;
  description: string | null;
  domain: string | null;
  sourceEntity: string | null;
  properties: { name: string; type: string; description?: string }[] | null;
}
interface OntLink {
  key: string;
  fromObject: string;
  toObject: string;
  cardinality: string | null;
  verb: string | null;
  description: string | null;
}
interface Catalog {
  metrics: MetricDef[];
  objects: OntObject[];
  links: OntLink[];
}
interface MetricValue {
  key: string;
  value: number | null;
  restricted: boolean;
  definitionOnly: boolean;
  error?: string;
}
interface Trend {
  series: { date: string; count: number }[];
  total: number;
  window: { days: number };
  recent7: number;
  prior7: number;
  deltaPct: number | null;
  narrative: string;
}
interface Breakdown {
  buckets: { domain: string; count: number }[];
  total: number;
  window: { sinceHours: number };
  narrative: string;
}
interface Proposal {
  id: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  line?: string | null;
  model?: string | null;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600 dark:text-red-300',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
};

const DOMAIN_COLOR: Record<string, string> = {
  MATERIALS: '#14b8a6',
  PRODUCTION: '#f97316',
  QUALITY: '#10b981',
  FINANCE: '#f59e0b',
  SALES: '#ec4899',
  PLANNING: '#6366f1',
  SHIPPING: '#0ea5e9',
  SYSTEM: '#64748b',
  ENGINEERING: '#8b5cf6',
};
const domainColor = (d: string) => DOMAIN_COLOR[d] || '#7c5cff';

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

const DOMAIN_TINT: Record<string, string> = {
  MATERIALS: 'bg-teal-500/10 text-teal-600 dark:text-teal-300',
  PRODUCTION: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
  QUALITY: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  FINANCE: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  SALES: 'bg-pink-500/10 text-pink-600 dark:text-pink-300',
  PLANNING: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  SHIPPING: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  SYSTEM: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
  ENGINEERING: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
};
const tint = (d: string | null) =>
  (d && DOMAIN_TINT[d]) || 'bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60';

export default function IntelligencePage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [values, setValues] = useState<Record<string, MetricValue>>({});
  const [trend, setTrend] = useState<Trend | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [c, v, t, b, p] = await Promise.all([
          fetch('/api/semantic/catalog', { cache: 'no-store' }),
          fetch('/api/semantic/values', { cache: 'no-store' }),
          fetch('/api/analytics/ledger-trend?days=14', { cache: 'no-store' }),
          fetch('/api/analytics/domain-breakdown?sinceHours=168', {
            cache: 'no-store',
          }),
          fetch('/api/autopilot/proposals?status=pending', {
            cache: 'no-store',
          }),
        ]);
        if (c.ok) setCatalog(await c.json());
        if (v.ok) {
          const rows: MetricValue[] = await v.json();
          setValues(Object.fromEntries(rows.map((r) => [r.key, r])));
        }
        if (t.ok) setTrend(await t.json());
        if (b.ok) setBreakdown(await b.json());
        if (p.ok) {
          const rows = await p.json();
          setProposals(Array.isArray(rows) ? rows : []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const objectByKey = useMemo(
    () => Object.fromEntries((catalog?.objects ?? []).map((o) => [o.key, o])),
    [catalog],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  const metrics = catalog?.metrics ?? [];
  const objects = catalog?.objects ?? [];
  const links = catalog?.links ?? [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
          <BrainCircuit className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Centro de Inteligencia</h1>
          <p className="text-sm text-black/55 dark:text-white/55">
            Analítica · catálogo de métricas · ontología del negocio
          </p>
        </div>
      </div>

      <div className={`${glass} mb-6 rounded-2xl p-4 text-sm`}>
        <p className="inline-flex items-center gap-1.5 text-black/70 dark:text-white/70">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Esta es la fuente única de verdad de tus métricas y objetos de negocio.
          <strong className="font-medium">CIDE</strong> usa este mismo catálogo
          para responder con cifras gobernadas y consistentes.
        </p>
      </div>

      {/* ── Acciones sugeridas (autopilot) ── */}
      {proposals.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-violet-500" /> Acciones sugeridas
            <span className="text-black/40 dark:text-white/40">
              · recomendadas por el sistema ({proposals.length})
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {proposals.slice(0, 6).map((p) => (
              <div key={p.id} className={`${glass} rounded-2xl p-4`}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-snug">{p.title}</span>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${SEVERITY_STYLE[p.severity] ?? ''}`}
                  >
                    {p.severity}
                  </span>
                </div>
                <p className="text-xs leading-snug text-black/55 dark:text-white/55">
                  {p.description}
                </p>
                {(p.line || p.model) && (
                  <p className="mt-1.5 text-[10px] text-black/40 dark:text-white/40">
                    {[p.line, p.model].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Pulso operacional (analítica) ── */}
      {(trend || breakdown) && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-violet-500" /> Pulso operacional
            <span className="text-black/40 dark:text-white/40">
              · analítica del Event Ledger
            </span>
          </h2>

          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            {trend && <NarrativeCard text={trend.narrative} delta={trend.deltaPct} />}
            {breakdown && <NarrativeCard text={breakdown.narrative} />}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {trend && (
              <div className={`${glass} rounded-2xl p-4`}>
                <p className="mb-2 text-xs font-medium text-black/55 dark:text-white/55">
                  Eventos por día · últimos {trend.window.days} días
                </p>
                <div className="h-44">
                  <ResponsiveContainer>
                    <AreaChart
                      data={trend.series}
                      margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="cideTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(120,120,120,0.15)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDate}
                        tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.85)' }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={20}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.85)' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={28}
                      />
                      <Tooltip content={<ChartTooltip labelFormatter={shortDate} />} />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#7c5cff"
                        strokeWidth={2}
                        fill="url(#cideTrend)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {breakdown && breakdown.buckets.length > 0 && (
              <div className={`${glass} rounded-2xl p-4`}>
                <p className="mb-2 text-xs font-medium text-black/55 dark:text-white/55">
                  Actividad por dominio · últimos 7 días
                </p>
                <div className="h-44">
                  <ResponsiveContainer>
                    <BarChart
                      data={breakdown.buckets}
                      margin={{ top: 6, right: 8, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(120,120,120,0.15)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="domain"
                        tick={{ fontSize: 9, fill: 'rgba(120,120,120,0.85)' }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-20}
                        textAnchor="end"
                        height={44}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.85)' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={28}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {breakdown.buckets.map((b) => (
                          <Cell key={b.domain} fill={domainColor(b.domain)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Métricas ── */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4 text-violet-500" /> Catálogo de métricas
          <span className="text-black/40 dark:text-white/40">({metrics.length})</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => {
            const v = values[m.key];
            return (
              <div key={m.key} className={`${glass} rounded-2xl p-4`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${tint(m.domain)}`}>
                    {m.domain ?? '—'}
                  </span>
                  <span className="text-[10px] text-black/40 dark:text-white/40">
                    v{m.version}
                  </span>
                </div>
                <p className="text-sm font-medium">{m.name}</p>
                <div className="mt-1 flex items-end gap-1.5">
                  {v?.restricted ? (
                    <span className="inline-flex items-center gap-1 text-sm text-black/45 dark:text-white/45">
                      <Lock className="h-3.5 w-3.5" /> restringido
                    </span>
                  ) : v?.definitionOnly ? (
                    <span className="text-xs text-black/40 dark:text-white/40">
                      definición (sin cálculo en vivo)
                    </span>
                  ) : (
                    <span className="text-2xl font-semibold tracking-tight">
                      {fmtValue(v?.value ?? null, m.unit)}
                    </span>
                  )}
                  {!v?.restricted && !v?.definitionOnly && m.unit && m.unit !== 'USD' && m.unit !== '%' && (
                    <span className="pb-1 text-[11px] text-black/40 dark:text-white/40">
                      {m.unit}
                    </span>
                  )}
                </div>
                {m.formula && (
                  <p className="mt-2 text-[11px] leading-snug text-black/45 dark:text-white/45">
                    {m.formula}
                  </p>
                )}
                <p className="mt-1 font-mono text-[10px] text-black/35 dark:text-white/35">
                  {m.key}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Ontología: objetos ── */}
      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Boxes className="h-4 w-4 text-violet-500" /> Objetos del negocio
          <span className="text-black/40 dark:text-white/40">({objects.length})</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {objects.map((o) => (
            <Link
              key={o.key}
              href={`/dashboard/intelligence/object/${o.key}`}
              className={`${glass} block rounded-2xl p-4 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{o.name}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${tint(o.domain)}`}>
                  {o.domain ?? '—'}
                </span>
              </div>
              <p className="font-mono text-[10px] text-black/35 dark:text-white/35">
                {o.key} · {o.sourceEntity}
              </p>
              {o.properties && o.properties.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {o.properties.slice(0, 6).map((p) => (
                    <span
                      key={p.name}
                      className="rounded bg-black/5 px-1.5 py-0.5 text-[10px] text-black/55 dark:bg-white/10 dark:text-white/55"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] font-medium text-violet-500">
                Explorar →
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Ontología: relaciones ── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <GitFork className="h-4 w-4 text-violet-500" /> Relaciones
          <span className="text-black/40 dark:text-white/40">({links.length})</span>
        </h2>
        <div className={`${glass} divide-y divide-black/5 rounded-2xl dark:divide-white/5`}>
          {links.map((l) => (
            <div key={l.key} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <span className="font-medium">{objectByKey[l.fromObject]?.name ?? l.fromObject}</span>
              <span className="text-violet-500">— {l.verb} →</span>
              <span className="font-medium">{objectByKey[l.toObject]?.name ?? l.toObject}</span>
              <span className="ml-auto text-[10px] text-black/40 dark:text-white/40">
                {l.cardinality}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** YYYY-MM-DD → DD/MM for compact axis labels. */
function shortDate(d: string): string {
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
}

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { value: number | string }[];
  labelFormatter?: (label: string) => string;
}

/** Tailwind-styled chart tooltip (readable in light and dark mode). */
function ChartTooltip({ active, payload, label, labelFormatter }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rawLabel = label === undefined ? '' : String(label);
  return (
    <div className="rounded-lg border border-black/10 bg-white/95 px-2.5 py-1.5 text-xs shadow-lg dark:border-white/10 dark:bg-zinc-900/95">
      <p className="font-medium">
        {labelFormatter ? labelFormatter(rawLabel) : rawLabel}
      </p>
      <p className="text-black/60 dark:text-white/60">
        {payload[0].value} eventos
      </p>
    </div>
  );
}

/** A one-line deterministic insight, with a trend arrow when a delta is given. */
function NarrativeCard({ text, delta }: { text: string; delta?: number | null }) {
  const Icon =
    delta === undefined || delta === null
      ? Activity
      : delta > 0
        ? TrendingUp
        : delta < 0
          ? TrendingDown
          : Minus;
  return (
    <div className={`${glass} flex items-start gap-2 rounded-2xl p-3 text-sm`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
      <p className="text-black/70 dark:text-white/70">{text}</p>
    </div>
  );
}
