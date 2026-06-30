'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, CheckCircle2, Download, FileJson, Loader2, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const fmt = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

function downloadJson(payload: any, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DocEvidencePackagePanel({ docId, title }: { docId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pkg, setPkg] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    if (pkg || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`${API_BASE}/office-documents/${docId}/evidence-package`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setPkg(await response.json());
    } catch {
      setError('No se pudo generar el paquete de evidencia.');
    } finally {
      setLoading(false);
    }
  }

  const safeTitle = (title || 'documento').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'documento';
  const counts = pkg?.counts ?? {};

  async function downloadPackage() {
    if (!pkg) return;
    await apiFetch(`${API_BASE}/office-documents/${docId}/distributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'download',
        format: 'other',
        purpose: 'Paquete de evidencia AXOS Docs',
        metadata: { evidencePackageId: pkg.packageId, evidenceGeneratedAt: pkg.generatedAt },
      }),
    }).catch(() => undefined);
    downloadJson(pkg, `${safeTitle}-evidence-package.json`);
  }

  return (
    <>
      <button
        onClick={load}
        className="relative inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-[#171717] dark:text-gray-200 dark:hover:bg-white/10"
        title="Paquete de evidencia"
      >
        <Archive className="h-4 w-4 text-violet-500" />
        Evidence pack
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[54] bg-black/20" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 z-[55] flex w-[400px] flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161616]"
            >
              <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-black/5 px-4 dark:border-white/10">
                <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-violet-500" />Paquete de evidencia</span>
                <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {loading && <div className="rounded-2xl border border-black/10 p-4 text-sm text-gray-500 dark:border-white/10"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Generando evidencia…</div>}
                {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

                {pkg && (
                  <>
                    <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">Controlled evidence package</p>
                      <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{pkg.document?.title ?? title}</h3>
                      <p className="mt-1 text-xs text-gray-500">Generado {fmt(pkg.generatedAt)} por {pkg.generatedBy || '—'}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5"><span className="block text-gray-500 dark:text-gray-400">Estado</span><b>{pkg.document?.lifecycleState}</b></div>
                        <div className="rounded-xl bg-gray-50 p-2 dark:bg-white/5"><span className="block text-gray-500 dark:text-gray-400">Hash</span><b className="break-all font-mono text-[10px]">{pkg.document?.contentHash}</b></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['Readiness', `${pkg.readiness?.score ?? 0}%`],
                        ['Comentarios abiertos', counts.openComments ?? 0],
                        ['Reviews pendientes', counts.pendingReviewTasks ?? 0],
                        ['Training pendiente', counts.pendingTrainingAssignments ?? 0],
                        ['Firmas activas', counts.activeSignatures ?? 0],
                        ['Eventos timeline', counts.timelineEvents ?? 0],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-black/10 p-3 dark:border-white/10">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">{label}</p>
                          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Contenido del paquete</p>
                      <ul className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <li>Metadata controlada, lifecycle, hash y ubicación DMS.</li>
                        <li>Release readiness, comentarios, reviews, training, firmas y distribuciones.</li>
                        <li>Search index, smart refs, fields, versiones recientes y timeline audit-ready.</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-black/5 p-3 dark:border-white/10">
                <button
                  disabled={!pkg}
                  onClick={downloadPackage}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900"
                >
                  <Download className="h-4 w-4" /> Descargar JSON <FileJson className="h-4 w-4" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
