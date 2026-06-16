"use client";

import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import type { Conformance } from "../reports.utils";

const META: Record<
  Conformance,
  { label: string; color: string; bg: string; icon: typeof CheckCircle2 }
> = {
  conforme: { label: "CONFORME", color: "#10b981", bg: "#10b9811a", icon: CheckCircle2 },
  condicional: { label: "LIBERACIÓN CONDICIONAL", color: "#f59e0b", bg: "#f59e0b1a", icon: AlertTriangle },
  no_conforme: { label: "NO CONFORME", color: "#ef4444", bg: "#ef44441a", icon: XCircle },
  sin_datos: { label: "SIN EVIDENCIA SUFICIENTE", color: "#6b7280", bg: "#6b72801a", icon: HelpCircle },
};

/**
 * Veredicto de conformidad del CoC, derivado SOLO de la evidencia disponible
 * (OQC + NCRs abiertas). Si no hay evidencia, lo dice — nunca declara conforme
 * por defecto.
 */
export function ConformanceBanner({
  verdict,
  reasons,
}: {
  verdict: Conformance;
  reasons: string[];
}) {
  const m = META[verdict];
  const Icon = m.icon;
  return (
    <div
      className="axos-avoid-break rounded-xl border px-4 py-3"
      style={{ borderColor: m.color, background: m.bg }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" style={{ color: m.color }} />
        <span className="text-sm font-bold tracking-wide" style={{ color: m.color }}>
          {m.label}
        </span>
      </div>
      {reasons.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-7 text-[12px] text-gray-700">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
