'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, PackageCheck, SearchCheck, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface DistributionEvent {
  id: string;
  action: string;
  format: string;
  copyNo: number;
  recipient?: string | null;
  purpose?: string | null;
  actor?: string | null;
  metadata?: {
    verificationCode?: string;
    contentHash?: string;
    controlled?: boolean;
    [key: string]: unknown;
  } | null;
  createdAt?: string;
}

interface CopyVerification {
  valid: boolean;
  reason?: string;
  hashMatchesCurrent?: boolean | null;
  copy?: {
    copyNo?: number;
    format?: string;
    lifecycleState?: string | null;
  };
}

function rel(iso?: string) {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function DocDistributionLedger({ docId }: { docId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DistributionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyNo, setCopyNo] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<CopyVerification | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetch(`${API_BASE}/office-documents/${docId}/distributions`)
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (alive) setError('No se pudo cargar el ledger de distribución.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [docId, open]);

  async function verifyCopy() {
    const copy = copyNo.trim();
    const verificationCode = code.trim();
    if (!copy || !verificationCode) return;
    setVerifying(true);
    setVerification(null);
    try {
      const response = await apiFetch(`${API_BASE}/office-documents/${docId}/distributions/${encodeURIComponent(copy)}/verify?code=${encodeURIComponent(verificationCode)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || String(response.status));
      setVerification(payload);
    } catch (err) {
      setVerification({ valid: false, reason: err instanceof Error ? err.message : 'No se pudo verificar la copia.' });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10" title="Copias controladas y distribuciones">
        <ClipboardList className="h-4 w-4" /> <span className="hidden xl:inline">Distribución</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111]">
              <header className="flex items-start justify-between gap-3 border-b border-black/10 p-5 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold"><PackageCheck className="h-4 w-4 text-indigo-500" /> Ledger de distribución</div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Registro auditable de exports, impresiones y copias controladas emitidas desde AXOS Docs.</p>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button>
              </header>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-4 rounded-3xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-sm font-bold"><SearchCheck className="h-4 w-4 text-indigo-500" />Verificar copia controlada</div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Captura el número de copia y el código impreso/exportado para validar contra AXOS Docs.</p>
                  <div className="mt-3 grid grid-cols-[90px_1fr] gap-2">
                    <input value={copyNo} onChange={(e) => setCopyNo(e.target.value)} placeholder="# copia" className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20" />
                    <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código de verificación" className="rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20" />
                  </div>
                  <button onClick={verifyCopy} disabled={verifying || !copyNo.trim() || !code.trim()} className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-gray-900 text-xs font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900">
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />} Verificar
                  </button>
                  {verification && (
                    <div className={`mt-3 rounded-2xl border p-3 text-xs ${verification.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'}`}>
                      <div className="flex items-center gap-2 font-bold">
                        {verification.valid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        {verification.valid ? 'Copia verificada' : 'No coincide'}
                      </div>
                      <p className="mt-1">{verification.valid ? `Copia #${verification.copy?.copyNo} · ${verification.copy?.format?.toUpperCase()} · ${verification.copy?.lifecycleState ?? 'sin estado'}` : verification.reason}</p>
                      {verification.hashMatchesCurrent === false && <p className="mt-1 font-semibold">El hash emitido no coincide con el contenido actual.</p>}
                    </div>
                  )}
                </div>
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : error ? (
                  <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</div>
                ) : items.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-black/10 p-6 text-center dark:border-white/10">
                    <PackageCheck className="mx-auto mb-3 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-semibold">Sin distribuciones registradas</p>
                    <p className="mt-1 text-xs text-gray-500">Cada exportación o impresión desde el menú Exportar creará evidencia aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-black/5 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">Copia #{item.copyNo} · {item.format.toUpperCase()}</span>
                          <span className="text-[11px] text-gray-400">{rel(item.createdAt)}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <p>{item.action} por {item.actor || 'usuario desconocido'}</p>
                          {item.recipient && <p>Destinatario: {item.recipient}</p>}
                          {item.purpose && <p>Propósito: {item.purpose}</p>}
                          {item.metadata?.verificationCode && <p className="mt-1 font-mono text-[11px] text-indigo-500">Código: {item.metadata.verificationCode}</p>}
                          {item.metadata?.contentHash && <p className="break-all font-mono text-[10px] text-gray-400">Hash: {item.metadata.contentHash}</p>}
                          {item.metadata?.controlled && <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">Controlled copy</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
