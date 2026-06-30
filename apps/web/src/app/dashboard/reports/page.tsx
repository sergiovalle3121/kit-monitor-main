"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileCheck2, ScanLine, ShieldCheck, Factory, Printer, ServerCog, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { glass } from "@/lib/glass";
import { IconTile } from "@/components/ui/IconTile";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DomainKey } from "@/lib/design/domains";

interface ReportCard {
  name: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  domain: DomainKey;
  source: string;
}

// Cada documento se genera 100% en cliente sobre endpoints reales — sin mock.
const REPORTS: ReportCard[] = [
  {
    name: "Certificado de Conformancia (CoC)",
    desc: "Por orden de trabajo o por embarque. Cruza OQC + NCR para un veredicto de conformidad honesto.",
    href: "/dashboard/reports/coc",
    icon: FileCheck2,
    domain: "quality",
    source: "/plans · /outbound/shipments · /quality/oqc/history · /ncr",
  },
  {
    name: "Trazabilidad as-built por serie",
    desc: "Genealogía cuna-a-tumba de una unidad: lote/reel por NP, estación, operador y hora.",
    href: "/dashboard/reports/traceability",
    icon: ScanLine,
    domain: "quality",
    source: "/genealogy/as-built/by-serial/:serial",
  },
  {
    name: "Reporte de calidad (NCR / Yield)",
    desc: "No-conformidades por severidad/origen, Pareto de defectos y rendimiento de prueba.",
    href: "/dashboard/reports/quality",
    icon: ShieldCheck,
    domain: "quality",
    source: "/ncr · /testing/kpis",
  },
  {
    name: "Producción por turno",
    desc: "Avance real vs objetivo agrupado por turno, con incidencias y bajo stock.",
    href: "/dashboard/reports/production",
    icon: Factory,
    domain: "production",
    source: "/production-runtime/completed · /production-runtime/lines",
  },
];

export default function ReportsHubPage() {
  return (
    <div className="min-h-screen pb-32 font-sans text-foreground">
      <main className="mx-auto max-w-4xl px-6 pt-10">
        <PageHeader
          domain="office"
          title="Reportes"
          subtitle="Generador de documentos de planta sobre datos existentes — client-side / print-to-PDF"
          icon={FileText}
        />

        {/* Cómo funciona / límites honestos */}
        <div className={`${glass} mb-7 rounded-2xl p-4`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <Printer className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              <p className="text-[13px] text-gray-600 dark:text-gray-300">
                <span className="font-semibold">Impresión a PDF:</span> cada documento se genera en el
                navegador. Usa <span className="font-medium">Imprimir / PDF</span> y elige “Guardar como
                PDF”. La hoja sale aislada (sin la interfaz del dashboard).
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <ServerCog className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-[13px] text-gray-600 dark:text-gray-300">
                <span className="font-semibold">Folio oficial:</span> el Certificado de Conformancia ya
                puede <span className="font-medium">emitir un folio oficial</span> (servicio de
                numeración, COC-). Hasta emitirlo, el documento sale como{" "}
                <span className="font-medium">BORRADOR</span>. La firma electrónica y el registro
                inmutable en el ledger siguen pendientes.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {REPORTS.map((r, i) => (
            <motion.div
              key={r.href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={r.href}
                className={`${glass} group flex h-full min-w-0 flex-col gap-3 rounded-2xl p-5 transition hover:shadow-md`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <IconTile domain={r.domain} size={46} icon={r.icon} />
                  <h3 className="min-w-0 truncate text-[15px] font-bold leading-tight tracking-tight">{r.name}</h3>
                </div>
                <p className="text-[13px] text-gray-500 dark:text-gray-400">{r.desc}</p>
                <code className="mt-auto block truncate text-[10px] text-gray-500 dark:text-gray-400">{r.source}</code>
              </Link>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
