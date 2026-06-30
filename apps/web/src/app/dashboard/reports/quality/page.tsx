"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Lock, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { glass } from "@/lib/glass";
import { ReportChrome } from "../_components/ReportChrome";
import { DocLetterhead } from "../_components/DocLetterhead";
import { DocSection } from "../_components/DocSection";
import { DocTable, type DocColumn } from "../_components/DocTable";
import { BackendNote } from "../_components/BackendNote";
import { EmptyState } from "../_components/EmptyState";
import type { Ncr, NcrSeverity, NcrStatus, NcrSourceType, TestingKpis } from "../reports.types";
import {
  draftDocNumber,
  fmtDate,
  fmtDay,
  ncrCategoryPareto,
  orDash,
  summarizeNcrs,
  type ParetoRow,
} from "../reports.utils";

const STATUS_LABEL: Record<NcrStatus, string> = {
  open: "Abierta",
  under_review: "En revisión",
  contained: "Contenida",
  dispositioned: "Dispuesta",
  closed: "Cerrada",
};
const SEVERITY_LABEL: Record<NcrSeverity, string> = {
  minor: "Menor",
  major: "Mayor",
  critical: "Crítica",
};
const SOURCE_LABEL: Record<NcrSourceType, string> = {
  incoming: "Recibo (IQC)",
  "in-process": "En proceso",
  outgoing: "Salida (OQC)",
  warehouse: "Almacén",
  supplier: "Proveedor",
  customer: "Cliente",
};

export default function QualityReportPage() {
  const { user } = useAuth();
  const generatedBy = user?.email || "—";

  const { data: ncrData, isLoading, forbidden } = useApi<Ncr[]>("/ncr", { refreshInterval: 60000 });
  const { data: kpis, forbidden: kpisForbidden } = useApi<TestingKpis>("/testing/kpis", {
    refreshInterval: 60000,
  });

  const allNcrs = useMemo(() => (Array.isArray(ncrData) ? ncrData : []), [ncrData]);

  // Filtro de periodo (cliente, sobre createdAt). Vacío = histórico completo.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const ncrs = useMemo(() => {
    const fromT = from ? new Date(from + "T00:00:00").getTime() : null;
    const toT = to ? new Date(to + "T23:59:59").getTime() : null;
    return allNcrs.filter((n) => {
      const t = new Date(n.createdAt).getTime();
      if (fromT != null && t < fromT) return false;
      if (toT != null && t > toT) return false;
      return true;
    });
  }, [allNcrs, from, to]);

  const summary = useMemo(() => summarizeNcrs(ncrs), [ncrs]);
  const pareto = useMemo(() => ncrCategoryPareto(ncrs), [ncrs]);

  const sourceCounts = useMemo(() => {
    const m = new Map<NcrSourceType, number>();
    for (const n of ncrs) m.set(n.sourceType, (m.get(n.sourceType) ?? 0) + 1);
    return m;
  }, [ncrs]);

  const hasAnything = ncrs.length > 0 || (!!kpis && kpis.totalTests > 0);

  const controls = (
    <div className="axos-no-print flex flex-wrap items-end gap-3">
      <Period label="Desde" value={from} onChange={setFrom} />
      <Period label="Hasta" value={to} onChange={setTo} />
      {(from || to) && (
        <button
          onClick={() => {
            setFrom("");
            setTo("");
          }}
          className="rounded-lg px-3 py-2 text-[13px] text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Todo el histórico
        </button>
      )}
    </div>
  );

  return (
    <ReportChrome
      title="Reporte de calidad (NCR / Yield)"
      subtitle="No-conformidades, severidad, origen y rendimiento de prueba — datos reales"
      controls={controls}
      canPrint={hasAnything}
    >
      {forbidden ? (
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title="Sin acceso a calidad"
          body="El reporte requiere acceso al backend de calidad (NCR). Verifica tu sesión y permisos."
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !hasAnything ? (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Sin datos de calidad en el periodo"
          body="No hay no-conformidades ni resultados de prueba para mostrar. Ajusta el rango de fechas o captura datos de calidad."
        />
      ) : (
        <>
          <DocLetterhead
            domain="quality"
            title="Reporte de calidad"
            subtitle="NCR · Severidad · Origen · Yield"
            docNumber={draftDocNumber("QR", from || "HIST")}
            meta={[
              {
                label: "Periodo",
                value: from || to ? `${from ? fmtDay(from) : "inicio"} → ${to ? fmtDay(to) : "hoy"}` : "Histórico completo",
              },
              { label: "NCR en periodo", value: `${summary.total}` },
              { label: "Abiertas", value: `${summary.open}` },
              { label: "Críticas abiertas", value: `${summary.critical}` },
              { label: "Generado por", value: orDash(generatedBy) },
            ]}
          />

          {/* Banda KPI */}
          <DocSection title="Indicadores">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="NCR abiertas" value={`${summary.open}`} accent={summary.open ? "#ef4444" : "#10b981"} />
              <KpiCard label="Críticas abiertas" value={`${summary.critical}`} accent={summary.critical ? "#ef4444" : "#10b981"} />
              <KpiCard label="Cerradas" value={`${summary.closed}`} accent="#10b981" />
              <KpiCard label="Total NCR" value={`${summary.total}`} accent="#6b7280" />
              <KpiCard
                label="First-Pass Yield"
                value={kpisForbidden ? "—" : kpis?.firstPassYieldPct != null ? `${kpis.firstPassYieldPct}%` : "—"}
                accent="#2ec27e"
              />
              <KpiCard
                label="Yield total"
                value={kpisForbidden ? "—" : kpis?.yieldPct != null ? `${kpis.yieldPct}%` : "—"}
                accent="#2ec27e"
              />
              <KpiCard label="Pruebas" value={kpisForbidden ? "—" : `${kpis?.totalTests ?? 0}`} accent="#6b7280" />
              <KpiCard
                label="Fallas de prueba"
                value={kpisForbidden ? "—" : `${kpis?.fail ?? 0}`}
                accent={(kpis?.fail ?? 0) > 0 ? "#ef4444" : "#10b981"}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Yield y fallas provienen del servicio de pruebas a nivel planta (no filtrado por el
              periodo seleccionado — no existe endpoint de yield por rango).
            </p>
          </DocSection>

          {/* Desgloses */}
          <div className="grid gap-6 sm:grid-cols-2">
            <DocSection title="NCR por severidad">
              <BarList
                rows={(["critical", "major", "minor"] as NcrSeverity[]).map((s) => ({
                  label: SEVERITY_LABEL[s],
                  count: summary.bySeverity[s] ?? 0,
                }))}
                total={summary.total}
              />
            </DocSection>
            <DocSection title="NCR por estado">
              <BarList
                rows={(Object.keys(STATUS_LABEL) as NcrStatus[]).map((s) => ({
                  label: STATUS_LABEL[s],
                  count: summary.byStatus[s] ?? 0,
                }))}
                total={summary.total}
              />
            </DocSection>
          </div>

          <DocSection title="NCR por origen">
            <BarList
              rows={(Object.keys(SOURCE_LABEL) as NcrSourceType[])
                .map((s) => ({ label: SOURCE_LABEL[s], count: sourceCounts.get(s) ?? 0 }))
                .filter((r) => r.count > 0)}
              total={summary.total}
            />
          </DocSection>

          {/* Pareto de categorías */}
          <DocSection title="Pareto de categorías de defecto (regla 80/20)">
            {pareto.length === 0 ? (
              <p className="text-[13px] text-gray-500">Sin categorías de defecto en el periodo.</p>
            ) : (
              <ParetoList rows={pareto} />
            )}
          </DocSection>

          {/* Detalle */}
          <DocSection title="Detalle de no-conformidades" right={`${ncrs.length} registro(s)`}>
            {ncrs.length === 0 ? (
              <p className="text-[13px] text-gray-500">Sin NCR en el periodo seleccionado.</p>
            ) : (
              <DocTable columns={ncrDetailCols} rows={ncrs} rowKey={(n) => n.id} />
            )}
          </DocSection>

          <BackendNote
            items={[
              "Endpoint de reporte de calidad por periodo (hoy: lista NCR completa filtrada en cliente; yields del servicio de pruebas son a nivel planta, sin rango).",
              "Folio oficial del reporte + firma/aprobación (aquí: número de control BORRADOR).",
              "Yield/FPY segmentado por modelo, línea o WO para cruzarlo con las NCR del mismo corte.",
            ]}
          />
        </>
      )}
    </ReportChrome>
  );
}

