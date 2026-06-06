'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, X, Trash2, Loader2, Check } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Share { email: string; access: 'view' | 'edit' }

/** Owner-only "Compartir" button + dialog to manage view/edit grants. */
export function ShareButton({ docId, initialShares }: { docId: string; initialShares?: Share[] }) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<Share[]>(initialShares ?? []);
  const [email, setEmail] = useState('');
  const [access, setAccess] = useState<'view' | 'edit'>('view');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function add() {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return;
    if (shares.some((s) => s.email === e)) return;
    setShares([...shares, { email: e, access }]);
    setEmail('');
  }
  function remove(e: string) { setShares(shares.filter((s) => s.email !== e)); }
  function setAcc(e: string, a: 'view' | 'edit') { setShares(shares.map((s) => (s.email === e ? { ...s, access: a } : s))); }

  async function save() {
    setBusy(true);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sharedWith: shares }),
      });
      if (r.ok) { setSaved(true); setTimeout(() => { setSaved(false); setOpen(false); }, 800); }
    } finally { setBusy(false); }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title="Compartir"
        className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors">
        <Users className="w-4 h-4" /> <span className="hidden lg:inline">Compartir</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Compartir documento</h2>
                <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  placeholder="correo@empresa.com" type="email"
                  className="flex-1 h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-blue-500/40" />
                <select value={access} onChange={(e) => setAccess(e.target.value as any)} className="h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-2 outline-none">
                  <option value="view">Ver</option>
                  <option value="edit">Editar</option>
                </select>
                <button onClick={add} className="h-9 px-3 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold">Añadir</button>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 mb-4">
                {shares.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Solo tú tienes acceso. Añade personas por correo.</p>
                ) : shares.map((s) => (
                  <div key={s.email} className="flex items-center gap-2 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5">
                    <span className="flex-1 text-sm truncate">{s.email}</span>
                    <select value={s.access} onChange={(e) => setAcc(s.email, e.target.value as any)} className="h-7 text-xs rounded-lg bg-gray-100 dark:bg-white/10 px-1.5 outline-none">
                      <option value="view">Ver</option>
                      <option value="edit">Editar</option>
                    </select>
                    <button onClick={() => remove(s.email)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <button onClick={save} disabled={busy} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
                {saved ? 'Guardado' : 'Guardar acceso'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
