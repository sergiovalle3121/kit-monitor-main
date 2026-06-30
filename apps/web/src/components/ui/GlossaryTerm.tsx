"use client";

import { useTranslations } from "next-intl";

/**
 * Término de manufactura con su definición EN/ES en un tooltip accesible (usa
 * <abbr> nativo + subrayado punteado como affordance de "¿qué es esto?").
 * Las definiciones viven en el namespace `glossary` (un solo glosario,
 * consistente en ambos idiomas).
 *
 * Uso: <GlossaryTerm k="backflush" /> o <GlossaryTerm k="bom">BOM</GlossaryTerm>
 */
export type GlossaryKey =
  | "wo"
  | "plan"
  | "bom"
  | "routing"
  | "kitting"
  | "backflush"
  | "ctb"
  | "mes"
  | "npi"
  | "wip"
  | "wms"
  | "mrp"
  | "andon"
  | "genealogy";

export function GlossaryTerm({
  k,
  children,
  className = "",
}: {
  k: GlossaryKey;
  children?: React.ReactNode;
  className?: string;
}) {
  const g = useTranslations("glossary");
  const term = g(`${k}.term`);
  const def = g(`${k}.def`);
  const label = children ?? g(`${k}.short`);

  return (
    <abbr
      title={`${term} — ${def}`}
      className={`cursor-help no-underline border-b border-dotted border-current/40 ${className}`}
    >
      {label}
    </abbr>
  );
}
