'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, GitPullRequestArrow, PenLine, Trash2, X } from 'lucide-react';
import { summarizeTrackedChanges } from '@/lib/office/trackChangesSummary';

function formatDate(value: number | null) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function truncate(text: string, max = 140) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function DocReviewSummary({ content }: { content: any }) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => summarizeTrackedChanges(content), [content]);
  const pendingLabel = summary.total > 99 ? '99+' : String(summary.total);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#171717] dark:text-gray-200 dark:hover:bg-white/10"
        title="Resumen de cambios sugeridos"
      >
        <GitPullRequestArrow className="h-4 w-4 text-amber-500" />
        Revisión
        {summary.total > 0 ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">{pendingLabel}</span> : null}
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
                <span className="flex items-center gap-2 text-sm font-semibold"><GitPullRequestArrow className="h-4 w-4 text-amber-500" />Resumen de revisión</span>
                <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-black/10 p-3 dark:border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Pendientes</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{summary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">Insert</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{summary.insertions}</p>
                  </div>
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-500">Delete</p>
                    <p className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-300">{summary.deletions}</p>
                  </div>
                </div>

                {summary.total === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 p-5 text-center dark:border-white/10">
                    <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
                    <p className="text-sm font-semibold text-foreground">No hay redlines pendientes</p>
                    <p className="mt-1 text-xs text-gray-500">El documento está limpio para revisión formal o liberación.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-black/10 p-3 dark:border-white/10">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Impacto por autor</p>
                      <div className="space-y-2">
                        {summary.authors.map((author) => (
                          <div key={author.author} className="rounded-xl bg-gray-50 p-2 dark:bg-white/5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{author.author}</p>
                              <span className="text-[11px] text-gray-400">+{author.charactersAdded} / -{author.charactersRemoved} chars</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[11px]">
                              <span className="inline-flex items-center gap-1 text-emerald-600"><PenLine className="h-3 w-3" />{author.insertions} inserciones</span>
                              <span className="inline-flex items-center gap-1 text-red-500"><Trash2 className="h-3 w-3" />{author.deletions} eliminaciones</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Cambios recientes</p>
                      {summary.items.slice(0, 25).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-black/10 p-3 dark:border-white/10">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${item.type === 'insertion' ? 'text-emerald-600' : 'text-red-500'}`}>{item.type === 'insertion' ? 'Inserción' : 'Eliminación'}</span>
                            <span className="text-[10px] text-gray-400">{formatDate(item.date)}</span>
                          </div>
                          <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-200">{item.author}</p>
                          <p className={`mt-1 text-sm ${item.type === 'deletion' ? 'text-red-500 line-through' : 'text-emerald-700 dark:text-emerald-300'}`}>“{truncate(item.text)}”</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
