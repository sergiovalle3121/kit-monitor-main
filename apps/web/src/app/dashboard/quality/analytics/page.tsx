"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Lock,
  Inbox,
  FlaskConical,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Empty, Kpi } from "../quality.ui";
import type { Ncr, TestingKpis } from "../quality.types";
import {
  deriveNcrKpis,
  paretoByCategory,
  paretoFromBuckets,
  type ParetoRow,
} from "../quality.utils";

const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const VIOLET = "#7c3aed";
const GRAY = "#6b7280";

type Source = "test" | "ncr";

export default function QualityAnalyticsPage() {
  const { data: kpis, forbidden: testForbidden } = useApi<TestingKpis>("/testing/kpis");
  const { data: ncrData } = useApi<Ncr[]>("/ncr");

  const ncrs = useMemo(() => (Array.isArray(ncrData) ? ncrData : []), [ncrData]);
  const ncrKpis = useMemo(() => deriveNcrKpis(ncrs), [ncrs]);

  const testPareto = useMemo<ParetoRow[]>(
    () => (kpis?.pareto ? paretoFromBuckets(kpis.pareto) : []),
    [kpis],
  );
  const ncrPareto = useMemo<ParetoRow[]>(() => paretoByCategory(ncrs), [ncrs]);

  // Fuente por defecto: la que tenga datos (prioriza fallas de prueba reales).
  const [source, setSource] = useState<Source | null>(null);
  const effectiveSource: Source = source ?? (testPareto.length > 0 ? "test" : "ncr");
  const pareto = effectiveSource === "test" ? testPareto : ncrPareto;
  const accent = effectiveSource === "test" ? RED : AMBER;

  const fpy = kpis?.firstPassYieldPct;
  const yld = kpis?.yieldPct;

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <main className="max-w-5xl mx-auto px-6 pt-10">
        <Link href="/dashboard/quality" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 mb-4">
          <ChevronLeft className="w-4 h-4" /> Calidad · NCR
        </Link>
        <PageHeader
          domain="quality"
          title="Calidad · Analítica"
          subtitle="Yield, First-Pass Yield y Pareto de defectos — datos reales"
          right={
            <Link
              href="/dashboard/test-engineering"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium hover:bg-black/5 dark:hover:bg-white/10"
              title="Capturar resultados de prueba (pass/fail)"
            >
              <FlaskConical className="w-4 h-4" /> Captura de pruebas
            </Link>
          }
        />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Kpi
            label="First-Pass Yield"
            value={testForbidden ? "—" : fpy === null || fpy === undefined ? "—" : `${fpy}%`}
            color={fpy != null && fpy >= 95 ? GREEN : AMBER}
            sub={kpis ? `${kpis.distinctSerials} series` : undefined}
          />
          <Kpi
            label="Yield total"
            value={testForbidden ? "—" : yld === null || yld === undefined ? "—" : `${yld}%`}
            color={GREEN}
            sub={kpis ? `${kpis.totalTests} pruebas` : undefined}
          />
          <Kpi label="Fallas de prueba" value={testForbidden ? "—" : kpis?.fail ?? 0} color={(kpis?.fail ?? 0) > 0 ? RED : GREEN} />
          <Kpi label="NCR abiertas" value={ncrKpis.open} color={ncrKpis.critical > 0 ? RED : GRAY} sub={`${ncrKpis.critical} críticas`} />
        </div>

        {testForbidden && (
          <div className={`${glass} rounded-2xl p-4 mb-4 flex items-center gap-2 text-sm text-gray-500`}>
            <Lock className="w-4 h-4 text-gray-400" /> Inicia sesión con permisos de calidad para ver yields y el Pareto de fallas de prueba. El Pareto de categorías de NCR sigue disponible abajo.
          </div>
        )}

        {/* Pareto */}
        <div className={`${glass} rounded-2xl p-5`}>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4" style={{ color: accent }} /> Pareto de defectos</h3>
            <div className="inline-flex rounded-xl bg-black/5 dark:bg-white/10 p-0.5 text-[13px]">
              <Toggle active={effectiveSource === "test"} onClick={() => setSource("test")} disabled={testPareto.length === 0}>Fallas de prueba</Toggle>
              <Toggle active={effectiveSource === "ncr"} onClick={() => setSource("ncr")} disabled={ncrPareto.length === 0}>Categorías NCR</Toggle>
            </div>
          </div>

          {pareto.length === 0 ? (
            <Empty
              icon={<Inbox className="w-6 h-6" />}
              title="Sin datos para el Pareto"
              body={
                effectiveSource === "test"
                  ? "Aún no hay fallas de prueba capturadas. Captura resultados FAIL para ver los códigos de falla dominantes."
                  : "Aún no hay NCRs con categoría. Levanta no-conformidades para ver las categorías de defecto dominantes."
              }
            />
          ) : (
            <ParetoChart rows={pareto} accent={accent} />
          )}
        </div>
      </main>
    </div>
  );
}

function ParetoChart({ rows, accent }: { rows: ParetoRow[]; accent: string }) {
  const data = rows.map((r) => ({ label: r.label, count: r.count, cum: r.cumPct }));
  return (
    <>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} stroke="rgba(148,163,184,0.6)" />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} stroke="rgba(148,163,184,0.6)" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" stroke="rgba(148,163,184,0.6)" />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(148,163,184,0.3)", fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="count" name="Cantidad" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={accent} fillOpacity={0.85 - Math.min(i, 6) * 0.07} />
              ))}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="cum" name="% acumulado" unit="%" stroke={VIOLET} strokeWidth={2} dot={{ r: 3, fill: VIOLET }} />
            <ReferenceLine yAxisId="right" y={80} stroke={RED} strokeDasharray="4 4" label={{ value: "80%", position: "right", fontSize: 10, fill: RED }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[12px] text-gray-400 mt-3">
        Regla 80/20: las barras a la izquierda de donde la línea cruza el 80% son los pocos defectos vitales que concentran la mayoría de las fallas.
      </p>
    </>
  );
}

function Toggle({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${active ? "bg-white dark:bg-white/15 shadow-sm" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"}`}
    >
      {children}
    </button>
  );
}
