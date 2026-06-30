"use client";

/**
 * Bloque de firmas. Las líneas van EN BLANCO a propósito: no hay firma
 * electrónica ni autoridad de aprobación en el backend (REQUIERE BACKEND). El
 * documento se firma de forma manuscrita tras imprimir, o queda pendiente de un
 * flujo de e-sign futuro. Honesto: no simula una aprobación que no ocurrió.
 */
export function SignatureBlock({
  roles,
}: {
  roles: { label: string; hint?: string }[];
}) {
  return (
    <div className="axos-avoid-break grid grid-cols-2 gap-x-10 gap-y-8 pt-6 sm:grid-cols-3">
      {roles.map((r, i) => (
        <div key={i}>
          <div className="h-9 border-b border-gray-400" />
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            {r.label}
          </div>
          {r.hint && <div className="text-[10px] text-gray-500 dark:text-gray-400">{r.hint}</div>}
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Nombre · Firma · Fecha</div>
        </div>
      ))}
    </div>
  );
}
