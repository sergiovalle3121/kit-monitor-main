'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Lock, Inbox, FlaskConical, BarChart3, TrendingUp, Boxes, ArrowRight,
  Tag, Truck, AlertTriangle, ClipboardList, Gauge, Recycle, Info as InfoIcon, CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { usePermissions } from '@/hooks/usePermissions';
import { GenerateDeckButton } from '@/components/office/GenerateDeckButton';
import {
  Toolbar, KpiRow, FilterBar, ExportButton,
  DetailDrawer, DrawerSection,
  type StatCardProps, type FilterDef, type FilterValues, type ExportColumn,
} from '@/components/workspace';
import type {
  Ncr, NcrSeverity, DefectCode, QualityAnalytics,
  DefectParetoRow, SupplierPpm, FpyGroup, PpmPoint, CountRow, CapaOverdue,
} from '../quality.types';
import {
  deriveNcrKpis, NCR_SEVERITY_META, NCR_STATUS_META, DEFECT_FAMILY_META, defectFamilyLabel,
} from '../quality.utils';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const VIOLET = '#7c3aed';
const BLUE = '#3b82f6';
const GRAY = '#6b7280';

const PERIODS: Record<string, number> = { '30': 30, '90': 90, '180': 180, '365': 365 };

const DISPO_LABELS: Record<string, string> = {
  release: 'Liberar', scrap: 'Desechar', rtv: 'Devolver (RTV)', rework: 'Retrabajar', use_as_is: 'Usar como está',
};

function inPeriod(iso: string, days?: number): boolean {
  if (!days) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 86_400_000;
}
function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return m ? `${months[Number(m) - 1]} ${y.slice(2)}` : key;
}
function ppmFmt(v: number | null | undefined): string {
  return v == null ? '—' : v.toLocaleString();
}
function ppmColor(v: number | null | undefined): string {
  if (v == null) return GRAY;
  if (v < 500) return GREEN;
  if (v < 5000) return AMBER;
  return RED;
}
function fpyColor(v: number | null | undefined): string {
  if (v == null) return GRAY;
  if (v >= 95) return GREEN;
  if (v >= 90) return AMBER;
  return RED;
}

interface MergedPpm { label: string; supplier: number | null; process: number | null }
function mergePpmTrend(supplier: PpmPoint[], process: PpmPoint[]): MergedPpm[] {
  const keys = Array.from(new Set([...supplier.map((p) => p.period), ...process.map((p) => p.period)])).sort();
  const s = new Map(supplier.map((p) => [p.period, p.ppm]));
  const pr = new Map(process.map((p) => [p.period, p.ppm]));
  return keys.map((k) => ({ label: monthLabel(k), supplier: s.get(k) ?? null, process: pr.get(k) ?? null }));
}

