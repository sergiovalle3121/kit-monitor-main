'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ClipboardCheck, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { assessReleaseReadiness, type ReleaseCheckStatus } from '@/lib/office/docReleaseReadiness';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const STATUS_META: Record<ReleaseCheckStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pass: { label: 'Listo', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300', icon: CheckCircle2 },
  warning: { label: 'Validar', cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200', icon: AlertTriangle },
  blocker: { label: 'Bloquea', cls: 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300', icon: AlertTriangle },
};

export function DocReleaseChecklist({ content, docId }: { content: any; docId: string }) {
  const [open, setOpen] = useState(false);
  const [serverOpenComments, setServerOpenComments] = useState(0);
  const [serverReadiness, setServerReadiness] = useState<any>(null);

  useEffect(() => {
    if (!open || !docId) return;
    let active = true;
    Promise.all([
      apiFetch(`${API_BASE}/office-documents/${docId}/comments?status=open`),
      apiFetch(`${API_BASE}/office-documents/${docId}/release-readiness`),
    ]).then(async ([commentsResponse, readinessResponse]) => {
      if (!active) return;
      if (commentsResponse.ok) {
        const rows = await commentsResponse.json();
        setServerOpenComments(Array.isArray(rows) ? rows.length : 0);
      }
      if (readinessResponse.ok) setServerReadiness(await readinessResponse.json());
    }).catch(() => undefined);
    return () => { active = false; };
  }, [open, docId]);

  const report = useMemo(() => assessReleaseReadiness(content, serverOpenComments), [content, serverOpenComments]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#171717] dark:text-gray-200 dark:hover:bg-white/10"
        title="Checklist de liberación"
      >
        <ClipboardCheck className="h-4 w-4 text-emerald-500" />
        Release gate
        {report.blockers > 0 ? <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-500/20 dark:text-red-200">{report.blockers}</span> : null}
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
                <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-emerald-500" />Checklist de liberación</span>
                <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Readiness score</p>
                      <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">{report.score}</p>
                    </div>
                    {report.ready ? <CheckCircle2 className="h-9 w-9 text-emerald-500" /> : <AlertTriangle className="h-9 w-9 text-red-500" />}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Gate previo a aprobar, liberar o exportar una copia controlada. Los bloqueos deben cerrarse antes de pasar a Effective.</p>
                  {serverReadiness && <p className="mt-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Servidor: score {serverReadiness.score} · {serverReadiness.blockers?.length ?? 0} bloqueo(s) · {serverReadiness.warnings?.length ?? 0} warning(s)</p>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2 dark:border-red-500/20 dark:bg-red-500/10"><p className="text-[10px] font-bold text-red-500">Bloqueos</p><p className="text-lg font-semibold text-red-600 dark:text-red-300">{report.blockers}</p></div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/20 dark:bg-amber-500/10"><p className="text-[10px] font-bold text-amber-600">Validar</p><p className="text-lg font-semibold text-amber-700 dark:text-amber-200">{report.warnings}</p></div>
                </div>

                {serverReadiness?.blockers?.length > 0 && <div className="space-y-2">{serverReadiness.blockers.map((item: any) => <div key={item.id} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><p className="text-xs font-bold">{item.label}</p><p className="mt-1 text-xs opacity-80">{item.detail}</p></div>)}</div>}

                {serverReadiness?.warnings?.length > 0 && <div className="space-y-2">{serverReadiness.warnings.map((item: any) => <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"><p className="text-xs font-bold">{item.label}</p><p className="mt-1 text-xs opacity-80">{item.detail}</p></div>)}</div>}

                <div className="space-y-2">
                  {report.checks.map((check) => {
                    const meta = STATUS_META[check.status];
                    const Icon = meta.icon;
                    return (
                      <div key={check.id} className={`rounded-2xl border p-3 ${meta.cls}`}>
                        <div className="flex items-start gap-2">
                          <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold">{check.label}</p>
                              <span className="text-[10px] font-bold uppercase">{meta.label}</span>
                            </div>
                            <p className="mt-1 text-xs opacity-80">{check.detail}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
