'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Loader2, RotateCcw, Save, Clock } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Version { id: string; title: string; label: string | null; createdBy: string | null; createdAt: string }

function rel(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleString();
}

/** Version-history trigger + drawer for the Office editor. */
export function VersionHistory({
  docId, canEdit, onRestored,
}: {
  docId: string;
  canEdit: boolean;
  onRestored: (content: any, title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setVersions(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/versions`);
      setVersions(r.ok ? await r.json() : []);
    } catch { setVersions([]); }
  }
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }
  async function saveVersion() {
    setBusy(true);
    try {
      await apiFetch(`${API_BASE}/office-documents/${docId}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      await load();
    } finally { setBusy(false); }
  }
  async function restore(vid: string) {
    setBusy(true);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/versions/${vid}/restore`, { method: 'POST' });
      if (r.ok) { const doc = await r.json(); onRestored(doc.content, doc.title); setOpen(false); }
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={toggle} title="Historial de versiones"
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors">
        <History className="w-4 h-4" /> <span className="hidden lg:inline">Historial</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[54] bg-black/20" onClick={() => setOpen(false)} />
            <motion.aside
              initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 w-80 z-[55] bg-white dark:bg-[#161616] border-l border-black/10 dark:border-white/10 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-4 h-12 border-b border-black/5 dark:border-white/10 flex-shrink-0">
                <span className="font-semibold text-sm">Historial de versiones</span>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
              </div>

              {canEdit && (
                <div className="p-3 border-b border-black/5 dark:border-white/10">
                  <button onClick={saveVersion} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-60 transition-opacity">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar versión actual
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-2">
                {versions === null ? (
                  <div className="flex justify-center py-10 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : versions.length === 0 ? (
                  <div className="text-center text-sm text-gray-400 py-10 px-4">
                    Aún no hay versiones. Se guardan automáticamente mientras editas.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {versions.map((v) => (
                      <li key={v.id} className="group rounded-xl p-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{v.label || rel(v.createdAt)}</p>
                            <p className="text-[11px] text-gray-400 truncate">{v.label ? rel(v.createdAt) : ''}{v.createdBy ? ` · ${v.createdBy}` : ''}</p>
                          </div>
                          {canEdit && (
                            <button onClick={() => restore(v.id)} disabled={busy} title="Restaurar esta versión"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-40">
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