const ncrDetailCols: DocColumn<Ncr>[] = [
  { key: "n", header: "NCR", cell: (n) => n.ncrNumber, mono: true },
  { key: "date", header: "Fecha", cell: (n) => fmtDate(n.createdAt) },
  { key: "part", header: "Parte", cell: (n) => orDash(n.partNumber), mono: true },
  { key: "cat", header: "Categoría", cell: (n) => orDash(n.category) },
  { key: "sev", header: "Severidad", cell: (n) => SEVERITY_LABEL[n.severity] ?? n.severity },
  { key: "src", header: "Origen", cell: (n) => SOURCE_LABEL[n.sourceType] ?? n.sourceType },
  { key: "st", header: "Estado", cell: (n) => STATUS_LABEL[n.status] ?? n.status },
  { key: "qty", header: "Cant.", cell: (n) => n.quantityAffected, align: "right" },
];

// ── Atoms ────────────────────────────────────────────────────────────────────
function Period({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${glass} rounded-lg px-2.5 py-1.5 text-sm outline-none`}
      />
    </label>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="axos-avoid-break rounded-xl border border-gray-200 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function BarList({ rows, total }: { rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.every((r) => r.count === 0)) {
    return <p className="text-[13px] text-gray-500">Sin datos.</p>;
  }
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[12px]">
          <span className="w-28 shrink-0 truncate text-gray-600">{r.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-black/5">
            <div
              className="h-full rounded bg-emerald-500/70"
              style={{ width: `${(r.count / max) * 100}%`, printColorAdjust: "exact" }}
            />
          </div>
          <span className="w-16 shrink-0 text-right tabular-nums text-gray-500">
            {r.count}
            {total > 0 ? ` · ${Math.round((r.count / total) * 100)}%` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function ParetoList({ rows }: { rows: ParetoRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[12px]">
          <span className="w-36 shrink-0 truncate text-gray-600">{r.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded bg-black/5">
            <div
              className="h-full rounded bg-amber-500/80"
              style={{ width: `${(r.count / max) * 100}%`, printColorAdjust: "exact" }}
            />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums text-gray-500">
            {r.count} · {r.cumPct}%
          </span>
        </div>
      ))}
    </div>
  );
}
