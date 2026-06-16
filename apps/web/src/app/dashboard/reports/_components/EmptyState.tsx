"use client";

import type { ReactNode } from "react";

/**
 * Estado vacío honesto. Cuando falta el dato (sin selección, sin permiso, sin
 * registro), se dice con claridad qué falta y por qué — nunca se rellena con
 * datos inventados ni ceros engañosos.
 */
export function EmptyState({
  icon,
  title,
  body,
  cta,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  cta?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-gray-100 p-4 text-gray-400">{icon}</div>
      <h3 className="mb-1 text-lg font-bold text-gray-900">{title}</h3>
      <p className="max-w-md text-sm text-gray-500">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
