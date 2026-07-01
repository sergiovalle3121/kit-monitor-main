'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  motion,
  useReducedMotion,
  AnimatePresence,
} from 'framer-motion';
import {
  ChevronLeft,
  Activity,
  AlertTriangle,
  Boxes,
  Factory,
  PackageX,
  Lock,
  Inbox,
  Radio,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useSignals, CorrectiveProposal } from '@/hooks/useSignals';

// Paleta de semáforos (de AXOS_OS_ARCHITECTURE.md)
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';

// ── Tipos defensivos ──────────────────────────────────────────────────
interface ProductionLine {
  id?: number | string;
  kitId?: number;
  name?: string;
  status?: string;
  progress?: number;
  line?: string;
  model?: string;
}
interface Bottleneck {
  line?: string;
  bayId?: number | string;
  reason?: string;
  severity?: string;
}
interface ShortageRow {
  partNumber?: string;
  description?: string;
  shortage?: number;
  severity?: string;
}
interface ExceptionSummary {
  total?: number;
  open?: number;
  bySeverity?: Record<string, number>;
}
interface TrendPoint {
  label?: string;
  date?: string;
  value?: number;
}
interface InventoryPosition {
  id?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────
const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function severityColor(sev?: string): string {
  const s = (sev || '').toLowerCase();
  if (s === 'critical' || s === 'high') return RED;
  if (s === 'medium' || s === 'warning') return AMBER;
  return GREEN;
}

// ── Componentes UI ────────────────────────────────────────────────────
function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
  loading,
  forbidden,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
  loading?: boolean;
  forbidden?: boolean;
}) {
  const toneColor =
    tone === 'green' ? GREEN : tone === 'amber' ? AMBER : tone === 'red' ? RED : undefined;

  return (
    <div className={`${glass} rounded-[24px] p-5`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" strokeWidth={1.5} />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        {forbidden ? (
          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <Lock className="h-3.5 w-3.5" /> Sin acceso
          </span>
        ) : loading ? (
          <span className="block h-8 w-16 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
        ) : (
          <span
            className="text-3xl font-semibold tracking-tight"
            style={toneColor ? { color: toneColor } : undefined}
          >
            {value}
          </span>
        )}
      </div>
      {hint && !loading && !forbidden && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}

function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-200">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-gray-500 dark:text-gray-400">
      <Inbox className="h-6 w-6" strokeWidth={1.5} />
      <p className="text-xs">{message}</p>
    </div>
  );
}

function ForbiddenState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-gray-500 dark:text-gray-400">
      <Lock className="h-6 w-6" strokeWidth={1.5} />
      <p className="text-xs">No tienes permiso para ver esta información.</p>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────
