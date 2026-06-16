"use client";

import type { ReactNode } from "react";

export interface DocColumn<T> {
  key: string;
  header: string;
  /** Cell renderer. Return "—" for empty values (use `orDash`). */
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
}

/**
 * Tabla sobria optimizada para impresión: cabecera con borde inferior, filas con
 * separadores tenues, números tabulares. Sin zebra agresivo para no gastar tinta.
 */
export function DocTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: DocColumn<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string | number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-gray-300">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-2 py-1.5 font-semibold uppercase tracking-wide text-gray-500 ${
                  c.align === "right"
                    ? "text-right"
                    : c.align === "center"
                      ? "text-center"
                      : "text-left"
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-gray-100">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-2 py-1.5 align-top ${
                    c.align === "right"
                      ? "text-right tabular-nums"
                      : c.align === "center"
                        ? "text-center"
                        : "text-left"
                  } ${c.mono ? "font-mono" : ""}`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
