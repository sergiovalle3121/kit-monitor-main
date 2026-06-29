'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GitBranch, Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiFetch';
import { axosEntityLabel, axosRefText } from '@/lib/office/axosRefs';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface RefItem { entity: string; refId: string; label?: string }
interface ImpactDoc { id: string; title: string; type: string; lifecycleState?: string; updatedAt?: string }

function collectRefs(content: any): RefItem[] {
  const map = new Map<string, RefItem>();
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'axosRef') {
      const entity = String(node.attrs?.entity ?? '').trim().toLowerCase();
      const refId = String(node.attrs?.refId ?? '').trim();
      if (entity && refId) map.set(`${entity}:${refId.toLowerCase()}`, { entity, refId, label: String(node.attrs?.label ?? '').trim() || undefined });
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(content);
  return [...map.values()].sort((a, b) => `${a.entity}:${a.refId}`.localeCompare(`${b.entity}:${b.refId}`));
}

export function DocImpactPanel({ content, currentDocId }: { content: any; currentDocId: string }) {
  const refs = useMemo(() => collectRefs(content), [content]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RefItem | null>(null);
  const [docs, setDocs] = useState<ImpactDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze(ref: RefItem) {
    setSelected(ref); setLoading(true); setError(null); setDocs([]);
    try {
      const qs = new URLSearchParams({ entity: ref.entity, refId: ref.refId });
      const r = await apiFetch(`${API_BASE}/office-documents/impact?${qs.toString()}`);
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      setDocs(Array.isArray(data?.documents) ? data.documents : []);
    } catch { setError('No se pudo calcular el impacto.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10" title="Análisis de impacto AXOS">
        <GitBranch className="h-4 w-4" /> <span className="hidden xl:inline">Impacto</span>
        {refs.length > 0 && <span className="rounded-full bg-purple-500 px-1.5 py-0.5 text-[10px] text-white">{refs.length}</span>}
      </button>
      <AnimatePresence>
        {open && <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.aside initial={{ x: 440 }} animate={{ x: 0 }} exit={{ x: 440 }} transition={{ type: 'spring', damping: 28, stiffness: 260 }} className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111]">
            <header className="flex items-start justify-between gap-3 border-b border-black/10 p-5 dark:border-white/10"><div><div className="flex items-center gap-2 text-sm font-bold"><GitBranch className="h-4 w-4 text-purple-500" /> Impacto AXOS</div><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Encuentra otros documentos que referencian el mismo BOM, routing, NCR, CAPA, cliente, proveedor o entidad AXOS.</p></div><button onClick={() => setOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"><X className="h-4 w-4" /></button></header>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {refs.length === 0 ? <div className="rounded-3xl border border-dashed border-black/10 p-6 text-center text-sm text-gray-500 dark:border-white/10">Este documento no contiene referencias AXOS inteligentes.</div> : <div className="space-y-2">{refs.map((ref) => <button key={`${ref.entity}:${ref.refId}`} onClick={() => analyze(ref)} className={`w-full rounded-2xl border p-3 text-left transition ${selected?.entity === ref.entity && selected?.refId === ref.refId ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10' : 'border-black/5 bg-gray-50 hover:border-purple-300 dark:border-white/10 dark:bg-white/5'}`}><p className="text-sm font-bold">{axosRefText(ref.entity, ref.refId, ref.label)}</p><p className="text-xs text-gray-500">{axosEntityLabel(ref.entity)} · {ref.refId}</p></button>)}</div>}
              {selected && <div className="rounded-3xl border border-black/5 p-4 dark:border-white/10"><div className="mb-3 flex items-center gap-2 text-sm font-bold"><Search className="h-4 w-4 text-purple-500" /> Documentos impactados</div>{loading ? <div className="flex justify-center py-6 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div> : error ? <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-500/10">{error}</div> : docs.length === 0 ? <p className="text-sm text-gray-500">Sin otros documentos encontrados.</p> : <div className="space-y-2">{docs.map((doc) => <Link key={doc.id} href={`/dashboard/office/${doc.id}`} className={`block rounded-xl px-3 py-2 text-sm transition hover:bg-black/5 dark:hover:bg-white/10 ${doc.id === currentDocId ? 'opacity-60' : ''}`}><span className="font-semibold">{doc.title}</span><span className="ml-2 text-xs text-gray-400">{doc.lifecycleState ?? 'draft'}</span>{doc.id === currentDocId && <span className="ml-2 text-xs text-purple-500">actual</span>}</Link>)}</div>}</div>}
            </div>
          </motion.aside>
        </>}
      </AnimatePresence>
    </div>
  );
}
