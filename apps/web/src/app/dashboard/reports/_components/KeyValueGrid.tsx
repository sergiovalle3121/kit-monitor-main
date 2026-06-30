"use client";

import type { ReactNode } from "react";

export interface KeyValue {
  label: string;
  value: ReactNode;
  /** Render the value monospaced (folios, serials, WOs). */
  mono?: boolean;
}

/**
 * Rejilla de pares etiqueta/valor para los encabezados de documento. Valores
 * vacíos deben llegar ya como "—" (ver `orDash`) para no mostrar huecos.
 */
export function KeyValueGrid({ items, cols = 3 }: { items: KeyValue[]; cols?: 2 | 3 | 4 }) {
  const colClass =
    cols === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : cols === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";
  return (
    <dl className={`grid ${colClass} gap-x-6 gap-y-3`}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {it.label}
          </dt>
          <dd className={`truncate text-[13px] font-medium ${it.mono ? "font-mono" : ""}`}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
