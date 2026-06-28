"use client";

import { useState } from "react";
import { Loader2, Package } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { apiFetch } from "@/lib/apiFetch";
import { glass } from "@/lib/glass";

export interface OperatorMaterial {
  id: number;
  partNumber: string;
  description: string | null;
  unit: string;
  plannedQty: number;
  consumedQty: number;
  availableQty: number;
  short: boolean;
}

const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";

export function MaterialConsumptionPanel({
  materials,
  kitId,
  operator,
  workOrder,
  apiBase,
  refresh,
}: {
  materials: OperatorMaterial[];
  kitId: number | null;
  operator: string;
  workOrder: string;
  apiBase: string;
  refresh: () => void;
}) {
  const [busyPart, setBusyPart] = useState<string | null>(null);
  const toast = useToast();

  async function requestMaterial(material: OperatorMaterial) {
    if (!kitId) {
      toast.error(
        "Esta ejecución no tiene kit ligado; no se puede crear solicitud de material.",
        "Material",
      );
      return;
    }
    setBusyPart(material.partNumber);
    try {
      const res = await apiFetch(`${apiBase}/material-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kitId,
          requestedBy: operator,
          note: `Terminal operador · WO ${workOrder} · ${material.partNumber} · disponible ${material.availableQty}/${material.plannedQty} ${material.unit}`,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(
          typeof j.message === "string"
            ? j.message
            : "No se pudo solicitar material.",
          "Material",
        );
        return;
      }
      toast.success(`Solicitud de material creada para ${material.partNumber}.`, "Material");
      refresh();
    } catch {
      toast.error("Sin conexión al solicitar material.", "Material");
    } finally {
      setBusyPart(null);
    }
  }

  return (
    <div className={`${glass} rounded-3xl p-5`}>
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <Package className="w-4 h-4 text-gray-400" /> Materiales del paso
      </h3>
      {materials.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          Esta estación no tiene materiales asignados en la ruta.
        </p>
      ) : (
        <div className="space-y-3">
          {materials.map((material) => (
            <MaterialConsumptionRow
              key={material.id}
              material={material}
              busy={busyPart === material.partNumber}
              canRequest={!!kitId && material.short}
              onRequest={() => requestMaterial(material)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialConsumptionRow({
  material,
  busy,
  canRequest,
  onRequest,
}: {
  material: OperatorMaterial;
  busy: boolean;
  canRequest: boolean;
  onRequest: () => void;
}) {
  const pct =
    material.plannedQty > 0
      ? Math.min(1, material.consumedQty / material.plannedQty)
      : 0;
  const color = material.short
    ? RED
    : material.availableQty <= material.plannedQty * 0.15
      ? AMBER
      : GREEN;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm mb-1">
        <span className="font-mono font-semibold">{material.partNumber}</span>
        <span className="tabular-nums text-gray-500">
          {material.consumedQty}/{material.plannedQty} {material.unit}
          {material.short && (
            <span className="ml-2 text-rose-500 font-bold">FALTA</span>
          )}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        {material.description && (
          <div className="text-[11px] text-gray-400">{material.description}</div>
        )}
        {material.short && (
          <button
            onClick={onRequest}
            disabled={!canRequest || busy}
            className="ml-auto rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-black text-amber-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Solicitar"}
          </button>
        )}
      </div>
    </div>
  );
}
