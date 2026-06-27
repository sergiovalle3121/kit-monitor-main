'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, FileText, Table, Presentation, Plus, Trash2, Loader2, Lock, AlertCircle,
  Copy, Pencil, RotateCcw, Check, X, Clock, Users, Search, ArrowDownUp, Upload,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { apiFetch } from '@/lib/apiFetch';
import { TemplateGallery } from '@/components/office/TemplateGallery';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type DocType = 'doc' | 'sheet' | 'slides';
interface OfficeDoc { id: string; type: DocType; title: string; updatedAt?: string; createdBy?: string | null }

const TABS: { id: DocType; label: string; icon: typeof FileText; color: string; tint: string }[] = [
  { id: 'doc', label: 'Documentos', icon: FileText, color: 'text-blue-500', tint: 'bg-blue-50 dark:bg-blue-500/10' },
  { id: 'sheet', label: 'Hojas de cálculo', icon: Table, color: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { id: 'slides', label: 'Presentaciones', icon: Presentation, color: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10' },
];

function relTime(iso?: string): string {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

export default function OfficeHubPage() {
  const router = useRouter();
  const { user } = useAuth();
  // Gate de escritura centralizado: robusto para admin/owner (ver usePermissions).
  const { canWrite, isAdmin } = usePermissions();
  const confirm = useConfirm();

  const [tab, setTab] = useState<DocType>('doc');
  const [trash, setTrash] = useState(false);
  const { data, isLoading, forbidden, mutate } = useApi<OfficeDoc[]>(`/office-documents?type=${tab}${trash ? '&trash=1' : ''}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [gallery, setGallery] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const meta = TABS.find((t) => t.id === tab)!;
  const docs = (Array.isArray(data) ? data : [])
    .filter((d) => !q.trim() || (d.title || '').toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => sort === 'name'
      ? (a.title || '').localeCompare(b.title || '')
      : (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()));

  async function createFrom(content: any, title?: string) {
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch(`${API_BASE}/office-documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: tab, title: title || 'Sin título', content: content ?? undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d?.message || `No se pudo crear (HTTP ${res.status}). Si acabas de desplegar, el backend puede seguir actualizándose.`);
        setGallery(false);
        return;
      }
      const doc = await res.json();
      if (doc?.id) router.push(`/dashboard/office/${doc.id}`);
      else { setErr('El servidor no devolvió un documento válido.'); setGallery(false); }
    } catch {
      setErr('Error de red al crear el documento. Revisa la conexión con el backend.');
      setGallery(false);
    } finally { setBusy(false); }
  }

  // Importar .pptx (round-trip Fase 2): se parsea en el cliente y se crea la
  // presentación con el contenido resultante.
  async function onImportPptx(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setErr(null); setNotice(null); setBusy(true);
    let deck: any;
    try {
      const buf = await f.arrayBuffer();
      const { importPptx } = await import('@/lib/office/pptxImport');
      deck = await importPptx(buf);
    } catch {
      setErr('No se pudo leer el .pptx. Puede que use funciones aún no soportadas en la importación.');
      setBusy(false); return;
    }
    setBusy(false);
    const issues = deck?.pptxCompatibility?.issues;
    if (Array.isArray(issues) && issues.length) {
      const top = issues.slice(0, 3).map((x: any) => x.message).join(' ');
      setNotice(`Importado con ${issues.length} aviso(s) de compatibilidad. ${top}`);
    }
    await createFrom(deck, f.name.replace(/\.pptx$/i, '') || 'Importada');
  }

  async function act(path: string, method: string) {
    await apiFetch(`${API_BASE}/office-documents/${path}`, { method });
    mutate();
  }
  const toTrash = (id: string) => act(`${id}`, 'DELETE');
  const restore = (id: string) => act(`${id}/restore`, 'PATCH');
  const destroy = async (id: string) => { if (await confirm({ message: '¿Eliminar permanentemente? Esta acción no se puede deshacer.', tone: 'danger', confirmLabel: 'Eliminar' })) act(`${id}/permanent`, 'DELETE'); };
  async function duplicate(id: string) {
    const r = await apiFetch(`${API_BASE}/office-documents/${id}/duplicate`, { method: 'POST' });
    if (r.ok) mutate();
  }
  async function emptyTrash() {
    if (!docs.length) return;
    if (!(await confirm({ message: `¿Vaciar la papelera? Se eliminarán ${docs.length} elemento(s) permanentemente.`, tone: 'danger', confirmLabel: 'Vaciar papelera' }))) return;
    await Promise.all(docs.map((d) => apiFetch(`${API_BASE}/office-documents/${d.id}/permanent`, { method: 'DELETE' })));
    mutate();
  }
  async function saveRename(id: string) {
    const title = draft.trim() || 'Sin título';
    setEditingId(null);
    await apiFetch(`${API_BASE}/office-documents/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }),
    });
    mutate();
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Dashboard
        </Link>
        <span className="text-sm font-semibold">Office</span>
      </div>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Office</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Documentos, hojas de cálculo y presentaciones — todo dentro de Axos.</p>
        </header>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className={`${glass} inline-flex p-1 rounded-2xl gap-1`}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => setTrash((v) => !v)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${trash ? 'bg-red-500/10 text-red-500' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
            <Trash2 className="w-4 h-4" /> Papelera
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…"
              className={`${glass} w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 ring-black/10 dark:ring-white/20`} />
          </div>
          <button onClick={() => setSort((s) => (s === 'recent' ? 'name' : 'recent'))}
            className={`${glass} flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300`}>
            <ArrowDownUp className="w-4 h-4" /> {sort === 'recent' ? 'Recientes' : 'Nombre'}
          </button>
        </div>

        {trash && canWrite && docs.length > 0 && (
          <div className="flex justify-end mb-4">
            <button onClick={emptyTrash} className="flex items-center gap-2 bg-red-500/10 text-red-500 text-sm font-semibold px-4 py-2 rounded-full hover:bg-red-500/20 transition-colors">
              <Trash2 className="w-4 h-4" /> Vaciar papelera
            </button>
          </div>
        )}

        {!trash && (
          <div className="flex justify-end items-center gap-2 mb-4">
            {canWrite && tab === 'slides' && (
              <label title="Importar una presentación de PowerPoint (.pptx)" className={`flex items-center gap-2 ${glass} text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                <Upload className="w-4 h-4" /> Importar .pptx
                <input type="file" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={onImportPptx} className="hidden" disabled={busy} />
              </label>
            )}
            {canWrite ? (
              <button onClick={() => setGallery(true)} disabled={busy} className="flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black text-sm font-semibold px-4 py-2 rounded-full hover:scale-[1.03] active:scale-95 transition-transform disabled:opacity-60">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Nuevo {meta.label.toLowerCase()}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"><Lock className="w-3.5 h-3.5" /> Solo lectura</span>
            )}
          </div>
        )}

        {err && (
          <div className="flex gap-2 items-start p-3 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-600 text-sm mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {err}
          </div>
        )}
        {notice && (
          <div className="flex gap-2 items-start p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm mb-4">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {notice}
          </div>
        )}

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <Empty icon={trash ? <Trash2 className="w-6 h-6" /> : <meta.icon className="w-6 h-6" />} title={trash ? 'Papelera vacía' : `Sin ${meta.label.toLowerCase()}`} body={trash ? 'Los documentos que elimines aparecerán aquí.' : 'Crea el primero con "Nuevo".'} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.map((d) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${glass} rounded-2xl p-4 group relative`}>
                {editingId === d.id ? (
                  <div className="flex items-center gap-1.5 mb-2">
                    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(d.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 min-w-0 bg-gray-100 dark:bg-white/10 rounded-lg px-2 py-1 text-sm font-bold outline-none" />
                    <button onClick={() => saveRename(d.id)} className="p-1.5 rounded-full text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <Link href={trash ? '#' : `/dashboard/office/${d.id}`} onClick={(e) => { if (trash) e.preventDefault(); }} className={`block ${trash ? 'cursor-default' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`inline-flex p-2.5 rounded-xl ${meta.tint}`}><meta.icon className={`w-5 h-5 ${meta.color}`} /></div>
                      {!isAdmin && d.createdBy && user?.email && d.createdBy !== user.email && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500" title={`Compartido por ${d.createdBy}`}><Users className="w-3 h-3" /> Compartido</span>
                      )}
                    </div>
                    <p className="font-bold truncate">{d.title}</p>
                    <p className="flex items-center gap-1 text-[11px] text-gray-400"><Clock className="w-3 h-3" /> {relTime(d.updatedAt)}</p>
                  </Link>
                )}

                {canWrite && editingId !== d.id && (
                  <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                    {trash ? (
                      <>
                        <IconBtn title="Restaurar" onClick={() => restore(d.id)} className="text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><RotateCcw className="w-4 h-4" /></IconBtn>
                        <IconBtn title="Eliminar para siempre" onClick={() => destroy(d.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></IconBtn>
                      </>
                    ) : (
                      <>
                        <IconBtn title="Renombrar" onClick={() => { setEditingId(d.id); setDraft(d.title); }} className="text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></IconBtn>
                        <IconBtn title="Duplicar" onClick={() => duplicate(d.id)} className="text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></IconBtn>
                        <IconBtn title="Mover a papelera" onClick={() => toTrash(d.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></IconBtn>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {gallery && canWrite && (
          <TemplateGallery type={tab} onPick={createFrom} onClose={() => setGallery(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function IconBtn({ title, onClick, className, children }: { title: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className={`p-1.5 rounded-full transition-all ${className ?? ''}`}>{children}</button>
  );
}

function Empty({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6">
      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 mb-4">{icon}</div>
      <h3 className="font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{body}</p>
    </div>
  );
}
