import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  WifiOff,
  XCircle,
} from "lucide-react";
import { glass } from "@/lib/glass";
import type {
  OperatorReadiness,
  OperatorReadinessCheck,
} from "./operator-terminal.utils";

const STATUS_LABEL: Record<OperatorReadiness["status"], string> = {
  READY: "READY · Puede correr",
  WARNING: "WARNING · Corre con atención",
  BLOCKED: "BLOCKED · No confirmar",
  OFFLINE_READY: "OFFLINE READY · Cola activa",
  NO_WORK_ORDER: "Sin WO montada",
};

export function ReadinessPanel({ readiness }: { readiness: OperatorReadiness }) {
  const tone =
    readiness.status === "READY" || readiness.status === "OFFLINE_READY"
      ? "emerald"
      : readiness.status === "WARNING"
        ? "amber"
        : "rose";
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-500"
      : tone === "amber"
        ? "bg-amber-500/15 text-amber-500"
        : "bg-rose-500/15 text-rose-500";

  return (
    <section className={`${glass} mb-5 rounded-3xl p-5`}>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-2xl grid place-items-center ${toneClass}`}>
          {readiness.status === "OFFLINE_READY" ? (
            <WifiOff className="w-6 h-6" />
          ) : (
            <ShieldCheck className="w-6 h-6" />
          )}
        </div>
        <div className="mr-auto">
          <h3 className="text-lg font-black tracking-tight">
            Station readiness / Go-No-Go
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {STATUS_LABEL[readiness.status]}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tabular-nums">
            {readiness.score}%
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            score
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {readiness.checks.map((check) => (
          <ReadinessCheckTile key={check.id} check={check} />
        ))}
      </div>
    </section>
  );
}

function ReadinessCheckTile({ check }: { check: OperatorReadinessCheck }) {
  const icon =
    check.status === "pass" ? (
      <CheckCircle2 className="w-4 h-4" />
    ) : check.status === "fail" ? (
      <XCircle className="w-4 h-4" />
    ) : (
      <AlertTriangle className="w-4 h-4" />
    );
  const cls =
    check.status === "pass"
      ? "bg-emerald-500/10 text-emerald-600"
      : check.status === "fail"
        ? "bg-rose-500/10 text-rose-500"
        : "bg-amber-500/10 text-amber-600";
  return (
    <div className={`rounded-2xl p-3 ${cls}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
        {icon}
        {check.label}
      </div>
      {check.reason && (
        <div className="mt-1 text-[11px] font-semibold opacity-80">
          {check.reason}
        </div>
      )}
    </div>
  );
}
