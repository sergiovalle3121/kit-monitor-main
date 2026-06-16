'use client';

/**
 * Inteligencia de Costos (Bloque M) — el puente vivo piso↔dinero.
 *
 * Cablea las rutas reales del backend `cost-intelligence`:
 *   GET /cost-intelligence/cogs?woId=            → COGS en vivo de una WO
 *   GET /cost-intelligence/cogs/program?programId= → COGS agregado del programa
 *   GET /cost-intelligence/variance?woId=        → variancia de uso + scrap
 *   GET /cost-intelligence/snapshots/kpis        → roll-up de cierre congelado
 *   GET /cost-intelligence/snapshots             → histórico de cierres
 *
 * El COGS se calcula desde el consumo del piso (backflush), el ruteo de línea
 * (BOM) y los holds de calidad contra costo estándar. Esta página SÓLO lee:
 * el cierre de periodo (POST) vive en el backend y no se toca desde aquí.
 * Estado vacío honesto donde no hay dato — no se inventa un $0 como si fuera real.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, Loader2, Lock, Inbox, Search, X, Factory, Boxes, Users, Zap,
  Wallet, Scale, AlertTriangle, ChevronRight, Gauge, PackageX, Layers,
  TrendingUp, TrendingDown, Coins, CalendarClock, Archive, CircleDashed,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { containerRM, itemRM } from '@/lib/motion';
import { useApi } from '@/hooks/useApi';
import { PageHeader } from '@/components/ui/PageHeader';

// ── Tipos (espejo de los contratos del backend cost-intelligence) ────────────
type LaborSource = 'ROLLUP_ACTUAL' | 'STANDARD_TIME_ESTIMATE';
type OverheadSource = 'ROLLUP_ACTUAL' | 'RATE_ABSORPTION';

interface WoCogs {
  woId: string; woFolio: string | null; model: string; line: string;
  programId: string | null; customer: string | null; status: string;
  quantityPlanned: number; quantityCompleted: number;
  materialCost: number; laborCost: number; laborSource: LaborSource;
  overheadCost: number; overheadSource: OverheadSource;
  cogs: number; unitCost: number; standardLaborHours: number;
  laborRate: number; overheadRate: number; currency: string;
}

interface ProgramTotals {
  count: number; quantityPlanned: number; quantityCompleted: number;
  materialCost: number; laborCost: number; overheadCost: number;
  cogs: number; unitCost: number;
}
interface ProgramCogs {
  programId: string; workOrders: WoCogs[]; totals: ProgramTotals; currency: string;
}

interface PartVariance {
  part: string; plannedQty: number; actualQty: number; standardCost: number;
  plannedCost: number; actualCost: number; usageVariance: number; qtyVariance: number;
}
interface WoVariance {
  woId: string; woFolio: string | null; model: string; programId: string | null;
  quantityPlanned: number; quantityCompleted: number;
  materialPlanCost: number; materialActualCost: number; materialUsageVariance: number;
  usageVariancePct: number; scrapQty: number; scrapCost: number; totalVariance: number;
  byPart: PartVariance[]; currency: string;
}

interface SnapshotKpis {
  period: string | null; snapshots: number; cogs: number; materialActualCost: number;
  materialUsageVariance: number; laborCost: number; overheadCost: number; scrapCost: number;
  unitsCompleted: number; avgUnitCost: number; currency: string;
}
interface Snapshot {
  id: string; period: string; woId: string; woFolio: string | null;
  model: string | null; line: string | null; programId: string | null;
  woStatus: string | null; quantityCompleted: number;
  materialUsageVariance: number; scrapCost: number; cogs: number; unitCost: number;
  currency: string; closedBy: string | null; closedAt: string | null;
}

// `/production-plan` devuelve la WO completa; aquí sólo necesitamos lo del picker.
interface WoLite {
  id: string; folio: string | null; model: string; line: string; status: string;
  programId?: string | null; quantityPlanned: number; quantityCompleted: number;
}

// ── Formato ──────────────────────────────────────────────────────────────────
function money(n: number | null | undefined, currency = 'USD'): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
}
function num(n: number | null | undefined, dp = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: dp }).format(Number(n ?? 0));
}
function signedPct(frac: number | null | undefined): string {
  const v = Number(frac ?? 0) * 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-MX', { year: 'numeric', month: 'short', day: '2-digit' }).format(d);
}

const STATUS_LABEL: Record<string, string> = {
  RELEASED: 'Liberado', STAGED: 'Montado', IN_EXECUTION: 'En ejecución',
  COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};

const C_MATERIAL = '#10b981';
const C_LABOR = '#f59e0b';
const C_OVERHEAD = '#8b5cf6';
const C_COGS = '#0fb39a';
const C_BAD = '#ef4444';
const C_GOOD = '#10b981';

// ── Piezas de UI ─────────────────────────────────────────────────────────────
function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className={`${glass} rounded-3xl flex flex-col items-center text-center py-14 px-6`}>
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{body}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-16 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  );
}

function Forbidden() {
  return (
    <Empty
      icon={<Lock className="w-6 h-6" />}
      title="Sin acceso al costeo"
      body="Esta vista requiere el permiso finance:read. Pide a un administrador que lo habilite para ver COGS, variancia y cierres."
    />
  );
}

function StatTile({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className={`${glass} rounded-3xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={1.75} />
      </div>
      <div className="text-2xl md:text-3xl font-bold tracking-tight tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function SourceBadge({ kind }: { kind: LaborSource | OverheadSource }) {
  const real = kind === 'ROLLUP_ACTUAL';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        real
          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
          : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300'
      }`}
      title={
        real
          ? 'Costo real tomado del rollup de costos.'
          : kind === 'STANDARD_TIME_ESTIMATE'
            ? 'Estimado: horas estándar ganadas × tarifa de mano de obra.'
            : 'Absorción: tasa de overhead aplicada sobre (material + mano de obra).'
      }
    >
      {real ? 'real' : kind === 'STANDARD_TIME_ESTIMATE' ? 'estimado' : 'absorción'}
    </span>
  );
}

function BreakdownRow({
  label, amount, total, color, icon: Icon, reduce,
}: {
  label: string; amount: number; total: number; color: string; icon: React.ElementType; reduce: boolean | null;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Icon className="w-4 h-4" style={{ color }} strokeWidth={1.75} /> {label}
        </span>
        <span className="text-right">
          <span className="text-sm font-semibold tabular-nums">{money(amount)}</span>
          <span className="ml-2 text-xs text-gray-400 tabular-nums">{pct.toFixed(1)}%</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', damping: 22, stiffness: 120 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function BreakdownCard({
  material, labor, overhead, cogs, reduce,
}: {
  material: number; labor: number; overhead: number; cogs: number; reduce: boolean | null;
}) {
  return (
    <div className={`${glass} rounded-3xl p-5 space-y-4`}>
      <h3 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">Composición del COGS</h3>
      <BreakdownRow label="Material" amount={material} total={cogs} color={C_MATERIAL} icon={Boxes} reduce={reduce} />
      <BreakdownRow label="Mano de obra" amount={labor} total={cogs} color={C_LABOR} icon={Users} reduce={reduce} />
      <BreakdownRow label="Overhead" amount={overhead} total={cogs} color={C_OVERHEAD} icon={Zap} reduce={reduce} />
    </div>
  );
}

function VarianceNumber({ value, currency }: { value: number; currency: string }) {
  const color = value > 0 ? C_BAD : value < 0 ? C_GOOD : '#6b7280';
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : CircleDashed;
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums" style={{ color }}>
      <Icon className="w-4 h-4" strokeWidth={2} />
      {value > 0 ? '+' : ''}{money(value, currency)}
    </span>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function CostIntelligencePage() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'wo' | 'program'>('wo');
  const [woId, setWoId] = useState('');
  const [programId, setProgramId] = useState('');
  const [query, setQuery] = useState('');

  // Cierre de periodo (sección independiente).
  const [period, setPeriod] = useState('');
  const [closingProgram, setClosingProgram] = useState('');

  // Catálogo para los selectores (WOs y programas) desde el plan de producción.
  const { data: woData, isLoading: woLoading } = useApi<WoLite[]>('/production-plan', { refreshInterval: 60000 });
  const wos = useMemo(() => (Array.isArray(woData) ? woData : []), [woData]);

  const programs = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of wos) {
      const p = (w.programId ?? '').trim();
      if (p) map.set(p, (map.get(p) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([id, count]) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id));
  }, [wos]);

  const filteredWos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? wos.filter((w) =>
          [w.folio, w.model, w.line, w.programId, w.id].some((f) => (f ?? '').toLowerCase().includes(q)))
      : wos;
    return base.slice(0, 60);
  }, [wos, query]);

  const selectedWo = useMemo(() => wos.find((w) => w.id === woId) ?? null, [wos, woId]);

  // Datos vivos (sólo se piden cuando hay selección).
  const enc = encodeURIComponent;
  const cogsWo = useApi<WoCogs>(mode === 'wo' && woId ? `/cost-intelligence/cogs?woId=${enc(woId)}` : null);
  const cogsProg = useApi<ProgramCogs>(
    mode === 'program' && programId ? `/cost-intelligence/cogs/program?programId=${enc(programId)}` : null,
  );
  const variance = useApi<WoVariance>(mode === 'wo' && woId ? `/cost-intelligence/variance?woId=${enc(woId)}` : null);

  // Cierre de periodo (siempre se piden; los filtros son opcionales).
  const closingQs = useMemo(() => {
    const p = new URLSearchParams();
    if (period) p.set('period', period);
    if (closingProgram) p.set('programId', closingProgram);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [period, closingProgram]);
  const kpis = useApi<SnapshotKpis>(`/cost-intelligence/snapshots/kpis${closingQs}`);
  const snaps = useApi<Snapshot[]>(`/cost-intelligence/snapshots${closingQs}`);
  const snapshots = useMemo(() => (Array.isArray(snaps.data) ? snaps.data : []), [snaps.data]);

  function pickWo(id: string) {
    setWoId(id);
    setMode('wo');
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <PageHeader
          domain="finance"
          title="Inteligencia de Costos"
          subtitle="COGS y variancia en vivo desde el piso · uso de material, scrap y cierre de periodo"
          icon={Gauge}
          right={
            <Link
              href="/dashboard/finance"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4" /> Finanzas
            </Link>
          }
        />

        <p className="text-sm text-gray-500 dark:text-gray-400 -mt-3 mb-6 max-w-3xl">
          El costo se calcula en vivo desde el consumo del piso (backflush), el ruteo de línea (BOM) y los holds de
          calidad contra costo estándar. Cuando aún no hay consumo registrado, se muestra el estado vacío — no un $0 falso.
        </p>

        {/* ── Selector de alcance ─────────────────────────────────────────── */}
        <section className={`${glass} rounded-3xl p-4 mb-8`}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex rounded-full bg-gray-100 dark:bg-white/10 p-1">
              {(['wo', 'program'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    mode === m ? 'bg-white dark:bg-white/15 shadow-sm text-black dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {m === 'wo' ? 'Por orden (WO)' : 'Por programa'}
                </button>
              ))}
            </div>
            {mode === 'wo' && selectedWo && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-3 py-1.5 text-sm font-medium">
                {selectedWo.folio ?? selectedWo.id.slice(0, 8)} · {selectedWo.model}
                <button onClick={() => setWoId('')} aria-label="Quitar selección"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
            {mode === 'program' && programId && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-3 py-1.5 text-sm font-medium">
                {programId}
                <button onClick={() => setProgramId('')} aria-label="Quitar selección"><X className="w-3.5 h-3.5" /></button>
              </span>
            )}
          </div>

          {mode === 'wo' ? (
            <>
              <div className="flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 px-3 py-2">
                <Search className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca por folio, modelo, línea o programa…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
                {query && <button onClick={() => setQuery('')} aria-label="Limpiar"><X className="w-4 h-4 text-gray-400" /></button>}
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto pr-1 -mr-1">
                {woLoading ? (
                  <Loading />
                ) : filteredWos.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">No hay órdenes que coincidan.</p>
                ) : (
                  <div className="space-y-1">
                    {filteredWos.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => pickWo(w.id)}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                          w.id === woId ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate">{w.folio ?? w.id.slice(0, 8)} · {w.model}</span>
                          <span className="block text-[11px] text-gray-400 truncate">
                            {w.line}{w.programId ? ` · ${w.programId}` : ''} · {w.quantityCompleted}/{w.quantityPlanned} u
                          </span>
                        </span>
                        <span className="text-[11px] text-gray-400 shrink-0">{STATUS_LABEL[w.status] ?? w.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : programs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              {woLoading ? 'Cargando…' : 'Ninguna orden tiene programa asignado todavía.'}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {programs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProgramId(p.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    p.id === programId
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" /> {p.id}
                  <span className={`text-[11px] ${p.id === programId ? 'text-white/80' : 'text-gray-400'}`}>{p.count}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── COGS + Variancia ────────────────────────────────────────────── */}
        {mode === 'wo' ? (
          <WoView cogs={cogsWo} variance={variance} reduce={reduce} hasSelection={Boolean(woId)} />
        ) : (
          <ProgramView cogs={cogsProg} reduce={reduce} hasSelection={Boolean(programId)} onDrill={pickWo} />
        )}

        {/* ── KPIs de cierre ──────────────────────────────────────────────── */}
        <ClosingSection
          kpis={kpis}
          snapshots={snapshots}
          snapsState={snaps}
          reduce={reduce}
          period={period}
          setPeriod={setPeriod}
          programs={programs}
          closingProgram={closingProgram}
          setClosingProgram={setClosingProgram}
        />
      </main>
    </div>
  );
}

// ── Vista por WO ──────────────────────────────────────────────────────────────
type ApiState<T> = { data?: T; isLoading: boolean; forbidden: boolean };

function WoView({
  cogs, variance, reduce, hasSelection,
}: {
  cogs: ApiState<WoCogs>; variance: ApiState<WoVariance>; reduce: boolean | null; hasSelection: boolean;
}) {
  if (!hasSelection) {
    return (
      <Empty
        icon={<Factory className="w-6 h-6" />}
        title="Elige una orden de trabajo"
        body="Selecciona una WO arriba para ver su COGS en vivo (material + mano de obra + overhead) y su variancia de uso de material contra el plan."
      />
    );
  }
  if (cogs.forbidden) return <Forbidden />;
  if (cogs.isLoading && !cogs.data) return <Loading />;
  if (!cogs.data) {
    return <Empty icon={<Inbox className="w-6 h-6" />} title="Sin datos" body="No se pudo calcular el COGS de esta orden." />;
  }

  const c = cogs.data;
  const noFloor = c.materialCost === 0 && c.laborCost === 0 && c.overheadCost === 0;

  return (
    <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="space-y-6 mb-10">
      <motion.div variants={itemRM(reduce)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="COGS total" value={money(c.cogs, c.currency)} sub={`${STATUS_LABEL[c.status] ?? c.status} · ${c.model}`} icon={Wallet} color={C_COGS} />
        <StatTile label="Costo unitario" value={c.unitCost > 0 ? money(c.unitCost, c.currency) : '—'} sub={c.quantityCompleted > 0 ? `${num(c.quantityCompleted, 0)} u completadas` : 'Sin unidades completadas'} icon={Coins} color="#3b82f6" />
        <StatTile label="Avance" value={`${num(c.quantityCompleted, 0)}/${num(c.quantityPlanned, 0)}`} sub="completadas / planeadas" icon={Factory} color="#7c3aed" />
      </motion.div>

      {noFloor ? (
        <motion.div variants={itemRM(reduce)}>
          <Empty
            icon={<PackageX className="w-6 h-6" />}
            title="Aún sin consumo en el piso"
            body="Esta orden no tiene backflush ni costos registrados todavía, así que su COGS es genuinamente $0. Conforme los operadores confirmen unidades, el costo se moverá en vivo aquí."
          />
        </motion.div>
      ) : (
        <motion.div variants={itemRM(reduce)} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakdownCard material={c.materialCost} labor={c.laborCost} overhead={c.overheadCost} cogs={c.cogs} reduce={reduce} />
          <div className={`${glass} rounded-3xl p-5`}>
            <h3 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-3">Detalle de costeo</h3>
            <dl className="space-y-2.5 text-sm">
              <Detail term="Mano de obra">
                <span className="tabular-nums">{money(c.laborCost, c.currency)}</span> <SourceBadge kind={c.laborSource} />
              </Detail>
              <Detail term="Overhead">
                <span className="tabular-nums">{money(c.overheadCost, c.currency)}</span> <SourceBadge kind={c.overheadSource} />
              </Detail>
              <Detail term="Horas estándar ganadas">{num(c.standardLaborHours)} h</Detail>
              <Detail term="Tarifa MO / overhead">{money(c.laborRate, c.currency)}/h · {(c.overheadRate * 100).toFixed(0)}%</Detail>
              {c.programId && <Detail term="Programa">{c.programId}</Detail>}
              {c.customer && <Detail term="Cliente">{c.customer}</Detail>}
              <Detail term="Línea">{c.line}</Detail>
            </dl>
          </div>
        </motion.div>
      )}

      {/* Variancia */}
      <motion.div variants={itemRM(reduce)}>
        <VariancePanel state={variance} />
      </motion.div>
    </motion.div>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400">{term}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function VariancePanel({ state }: { state: ApiState<WoVariance> }) {
  if (state.forbidden) return <Forbidden />;
  if (state.isLoading && !state.data) return <Loading />;
  const v = state.data;
  if (!v) return null;

  const noBasis = v.materialPlanCost === 0 && v.materialActualCost === 0 && v.byPart.length === 0 && v.scrapCost === 0;
  if (noBasis) {
    return (
      <Empty
        icon={<Scale className="w-6 h-6" />}
        title="Sin base para la variancia"
        body="Todavía no hay BOM (ruteo de línea) ni consumo registrado para esta orden, así que no hay plan ni real que comparar."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">Variancia de uso de material + scrap</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${glass} rounded-3xl p-5`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Plan vs real</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">Plan {money(v.materialPlanCost, v.currency)}</div>
          <div className="text-sm font-semibold tabular-nums">Real {money(v.materialActualCost, v.currency)}</div>
        </div>
        <div className={`${glass} rounded-3xl p-5`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Variancia de uso</div>
          <div className="text-lg"><VarianceNumber value={v.materialUsageVariance} currency={v.currency} /></div>
          <div className="text-xs text-gray-400 mt-1 tabular-nums">{signedPct(v.usageVariancePct)} vs plan</div>
        </div>
        <div className={`${glass} rounded-3xl p-5`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Scrap</div>
          <div className="text-lg font-semibold tabular-nums" style={{ color: v.scrapCost > 0 ? C_BAD : '#6b7280' }}>{money(v.scrapCost, v.currency)}</div>
          <div className="text-xs text-gray-400 mt-1 tabular-nums">{num(v.scrapQty)} u en holds</div>
        </div>
        <div className={`${glass} rounded-3xl p-5`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Variancia total</div>
          <div className="text-lg"><VarianceNumber value={v.totalVariance} currency={v.currency} /></div>
          <div className="text-xs text-gray-400 mt-1">uso + scrap</div>
        </div>
      </div>

      {v.byPart.length > 0 && (
        <div className={`${glass} rounded-3xl p-2`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Parte</th>
                  <th className="px-3 py-2 text-right font-medium">Plan (u)</th>
                  <th className="px-3 py-2 text-right font-medium">Real (u)</th>
                  <th className="px-3 py-2 text-right font-medium">Costo std</th>
                  <th className="px-3 py-2 text-right font-medium">Variancia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {v.byPart.map((p) => (
                  <tr key={p.part}>
                    <td className="px-3 py-2.5 font-medium">{p.part}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{num(p.plannedQty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{num(p.actualQty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{money(p.standardCost, v.currency)}</td>
                    <td className="px-3 py-2.5 text-right"><VarianceNumber value={p.usageVariance} currency={v.currency} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-[11px] text-gray-400">
            Variancia positiva (roja) = se consumió más material que el plan; negativa (verde) = se consumió menos.
            Ordenado por mayor impacto.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Vista por programa ──────────────────────────────────────────────────────
function ProgramView({
  cogs, reduce, hasSelection, onDrill,
}: {
  cogs: ApiState<ProgramCogs>; reduce: boolean | null; hasSelection: boolean; onDrill: (woId: string) => void;
}) {
  if (!hasSelection) {
    return (
      <Empty
        icon={<Layers className="w-6 h-6" />}
        title="Elige un programa"
        body="Selecciona un programa arriba para ver el COGS agregado de todas sus órdenes y el desglose por WO. Toca una orden para ver su variancia."
      />
    );
  }
  if (cogs.forbidden) return <Forbidden />;
  if (cogs.isLoading && !cogs.data) return <Loading />;
  const p = cogs.data;
  if (!p) return <Empty icon={<Inbox className="w-6 h-6" />} title="Sin datos" body="No se pudo calcular el COGS del programa." />;

  const t = p.totals;
  if (t.count === 0) {
    return <Empty icon={<Inbox className="w-6 h-6" />} title="Programa sin órdenes" body="Este programa no tiene órdenes de trabajo asociadas." />;
  }
  const noFloor = t.materialCost === 0 && t.laborCost === 0 && t.overheadCost === 0;

  return (
    <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="space-y-6 mb-10">
      <motion.div variants={itemRM(reduce)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="COGS del programa" value={money(t.cogs, p.currency)} sub={`${num(t.count, 0)} órdenes`} icon={Wallet} color={C_COGS} />
        <StatTile label="Costo unitario prom." value={t.unitCost > 0 ? money(t.unitCost, p.currency) : '—'} sub="por unidad completada" icon={Coins} color="#3b82f6" />
        <StatTile label="Unidades" value={`${num(t.quantityCompleted, 0)}/${num(t.quantityPlanned, 0)}`} sub="completadas / planeadas" icon={Factory} color="#7c3aed" />
        <StatTile label="Material" value={money(t.materialCost, p.currency)} sub="backflush a costo estándar" icon={Boxes} color={C_MATERIAL} />
      </motion.div>

      {noFloor ? (
        <motion.div variants={itemRM(reduce)}>
          <Empty
            icon={<PackageX className="w-6 h-6" />}
            title="Aún sin consumo en el piso"
            body="Ninguna orden de este programa tiene backflush ni costos registrados todavía. El COGS se moverá en vivo conforme la línea confirme unidades."
          />
        </motion.div>
      ) : (
        <motion.div variants={itemRM(reduce)} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BreakdownCard material={t.materialCost} labor={t.laborCost} overhead={t.overheadCost} cogs={t.cogs} reduce={reduce} />
          <div className={`${glass} rounded-3xl p-5 flex flex-col justify-center`}>
            <h3 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-3">Programa {p.programId}</h3>
            <dl className="space-y-2.5 text-sm">
              <Detail term="Mano de obra">{money(t.laborCost, p.currency)}</Detail>
              <Detail term="Overhead">{money(t.overheadCost, p.currency)}</Detail>
              <Detail term="Órdenes incluidas">{num(t.count, 0)}</Detail>
            </dl>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemRM(reduce)} className={`${glass} rounded-3xl p-2`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Orden</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Unidades</th>
                <th className="px-3 py-2 text-right font-medium">Material</th>
                <th className="px-3 py-2 text-right font-medium">COGS</th>
                <th className="px-3 py-2 text-right font-medium">Unitario</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {p.workOrders.map((w) => (
                <tr
                  key={w.woId}
                  onClick={() => onDrill(w.woId)}
                  className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <td className="px-3 py-2.5 font-medium">{w.woFolio ?? w.woId.slice(0, 8)}<span className="block text-[11px] text-gray-400">{w.model}</span></td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">{STATUS_LABEL[w.status] ?? w.status}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{num(w.quantityCompleted, 0)}/{num(w.quantityPlanned, 0)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{money(w.materialCost, p.currency)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{money(w.cogs, p.currency)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{w.unitCost > 0 ? money(w.unitCost, p.currency) : '—'}</td>
                  <td className="px-3 py-2.5 text-right"><ChevronRight className="w-4 h-4 text-gray-300 inline" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-3 py-2 text-[11px] text-gray-400">Toca una orden para ver su variancia de uso + scrap.</p>
      </motion.div>
    </motion.div>
  );
}

// ── Sección de cierre de periodo ──────────────────────────────────────────────
function ClosingSection({
  kpis, snapshots, snapsState, reduce, period, setPeriod, programs, closingProgram, setClosingProgram,
}: {
  kpis: ApiState<SnapshotKpis>;
  snapshots: Snapshot[];
  snapsState: ApiState<Snapshot[]>;
  reduce: boolean | null;
  period: string;
  setPeriod: (v: string) => void;
  programs: { id: string; count: number }[];
  closingProgram: string;
  setClosingProgram: (v: string) => void;
}) {
  const k = kpis.data;
  const forbidden = kpis.forbidden || snapsState.forbidden;
  const loading = (kpis.isLoading && !k) || (snapsState.isLoading && snapshots.length === 0);
  const empty = !loading && !forbidden && (!k || k.snapshots === 0);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">KPIs de cierre de periodo</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 px-3 py-1.5 text-sm">
            <CalendarClock className="w-4 h-4 text-gray-400" />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent text-sm outline-none"
              aria-label="Periodo de cierre"
            />
            {period && <button onClick={() => setPeriod('')} aria-label="Todos los periodos"><X className="w-3.5 h-3.5 text-gray-400" /></button>}
          </label>
          {programs.length > 0 && (
            <select
              value={closingProgram}
              onChange={(e) => setClosingProgram(e.target.value)}
              className="rounded-full border border-black/10 dark:border-white/10 bg-transparent px-3 py-1.5 text-sm outline-none"
              aria-label="Filtrar por programa"
            >
              <option value="">Todos los programas</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
            </select>
          )}
        </div>
      </div>

      {forbidden ? (
        <Forbidden />
      ) : loading ? (
        <Loading />
      ) : empty ? (
        <Empty
          icon={<Archive className="w-6 h-6" />}
          title="No hay cierres congelados"
          body={
            period || closingProgram
              ? 'No hay snapshots de cierre para este filtro. El cierre de periodo congela el costeo desde el backend (no se hace desde esta vista).'
              : 'Todavía no se ha cerrado ningún periodo. Cuando se congele un cierre, su roll-up y el histórico aparecerán aquí.'
          }
        />
      ) : (
        <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="space-y-6">
          <motion.div variants={itemRM(reduce)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="COGS cerrado" value={money(k!.cogs, k!.currency)} sub={`${num(k!.snapshots, 0)} órdenes · ${period || 'todos los periodos'}`} icon={Wallet} color={C_COGS} />
            <StatTile label="Costo unitario prom." value={k!.avgUnitCost > 0 ? money(k!.avgUnitCost, k!.currency) : '—'} sub={`${num(k!.unitsCompleted, 0)} unidades`} icon={Coins} color="#3b82f6" />
            <StatTile label="Variancia de uso" value={`${k!.materialUsageVariance > 0 ? '+' : ''}${money(k!.materialUsageVariance, k!.currency)}`} sub="material plan vs real" icon={Scale} color={k!.materialUsageVariance > 0 ? C_BAD : C_GOOD} />
            <StatTile label="Scrap" value={money(k!.scrapCost, k!.currency)} sub="costo de holds dispuestos" icon={AlertTriangle} color={k!.scrapCost > 0 ? C_BAD : '#6b7280'} />
          </motion.div>

          <motion.div variants={itemRM(reduce)} className={`${glass} rounded-3xl p-2`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Periodo</th>
                    <th className="px-3 py-2 text-left font-medium">Orden</th>
                    <th className="px-3 py-2 text-right font-medium">Unidades</th>
                    <th className="px-3 py-2 text-right font-medium">COGS</th>
                    <th className="px-3 py-2 text-right font-medium">Unitario</th>
                    <th className="px-3 py-2 text-right font-medium">Var. uso</th>
                    <th className="px-3 py-2 text-right font-medium">Scrap</th>
                    <th className="px-3 py-2 text-right font-medium">Cerrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {snapshots.slice(0, 60).map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5 font-medium tabular-nums">{s.period}</td>
                      <td className="px-3 py-2.5">{s.woFolio ?? s.woId.slice(0, 8)}<span className="block text-[11px] text-gray-400">{s.model ?? '—'}{s.programId ? ` · ${s.programId}` : ''}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(s.quantityCompleted, 0)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{money(s.cogs, s.currency)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{s.unitCost > 0 ? money(s.unitCost, s.currency) : '—'}</td>
                      <td className="px-3 py-2.5 text-right"><VarianceNumber value={s.materialUsageVariance} currency={s.currency} /></td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: s.scrapCost > 0 ? C_BAD : undefined }}>{money(s.scrapCost, s.currency)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-400 text-[12px]">{fmtDate(s.closedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {snapshots.length > 60 && (
              <p className="px-3 py-2 text-[11px] text-gray-400">Mostrando 60 de {snapshots.length} cierres. Filtra por periodo o programa para acotar.</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
