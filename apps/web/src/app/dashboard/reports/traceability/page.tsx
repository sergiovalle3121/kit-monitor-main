"use client";

import { useMemo, useState } from "react";
import { ScanLine, Lock, Loader2, FileSearch, AlertTriangle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { glass } from "@/lib/glass";
import { ReportChrome } from "../_components/ReportChrome";
import { DocLetterhead } from "../_components/DocLetterhead";
import { DocSection } from "../_components/DocSection";
import { DocTable, type DocColumn } from "../_components/DocTable";
import { SignatureBlock } from "../_components/SignatureBlock";
import { BackendNote } from "../_components/BackendNote";
import { EmptyState } from "../_components/EmptyState";
import type { AsBuiltComponent, AsBuiltTree } from "../reports.types";
import { draftDocNumber, fmtDate, orDash } from "../reports.utils";

export default function TraceabilityPage() {
  const { user } = useAuth();
  const generatedBy = user?.email || "—";

  const [draft, setDraft] = useState("");
  const [serial, setSerial] = useState<string | null>(null);

  const path = serial ? `/genealogy/as-built/by-serial/${encodeURIComponent(serial)}` : null;
  const { data, isLoading, forbidden } = useApi<AsBuiltTree>(path, { refreshInterval: 0 });

  const tree = data ?? null;
  const hasData = !!tree && Array.isArray(tree.parts) && tree.parts.length > 0;

  function submit() {
    const s = draft.trim();
    setSerial(s.length ? s : null);
  }

  const controls = (
    <div className="axos-no-print space-y-2">
      <div className={`${glass} flex items-center gap-2 rounded-xl px-3 py-2`}>
        <ScanLine className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Escanea o escribe el número de serie…"
          className="w-full bg-transparent text-sm outline-none"
          autoFocus
        />
        <button
          onClick={submit}
          className="shrink-0 rounded-lg bg-black px-3 py-1.5 text-[13px] font-semibold text-white dark:bg-white dark:text-black"
        >
          Generar
        </button>
      </div>
      {serial && (
        <p className="text-[12px] text-gray-400">
          Serie consultada: <span className="font-mono">{serial}</span>
        </p>
      )}
    </div>
  );

  return (
    <ReportChrome
      title="Certificado de trazabilidad as-built"
      subtitle="Genealogía cuna-a-tumba por número de serie, desde el visor de genealogía"
      controls={controls}
      canPrint={hasData}
    >
      {!serial ? (
        <EmptyState
          icon={<FileSearch className="h-6 w-6" />}
          title="Ingresa un número de serie"
          body="Escanea o escribe la serie de la unidad para generar su certificado de trazabilidad as-built: qué lote/reel de cada número de parte se consumió, en qué estación, por quién y cuándo."
        />
      ) : forbidden ? (
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title="Sin acceso a genealogía"
          body="La trazabilidad as-built requiere el permiso production:report. Verifica tu rol y la conexión al backend."
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={<FileSearch className="h-6 w-6" />}
          title="Sin genealogía para esta serie"
          body={`No hay eslabones as-built registrados para «${serial}». La red de captura (terminal de operador / hooks de genealogía) aún no ha poblado el consumo de esta unidad.`}
        />
      ) : (
        <TraceCert tree={tree} generatedBy={generatedBy} />
      )}
    </ReportChrome>
  );
}

function TraceCert({ tree, generatedBy }: { tree: AsBuiltTree; generatedBy: string }) {
  const totalConsumptions = useMemo(
    () => tree.parts.reduce((s, p) => s + p.consumptions.length, 0),
    [tree],
  );

  const partCols: DocColumn<AsBuiltComponent>[] = [
    { key: "part", header: "Número de parte", cell: (p) => p.part, mono: true },
    { key: "qty", header: "Cant.", cell: (p) => p.totalQty, align: "right" },
    {
      key: "lots",
      header: "Lotes",
      cell: (p) => (p.lots.length ? p.lots.join(", ") : <GapTag />),
      mono: true,
    },
    {
      key: "reels",
      header: "Reels",
      cell: (p) => (p.reels.length ? p.reels.join(", ") : <span className="text-gray-300">—</span>),
      mono: true,
    },
  ];

  return (
    <>
      <DocLetterhead
        domain="quality"
        title="Certificado de trazabilidad as-built"
        subtitle="As-built genealogy certificate — cradle-to-grave por serie"
        docNumber={draftDocNumber("TRC", tree.serial)}
        meta={[
          { label: "Número de serie", value: orDash(tree.serial), mono: true },
          { label: "Modelo", value: orDash(tree.model), mono: true },
          { label: "Orden de trabajo", value: orDash(tree.woFolio || tree.woId), mono: true },
          { label: "Componentes", value: `${tree.componentCount}` },
          { label: "Primer consumo", value: fmtDate(tree.firstBuiltAt) },
          { label: "Último consumo", value: fmtDate(tree.lastBuiltAt) },
          { label: "Generado por", value: orDash(generatedBy) },
        ]}
      />

      {tree.lotCaptureGap && (
        <div className="axos-avoid-break flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-bold">Brecha de captura de lote.</span> Al menos un componente fue
            consumido sin lote/reel registrado. La genealogía de número de parte, estación, operador y
            hora SÍ está completa; el lote faltante debe cerrarse vía la red de captura (terminal de
            operador / hooks de genealogía) para trazabilidad de recall total.
          </span>
        </div>
      )}

      <DocSection title="Componentes consumidos (resumen por número de parte)" right={`${tree.componentCount} NP`}>
        <DocTable columns={partCols} rows={tree.parts} rowKey={(p) => p.part} />
      </DocSection>

      <DocSection title="Detalle de consumo (estación · operador · hora)" right={`${totalConsumptions} eventos`}>
        <div className="space-y-4">
          {tree.parts.map((p) => (
            <div key={p.part} className="axos-avoid-break">
              <div className="mb-1 font-mono text-[12px] font-semibold">{p.part}</div>
              <DocTable
                columns={[
                  { key: "lot", header: "Lote", cell: (c) => orDash(c.lot), mono: true },
                  { key: "reel", header: "Reel", cell: (c) => orDash(c.reel), mono: true },
                  { key: "qty", header: "Cant.", cell: (c) => c.qty, align: "right" },
                  { key: "stn", header: "Estación", cell: (c) => orDash(c.station) },
                  { key: "op", header: "Operador", cell: (c) => orDash(c.operator) },
                  { key: "ts", header: "Hora", cell: (c) => fmtDate(c.consumedAt) },
                ]}
                rows={p.consumptions}
                rowKey={(_, i) => `${p.part}-${i}`}
              />
            </div>
          ))}
        </div>
      </DocSection>

      <SignatureBlock
        roles={[
          { label: "Ingeniería de calidad", hint: "QA Engineer" },
          { label: "Trazabilidad / Genealogía", hint: "Traceability" },
        ]}
      />

      <BackendNote
        items={[
          "Folio oficial del certificado + firma electrónica + registro inmutable (aquí: número de control BORRADOR + firma manuscrita).",
          "Árbol multinivel de sub-ensambles (la genealogía ya guarda parent_serial; la recursión hija aún no se expone en as-built).",
          tree.lotCaptureGap
            ? "Cierre de la brecha de lote vía red de captura (terminal de operador → recordLink) para recall unidad-por-unidad completo."
            : "Puente de lote/reel desde MES para enriquecer consumos sin lote (cuando aplique).",
        ]}
      />
    </>
  );
}

function GapTag() {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      sin lote
    </span>
  );
}
