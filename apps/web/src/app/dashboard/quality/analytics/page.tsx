'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Lock, Inbox, FlaskConical, BarChart3, TrendingUp, Boxes, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import {
  Toolbar, KpiRow, FilterBar, ExportButton,
  DetailDrawer, DrawerSection,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';
import type { Ncr, NcrSeverity, NcrSourceType, TestingKpis } from '../quality.types';
import {
  deriveNcrKpis, paretoByCategory, paretoFromBuckets,
  NCR_SEVERITY_META, NCR_STATUS_META, NCR_SOURCE_META,
  type ParetoRow,
} from '../quality.utils';

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const VIOLET = '#7c3aed';
const GRAY = '#6b7280';

type Source = 'test' | 'ncr';

const PERIODS: Record<string, number> = { '30': 30, '90': 90, '180': 180, '365': 365 };

function inPeriod(iso: string, days?: number): boolean {
  if (!days) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 86_400_000;
}
function monthKey(iso: string): string {
  return iso ? iso.slice(0, 7) : '';
}
function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return m ? `${months[Number(m) - 1]} ${y.slice(2)}` : key;
}

interface GroupRow { key: string; label: string; count: number }
function groupCount(rows: Ncr[], get: (n: Ncr) => string, labelOf?: (k: string) => string): GroupRow[] {
  const m = new Map<string, number>();
  for (const n of rows) {
    const k = (get(n) || '—').trim() || '—';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, label: labelOf ? labelOf(key) : key, count }))
    .sort((a, b) => b.count - a.count);
}

