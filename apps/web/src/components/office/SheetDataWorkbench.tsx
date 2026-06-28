"use client";
import React, { useMemo, useState } from "react";
import {
  Activity,
  Database,
  Layers,
  RefreshCw,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import {
  AXOS_DATA_WORKBENCH_PLANS,
  buildAxosDataWorkbench,
  connectorCatalogSummary,
  type WorkbenchBuildResult,
} from "@/lib/office/dataWorkbench";

export function SheetDataWorkbench({
  onBuild,
  onClose,
}: {
  onBuild: (result: WorkbenchBuildResult) => void;
  onClose: () => void;
}) {
  const [planId, setPlanId] = useState(AXOS_DATA_WORKBENCH_PLANS[0]?.id ?? "");
  const preview = useMemo(
    () => buildAxosDataWorkbench(planId, new Date("2026-06-28T00:00:00.000Z")),
    [planId],
  );
  const catalog = useMemo(() => connectorCatalogSummary(), []);
  const selected =
    AXOS_DATA_WORKBENCH_PLANS.find((x) => x.id === planId) ??
    AXOS_DATA_WORKBENCH_PLANS[0];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111]">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
              <Wand2 className="h-4 w-4" /> AXOS Sheets Data Intelligence
              Workbench
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">
              Power Query + Power Pivot para manufactura
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Construye un workbook conectado con tablas gobernadas, pasos de
              transformación, modelo pivot y dashboard sin exportar CSVs fuera
              de AXOS.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-semibold text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[320px_1fr]">
          <aside className="border-r border-black/10 p-4 dark:border-white/10">
            <div className="space-y-2">
              {AXOS_DATA_WORKBENCH_PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setPlanId(plan.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${plan.id === planId ? "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-500/10 dark:text-emerald-100" : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"}`}
                >
                  <div className="text-sm font-bold">{plan.title}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {plan.description}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.04]">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                <Database className="h-4 w-4" /> Catálogo live
              </div>
              <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                {catalog.map((x) => (
                  <div key={x}>• {x}</div>
                ))}
              </div>
            </div>
          </aside>
          <main className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <Kpi
                icon={<Database className="h-4 w-4" />}
                label="Conectores"
                value={String(preview.connectors.length)}
              />
              <Kpi
                icon={<RefreshCw className="h-4 w-4" />}
                label="Query steps"
                value={String(preview.steps.length)}
              />
              <Kpi
                icon={<Layers className="h-4 w-4" />}
                label="Modelos pivot"
                value={String(preview.pivots.length)}
              />
              <Kpi
                icon={<Activity className="h-4 w-4" />}
                label="Charts"
                value={String(preview.charts.length)}
              />
            </div>
            <section className="rounded-3xl border border-black/10 p-4 dark:border-white/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Pipeline
                gobernado: {selected?.title}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {preview.steps.map((step, index) => (
                  <div
                    key={`${step.kind}-${index}`}
                    className="rounded-2xl bg-gray-50 p-3 dark:bg-white/[0.04]"
                  >
                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-600">
                      {index + 1}. {step.kind}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                      {step.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {step.detail}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
        <div className="flex items-center justify-between border-t border-black/10 p-4 dark:border-white/10">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {preview.summary}
          </span>
          <button
            onClick={() => onBuild(buildAxosDataWorkbench(planId))}
            className="rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700"
          >
            Crear workbench
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}
