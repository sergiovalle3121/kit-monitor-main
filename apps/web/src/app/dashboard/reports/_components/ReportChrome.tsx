"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Printer } from "lucide-react";
import { PrintStyles } from "./PrintStyles";
import { fmtDate } from "../reports.utils";

/**
 * Marco compartido de toda página de reporte:
 *   - Barra superior sólo-pantalla (volver a Reportes + botón Imprimir/PDF).
 *   - Panel de controles sólo-pantalla (selectores) — `controls`.
 *   - La "hoja" `.axos-doc` (papel blanco) que contiene el documento + un pie de
 *     página estándar con la marca de tiempo de generación y la vía print-to-PDF.
 *
 * La marca de tiempo se fija UNA vez al montar (no se mueve con los refrescos de
 * SWR) para que el documento impreso tenga una hora de generación estable.
 */
export function ReportChrome({
  title,
  subtitle,
  controls,
  children,
  canPrint = true,
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
  canPrint?: boolean;
}) {
  const [generatedAt] = useState(() => new Date().toISOString());

  return (
    <div className="min-h-screen pb-32 font-sans text-black dark:text-white">
      <PrintStyles />
      <main className="mx-auto max-w-4xl px-6 pt-10">
        {/* Barra superior — sólo pantalla */}
        <div className="axos-no-print">
          <Link
            href="/dashboard/reports"
            className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <ChevronLeft className="h-4 w-4" /> Reportes
          </Link>
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
              {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
            </div>
            <button
              onClick={() => window.print()}
              disabled={!canPrint}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
              title={canPrint ? "Imprimir o guardar como PDF" : "Selecciona datos para generar el documento"}
            >
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </button>
          </div>
          {controls && <div className="mb-6">{controls}</div>}
        </div>

        {/* La hoja del documento: papel blanco fijo (no responde a modo oscuro)
            para verse como un documento real sobre el lienzo y para que el
            print-to-PDF salga limpio sin importar el tema del sistema. */}
        <article className="axos-doc axos-paper rounded-2xl border border-gray-200 bg-white p-7 text-gray-900 shadow-xl sm:p-9">
          <div className="space-y-6">{children}</div>
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-[10px] text-gray-400">
            <span>Generado: {fmtDate(generatedAt)}</span>
            <span>
              AXOS OS · Documento generado en cliente · Impresión PDF vía navegador (Imprimir →
              Guardar como PDF)
            </span>
          </footer>
        </article>
      </main>
    </div>
  );
}
