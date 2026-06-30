'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, GraduationCap, Loader2, UserPlus, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface TrainingAssignment {
  id: string;
  assigneeEmail: string;
  assignedBy?: string | null;
  status: 'pending' | 'acknowledged' | 'cancelled';
  dueAt?: string | null;
  acknowledgedAt?: string | null;
  signatureId?: string | null;
  note?: string | null;
}

function relDate(iso?: string | null) {
  if (!iso) return 'sin fecha';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso));
}

export function DocTrainingPanel({ docId, isOwner }: { docId: string; isOwner: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<TrainingAssignment[]>([]);
  const [assignees, setAssignees] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myEmail = user?.email?.toLowerCase();
  const minePending = useMemo(() => items.filter((item) => item.status === 'pending' && item.assigneeEmail.toLowerCase() === myEmail), [items, myEmail]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/training`);
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setError('No se pudo cargar entrenamiento.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function assign() {
    setBusy(true); setError(null);
    try {
      const parsed = assignees.split(',').map((value) => value.trim()).filter(Boolean);
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/training`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignees: parsed, dueAt: dueAt || null, note: note || null }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setAssignees(''); setDueAt(''); setNote('');
      await load();
    } catch { setError('No se pudo asignar entrenamiento.'); }
    finally { setBusy(false); }
  }

  async function acknowledge(id: string) {
    setBusy(true); setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/training/${id}/acknowledge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerName: user?.email, signerRole: 'AXOS user' }),
      });
      if (!r.ok) throw new Error(String(r.status));
      await load();
    } catch { setError('No se pudo confirmar entrenamiento.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10" title="Entrenamiento / lectura requerida">
        <GraduationCap className="h-4 w-4" /> <span className="hidden xl:inline">Entrenamiento</span>
        {minePending.length > 0 && <span className="rounded-full bg-amber-700 px-1.5 py-0.5 text-[10px] text-white">{minePending.length}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111]">
              <header className="flex items-start justify-between gap-3 border-b border-black/10 p-5 dark:border-white/10">
                <div><div className="flex items-center gap-2 text-sm font-bold"><GraduationCap className="h-4 w-4 text-amber-500" /> Entrenamiento documental</div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Asigna lectura obligatoria y captura acuses firmados.</p></div>
                <button onClick={() => setOpen(false)} className="rounded-full p-2 text-gray-500 dark:text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button>
              </header>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {isOwner && <div className="rounded-3xl border border-amber-500/20 bg-amber-50/60 p-4 dark:bg-amber-500/10">
                  <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Asignar por email</label>
                  <input value={assignees} onChange={(e) => setAssignees(e.target.value)} placeholder="user@axos.com, operador@axos.com" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10" />
                  <input value={dueAt} onChange={(e) => setDueAt(e.target.value)} type="date" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10" />
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota / motivo" className="mt-2 h-20 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10" />
                  <button onClick={assign} disabled={busy || !assignees.trim()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"><UserPlus className="h-4 w-4" /> Asignar</button>
                </div>}

                {loading ? <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  : error ? <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</div>
                  : items.length === 0 ? <div className="rounded-3xl border border-dashed border-black/10 p-6 text-center text-sm text-gray-500 dark:border-white/10">Sin entrenamiento asignado.</div>
                  : <div className="space-y-3">{items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-black/5 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{item.assigneeEmail}</p><p className="text-xs text-gray-500">Vence: {relDate(item.dueAt)} · {item.status}</p></div>{item.status === 'acknowledged' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}</div>
                      {item.note && <p className="mt-2 text-xs text-gray-500">{item.note}</p>}
                      {item.status === 'pending' && item.assigneeEmail.toLowerCase() === myEmail && <button onClick={() => acknowledge(item.id)} disabled={busy} className="mt-3 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Confirmar lectura y firmar</button>}
                      {item.signatureId && <p className="mt-2 font-mono text-[10px] text-gray-500 dark:text-gray-400">firma {item.signatureId}</p>}
                    </div>
                  ))}</div>}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
