'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ClipboardCheck, Loader2, Route, UserPlus, X, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface ReviewTask {
  id: string;
  reviewerEmail: string;
  assignedBy?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  dueAt?: string | null;
  decidedAt?: string | null;
  note?: string | null;
  decisionNote?: string | null;
  signatureId?: string | null;
}

function fmt(iso?: string | null) { return iso ? new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(iso)) : 'sin fecha'; }

export function DocReviewRoutePanel({ docId, isOwner }: { docId: string; isOwner: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReviewTask[]>([]);
  const [reviewers, setReviewers] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myEmail = user?.email?.toLowerCase();
  const minePending = useMemo(() => items.filter((item) => item.status === 'pending' && item.reviewerEmail.toLowerCase() === myEmail), [items, myEmail]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/review-tasks`);
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setError('No se pudo cargar la ruta de revisión.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function assign() {
    setBusy(true); setError(null);
    try {
      const parsed = reviewers.split(',').map((value) => value.trim()).filter(Boolean);
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/review-tasks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewers: parsed, dueAt: dueAt || null, note: note || null }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setReviewers(''); setDueAt(''); setNote('');
      await load();
    } catch { setError('No se pudieron asignar revisores.'); }
    finally { setBusy(false); }
  }

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusy(true); setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/review-tasks/${id}/decision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: decisionNote || null }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setDecisionNote('');
      await load();
    } catch { setError('No se pudo cerrar la revisión.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10" title="Ruta de revisión">
        <Route className="h-4 w-4" /> <span className="hidden xl:inline">Revisión</span>
        {minePending.length > 0 && <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] text-white">{minePending.length}</span>}
      </button>
      <AnimatePresence>
        {open && <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.aside initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111]">
            <header className="flex items-start justify-between gap-3 border-b border-black/10 p-5 dark:border-white/10">
              <div><div className="flex items-center gap-2 text-sm font-bold"><ClipboardCheck className="h-4 w-4 text-blue-500" /> Ruta de revisión</div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Asigna reviewers, captura aprobación/rechazo y genera evidencia firmada.</p></div>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-gray-500 dark:text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isOwner && <div className="rounded-3xl border border-blue-500/20 bg-blue-50/60 p-4 dark:bg-blue-500/10"><label className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Asignar reviewers</label><input value={reviewers} onChange={(e) => setReviewers(e.target.value)} placeholder="quality@axos.com, engineering@axos.com" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10" /><input value={dueAt} onChange={(e) => setDueAt(e.target.value)} type="date" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10" /><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Instrucciones de revisión" className="mt-2 h-20 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10" /><button onClick={assign} disabled={busy || !reviewers.trim()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"><UserPlus className="h-4 w-4" /> Asignar revisión</button></div>}
              {minePending.length > 0 && <textarea value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Nota para aprobación/rechazo" className="h-20 w-full rounded-xl border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10" />}
              {loading ? <div className="flex justify-center py-8 text-gray-500 dark:text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> : error ? <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</div> : items.length === 0 ? <div className="rounded-3xl border border-dashed border-black/10 p-6 text-center text-sm text-gray-500 dark:border-white/10">Sin reviewers asignados.</div> : <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-2xl border border-black/5 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{item.reviewerEmail}</p><p className="text-xs text-gray-500">Vence: {fmt(item.dueAt)} · {item.status}</p></div>{item.status === 'approved' ? <Check className="h-5 w-5 text-emerald-500" /> : item.status === 'rejected' ? <XCircle className="h-5 w-5 text-red-500" /> : null}</div>{item.note && <p className="mt-2 text-xs text-gray-500">{item.note}</p>}{item.status === 'pending' && item.reviewerEmail.toLowerCase() === myEmail && <div className="mt-3 flex gap-2"><button disabled={busy} onClick={() => decide(item.id, 'approved')} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Aprobar</button><button disabled={busy} onClick={() => decide(item.id, 'rejected')} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Rechazar</button></div>}{item.signatureId && <p className="mt-2 font-mono text-[10px] text-gray-500 dark:text-gray-400">firma {item.signatureId}</p>}</div>)}</div>}
            </div>
          </motion.aside>
        </>}
      </AnimatePresence>
    </div>
  );
}
