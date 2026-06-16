"use client";

import type { ReactNode } from "react";

/**
 * Sección titulada del documento. `right` permite poner un acento (resultado,
 * conteo) alineado a la derecha del encabezado de sección.
 */
export function DocSection({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="axos-avoid-break">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-gray-200 pb-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">{title}</h2>
        {right && <div className="text-[12px] font-medium text-gray-500">{right}</div>}
      </div>
      {children}
    </section>
  );
}
