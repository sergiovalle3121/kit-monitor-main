'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, FileCheck2, Info, X } from 'lucide-react';
import { assessDocCompatibility, type CompatibilitySeverity } from '@/lib/office/docCompatibility';

const META: Record<CompatibilitySeverity, { label: string; cls: string; icon: typeof Info }> = {
  critical: { label: 'Crítico', cls: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300', icon: AlertTriangle },
  warning: { label: 'Advertencia', cls: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-200', icon: AlertTriangle },
  info: { label: 'Info', cls: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-200', icon: Info },
};

export function DocCompatibilityPanel({ content }: { content: any }) {
  const [open, setOpen] = useState(false);
  const report = useMemo(() => assessDocCompatibility(content), [content]);
  const riskCount = report.totals.critical + report.totals.warning;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#171717] dark:text-gray-200 dark:hover:bg-white/10"
        title="Compatibilidad DOCX/PDF/HTML"
      >
        <FileCheck2 className="h-4 w-4 text-blue-500" />
        Compatibilidad
        {riskCount > 0 ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">{riskCount}</span> : null}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[54] bg-black/20" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-[55] flex w-[360px] flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161616]"
            >
              <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-black/5 px-4 dark:border-white/10">
                <span className="flex items-center gap-2 text-sm font-semibold"><FileCheck2 className="h-4 w-4 text-blue-500" />Compatibilidad</span>
                <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Score exportación</p>
                      <p className="mt-1 text-3xl font-semibold text-foreground">{report.score}</p>
                    </div>
                    {riskCount === 0 ? <CheckCircle2 className="h-9 w-9 text-emerald-500" /> : <AlertTriangle className="h-9 w-9 text-amber-500" />}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Evaluación estática de fidelidad para DOCX, PDF y HTML antes de compartir o liberar el documento.</p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2 dark:border-red-500/20 dark:bg-red-500/10"><p className="text-[10px] font-bold text-red-500">Crítico</p><p className="text-lg font-semibold text-red-600 dark:text-red-300">{report.totals.critical}</p></div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-[10px] font-bold text-amber-600">Warnings</p><p className="text-lg font-semibold text-amber-700 dark:text-amber-200">{report.totals.warning}</p></div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 dark:border-blue-500/20 dark:bg-blue-500/10"><p className="text-[10px] font-bold text-blue-600">Info</p><p className="text-lg font-semibold text-blue-700 dark:text-blue-200">{report.totals.info}</p></div>
                </div>

                {report.findings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 p-5 text-center dark:border-white/10">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                    <p className="text-sm font-semibold text-foreground">Sin riesgos detectados</p>
                    <p className="mt-1 text-xs text-gray-500">El contenido usa nodos y marcas conocidos por los exportadores actuales.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.findings.map((finding) => {
                      const meta = META[finding.severity];
                      const Icon = meta.icon;
                      return (
                        <div key={finding.id} className={`rounded-2xl border p-3 ${meta.cls}`}>
                          <div className="flex items-start gap-2">
                            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold">{finding.title}</p>
                                <span className="text-[10px] font-bold uppercase">{finding.target}</span>
                              </div>
                              <p className="mt-1 text-xs opacity-80">{finding.detail}</p>
                              <p className="mt-2 text-[10px] font-bold uppercase tracking-wide">{meta.label} · {finding.count}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
