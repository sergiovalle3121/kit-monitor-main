"use client";

import { useTranslations } from "next-intl";
import { HardHat, ListChecks, Info } from "lucide-react";

/**
 * Distingue visualmente una **Orden de Trabajo (WO)** de un **Carril de Plan**.
 * Son conceptos que el usuario confunde: una WO se ejecuta en piso y consume
 * material; un Plan secuencia el trabajo futuro. Este badge les da nombre,
 * color e ícono consistentes, más un tooltip "¿qué es esto?" desde el glosario.
 *
 * Sólo presentación/copy — no toca el modelo de datos.
 */
export type WorkType = "wo" | "plan";

export function WorkTypeBadge({
  type,
  code,
  showInfo = true,
  size = "sm",
  className = "",
}: {
  type: WorkType;
  /** Código opcional a mostrar junto a la etiqueta (p. ej. AX-WO-0001). */
  code?: string;
  /** Muestra el ícono "?" con el tooltip explicativo. */
  showInfo?: boolean;
  size?: "xs" | "sm";
  className?: string;
}) {
  const g = useTranslations("glossary");
  const isWo = type === "wo";

  const term = isWo ? g("wo.term") : g("plan.term");
  const abbr = isWo ? g("wo.abbr") : g("plan.abbr");
  const def = isWo ? g("wo.def") : g("plan.def");
  const Icon = isWo ? HardHat : ListChecks;

  // Colores distintos y consistentes: WO = ámbar (ejecución en piso),
  // Plan = índigo (planeación). Funcionan en claro y oscuro.
  const tone = isWo
    ? "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300"
    : "bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-300";

  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";
  const iconSize = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${tone} ${pad} ${className}`}
      title={`${term} — ${def}`}
    >
      <Icon className={iconSize} strokeWidth={2} aria-hidden />
      <span className="uppercase tracking-wide">{abbr}</span>
      {code && <span className="font-mono font-medium normal-case opacity-80">{code}</span>}
      {showInfo && (
        <Info
          className={`${iconSize} opacity-60`}
          strokeWidth={2}
          aria-label={`${term}: ${def}`}
        />
      )}
    </span>
  );
}