export default function QualityAnalyticsPage() {
  const { canWrite } = usePermissions();
  const { user } = useAuth();
  const toast = useToast();

  const [filters, setFilters] = useState<FilterValues>({ period: '365' });
  const days = PERIODS[(filters.period as string) || ''] ?? undefined;
  const model = (filters.model as string) || undefined;
  const line = (filters.line as string) || undefined;

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (days) p.set('days', String(days));
    if (model) p.set('model', model);
    if (line) p.set('line', line);
    return p.toString();
  }, [days, model, line]);

  const { data: analytics, forbidden, isLoading, mutate: mutateAnalytics } =
    useApi<QualityAnalytics>(`/quality/analytics${qs ? `?${qs}` : ''}`);
  const { data: ncrData, mutate: mutateNcrs } = useApi<Ncr[]>('/ncr');
  const { data: codeData } = useApi<DefectCode[]>('/quality/defect-codes');

  const allNcrs = useMemo(() => (Array.isArray(ncrData) ? ncrData : []), [ncrData]);
  const codes = useMemo(() => (Array.isArray(codeData) ? codeData : []), [codeData]);
  const codeById = useMemo(() => new Map(codes.map((c) => [c.id, c])), [codes]);

  const models = useMemo(() => Array.from(new Set(allNcrs.map((n) => n.model).filter(Boolean) as string[])).sort(), [allNcrs]);
  const lines = useMemo(() => Array.from(new Set(allNcrs.map((n) => n.line).filter(Boolean) as string[])).sort(), [allNcrs]);

  // NCRs filtrados igual que el servidor (periodo + modelo + línea) — base del drill-down.
  const filteredNcrs = useMemo(() => allNcrs.filter((n) => {
    if (!inPeriod(n.createdAt, days)) return false;
    if (model && n.model !== model) return false;
    if (line && n.line !== line) return false;
    return true;
  }), [allNcrs, days, model, line]);

  const ncrKpis = useMemo(() => deriveNcrKpis(filteredNcrs), [filteredNcrs]);
  const affected = useMemo(() => filteredNcrs.reduce((a, n) => a + (n.quantityAffected || 0), 0), [filteredNcrs]);
  const ncrTrend = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of filteredNcrs) {
      const k = n.createdAt ? n.createdAt.slice(0, 7) : '';
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, count]) => ({ label: monthLabel(k), count }));
  }, [filteredNcrs]);

  const [drill, setDrill] = useState<{ title: string; subtitle?: string; match: (n: Ncr) => boolean } | null>(null);
  const [classifying, setClassifying] = useState<number | null>(null);
  const drillRows = useMemo(() => (drill ? filteredNcrs.filter(drill.match) : []), [drill, filteredNcrs]);

  async function classify(ncrId: number, defectCodeId: number | null) {
    setClassifying(ncrId);
    try {
      const res = await apiFetch(`${API_BASE}/ncr/${ncrId}/classify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defectCodeId, actor: user?.email || 'QA' }),
      });
      if (!res.ok) {
        toast.error(res.status === 403 ? 'Necesitas permiso QUALITY_WRITE para clasificar.' : 'No se pudo clasificar la NCR.', 'Calidad');
        return;
      }
      toast.success(defectCodeId == null ? 'NCR marcada como sin clasificar.' : 'NCR clasificada.', 'Calidad');
      mutateNcrs();
      mutateAnalytics();
    } catch {
      toast.error('Error de red.', 'Calidad');
    } finally {
      setClassifying(null);
    }
  }

  const pareto = analytics?.defects.pareto ?? [];
  const onlyUnclassified = pareto.length > 0 && pareto.every((p) => p.defectCodeId === null);
  const ppmTrend = useMemo(
    () => mergePpmTrend(analytics?.ppm.supplierTrend ?? [], analytics?.ppm.processTrend ?? []),
    [analytics],
  );
  const meta = analytics?.meta;
  const cap = analytics?.capa;

  const kpiItems: StatCardProps[] = [
    { label: 'First-Pass Yield', value: analytics?.yield.fpyOverall != null ? `${analytics.yield.fpyOverall}%` : '—', sublabel: analytics ? `${analytics.yield.serials} series` : undefined, color: fpyColor(analytics?.yield.fpyOverall), icon: TrendingUp },
    { label: 'Yield OQC', value: analytics?.yield.oqc.yieldPct != null ? `${analytics.yield.oqc.yieldPct}%` : '—', sublabel: analytics ? `${analytics.yield.oqc.inspected.toLocaleString()} insp.` : undefined, color: fpyColor(analytics?.yield.oqc.yieldPct), icon: BarChart3 },
    { label: 'PPM proveedor', value: ppmFmt(analytics?.ppm.supplierOverall), sublabel: 'desde IQC', color: ppmColor(analytics?.ppm.supplierOverall), icon: Truck },
    { label: 'PPM proceso', value: ppmFmt(analytics?.ppm.processOverall), sublabel: 'desde pruebas', color: ppmColor(analytics?.ppm.processOverall), icon: FlaskConical },
    { label: 'NCR sin clasificar', value: meta ? meta.unclassifiedNcrs : '—', sublabel: meta ? `de ${meta.totalNcrs} en periodo` : undefined, color: meta && meta.unclassifiedNcrs > 0 ? AMBER : GREEN, icon: Tag },
    { label: 'CAPAs vencidas', value: cap ? cap.overdue : '—', sublabel: cap ? `${cap.open} abiertas` : undefined, color: cap && cap.overdue > 0 ? RED : GRAY, icon: AlertTriangle },
  ];

  // ── Deck de calidad (Fase 4) ─────────────────────────────────────────────
  const periodLabel = ({ '30': 'Últimos 30 días', '90': 'Últimos 90 días', '180': 'Últimos 180 días', '365': 'Último año' } as Record<string, string>)[(filters.period as string) || '365'] || 'Periodo';
  const buildQualityDeckFn = async () => {
    const { buildQualityDeck } = await import('@/lib/office/deckGen');
    const openNcrs = filteredNcrs.filter((n) => ['open', 'under_review', 'contained'].includes(n.status));
    return buildQualityDeck({
      period: periodLabel,
      kpis: {
        fpy: analytics?.yield.fpyOverall != null ? `${analytics.yield.fpyOverall}%` : '—',
        yieldPct: analytics?.yield.oqc.yieldPct != null ? `${analytics.yield.oqc.yieldPct}%` : '—',
        fails: analytics?.yield.oqc.failed ?? 0,
        openNcr: ncrKpis.open, critical: ncrKpis.critical, affected,
      },
      pareto: pareto.map((r) => ({ label: r.label, count: r.count })),
      trend: ncrTrend.map((t) => ({ label: t.label, count: t.count })),
      byModel: (analytics?.cuts.byModel ?? []).map((g) => ({ label: g.label, count: g.count })),
      openNcrs: openNcrs.slice(0, 10).map((n) => ({ ncrNumber: n.ncrNumber, partNumber: n.partNumber, model: n.model ?? undefined, severity: NCR_SEVERITY_META[n.severity as NcrSeverity]?.label ?? n.severity, affected: n.quantityAffected })),
    });
  };
  const deckEmpty = !analytics || meta?.totalNcrs === 0;

  const FILTER_DEFS: FilterDef[] = [
    { key: 'period', type: 'select', label: 'Periodo', options: [
      { value: '30', label: 'Últimos 30 días' }, { value: '90', label: 'Últimos 90 días' },
      { value: '180', label: 'Últimos 180 días' }, { value: '365', label: 'Último año' },
    ] },
    ...(models.length ? [{ key: 'model', type: 'select' as const, label: 'Modelo', options: models.map((m) => ({ value: m, label: m })) }] : []),
    ...(lines.length ? [{ key: 'line', type: 'select' as const, label: 'Línea', options: lines.map((l) => ({ value: l, label: l })) }] : []),
  ];

  const openDrillFromPareto = (label: string) => {
    const row = pareto.find((r) => r.label === label);
    if (!row) return;
    const id = row.defectCodeId;
    setDrill({
      title: id == null ? 'Sin clasificar' : `${row.label}${row.description ? ` · ${row.description}` : ''}`,
      subtitle: id == null ? 'NCRs sin código de defecto' : 'Código de defecto',
      match: (n) => (n.defectCodeId ?? null) === id,
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 text-foreground md:px-8">
      <Toolbar
        domain="quality"
        icon={BarChart3}
        title="Calidad · Analítica"
        subtitle="Pareto de defectos, PPM/yield, estado de CAPAs y drill-down — cruzando todo el ecosistema"
        right={
          <Link href="/dashboard/test-engineering" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10" title="Capturar resultados de prueba (pass/fail)">
            <FlaskConical className="h-4 w-4" /> Captura de pruebas
          </Link>
        }
      >
        <FilterBar defs={FILTER_DEFS} value={filters} onChange={setFilters} />
        <div className="ml-auto flex items-center gap-1.5">
          {canWrite && (
            <GenerateDeckButton title="Calidad · Revisión" build={buildQualityDeckFn} disabled={deckEmpty} />
          )}
          <ExportButton<DefectParetoRow> rows={pareto} columns={PARETO_EXPORT} filename="calidad-pareto" />
        </div>
      </Toolbar>

      <div className="mb-4">
        <KpiRow items={kpiItems} columns={6} />
      </div>

      {forbidden && (
        <div className={`${glass} mb-4 flex items-center gap-2 rounded-2xl p-4 text-sm text-gray-500`}>
          <Lock className="h-4 w-4 text-gray-500 dark:text-gray-400" /> Inicia sesión con una cuenta de calidad para ver el tablero analítico.
        </div>
      )}

      {/* Pareto de defectos */}
      <Section
        icon={BarChart3} accent={AMBER} title="Pareto de defectos"
        hint="Por código de defecto. Las NCRs sin código se agrupan como «Sin clasificar» — clasifícalas para afinar el Pareto."
        action={pareto.length > 0 ? <ExportButton<DefectParetoRow> rows={pareto} columns={PARETO_EXPORT} filename="calidad-pareto" label="CSV" /> : undefined}
      >
        {pareto.length === 0 ? (
          <Empty
            icon={<Inbox className="h-6 w-6" />}
            body={isLoading ? 'Cargando…' : 'Aún no hay no-conformidades en el periodo. Levanta NCRs y clasifícalas para ver los pocos vitales.'}
          />
        ) : onlyUnclassified ? (
          <Empty
            icon={<Tag className="h-6 w-6" />}
            body={`Tienes ${pareto[0].count} NCR(s) en el periodo pero ninguna clasificada. Clasifícalas con códigos de defecto para que el Pareto revele el 80/20.`}
            cta={canWrite ? (
              <button
                type="button"
                onClick={() => setDrill({ title: 'Sin clasificar', subtitle: 'NCRs sin código de defecto', match: (n) => (n.defectCodeId ?? null) === null })}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-white"
                style={{ background: AMBER }}
              >
                <Tag className="h-4 w-4" /> Clasificar NCRs
              </button>
            ) : undefined}
          />
        ) : (
          <ParetoChart rows={pareto} onPick={openDrillFromPareto} />
        )}
      </Section>

      {/* Tendencia PPM */}
      <Section
        icon={TrendingUp} accent={VIOLET} title="Tendencia de PPM"
        hint="PPM de proveedor (rechazos/inspeccionado en IQC) y PPM defectivo de proceso (fallas/pruebas) por mes."
        action={ppmTrend.length > 0 ? <ExportButton<MergedPpm> rows={ppmTrend} columns={PPM_EXPORT} filename="calidad-ppm" label="CSV" /> : undefined}
      >
        {ppmTrend.length === 0 ? (
          <Empty icon={<TrendingUp className="h-6 w-6" />} body="Sin inspecciones IQC ni pruebas en el periodo para trazar PPM. El PPM de proveedor sale de IQC; el de proceso, de la captura de pruebas." />
        ) : (
          <PpmTrendChart rows={ppmTrend} />
        )}
      </Section>

      {/* First Pass Yield */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={Gauge} accent={GREEN} title="First-Pass Yield por modelo"
          hint="Series cuya PRIMERA prueba pasó / series distintas, por modelo."
          action={(analytics?.yield.fpyByModel.length ?? 0) > 0 ? <ExportButton<FpyGroup> rows={analytics?.yield.fpyByModel ?? []} columns={FPY_EXPORT} filename="calidad-fpy-modelo" label="CSV" /> : undefined}>
          <FpyList rows={analytics?.yield.fpyByModel ?? []} empty="Sin registros de prueba con modelo en el periodo." />
        </Section>
        <Section icon={Gauge} accent={BLUE} title="First-Pass Yield por estación"
          hint="Mismo cálculo de FPY, agrupado por estación de prueba (ICT/FCT/AOI/FINAL…)."
          action={(analytics?.yield.fpyByStation.length ?? 0) > 0 ? <ExportButton<FpyGroup> rows={analytics?.yield.fpyByStation ?? []} columns={FPY_EXPORT} filename="calidad-fpy-estacion" label="CSV" /> : undefined}>
          <FpyList rows={analytics?.yield.fpyByStation ?? []} empty="Sin registros de prueba con estación en el periodo." />
        </Section>
      </div>

      {/* Tres cortes */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Section icon={Boxes} accent={VIOLET} title="Top defectos por modelo">
          <Breakdown rows={analytics?.cuts.byModel ?? []} accent={VIOLET}
            onPick={(g) => setDrill({ title: `Modelo · ${g.label}`, subtitle: 'No-conformidades del modelo', match: (n) => (n.model || 'Sin modelo') === g.key })} />
        </Section>
        <Section icon={BarChart3} accent={AMBER} title="Top defectos por línea">
          <Breakdown rows={analytics?.cuts.byLine ?? []} accent={AMBER}
            onPick={(g) => setDrill({ title: `Línea · ${g.label}`, subtitle: 'No-conformidades de la línea', match: (n) => (n.line || 'Sin línea') === g.key })} />
        </Section>
        <Section icon={Truck} accent={RED} title="Proveedores por PPM"
          hint="Ranking de proveedores por PPM (IQC)."
          action={(analytics?.cuts.bySupplier.length ?? 0) > 0 ? <ExportButton<SupplierPpm> rows={analytics?.cuts.bySupplier ?? []} columns={SUPPLIER_EXPORT} filename="calidad-ppm-proveedor" label="CSV" /> : undefined}>
          <SupplierList rows={analytics?.cuts.bySupplier ?? []} />
        </Section>
      </div>

      {/* CAPA + MRB + follow-ups */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section icon={ClipboardList} accent={VIOLET} title="Estado de CAPAs"
          hint="Acciones correctivas/preventivas: abiertas, cerradas, vencidas y tiempo de cierre."
          action={cap && cap.overdueList.length > 0 ? <ExportButton<CapaOverdue> rows={cap.overdueList} columns={CAPA_EXPORT} filename="calidad-capas-vencidas" label="CSV" /> : undefined}>
          <CapaPanel stats={cap} />
        </Section>
        <Section icon={Recycle} accent={BLUE} title="Disposiciones (MRB) · unidades"
          hint="Unidades dispuestas por tipo. Base real para una futura COPQ.">
          <DispoPanel rows={analytics?.dispositions.byType ?? []} />
        </Section>
      </div>

      {/* Follow-ups honestos (sin fuente de datos hoy) */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Followup title="DPMO de proceso" body="El DPMO clásico necesita «oportunidades por unidad» (p.ej. uniones de soldadura por tablero), dato que el sistema aún no captura. Mientras tanto se muestra el PPM defectivo de proceso (fallas/pruebas). Queda como follow-up un catálogo de oportunidades por modelo." />
        <Followup title="Costo de no-calidad (COPQ)" body="Las disposiciones registran unidades (scrap/retrabajo) pero no costo unitario, así que no inventamos un monto. Con un costo por parte/retrabajo se podría derivar la COPQ real. Queda como follow-up." />
      </div>

      {/* Drill-down → NCRs reales */}
      <DetailDrawer
        open={drill !== null}
        onClose={() => setDrill(null)}
        icon={BarChart3}
        accent={VIOLET}
        width={600}
        title={drill?.title ?? 'Detalle'}
        subtitle={drill ? `${drillRows.length} no-conformidad(es)${drill.subtitle ? ` · ${drill.subtitle}` : ''}` : undefined}
      >
        {drill && (
          <DrawerSection title="No-conformidades">
            {drillRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin NCRs para este corte.</p>
            ) : (
              <div className="space-y-2">
                {drillRows.map((n) => (
                  <NcrDrillCard
                    key={n.id}
                    ncr={n}
                    codeById={codeById}
                    codes={codes}
                    canWrite={canWrite}
                    busy={classifying === n.id}
                    onClassify={(cid) => classify(n.id, cid)}
                  />
                ))}
              </div>
            )}
          </DrawerSection>
        )}
      </DetailDrawer>
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────────
function Section({ icon: Icon, accent, title, hint, action, children }: {
  icon: typeof Boxes; accent: string; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className={`${glass} mb-4 rounded-2xl p-5`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" style={{ color: accent }} /> {title}</h3>
          {hint && <p className="mt-1 max-w-2xl text-[12px] text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Pareto chart ────────────────────────────────────────────────────────────────
function ParetoChart({ rows, onPick }: { rows: DefectParetoRow[]; onPick: (label: string) => void }) {
  const data = rows.map((r) => ({ label: r.label, count: r.count, cum: r.cumPct, family: r.category }));
  // recharts tipa onClick con su estado interno; acotamos el escape a este punto.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePick = (s: any) => { if (s?.activeLabel) onPick(s.activeLabel as string); };
  return (
    <>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 28 }} onClick={handlePick}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} stroke="rgba(148,163,184,0.6)" />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" stroke="rgba(148,163,184,0.6)" />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.3)', fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="count" name="Cantidad" radius={[4, 4, 0, 0]} className="cursor-pointer">
              {data.map((d, i) => (
                <Cell key={i} fill={d.family ? (DEFECT_FAMILY_META[d.family as keyof typeof DEFECT_FAMILY_META]?.color ?? AMBER) : GRAY} fillOpacity={0.9 - Math.min(i, 6) * 0.06} />
              ))}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cum" name="% acumulado" unit="%" stroke={VIOLET} strokeWidth={2} dot={{ r: 3, fill: VIOLET }} />
            <ReferenceLine yAxisId="right" y={80} stroke={RED} strokeDasharray="4 4" label={{ value: '80%', position: 'right', fontSize: 10, fill: RED }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[12px] text-gray-500 dark:text-gray-400">Regla 80/20: los defectos a la izquierda de donde la línea cruza el 80% son los pocos vitales. Haz clic en una barra para ver y clasificar sus NCRs.</p>
    </>
  );
}

// ── PPM trend chart ─────────────────────────────────────────────────────────────
function PpmTrendChart({ rows }: { rows: MergedPpm[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
          <YAxis tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.3)', fontSize: 12 }} />
          <Line type="monotone" dataKey="supplier" name="PPM proveedor" stroke={RED} strokeWidth={2} dot={{ r: 3, fill: RED }} connectNulls />
          <Line type="monotone" dataKey="process" name="PPM proceso" stroke={VIOLET} strokeWidth={2} dot={{ r: 3, fill: VIOLET }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Breakdown (conteo) ───────────────────────────────────────────────────────────
function Breakdown({ rows, accent, onPick }: { rows: CountRow[]; accent: string; onPick: (g: CountRow) => void }) {
  const top = rows.slice(0, 8);
  const max = top.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  if (top.length === 0) return <Empty icon={<Inbox className="h-6 w-6" />} body="Sin datos en el periodo." />;
  return (
    <div className="space-y-2">
      {top.map((r) => (
        <button key={r.key} type="button" onClick={() => onPick(r)} className="group flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
          <span className="w-28 shrink-0 truncate text-[13px] font-medium" title={r.label}>{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: accent }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: accent }}>{r.count}</span>
        </button>
      ))}
    </div>
  );
}

// ── FPY list ─────────────────────────────────────────────────────────────────────
function FpyList({ rows, empty }: { rows: FpyGroup[]; empty: string }) {
  const top = rows.slice(0, 8);
  if (top.length === 0) return <Empty icon={<Gauge className="h-6 w-6" />} body={empty} />;
  return (
    <div className="space-y-2">
      {top.map((r) => {
        const c = fpyColor(r.fpy);
        return (
          <div key={r.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-[13px] font-medium" title={r.key}>{r.key}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${r.fpy ?? 0}%`, background: c }} />
            </div>
            <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: c }}>{r.fpy != null ? `${r.fpy}%` : '—'}</span>
            <span className="w-12 shrink-0 text-right text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">{r.serials} s</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Supplier PPM list ─────────────────────────────────────────────────────────────