export default function MissionControlPage() {
  const reduce = useReducedMotion();

  const lines = useApi<ProductionLine[] | unknown>('/production-runtime/lines');
  const wip = useApi<unknown>('/production-runtime/wip');
  const bottleneck = useApi<Bottleneck | null>('/production-runtime/bottleneck');
  const shortage = useApi<ShortageRow[] | unknown>('/production-runtime/logistics/shortage-risk');
  const proposalsHistorical = useApi<CorrectiveProposal[] | unknown>('/autopilot/proposals');
  const exceptions = useApi<ExceptionSummary | unknown>('/governance/exceptions/summary');
  const trends = useApi<TrendPoint[] | unknown>('/governance/analytics/trends');
  const inventory = useApi<InventoryPosition[] | unknown>('/inventory/positions');

  const { proposals: liveProposals, criticalEvents, status: socketStatus } = useSignals();

  // ── Derivados ───────────────────────────────────────────────────────
  const linesArr = asArray<ProductionLine>(lines.data);
  const shortageArr = asArray<ShortageRow>(shortage.data);
  const historicalProposals = asArray<CorrectiveProposal>(proposalsHistorical.data);
  const inventoryArr = asArray<InventoryPosition>(inventory.data);

  // WIP total: si el backend devuelve un número, número; si devuelve array, count.
  const wipTotal: number | null = useMemo(() => {
    const d = wip.data;
    if (typeof d === 'number') return d;
    if (Array.isArray(d)) return d.length;
    if (d && typeof d === 'object' && 'total' in (d as Record<string, unknown>)) {
      const t = (d as Record<string, unknown>).total;
      return typeof t === 'number' ? t : null;
    }
    return null;
  }, [wip.data]);

  const exceptionsCount: number | null = useMemo(() => {
    const d = exceptions.data;
    if (d && typeof d === 'object') {
      const r = d as ExceptionSummary;
      if (typeof r.open === 'number') return r.open;
      if (typeof r.total === 'number') return r.total;
    }
    return null;
  }, [exceptions.data]);

  // Mezcla histórico + en vivo, dedupe por id, deja los pending al frente.
  const allProposals = useMemo(() => {
    const map = new Map<string | number, CorrectiveProposal>();
    [...liveProposals, ...historicalProposals].forEach((p) => {
      if (p && p.id != null) map.set(p.id, p);
    });
    return Array.from(map.values())
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })
      .slice(0, 8);
  }, [liveProposals, historicalProposals]);

  const openAlertCount = useMemo(
    () => allProposals.filter((p) => p.status === 'pending').length,
    [allProposals],
  );

  // Semáforo general: rojo si hay críticos/cuello, ámbar si hay alertas
  // pendientes o escasez, verde en otro caso.
  const overall: 'green' | 'amber' | 'red' = useMemo(() => {
    if (criticalEvents.length > 0) return 'red';
    if (bottleneck.data && (bottleneck.data as Bottleneck)?.line) return 'red';
    if (openAlertCount > 0 || shortageArr.length > 0) return 'amber';
    return 'green';
  }, [criticalEvents.length, bottleneck.data, openAlertCount, shortageArr.length]);

  const overallColor = overall === 'red' ? RED : overall === 'amber' ? AMBER : GREEN;
  const overallLabel =
    overall === 'red' ? 'Atención inmediata' : overall === 'amber' ? 'Operación con alertas' : 'Operación estable';

  const bottleneckLine = (bottleneck.data as Bottleneck | null)?.line ?? null;

  // Datos de la gráfica: normaliza /governance/analytics/trends.
  const chartData = useMemo(() => {
    const arr = asArray<TrendPoint>(trends.data);
    return arr
      .map((p) => ({
        label: p.label ?? p.date ?? '',
        value: typeof p.value === 'number' ? p.value : 0,
      }))
      .slice(-20);
  }, [trends.data]);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-8 md:px-10 lg:px-12">
        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              aria-label="Volver al inicio"
              className={`${glass} flex h-10 w-10 items-center justify-center rounded-full hover:scale-105`}
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Mission control
              </p>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">War room</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className={`${glass} flex items-center gap-3 rounded-full px-4 py-2`}>
              <motion.span
                aria-hidden
                className="block h-2.5 w-2.5 rounded-full"
                style={{ background: overallColor }}
                animate={reduce ? undefined : { scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <span className="text-sm font-medium" style={{ color: overallColor }}>
                {overallLabel}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Radio
                  className="h-3 w-3"
                  style={{ color: socketStatus === 'connected' ? GREEN : '#9ca3af' }}
                  strokeWidth={2}
                />
                {socketStatus === 'connected' ? 'en vivo' : 'reconectando'}
              </span>
            </div>
          </div>
        </header>

        {/* ── KPIs ──────────────────────────────────────────────────── */}
        <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          <KpiTile
            icon={Factory}
            label="Líneas activas"
            value={linesArr.length}
            loading={lines.isLoading}
            forbidden={lines.forbidden}
          />
          <KpiTile
            icon={Activity}
            label="WIP total"
            value={wipTotal ?? '—'}
            loading={wip.isLoading}
            forbidden={wip.forbidden}
          />
          <KpiTile
            icon={AlertTriangle}
            label="Alertas abiertas"
            value={openAlertCount}
            tone={openAlertCount > 0 ? 'amber' : 'green'}
            loading={proposalsHistorical.isLoading}
            forbidden={proposalsHistorical.forbidden}
          />
          <KpiTile
            icon={PackageX}
            label="Riesgo de material"
            value={shortageArr.length}
            tone={shortageArr.length > 0 ? 'amber' : 'green'}
            loading={shortage.isLoading}
            forbidden={shortage.forbidden}
          />
          <KpiTile
            icon={Boxes}
            label="Posiciones en inventario"
            value={inventoryArr.length || '—'}
            hint={
              exceptionsCount != null && !exceptions.forbidden
                ? `${exceptionsCount} excepciones abiertas`
                : undefined
            }
            loading={inventory.isLoading}
            forbidden={inventory.forbidden}
          />
        </section>

        {/* ── Paneles ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Líneas de producción */}
          <section className={`${glass} rounded-[24px] p-5 lg:col-span-2`}>
            <PanelHeader
              title="Líneas de producción"
              subtitle={
                bottleneckLine
                  ? `Cuello de botella: ${bottleneckLine}`
                  : 'Estado por línea, actualización cada 20 s'
              }
            />
            {lines.forbidden ? (
              <ForbiddenState />
            ) : lines.isLoading ? (
              <SkeletonRows />
            ) : linesArr.length === 0 ? (
              <EmptyState message="Sin líneas reportadas." />
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {linesArr.slice(0, 12).map((l, i) => {
                  const lineId = l.line || l.name || `Línea ${l.kitId ?? l.id ?? i}`;
                  const isBottleneck = bottleneckLine && lineId === bottleneckLine;
                  return (
                    <li
                      key={`${lineId}-${i}`}
                      className="flex items-center justify-between rounded-2xl bg-black/5 px-3 py-2 dark:bg-white/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{lineId}</p>
                        {l.model && (
                          <p className="truncate text-xs text-gray-500">{l.model}</p>
                        )}
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: isBottleneck ? `${RED}1a` : `${GREEN}1a`,
                          color: isBottleneck ? RED : GREEN,
                        }}
                      >
                        {isBottleneck ? 'cuello de botella' : l.status || 'activa'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Alertas en vivo */}
          <section className={`${glass} rounded-[24px] p-5`}>
            <PanelHeader
              title="Alertas en vivo"
              subtitle={`${openAlertCount} pendiente${openAlertCount === 1 ? '' : 's'}`}
            />
            {proposalsHistorical.forbidden ? (
              <ForbiddenState />
            ) : proposalsHistorical.isLoading && allProposals.length === 0 ? (
              <SkeletonRows count={3} />
            ) : allProposals.length === 0 ? (
              <EmptyState message="Sin alertas activas." />
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {allProposals.map((p) => (
                    <motion.li
                      key={p.id}
                      layout
                      initial={reduce ? undefined : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl bg-black/5 px-3 py-2 dark:bg-white/5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: severityColor(p.severity) }}
                        />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {p.title || p.category || 'Alerta'}
                        </p>
                        <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {p.status}
                        </span>
                      </div>
                      {p.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">{p.description}</p>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>

          {/* Riesgo de material */}
          <section className={`${glass} rounded-[24px] p-5 lg:col-span-2`}>
            <PanelHeader title="Riesgo de material" subtitle="Componentes con riesgo de escasez" />
            {shortage.forbidden ? (
              <ForbiddenState />
            ) : shortage.isLoading ? (
              <SkeletonRows />
            ) : shortageArr.length === 0 ? (
              <EmptyState message="Sin riesgos de escasez reportados." />
            ) : (
              <ul className="space-y-2">
                {shortageArr.slice(0, 8).map((row, i) => (
                  <li
                    key={`${row.partNumber}-${i}`}
                    className="flex items-center justify-between rounded-2xl bg-black/5 px-3 py-2 dark:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {row.partNumber || 'Parte sin nombre'}
                      </p>
                      {row.description && (
                        <p className="truncate text-xs text-gray-500">{row.description}</p>
                      )}
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: `${severityColor(row.severity)}1a`,
                        color: severityColor(row.severity),
                      }}
                    >
                      {row.severity || 'riesgo'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Tendencia */}
          <section className={`${glass} rounded-[24px] p-5`}>
            <PanelHeader title="Tendencia" subtitle="Gobernanza · últimos puntos" />
            {trends.forbidden ? (
              <ForbiddenState />
            ) : trends.isLoading ? (
              <div className="h-44 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" />
            ) : chartData.length === 0 ? (
              <EmptyState message="Sin datos de tendencia." />
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="rgba(120,120,120,0.6)" />
                    <YAxis tick={{ fontSize: 10 }} stroke="rgba(120,120,120,0.6)" />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255,255,255,0.95)',
                        border: 'none',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke={GREEN} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="h-10 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5"
        />
      ))}
    </ul>
  );
}
