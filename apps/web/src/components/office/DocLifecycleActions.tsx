'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronDown, CircleDot, FileLock2, FilePenLine, Lock, RotateCcw, Send, ShieldCheck, Archive } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useToast } from '@/contexts/ToastContext';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export type OfficeLifecycleState = 'draft' | 'in_review' | 'approved' | 'effective' | 'obsolete';

const STATE_META: Record<OfficeLifecycleState, { label: string; tone: string; icon: typeof FilePenLine; helper: string }> = {
  draft: { label: 'Borrador', tone: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300', icon: FilePenLine, helper: 'Editable y en preparación.' },
  in_review: { label: 'En revisión', tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', icon: CircleDot, helper: 'Listo para revisión formal.' },
  approved: { label: 'Aprobado', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', icon: ShieldCheck, helper: 'Aprobado y bloqueado; pendiente de liberación.' },
  effective: { label: 'Vigente', tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300', icon: FileLock2, helper: 'Documento efectivo en punto de uso.' },
  obsolete: { label: 'Obsoleto', tone: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300', icon: Archive, helper: 'Retirado de uso. Duplica para nueva revisión.' },
};

const ACTIONS: Record<string, { label: string; path: string; icon: typeof Send; next: OfficeLifecycleState; ownerOnly?: boolean; danger?: boolean }> = {
  submit: { label: 'Enviar a revisión', path: 'submit-review', icon: Send, next: 'in_review' },
  approve: { label: 'Aprobar', path: 'approve', icon: CheckCircle2, next: 'approved' },
  release: { label: 'Liberar vigente', path: 'release', icon: FileLock2, next: 'effective' },
  obsolete: { label: 'Obsoletar', path: 'obsolete', icon: Archive, next: 'obsolete', ownerOnly: true, danger: true },
  reopen: { label: 'Reabrir borrador', path: 'reopen-draft', icon: RotateCcw, next: 'draft', ownerOnly: true },
};

function actionsFor(state: OfficeLifecycleState) {
  if (state === 'draft') return ['submit', 'approve'];
  if (state === 'in_review') return ['approve', 'reopen'];
  if (state === 'approved') return ['release', 'reopen', 'obsolete'];
  if (state === 'effective') return ['obsolete'];
  return [];
}

export function DocLifecycleActions({
  docId,
  state,
  locked,
  canEdit,
  isOwner,
  onChanged,
}: {
  docId: string;
  state: OfficeLifecycleState;
  locked?: boolean;
  canEdit: boolean;
  isOwner: boolean;
  onChanged: (next: { lifecycleState: OfficeLifecycleState; locked?: boolean; approvedBy?: string | null; releasedBy?: string | null; obsoletedBy?: string | null }) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const meta = STATE_META[state] ?? STATE_META.draft;
  const StateIcon = meta.icon;
  const available = actionsFor(state).map((key) => ACTIONS[key]).filter((action) => !action.ownerOnly || isOwner);

  async function run(action: (typeof ACTIONS)[string]) {
    if (!canEdit && !action.ownerOnly) return;
    const note = window.prompt(`${action.label}\n\nNota opcional para auditoría:`, '');
    if (note === null) return;
    setBusy(action.path);
    try {
      const res = await apiFetch(`${API_BASE}/office-documents/${docId}/lifecycle/${action.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      const next = await res.json();
      onChanged(next);
      setOpen(false);
      toast.success(`Documento: ${STATE_META[next.lifecycleState as OfficeLifecycleState]?.label ?? action.next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el ciclo de vida.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`} title={meta.helper}>
        {locked ? <Lock className="h-3.5 w-3.5" /> : <StateIcon className="h-3.5 w-3.5" />}
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute right-0 z-20 mt-1 w-72 rounded-2xl border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#1a1a1a]">
              <div className="px-3 py-2">
                <p className="text-sm font-bold">Ciclo de vida documental</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{meta.helper}</p>
              </div>
              <div className="h-px bg-black/5 dark:bg-white/10" />
              {available.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">No hay transiciones disponibles para este estado.</p>
              ) : available.map((action) => {
                const Icon = action.icon;
                return (
                  <button key={action.path} onClick={() => run(action)} disabled={!!busy || (!canEdit && !action.ownerOnly)}
                    className={`mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-50 ${action.danger ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{busy === action.path ? 'Procesando…' : action.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">{STATE_META[action.next].label}</span>
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
