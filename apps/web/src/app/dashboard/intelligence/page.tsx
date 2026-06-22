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
} from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [c, v] = await Promise.all([
          fetch('/api/semantic/catalog', { cache: 'no-store' }),
          fetch('/api/semantic/values', { cache: 'no-store' }),
        ]);
        if (c.ok) setCatalog(await c.json());
        if (v.ok) {
          const rows: MetricValue[] = await v.json();
          setValues(Object.fromEntries(rows.map((r) => [r.key, r])));
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
            Capa semántica · catálogo de métricas y ontología del negocio
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
            <div key={o.key} className={`${glass} rounded-2xl p-4`}>
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
            </div>
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