function SupplierList({ rows }: { rows: SupplierPpm[] }) {
  const top = rows.slice(0, 8);
  if (top.length === 0) return <Empty icon={<Truck className="h-6 w-6" />} body="Sin inspecciones de recibo (IQC) en el periodo." />;
  return (
    <div className="space-y-2">
      {top.map((r) => (
        <div key={String(r.supplierId)} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[13px] font-medium" title={r.supplierName}>{r.supplierName}</span>
          <span className="flex-1 text-[11px] text-gray-500 dark:text-gray-400">{r.defects}/{r.inspected.toLocaleString()} pzas</span>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums" style={{ background: `${ppmColor(r.ppm)}1f`, color: ppmColor(r.ppm) }}>{ppmFmt(r.ppm)} ppm</span>
        </div>
      ))}
    </div>
  );
}

// ── CAPA panel ─────────────────────────────────────────────────────────────────
function CapaPanel({ stats }: { stats?: QualityAnalytics['capa'] }) {
  if (!stats || stats.total === 0) {
    return <Empty icon={<ClipboardList className="h-6 w-6" />} body="Sin CAPAs registradas. Las CAPAs se abren desde el detalle de una NCR para atacar la causa raíz." />;
  }
  return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-2 text-center">
        <Stat label="Abiertas" value={stats.open} color={AMBER} />
        <Stat label="Cerradas" value={stats.closed} color={GREEN} />
        <Stat label="Vencidas" value={stats.overdue} color={stats.overdue > 0 ? RED : GRAY} />
        <Stat label="Cierre prom." value={stats.avgCloseDays != null ? `${stats.avgCloseDays}d` : '—'} color={VIOLET} />
      </div>
      {stats.overdueList.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Vencidas</div>
          {stats.overdueList.slice(0, 5).map((c) => (
            <div key={c.capaNumber} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: `${RED}0f` }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: RED }} />
              <span className="font-mono text-[11px] text-gray-500">{c.capaNumber}</span>
              <span className="min-w-0 flex-1 truncate text-[12px]">{c.partNumber}</span>
              <span className="shrink-0 text-[12px] font-semibold" style={{ color: RED }}>+{c.daysOverdue}d</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[12px] text-gray-500 dark:text-gray-400"><CheckCircle2 className="h-3.5 w-3.5" style={{ color: GREEN }} /> Ninguna CAPA vencida.</p>
      )}
    </div>
  );
}

