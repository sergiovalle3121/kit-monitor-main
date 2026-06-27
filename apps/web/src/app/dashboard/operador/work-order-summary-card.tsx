import { glass } from "@/lib/glass";

export interface WorkOrderSummaryExecution {
  workOrder: string;
  model: string;
  revision: string;
  line: number | null;
  quantity: number;
}

export function WorkOrderSummaryCard({
  execution,
  overall,
}: {
  execution: WorkOrderSummaryExecution;
  overall: number;
}) {
  return (
    <div className={`${glass} rounded-3xl p-5 mb-5`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-mono text-gray-400 mb-0.5">
            WO {execution.workOrder} · rev {execution.revision}
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {execution.model}
          </div>
          <div className="text-sm text-gray-500">
            Línea {execution.line ?? "—"} · {execution.quantity} unidades
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">
            {Math.round(overall * 100)}%
          </div>
          <div className="text-[11px] text-gray-500">avance total</div>
        </div>
      </div>
      <div className="mt-3">
        <WorkOrderProgress value={overall} />
      </div>
    </div>
  );
}

function WorkOrderProgress({ value }: { value: number }) {
  return (
    <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}
