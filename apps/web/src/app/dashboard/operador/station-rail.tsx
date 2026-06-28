import { glass } from "@/lib/glass";

export type StationRailStatus = "pending" | "in_process" | "blocked" | "completed";

export interface StationRailStep {
  id: number;
  stepId: number;
  sequence: number;
  name: string;
  status: StationRailStatus;
  unitsTarget: number;
  unitsCompleted: number;
  scrapQty: number;
  starved: boolean;
}

const STATION_META: Record<StationRailStatus, { label: string; color: string }> = {
  pending: { label: "Pendiente", color: "#6b7280" },
  in_process: { label: "En proceso", color: "#f59e0b" },
  blocked: { label: "Bloqueado", color: "#ef4444" },
  completed: { label: "Completado", color: "#10b981" },
};

export function stationStatusMeta(status: StationRailStatus) {
  return STATION_META[status];
}

export function StationRail({
  steps,
  currentStepId,
  onSelectStep,
}: {
  steps: StationRailStep[];
  currentStepId: number | null;
  onSelectStep: (stepId: number) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1" aria-label="Estaciones de la ruta">
      {steps.map((step) => {
        const active = currentStepId === step.id;
        const meta = STATION_META[step.status];
        return (
          <button
            key={step.id}
            onClick={() => onSelectStep(step.stepId)}
            className={`${glass} flex-shrink-0 rounded-2xl px-4 py-3 text-left transition-all ${
              active ? "ring-2 ring-amber-400" : "opacity-80 hover:opacity-100"
            }`}
            style={{ minWidth: 150 }}
            aria-current={active ? "step" : undefined}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: step.starved ? "#f59e0b" : meta.color }}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Estación {step.sequence}
              </span>
            </div>
            <div className="font-bold text-sm truncate">{step.name}</div>
            <div className="text-[11px] text-gray-500 tabular-nums">
              {step.unitsCompleted}/{step.unitsTarget} u
              {step.scrapQty > 0 ? ` · ${step.scrapQty} scrap` : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
