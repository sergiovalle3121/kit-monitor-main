"use client";

import { useMemo, useState } from "react";
import { Factory, Lock, Loader2, AlertTriangle, PackageX } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { ReportChrome } from "../_components/ReportChrome";
import { DocLetterhead } from "../_components/DocLetterhead";
import { DocSection } from "../_components/DocSection";
import { DocTable, type DocColumn } from "../_components/DocTable";
import { BackendNote } from "../_components/BackendNote";
import { EmptyState } from "../_components/EmptyState";
import type { RuntimeLine } from "../reports.types";
import { draftDocNumber, fmtDate, groupByShift, orDash, pct, type ShiftGroup } from "../reports.utils";

export default function ProductionReportPage() {
  const { user } = useAuth();
  const generatedBy = user?.email || "—";

  const { data: completedData, isLoading: cLoading, forbidden } =
    useApi<RuntimeLine[]>("/production-runtime/completed", { refreshInterval: 30000 });
  const { data: linesData } = useApi<RuntimeLine[]>("/production-runtime/lines", {
    refreshInterval: 30000,
  });

  // Une corridas completadas + líneas activas, dedup por kitId. Es el universo de
  // ejecución real que lleva el campo `shift`.
  const rows = useMemo(() => {
    const completed = Array.isArray(completedData) ? completedData : [];
    const active = Array.isArray(linesData) ? linesData : [];
    const seen = new Set<number>();
    const out: RuntimeLine[] = [];
    for (const r of [...completed, ...active]) {
      if (r && !seen.has(r.kitId)) {
        seen.add(r.kitId);
        out.push(r);
      }
    }
    return out;
  }, [completedData, linesData]);

  const groups = useMemo(() => groupByShift(rows), [rows]);
  const [shift, setShift] = useState<string>("all");
  const visibleGroups = shift === "all" ? groups : groups.filter((g) => g.shift === shift);

  const totals = useMemo(() => {
    const target = rows.reduce((s, r) => s + (Number(r.targetQty) || 0), 0);
    const done = rows.reduce((s, r) => s + (Number(r.completedQty) || 0), 0);
    return {
      target,
      done,
      attainment: pct(done, target),
      incidents: rows.filter((r) => r.hasIncident).length,
      shifts: groups.length,
      wos: new Set(rows.map((r) => r.workOrder)).size,
    };
  }, [rows, groups]);

  const hasData = rows.length > 0;

  const controls = hasData ? (
    <div className="axos-no-print inline-flex flex-wrap gap-1 rounded-xl bg-black/5 p-1 dark:bg-white/10">
      <ShiftTab active={shift === "all"} onClick={() => setShift("all")}>
        Todos los turnos
      </ShiftTab>
      {groups.map((g) => (
        <ShiftTab key={g.shift} active={shift === g.shift} onClick={() => setShift(g.shift)}>
          Turno {g.shift}
        </ShiftTab>
      ))}
    </div>
  ) : undefined;

  return (
    <ReportChrome
      title="Reporte de producción por turno"
      subtitle="Avance real vs objetivo por turno, sobre la ejecución de piso (MES)"
      controls={controls}
      canPrint={hasData}
    >
      {forbidden ? (
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title="Sin acceso a producción"
          body="El reporte requiere el permiso production:read. Verifica tu rol y la conexión al backend."
        />
      ) : cLoading ? (
        <div className="flex justify-center py-16 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={<Factory className="h-6 w-6" />}
          title="Sin ejecución de producción"
          body="No hay corridas activas ni completadas para reportar. Cuando el piso registre avance por bahía, aparecerá aquí agrupado por turno."
        />
      ) : (
        <>
          <DocLetterhead
            domain="production"
            title="Reporte de producción por turno"
            subtitle="Production by shift — attainment de piso"
            docNumber={draftDocNumber("PRD", shift === "all" ? "TURNOS" : shift)}
            meta={[
              { label: "Alcance", value: shift === "all" ? `${totals.shifts} turno(s)` : `Turno ${shift}` },
              { label: "Órdenes", value: `${totals.wos}` },
              { label: "Objetivo total", value: `${totals.target} u` },
              { label: "Completado", value: `${totals.done} u` },
              { label: "Attainment", value: `${totals.attainment}%` },
              { label: "Generado por", value: orDash(generatedBy) },
            ]}
          />

          {visibleGroups.map((g) => (
            <ShiftBlock key={g.shift} group={g} />
          ))}

          <BackendNote
            items={[
              "El reporte agrupa por el campo `shift` que traen las corridas; NO hay ventanas de turno (hora inicio/fin) ni corte por fecha del lado servidor — un reporte de turno por fecha+ventana requiere backend.",
              "Métricas de turno (OEE, disponibilidad, scrap por turno) no existen como endpoint; aquí sólo objetivo vs completado e incidencias abiertas.",
              "Folio oficial + firma del supervisor de turno (aquí: número de control BORRADOR).",
            ]}
          />
        </>
      )}
    </ReportChrome>
  );
}

function ShiftBlock({ group }: { group: ShiftGroup }) {
  const cols: DocColumn<RuntimeLine>[] = [
    { key: "wo", header: "WO", cell: (r) => orDash(r.workOrder), mono: true },
    { key: "model", header: "Modelo", cell: (r) => orDash(r.model), mono: true },
    { key: "line", header: "Línea", cell: (r) => orDash(r.line) },
    { key: "target", header: "Obj.", cell: (r) => r.targetQty, align: "right" },
    { key: "done", header: "Hecho", cell: (r) => r.completedQty, align: "right" },
    {
      key: "pct",
      header: "%",
      cell: (r) => `${pct(r.completedQty, r.targetQty)}%`,
      align: "right",
    },
    { key: "status", header: "Estado", cell: (r) => orDash(r.status) },
    {
      key: "flags",
      header: "Flags",
      cell: (r) => (
        <span className="inline-flex gap-1">
          {r.hasIncident && (
            <span title="Incidencia" className="inline-flex items-center gap-0.5 text-[10px] text-red-500">
              <AlertTriangle className="h-3 w-3" />
            </span>
          )}
          {(r.lowStockCount ?? 0) > 0 && (
            <span title="Bajo stock" className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
              <PackageX className="h-3 w-3" />
            </span>
          )}
          {!r.hasIncident && (r.lowStockCount ?? 0) === 0 && <span className="text-gray-300">—</span>}
        </span>
      ),
    },
  ];

  return (
    <DocSection
      title={`Turno ${group.shift}`}
      right={`${group.completedQty}/${group.targetQty} u · ${group.attainmentPct}% attainment`}
    >
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Órdenes" value={`${group.woCount}`} />
        <Stat label="Objetivo" value={`${group.targetQty} u`} />
        <Stat label="Completado" value={`${group.completedQty} u`} />
        <Stat
          label="Incidencias"
          value={`${group.incidents}`}
          accent={group.incidents ? "#ef4444" : undefined}
        />
      </div>
      <DocTable columns={cols} rows={group.lines} rowKey={(r) => r.kitId} />
      {group.lines.some((l) => l.completedAt) && (
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          Última corrida cerrada:{" "}
          {fmtDate(
            group.lines
              .map((l) => l.completedAt)
              .filter(Boolean)
              .sort()
              .slice(-1)[0],
          )}
        </p>
      )}
    </DocSection>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="axos-avoid-break rounded-xl border border-gray-200 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function ShiftTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-white shadow-sm dark:bg-white/15" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}
