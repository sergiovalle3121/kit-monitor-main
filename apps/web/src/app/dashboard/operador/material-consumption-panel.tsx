import { Package } from "lucide-react";
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
}: {
  materials: OperatorMaterial[];
}) {
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
            <MaterialConsumptionRow key={material.id} material={material} />
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialConsumptionRow({ material }: { material: OperatorMaterial }) {
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
      <div className="flex items-center justify-between text-sm mb-1">
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
      {material.description && (
        <div className="text-[11px] text-gray-400 mt-0.5">
          {material.description}
        </div>
      )}
    </div>
  );
}
