'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronDown, GitBranch, Loader2, MessageSquare, ShieldCheck, FileClock } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type TimelineKind = 'document' | 'version' | 'comment' | 'audit';
interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  action: string;
  actor?: string | null;
  at: string;
  details?: Record<string, unknown>;
}

const KIND_ICON: Record<TimelineKind, typeof Activity> = {
  document: FileClock,
  version: GitBranch,
  comment: MessageSquare,
  audit: ShieldCheck,
};

function rel(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'ahora';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

function prettyAction(action: string) {
  return action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function DocAuditTimeline({ docId }: { docId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || events.length || loading) return;
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch(`${API_BASE}/office-documents/${docId}/timeline`).then(async (res) => {
      if (!active) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setEvents(Array.isArray(body?.events) ? body.events : []);
    }).catch(() => {
      if (active) setError('No se pudo cargar la línea de tiempo.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [docId, events.length, loading, open]);

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} title="Línea de tiempo auditada"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10">
        <Activity className="h-4 w-4 text-indigo-500" />
        <span className="hidden lg:inline">Auditoría</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 z-20 mt-1 flex max-h-[70vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#1a1a1a]">
              <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
                <p className="text-sm font-bold">Línea de tiempo auditada</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Versiones, comentarios y cambios de lifecycle.</p>
              </div>
              <div className="overflow-y-auto p-2">
                {loading && <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>}
                {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10">{error}</p>}
                {!loading && !error && events.length === 0 && <p className="px-3 py-8 text-center text-sm text-gray-500">Sin eventos todavía.</p>}
                {!loading && !error && events.map((event) => {
                  const Icon = KIND_ICON[event.kind] ?? Activity;
                  return (
                    <div key={event.id} className="flex gap-3 rounded-xl px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5">
                      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Icon className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{prettyAction(event.action)}</p>
                          <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">{rel(event.at)}</span>
                        </div>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{event.actor || 'Sistema'} · {event.kind}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
