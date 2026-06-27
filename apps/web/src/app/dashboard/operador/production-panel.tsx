import { Activity } from "lucide-react";
import { glass } from "@/lib/glass";
import {
  deriveProductionMetrics,
  type ProductionMetricStep,
} from "./operator-terminal.utils";

interface ProductionPanelBoard {
  execution: { quantity: number };
  steps: ProductionMetricStep[];
  downtimeSummarySec: number;
  openDowntime: { durationSec: number }[];
}

function formatDuration(sec: number) {
  const safe = Math.max(0, Math.floor(sec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ProductionPanel({
  board,
  overall,
}: {
  board: ProductionPanelBoard;
  overall: number;
}) {
  const metrics = deriveProductionMetrics({
    quantity: board.execution.quantity,
    steps: board.steps,
    overall,
    downtimeSummarySec: board.downtimeSummarySec,
    openDowntimeDurationsSec: board.openDowntime.map(
      (down) => down.durationSec,
    ),
  });
  const cards = [
    ["Objetivo", metrics.target, "u"],
    ["Real", metrics.real, "u"],
    ["Restante", metrics.remaining, "u"],
    ["Takt", "—", "s/u"],
    ["UPH", "—", "u/h"],
    ["OEE", metrics.oeePercent, "%"],
    ["Yield", metrics.yieldPercent, "%"],
    ["Scrap", metrics.scrap, "u"],
    ["Rework", metrics.rework, "u"],
    ["Downtime", formatDuration(metrics.downtimeSec), ""],
    ["WIP", metrics.wip, "u"],
  ] as const;
  return (
    <section className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-11 gap-3">
      {cards.map(([label, value, unit]) => (
        <div
          key={label}
          className={`${glass} rounded-3xl p-4 min-h-28 flex flex-col justify-between`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-widest">
              {label}
            </span>
            <Activity className="w-4 h-4" />
          </div>
          <div className="text-3xl font-black tabular-nums tracking-tight">
            {value}
            <span className="text-sm text-slate-400 ml-1">{unit}</span>
          </div>
        </div>
      ))}
    </section>
  );
}