export default function QualityAnalyticsPage() {
  const { data: kpis, forbidden: testForbidden } = useApi<TestingKpis>('/testing/kpis');
  const { data: ncrData } = useApi<Ncr[]>('/ncr');
  const allNcrs = useMemo(() => (Array.isArray(ncrData) ? ncrData : []), [ncrData]);

  const [filters, setFilters] = useState<FilterValues>({ period: '365' });
  const [source, setSource] = useState<Source | null>(null);
  const [drill, setDrill] = useState<{ title: string; rows: Ncr[] } | null>(null);

  const models = useMemo(() => Array.from(new Set(allNcrs.map((n) => n.model).filter(Boolean) as string[])).sort(), [allNcrs]);

  const ncrs = useMemo(() => {
    const days = PERIODS[(filters.period as string) || ''] ?? undefined;
    const model = filters.model as string | undefined;
    const src = filters.source as string | undefined;
    return allNcrs.filter((n) => {
      if (!inPeriod(n.createdAt, days)) return false;
      if (model && n.model !== model) return false;
      if (src && n.sourceType !== src) return false;
      return true;
    });
  }, [allNcrs, filters]);

  const ncrKpis = useMemo(() => deriveNcrKpis(ncrs), [ncrs]);
  const affected = useMemo(() => ncrs.reduce((a, n) => a + (n.quantityAffected || 0), 0), [ncrs]);

  const testPareto = useMemo<ParetoRow[]>(() => (kpis?.pareto ? paretoFromBuckets(kpis.pareto) : []), [kpis]);
  const ncrPareto = useMemo<ParetoRow[]>(() => paretoByCategory(ncrs), [ncrs]);
  const byModel = useMemo(() => groupCount(ncrs, (n) => n.model || 'Sin modelo').slice(0, 8), [ncrs]);
  const bySource = useMemo(() => groupCount(ncrs, (n) => n.sourceType, (k) => NCR_SOURCE_META[k as NcrSourceType] ?? k).slice(0, 8), [ncrs]);

  const trend = useMemo(() => {
    const m = new Map<string, { count: number; affected: number }>();
    for (const n of ncrs) {
      const k = monthKey(n.createdAt);
      if (!k) continue;
      const cur = m.get(k) ?? { count: 0, affected: 0 };
      cur.count += 1; cur.affected += n.quantityAffected || 0;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: monthLabel(k), count: v.count, affected: v.affected }));
  }, [ncrs]);

  const effectiveSource: Source = source ?? (testPareto.length > 0 ? 'test' : 'ncr');
  const pareto = effectiveSource === 'test' ? testPareto : ncrPareto;
  const accent = effectiveSource === 'test' ? RED : AMBER;

  const fpy = kpis?.firstPassYieldPct;
  const yld = kpis?.yieldPct;

  const kpiItems: StatCardProps[] = [
    { label: 'First-Pass Yield', value: testForbidden || fpy == null ? '—' : `${fpy}%`, sublabel: kpis ? `${kpis.distinctSerials} series` : undefined, color: fpy != null && fpy >= 95 ? GREEN : AMBER, icon: TrendingUp },
    { label: 'Yield total', value: testForbidden || yld == null ? '—' : `${yld}%`, sublabel: kpis ? `${kpis.totalTests} pruebas` : undefined, color: GREEN, icon: BarChart3 },
    { label: 'Fallas de prueba', value: testForbidden ? '—' : kpis?.fail ?? 0, color: (kpis?.fail ?? 0) > 0 ? RED : GREEN, icon: FlaskConical },
    { label: 'NCR abiertas', value: ncrKpis.open, sublabel: `${ncrKpis.critical} críticas`, color: ncrKpis.critical > 0 ? RED : GRAY, icon: Inbox },
    { label: 'Pzas afectadas', value: affected.toLocaleString(), sublabel: `${ncrs.length} NCR en periodo`, color: VIOLET, icon: Boxes },
  ];

  const FILTER_DEFS: FilterDef[] = [
    { key: 'period', type: 'select', label: 'Periodo', options: [
      { value: '30', label: 'Últimos 30 días' }, { value: '90', label: 'Últimos 90 días' },
      { value: '180', label: 'Últimos 180 días' }, { value: '365', label: 'Último año' },
    ] },
    ...(models.length ? [{ key: 'model', type: 'select' as const, label: 'Modelo', options: models.map((m) => ({ value: m, label: m })) }] : []),
    { key: 'source', type: 'select', label: 'Origen', options: (Object.keys(NCR_SOURCE_META) as NcrSourceType[]).map((s) => ({ value: s, label: NCR_SOURCE_META[s] })) },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 text-black md:px-8 dark:text-white">
      <Link href="/dashboard/quality" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200">
        <ChevronLeft className="h-4 w-4" /> Calidad · NCR
      </Link>

      <Toolbar
        domain="quality"
        icon={BarChart3}
        title="Calidad · Analítica"
        subtitle="Yield, First-Pass Yield, Pareto de defectos y tendencia — datos reales"
        right={
          <Link href="/dashboard/test-engineering" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10" title="Capturar resultados de prueba (pass/fail)">
            <FlaskConical className="h-4 w-4" /> Captura de pruebas
          </Link>
        }
      >
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto">
          <ExportButton<Ncr> rows={ncrs} columns={NCR_EXPORT} filename="calidad-ncr" />
        </div>
      </Toolbar>

      <div className="mb-4">
        <KpiRow items={kpiItems} columns={5} />
      </div>

      {testForbidden && (
        <div className={`${glass} mb-4 flex items-center gap-2 rounded-2xl p-4 text-sm text-gray-500`}>
          <Lock className="h-4 w-4 text-gray-400" /> Inicia sesión con permisos de calidad para ver yields y el Pareto de fallas de prueba. El Pareto de NCR sigue disponible.
        </div>
      )}

      {/* Pareto */}
      <div className={`${glass} mb-4 rounded-2xl p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" style={{ color: accent }} /> Pareto de defectos</h3>
          <div className="inline-flex rounded-xl bg-black/5 p-0.5 text-[13px] dark:bg-white/10">
            <Toggle active={effectiveSource === 'test'} onClick={() => setSource('test')} disabled={testPareto.length === 0}>Fallas de prueba</Toggle>
            <Toggle active={effectiveSource === 'ncr'} onClick={() => setSource('ncr')} disabled={ncrPareto.length === 0}>Categorías NCR</Toggle>
          </div>
        </div>

        {pareto.length === 0 ? (
          <Empty body={effectiveSource === 'test'
            ? 'Aún no hay fallas de prueba capturadas en el periodo. Captura resultados FAIL para ver los códigos de falla dominantes.'
            : 'Aún no hay NCRs con categoría en el periodo. Levanta no-conformidades para ver las categorías de defecto dominantes.'} />
        ) : (
          <ParetoChart
            rows={pareto}
            accent={accent}
            onPick={effectiveSource === 'ncr' ? (label) => setDrill({ title: `Categoría · ${label}`, rows: ncrs.filter((n) => (n.category || 'Sin categoría') === label) }) : undefined}
          />
        )}
      </div>

      {/* Tendencia */}
      <div className={`${glass} mb-4 rounded-2xl p-5`}>
        <h3 className="mb-1 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4" style={{ color: VIOLET }} /> Tendencia de no-conformidades</h3>
        <p className="mb-4 text-[12px] text-gray-400">NCRs levantadas y piezas afectadas por mes en el periodo seleccionado.</p>
        {trend.length === 0 ? (
          <Empty body="Sin NCRs en el periodo para trazar una tendencia." />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
                <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.3)', fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="count" name="NCRs" fill={AMBER} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="affected" name="Pzas afectadas" stroke={VIOLET} strokeWidth={2} dot={{ r: 3, fill: VIOLET }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Breakdown
          title="Top defectos por modelo"
          icon={Boxes}
          rows={byModel}
          accent={VIOLET}
          onPick={(g) => setDrill({ title: `Modelo · ${g.label}`, rows: ncrs.filter((n) => (n.model || 'Sin modelo') === g.key) })}
        />
        <Breakdown
          title="Por origen del defecto"
          icon={BarChart3}
          rows={bySource}
          accent={AMBER}
          onPick={(g) => setDrill({ title: `Origen · ${g.label}`, rows: ncrs.filter((n) => n.sourceType === g.key) })}
        />
      </div>

      {/* Drill-down */}
      <DetailDrawer
        open={drill !== null}
        onClose={() => setDrill(null)}
        icon={BarChart3}
        accent={VIOLET}
        width={560}
        title={drill?.title ?? 'Detalle'}
        subtitle={drill ? `${drill.rows.length} no-conformidad(es)` : undefined}
      >
        {drill && (
          <DrawerSection title="No-conformidades">
            {drill.rows.length === 0 ? (
              <p className="text-sm text-gray-400">Sin NCRs para este corte.</p>
            ) : (
              <div className="space-y-2">
                {drill.rows.map((n) => {
                  const sev = NCR_SEVERITY_META[n.severity as NcrSeverity];
                  const st = NCR_STATUS_META[n.status];
                  return (
                    <Link key={n.id} href="/dashboard/quality" className={`${glass} flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]`}>
                      <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{n.ncrNumber}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{n.description || n.category}</div>
                        <div className="truncate text-[12px] text-gray-400">{n.partNumber}{n.model ? ` · ${n.model}` : ''} · {n.quantityAffected} pzas</div>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${sev.color}1f`, color: sev.color }}>{sev.label}</span>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${st.color}1f`, color: st.color }}>{st.label}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </Link>
                  );
                })}
              </div>
            )}
          </DrawerSection>
        )}
      </DetailDrawer>
    </div>
  );
}

const NCR_EXPORT: ExportColumn<Ncr>[] = [
  { key: 'ncrNumber', header: 'NCR' },
  { key: 'status', header: 'Estado', value: (n) => NCR_STATUS_META[n.status]?.label ?? n.status },
  { key: 'severity', header: 'Severidad', value: (n) => NCR_SEVERITY_META[n.severity as NcrSeverity]?.label ?? n.severity },
  { key: 'category', header: 'Categoría' },
  { key: 'partNumber', header: 'Parte' },
  { key: 'model', header: 'Modelo' },
  { key: 'sourceType', header: 'Origen', value: (n) => NCR_SOURCE_META[n.sourceType] ?? n.sourceType },
  { key: 'quantityAffected', header: 'Pzas afectadas' },
  { key: 'customer', header: 'Cliente' },
  { key: 'createdAt', header: 'Fecha', value: (n) => (n.createdAt ? n.createdAt.slice(0, 10) : '') },
];

function ParetoChart({ rows, accent, onPick }: { rows: ParetoRow[]; accent: string; onPick?: (label: string) => void }) {
  const data = rows.map((r) => ({ label: r.label, count: r.count, cum: r.cumPct }));
  // recharts tipa onClick con su estado interno; acotamos el escape a este punto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePick = onPick ? (s: any) => { if (s?.activeLabel) onPick(s.activeLabel as string); } : undefined;
  return (
    <>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: -12, bottom: 28 }}
            onClick={handlePick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} stroke="rgba(148,163,184,0.6)" />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" stroke="rgba(148,163,184,0.6)" />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.3)', fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="count" name="Cantidad" radius={[4, 4, 0, 0]} className={onPick ? 'cursor-pointer' : ''}>
              {data.map((_, i) => <Cell key={i} fill={accent} fillOpacity={0.85 - Math.min(i, 6) * 0.07} />)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cum" name="% acumulado" unit="%" stroke={VIOLET} strokeWidth={2} dot={{ r: 3, fill: VIOLET }} />
            <ReferenceLine yAxisId="right" y={80} stroke={RED} strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: RED }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[12px] text-gray-400">
        Regla 80/20: los defectos a la izquierda de donde la línea cruza el 80% son los pocos vitales.{onPick ? ' Haz clic en una barra para ver sus NCRs.' : ''}
      </p>
    </>
  );
}

function Breakdown({ title, icon: Icon, rows, accent, onPick }: { title: string; icon: typeof Boxes; rows: GroupRow[]; accent: string; onPick: (g: GroupRow) => void }) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <div className={`${glass} rounded-2xl p-5`}>
      <h3 className="mb-4 flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" style={{ color: accent }} /> {title}</h3>
      {rows.length === 0 ? (
        <Empty body="Sin datos en el periodo." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button key={r.key} type="button" onClick={() => onPick(r)} className="group flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <span className="w-32 shrink-0 truncate text-[13px] font-medium" title={r.label}>{r.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: accent }} />
              </div>
              <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: accent }}>{r.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ body }: { body: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Inbox className="mb-3 h-6 w-6 text-gray-300" />
      <p className="max-w-sm text-sm text-gray-400">{body}</p>
    </div>
  );
}

function Toggle({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-1.5 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-white shadow-sm dark:bg-white/15' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-200'}`}>
      {children}
    </button>
  );
}
