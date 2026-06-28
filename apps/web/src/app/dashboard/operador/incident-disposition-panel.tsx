"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { apiFetch } from "@/lib/apiFetch";
import { glass } from "@/lib/glass";

export interface DispositionIncident {
  id: number;
  type: string;
  severity: string;
  qtyAffected: number;
  blocksFlow: boolean;
  ncrId?: string | null;
  raisedBy: string | null;
}

export function IncidentDispositionPanel({
  incidents,
  apiBase,
  operator,
  refresh,
}: {
  incidents: DispositionIncident[];
  apiBase: string;
  operator: string;
  refresh: () => void;
}) {
  if (incidents.length === 0) return null;

  return (
    <div className="mt-5 space-y-3" aria-label="Incidentes abiertos de calidad">
      {incidents.map((incident) => (
        <IncidentDispositionRow
          key={incident.id}
          incident={incident}
          apiBase={apiBase}
          operator={operator}
          refresh={refresh}
        />
      ))}
    </div>
  );
}

function IncidentDispositionRow({
  incident,
  apiBase,
  operator,
  refresh,
}: {
  incident: DispositionIncident;
  apiBase: string;
  operator: string;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  async function disposition(dispositionType: "rework" | "scrap" | "use_as_is") {
    setBusy(dispositionType);
    try {
      const res = await apiFetch(
        `${apiBase}/mes/incidents/${incident.id}/disposition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            disposition: dispositionType,
            resolvedBy: operator,
            note: incident.ncrId
              ? `Disposición ${dispositionType} desde terminal operador para ${incident.ncrId}.`
              : `Disposición ${dispositionType} desde terminal operador.`,
          }),
        },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(
          typeof j.message === "string"
            ? j.message
            : "No se pudo registrar la disposición.",
          "Calidad",
        );
        return;
      }
      refresh();
    } catch {
      toast.error("No se pudo contactar el backend.", "Calidad");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`${glass} rounded-2xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500">
          {incident.severity}
        </span>
        <span className="font-bold">{incident.type}</span>
        {incident.blocksFlow && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
            BLOQUEA
          </span>
        )}
        {incident.ncrId && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
            {incident.ncrId}
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-400">
          {incident.qtyAffected} u segregadas · {incident.raisedBy}
        </span>
      </div>
      <div className="flex gap-2">
        {(["rework", "scrap", "use_as_is"] as const).map((dispositionType) => (
          <button
            key={dispositionType}
            onClick={() => disposition(dispositionType)}
            disabled={!!busy}
            className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy === dispositionType ? (
              <Loader2 className="w-4 h-4 animate-spin mx-auto" />
            ) : dispositionType === "rework" ? (
              incident.ncrId ? "Retrabajo + cerrar hold" : "Retrabajo"
            ) : dispositionType === "scrap" ? (
              incident.ncrId ? "Scrap + cerrar hold" : "Scrap"
            ) : (
              incident.ncrId ? "Liberar uso" : "Usar como está"
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
