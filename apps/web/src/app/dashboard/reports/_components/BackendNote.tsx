"use client";

import { ServerCog } from "lucide-react";

/**
 * Aviso honesto "REQUIERE BACKEND". Donde la generación formal del documento
 * (folio oficial, firma electrónica, registro inmutable, contenido a nivel serie)
 * exige backend que aún no existe, NO se inventa: se imprime esta nota. Sale
 * también en el PDF para que el documento nunca se confunda con uno controlado.
 *
 * Vive dentro de la "hoja" (papel blanco fijo) → estilos sólo claros.
 */
export function BackendNote({
  items,
  title = "REQUIERE BACKEND",
}: {
  items: string[];
  title?: string;
}) {
  if (!items.length) return null;
  return (
    <div className="axos-avoid-break rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
      <div className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-wider">
        <ServerCog className="h-3.5 w-3.5" /> {title}
      </div>
      <ul className="list-disc space-y-0.5 pl-5">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