// ── Disposition panel ─────────────────────────────────────────────────────────────
function DispoPanel({ rows }: { rows: QualityAnalytics['dispositions']['byType'] }) {
  if (rows.length === 0) return <Empty icon={<Recycle className="h-6 w-6" />} body="Sin disposiciones (MRB) en el periodo." />;
  const max = rows.reduce((m, r) => Math.max(m, r.units), 0) || 1;
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.type} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[13px] font-medium">{DISPO_LABELS[r.type] ?? r.type}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${(r.units / max) * 100}%`, background: BLUE }} />
          </div>
          <span className="w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums" style={{ color: BLUE }}>{r.units.toLocaleString()} u</span>
          <span className="w-10 shrink-0 text-right text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">{r.count}×</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] p-2 dark:bg-white/[0.04]">
      <div className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

// ── NCR drill card (with inline classify) ─────────────────────────────────────────
function NcrDrillCard({ ncr, codeById, codes, canWrite, busy, onClassify }: {
  ncr: Ncr; codeById: Map<number, DefectCode>; codes: DefectCode[]; canWrite: boolean; busy: boolean; onClassify: (id: number | null) => void;
}) {
  const sev = NCR_SEVERITY_META[ncr.severity as NcrSeverity];
  const st = NCR_STATUS_META[ncr.status];
  const current = ncr.defectCodeId != null ? codeById.get(ncr.defectCodeId) : undefined;
  return (
    <div className={`${glass} rounded-xl p-3`}>
      <div className="flex items-center gap-3">
        <span className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-white/10">{ncr.ncrNumber}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{ncr.description || ncr.category}</div>
          <div className="truncate text-[12px] text-gray-500 dark:text-gray-400">{ncr.partNumber}{ncr.model ? ` · ${ncr.model}` : ''} · {ncr.quantityAffected} pzas</div>
        </div>
        {sev && <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${sev.color}1f`, color: sev.color }}>{sev.label}</span>}
        {st && <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${st.color}1f`, color: st.color }}>{st.label}</span>}
        <Link href={`/dashboard/quality/ncr/${ncr.id}`} className="shrink-0 text-gray-300 transition-colors hover:text-gray-500" title="Abrir NCR">
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      {canWrite && (
        <div className="mt-2 flex items-center gap-2 border-t border-black/5 pt-2 dark:border-white/10">
          <Tag className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">Código:</span>
          <select
            value={ncr.defectCodeId ?? ''}
            disabled={busy}
            onChange={(e) => onClassify(e.target.value ? Number(e.target.value) : null)}
            className="min-w-0 flex-1 rounded-lg border border-black/10 bg-black/[0.03] px-2 py-1 text-[12px] outline-none disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <option value="">Sin clasificar</option>
            {codes.map((c) => (
              <option key={c.id} value={c.id}>{c.code} · {c.description} ({defectFamilyLabel(c.category)})</option>
            ))}
          </select>
        </div>
      )}
      {!canWrite && current && (
        <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400"><Tag className="mr-1 inline h-3 w-3" />{current.code} · {current.description}</div>
      )}
    </div>
  );
}

