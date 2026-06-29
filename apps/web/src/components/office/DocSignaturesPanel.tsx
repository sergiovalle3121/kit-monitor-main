'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, FileSignature, Loader2, SearchCheck, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/useAuth';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type SignatureMeaning = 'reviewed' | 'approved' | 'released' | 'acknowledged' | 'training_ack';
interface SignatureRecord {
  id: string;
  meaning: SignatureMeaning;
  signerEmail?: string | null;
  signerName?: string | null;
  signerRole?: string | null;
  statement: string;
  contentHash: string;
  revoked?: boolean;
  revokedBy?: string | null;
  signedAt?: string;
}
interface SignatureVerification {
  valid: boolean;
  reason: 'MATCH' | 'CONTENT_CHANGED' | 'SIGNATURE_REVOKED' | string;
  hashMatchesCurrent?: boolean;
}

const MEANINGS: { id: SignatureMeaning; label: string; statement: string }[] = [
  { id: 'reviewed', label: 'Revisado', statement: 'He revisado este documento y confirmo que la evidencia es correcta.' },
  { id: 'approved', label: 'Aprobado', statement: 'Apruebo este documento controlado para el flujo definido.' },
  { id: 'released', label: 'Liberado', statement: 'Confirmo la liberación de este documento para uso controlado.' },
  { id: 'acknowledged', label: 'Leído / entendido', statement: 'Confirmo que he leído y entendido este documento.' },
  { id: 'training_ack', label: 'Acuse de entrenamiento', statement: 'Confirmo entrenamiento/acuse sobre este documento controlado.' },
];

function shortHash(hash?: string) { return hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : 'sin hash'; }
function rel(iso?: string) {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} d`;
}

export function DocSignaturesPanel({ docId, canSign }: { docId: string; canSign: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SignatureRecord[]>([]);
  const [meaning, setMeaning] = useState<SignatureMeaning>('reviewed');
  const [statement, setStatement] = useState(MEANINGS[0].statement);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationById, setVerificationById] = useState<Record<string, SignatureVerification>>({});

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/signatures`);
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setError('No se pudieron cargar las firmas.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function sign() {
    if (!canSign) return;
    setBusy(true); setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/signatures`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meaning, statement, signerName: user?.email, signerRole: 'AXOS user' }),
      });
      if (!r.ok) throw new Error(String(r.status));
      await load();
    } catch { setError('No se pudo firmar el documento.'); }
    finally { setBusy(false); }
  }

  async function verifySignature(signatureId: string) {
    setVerifyingId(signatureId); setError(null);
    try {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/signatures/${signatureId}/verify`);
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(String(r.status));
      setVerificationById((current) => ({ ...current, [signatureId]: data }));
    } catch {
      setVerificationById((current) => ({ ...current, [signatureId]: { valid: false, reason: 'VERIFY_FAILED' } }));
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10" title="Firmas electrónicas">
        <FileSignature className="h-4 w-4" /> <span className="hidden xl:inline">Firmas</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111]">
              <header className="flex items-start justify-between gap-3 border-b border-black/10 p-5 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Firmas electrónicas</div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Evidencia de firma con hash de contenido para documentos controlados.</p>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button>
              </header>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {canSign && (
                  <div className="rounded-3xl border border-emerald-500/20 bg-emerald-50/60 p-4 dark:bg-emerald-500/10">
                    <label className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Tipo de firma</label>
                    <select value={meaning} onChange={(e) => { const next = e.target.value as SignatureMeaning; setMeaning(next); setStatement(MEANINGS.find((m) => m.id === next)?.statement ?? ''); }} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10">
                      {MEANINGS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <textarea value={statement} onChange={(e) => setStatement(e.target.value)} className="mt-3 h-24 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-white/10" />
                    <button onClick={sign} disabled={busy || !statement.trim()} className="mt-3 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Firmar documento
                    </button>
                  </div>
                )}

                {loading ? <div className="flex justify-center py-8 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  : error ? <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</div>
                  : items.length === 0 ? <div className="rounded-3xl border border-dashed border-black/10 p-6 text-center text-sm text-gray-500 dark:border-white/10">Sin firmas registradas.</div>
                  : <div className="space-y-3">{items.map((item) => (
                    <div key={item.id} className={`rounded-2xl border p-3 ${item.revoked ? 'border-red-500/20 bg-red-50 dark:bg-red-500/10' : 'border-black/5 bg-gray-50 dark:border-white/10 dark:bg-white/5'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-sm font-bold"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-500" /> {MEANINGS.find((m) => m.id === item.meaning)?.label ?? item.meaning}</p><p className="text-xs text-gray-500">{item.signerName || item.signerEmail} · {item.signerRole || 'rol no definido'}</p></div>
                        <span className="text-[11px] text-gray-400">{rel(item.signedAt)}</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{item.statement}</p>
                      <p className="mt-2 rounded-lg bg-white px-2 py-1 font-mono text-[10px] text-gray-500 dark:bg-black/20">hash {shortHash(item.contentHash)}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button onClick={() => verifySignature(item.id)} disabled={verifyingId === item.id} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-white disabled:opacity-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10">
                          {verifyingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="h-3.5 w-3.5" />} Verificar firma
                        </button>
                        {verificationById[item.id] && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${verificationById[item.id].valid ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-200'}`}>{verificationById[item.id].valid ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{verificationById[item.id].reason}</span>}
                      </div>
                      {verificationById[item.id]?.reason === 'CONTENT_CHANGED' && <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-300">El contenido actual cambió después de esta firma.</p>}
                      {item.revoked && <p className="mt-2 text-xs font-semibold text-red-600">Revocada por {item.revokedBy}</p>}
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
