"use client";

import { IconTile } from "@/components/ui/IconTile";
import type { DomainKey } from "@/lib/design/domains";
import { KeyValueGrid, type KeyValue } from "./KeyValueGrid";

/**
 * Membrete del documento: emblema del dominio + título + rejilla de metadatos de
 * control (número de control, fecha, generado por, workspace). Incluye un sello
 * BORRADOR honesto porque el folio no proviene de un servicio de numeración
 * oficial (REQUIERE BACKEND) — así el documento nunca se confunde con uno
 * controlado/aprobado.
 */
export function DocLetterhead({
  domain,
  title,
  subtitle,
  docNumber,
  meta,
  official = false,
  attestation,
}: {
  domain: DomainKey;
  title: string;
  subtitle?: string;
  docNumber: string;
  meta: KeyValue[];
  /** True cuando `docNumber` es un folio OFICIAL emitido por el servicio de
   *  numeración (no un borrador derivado en cliente). Cambia el sello. */
  official?: boolean;
  /** Firma electrónica: quién certificó, cuándo y el hash del contenido. Cuando
   *  está presente, el documento queda atestado + registrado en la bitácora. */
  attestation?: { by: string; at: string; hash?: string | null };
}) {
  return (
    <header className="axos-avoid-break border-b border-gray-200 pb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <IconTile domain={domain} size={48} />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
              AXOS OS · Documento de planta
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
        </div>
        <div className="text-right">
          {official ? (
            <span className="inline-block rounded-md border border-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Folio oficial
            </span>
          ) : (
            <span className="inline-block rounded-md border border-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Borrador · sin folio oficial
            </span>
          )}
          <div className="mt-1.5 font-mono text-[13px] font-semibold text-gray-900">{docNumber}</div>
        </div>
      </div>
      <div className="mt-4">
        <KeyValueGrid items={meta} cols={3} />
      </div>
      {attestation && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-snug text-emerald-800">
          <span className="font-semibold">Firma electrónica:</span> {attestation.by} ·{" "}
          {new Date(attestation.at).toLocaleString()}
          {attestation.hash ? (
            <>
              {" "}· <span className="font-mono">hash {attestation.hash}</span>
            </>
          ) : null}{" "}
          · registrado en la bitácora inmutable (Event Ledger).
        </div>
      )}
    </header>
  );
}