// ── Follow-up card (honesto: sin fuente de datos hoy) ──────────────────────────────
function Followup({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${glass} rounded-2xl border border-dashed border-black/10 p-4 dark:border-white/10`}>
      <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-500"><InfoIcon className="h-4 w-4" /> {title} <span className="rounded-full bg-gray-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">follow-up</span></h4>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">{body}</p>
    </div>
  );
}

function Empty({ icon, body, cta }: { icon: React.ReactNode; body: string; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center text-gray-300">
      <div className="mb-3">{icon}</div>
      <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

// ── Export column defs ─────────────────────────────────────────────────────────────
const PARETO_EXPORT: ExportColumn<DefectParetoRow>[] = [
  { key: 'label', header: 'Código' },
  { key: 'description', header: 'Descripción', value: (r) => r.description ?? '' },
  { key: 'category', header: 'Familia', value: (r) => defectFamilyLabel(r.category) },
  { key: 'count', header: 'Cantidad' },
  { key: 'pct', header: '%', value: (r) => `${r.pct}%` },
  { key: 'cumPct', header: '% acumulado', value: (r) => `${r.cumPct}%` },
];

const PPM_EXPORT: ExportColumn<MergedPpm>[] = [
  { key: 'label', header: 'Periodo' },
  { key: 'supplier', header: 'PPM proveedor', value: (r) => r.supplier ?? '' },
  { key: 'process', header: 'PPM proceso', value: (r) => r.process ?? '' },
];

const FPY_EXPORT: ExportColumn<FpyGroup>[] = [
  { key: 'key', header: 'Grupo' },
  { key: 'serials', header: 'Series' },
  { key: 'firstPass', header: 'Pasaron a la 1ª' },
  { key: 'fpy', header: 'FPY %', value: (r) => (r.fpy != null ? `${r.fpy}%` : '') },
];

const SUPPLIER_EXPORT: ExportColumn<SupplierPpm>[] = [
  { key: 'supplierName', header: 'Proveedor' },
  { key: 'inspections', header: 'Inspecciones' },
  { key: 'inspected', header: 'Inspeccionado' },
  { key: 'defects', header: 'Rechazos' },
  { key: 'ppm', header: 'PPM', value: (r) => r.ppm ?? '' },
];

const CAPA_EXPORT: ExportColumn<CapaOverdue>[] = [
  { key: 'capaNumber', header: 'CAPA' },
  { key: 'partNumber', header: 'Parte' },
  { key: 'status', header: 'Estado' },
  { key: 'dueDate', header: 'Vence', value: (r) => (r.dueDate ? r.dueDate.slice(0, 10) : '') },
  { key: 'daysOverdue', header: 'Días vencida' },
];
