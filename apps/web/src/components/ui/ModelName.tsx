"use client";

import { useModelDisplayName } from "@/lib/readability/modelNames";

/**
 * Muestra un código de modelo del seed (críptico) acompañado de su nombre
 * legible, p. ej. `AX-DRIVE-100 · Traction Controller Card`. Si no hay nombre
 * legible mapeado, cae con gracia al código solo. Sólo presentación.
 */
export function ModelName({
  code,
  className = "",
  nameClassName = "text-muted-foreground",
  layout = "inline",
}: {
  code: string | null | undefined;
  className?: string;
  nameClassName?: string;
  /** "inline" → `código · nombre`; "stacked" → código arriba, nombre debajo. */
  layout?: "inline" | "stacked";
}) {
  const resolve = useModelDisplayName();
  const display = resolve(code);

  if (!code) return null;
  if (!display) return <span className={className}>{code}</span>;

  if (layout === "stacked") {
    return (
      <span className={className}>
        <span className="block font-medium">{code}</span>
        <span className={`block text-xs ${nameClassName}`}>{display}</span>
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="font-medium">{code}</span>
      <span className={nameClassName}> · {display}</span>
    </span>
  );
}
