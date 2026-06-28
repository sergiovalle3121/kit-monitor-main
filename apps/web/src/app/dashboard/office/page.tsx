'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, FileText, Table, Presentation, Plus, Trash2, Loader2, Lock, AlertCircle,
  Copy, Pencil, RotateCcw, Check, X, Clock, Users, Search, ArrowDownUp, Upload,
  Star, Pin, Tags, LayoutGrid, List, Filter, Sparkles, ShieldCheck, FileLock2, CircleDot, Archive,
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
type LifecycleState = 'draft' | 'in_review' | 'approved' | 'effective' | 'obsolete';
type LibraryScope = 'all' | 'owned' | 'shared' | 'favorites' | 'pinned' | 'recent' | LifecycleState;
type ViewMode = 'grid' | 'list';
interface OfficeDoc { id: string; type: DocType; title: string; updatedAt?: string; createdBy?: string | null; lifecycleState?: LifecycleState; locked?: boolean }
interface LibraryMeta { favorite?: boolean; pinned?: boolean; tags?: string[] }

const LIBRARY_META_KEY = 'axos.office.libraryMeta.v1';

const TABS: { id: DocType; label: string; icon: typeof FileText; color: string; tint: string }[] = [
  { id: 'doc', label: 'Documentos', icon: FileText, color: 'text-blue-500', tint: 'bg-blue-50 dark:bg-blue-500/10' },
  { id: 'sheet', label: 'Hojas de cálculo', icon: Table, color: 'text-emerald-500', tint: 'bg-emerald-50 dark:bg-emerald-500/10' },
  { id: 'slides', label: 'Presentaciones', icon: Presentation, color: 'text-amber-500', tint: 'bg-amber-50 dark:bg-amber-500/10' },
];

const SCOPES: { id: LibraryScope; label: string; helper: string }[] = [
  { id: 'all', label: 'Todos', helper: 'Toda la biblioteca visible' },
  { id: 'owned', label: 'Míos', helper: 'Creados por tu usuario' },
  { id: 'shared', label: 'Compartidos', helper: 'Recibidos de otros usuarios' },
  { id: 'favorites', label: 'Favoritos', helper: 'Marcados para trabajo recurrente' },
  { id: 'pinned', label: 'Fijados', helper: 'Críticos para operación diaria' },
  { id: 'recent', label: 'Recientes', helper: 'Actualizados en los últimos 14 días' },
  { id: 'draft', label: 'Borradores', helper: 'Documentos editables en preparación' },
  { id: 'in_review', label: 'En revisión', helper: 'Pendientes de revisión/aprobación' },
  { id: 'approved', label: 'Aprobados', helper: 'Aprobados y bloqueados, pendientes de liberar' },
  { id: 'effective', label: 'Vigentes', helper: 'Documentos efectivos en punto de uso' },
  { id: 'obsolete', label: 'Obsoletos', helper: 'Retirados del uso operativo' },
];

const LIFECYCLE_META: Record<LifecycleState, { label: string; cls: string; icon: typeof FileText }> = {
  draft: { label: 'Borrador', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300', icon: FileText },
  in_review: { label: 'En revisión', cls: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', icon: CircleDot },
  approved: { label: 'Aprobado', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', icon: ShieldCheck },
  effective: { label: 'Vigente', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300', icon: FileLock2 },
  obsolete: { label: 'Obsoleto', cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300', icon: Archive },
};

function LifecycleBadge({ state = 'draft', locked }: { state?: LifecycleState; locked?: boolean }) {
  const meta = LIFECYCLE_META[state] ?? LIFECYCLE_META.draft;
  const Icon = locked ? Lock : meta.icon;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}><Icon className="h-3 w-3" /> {meta.label}</span>;
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [gallery, setGallery] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [scope, setScope] = useState<LibraryScope>('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [activeTag, setActiveTag] = useState('');
  const [libraryMeta, setLibraryMeta] = useState<Record<string, LibraryMeta>>({});
  const meta = TABS.find((t) => t.id === tab)!;
  const rawDocs = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const isShared = (d: OfficeDoc) => Boolean(!isAdmin && d.createdBy && user?.email && d.createdBy !== user.email);
  const isOwned = (d: OfficeDoc) => Boolean(!d.createdBy || !user?.email || d.createdBy === user.email || isAdmin);
  const allTags = useMemo(() => Array.from(new Set(Object.values(libraryMeta).flatMap((m) => m.tags ?? []))).sort((a, b) => a.localeCompare(b)), [libraryMeta]);
  const lifecycleSummary = useMemo(() => rawDocs.reduce<Record<LifecycleState, number>>((acc, doc) => {
    const state = doc.lifecycleState ?? 'draft';
    acc[state] = (acc[state] ?? 0) + 1;
    return acc;
  }, { draft: 0, in_review: 0, approved: 0, effective: 0, obsolete: 0 }), [rawDocs]);
  const docs = rawDocs
    .filter((d) => {
      const local = libraryMeta[d.id] ?? {};
      const haystack = [d.title, d.createdBy, ...(local.tags ?? [])].join(' ').toLowerCase();
      const matchesQuery = !q.trim() || haystack.includes(q.trim().toLowerCase());
      const matchesTag = !activeTag || (local.tags ?? []).includes(activeTag);
      const updatedAt = new Date(d.updatedAt || 0).getTime();
      const recentCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const matchesScope = scope === 'all'
        || (scope === 'owned' && isOwned(d))
        || (scope === 'shared' && isShared(d))
        || (scope === 'favorites' && local.favorite)
        || (scope === 'pinned' && local.pinned)
        || (scope === 'recent' && updatedAt >= recentCutoff)
        || (['draft', 'in_review', 'approved', 'effective', 'obsolete'].includes(scope) && (d.lifecycleState ?? 'draft') === scope);
      return matchesQuery && matchesTag && matchesScope;
    })
    .sort((a, b) => {
      const aMeta = libraryMeta[a.id] ?? {};
      const bMeta = libraryMeta[b.id] ?? {};
      if (Number(bMeta.pinned) !== Number(aMeta.pinned)) return Number(bMeta.pinned) - Number(aMeta.pinned);
      return sort === 'name'
        ? (a.title || '').localeCompare(b.title || '')
        : (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    });
  const visibleScope = SCOPES.find((item) => item.id === scope)!;

  useEffect(() => {
    const raw = window.localStorage.getItem(LIBRARY_META_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setLibraryMeta(parsed);
    } catch {
      window.localStorage.removeItem(LIBRARY_META_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LIBRARY_META_KEY, JSON.stringify(libraryMeta));
  }, [libraryMeta]);

  function updateLocalMeta(id: string, next: (meta: LibraryMeta) => LibraryMeta) {
    setLibraryMeta((current) => {
      const updated = next(current[id] ?? {});
      return { ...current, [id]: updated };
    });
  }

  function toggleFavorite(id: string) {
    updateLocalMeta(id, (current) => ({ ...current, favorite: !current.favorite }));
  }

  function togglePinned(id: string) {
    updateLocalMeta(id, (current) => ({ ...current, pinned: !current.pinned }));
  }

  function editTags(id: string) {
    const current = (libraryMeta[id]?.tags ?? []).join(', ');
    const value = window.prompt('Tags separados por coma (ej. SOP, SMT, Calidad)', current);
    if (value === null) return;
    const tags = Array.from(new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))).slice(0, 8);
    updateLocalMeta(id, (m) => ({ ...m, tags }));
    if (activeTag && !tags.includes(activeTag)) setActiveTag('');
  }

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
    setErr(null); setBusy(true);
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
    <div className="min-h-screen text-foreground font-sans pb-32">
      <div className={`${glass} sticky top-0 z-40 px-6 py-4 rounded-none border-x-0 border-t-0 flex items-center justify-between`}>
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-foreground transition-colors">
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, autor o tag…"
              className={`${glass} w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 ring-black/10 dark:ring-white/20`} />
          </div>
          <button onClick={() => setSort((s) => (s === 'recent' ? 'name' : 'recent'))}
            className={`${glass} flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300`}>
            <ArrowDownUp className="w-4 h-4" /> {sort === 'recent' ? 'Recientes' : 'Nombre'}
          </button>
          <div className={`${glass} inline-flex p-1 rounded-xl gap-1`}>
            <button title="Vista tarjetas" onClick={() => setView('grid')} className={`p-2 rounded-lg transition-all ${view === 'grid' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button title="Vista lista" onClick={() => setView('list')} className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <section className={`${glass} rounded-3xl p-4 mb-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold"><Sparkles className="w-4 h-4 text-blue-500" /> Biblioteca documental</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{visibleScope.helper}. Metadatos de workspace locales: favoritos, fijados y tags.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Filter className="w-3.5 h-3.5" /> {docs.length} de {rawDocs.length}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {SCOPES.map((item) => (
              <button key={item.id} onClick={() => setScope(item.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${scope === item.id ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-500 hover:text-black dark:bg-white/5 dark:hover:text-white'}`}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-5">
            {(Object.keys(LIFECYCLE_META) as LifecycleState[]).map((state) => {
              const metaState = LIFECYCLE_META[state];
              const Icon = metaState.icon;
              return (
                <button key={state} onClick={() => setScope(state)} className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-left transition-all ${scope === state ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-black/5 bg-white/50 text-gray-500 hover:text-black dark:border-white/10 dark:bg-white/5 dark:hover:text-white'}`}>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold"><Icon className="h-3.5 w-3.5" /> {metaState.label}</span>
                  <span className="text-xs font-bold">{lifecycleSummary[state]}</span>
                </button>
              );
            })}
          </div>
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/10">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400"><Tags className="w-3.5 h-3.5" /> Tags</span>
              <button onClick={() => setActiveTag('')} className={`px-2.5 py-1 rounded-full text-xs font-medium ${activeTag === '' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300'}`}>Todos</button>
              {allTags.map((tag) => (
                <button key={tag} onClick={() => setActiveTag((current) => current === tag ? '' : tag)} className={`px-2.5 py-1 rounded-full text-xs font-medium ${activeTag === tag ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500 hover:text-black dark:bg-white/5 dark:hover:text-white'}`}>
                  {tag}
                </button>
              ))}
            </div>
          )}
        </section>

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

        {forbidden ? (
          <Empty icon={<Lock className="w-6 h-6" />} title="Sin acceso al backend" body="Verifica que el servicio de API esté conectado." />
        ) : isLoading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : docs.length === 0 ? (
          <Empty icon={trash ? <Trash2 className="w-6 h-6" /> : <meta.icon className="w-6 h-6" />} title={trash ? 'Papelera vacía' : `Sin ${meta.label.toLowerCase()}`} body={trash ? 'Los documentos que elimines aparecerán aquí.' : 'Crea el primero con "Nuevo" o ajusta los filtros de biblioteca.'} />
        ) : view === 'list' ? (
          <div className={`${glass} rounded-3xl overflow-hidden`}>
            {docs.map((d) => (
              <DocumentRow key={d.id} doc={d} meta={meta} trash={trash} canWrite={canWrite} isShared={isShared(d)} local={libraryMeta[d.id] ?? {}}
                editingId={editingId} draft={draft} setDraft={setDraft} setEditingId={setEditingId} saveRename={saveRename}
                toggleFavorite={toggleFavorite} togglePinned={togglePinned} editTags={editTags}
                restore={restore} destroy={destroy} duplicate={duplicate} toTrash={toTrash} />
            ))}
          </div>
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
                      {isShared(d) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500" title={`Compartido por ${d.createdBy}`}><Users className="w-3 h-3" /> Compartido</span>
                      )}
                      {libraryMeta[d.id]?.pinned && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600"><Pin className="w-3 h-3" /> Fijado</span>}
                      <LifecycleBadge state={d.lifecycleState ?? 'draft'} locked={d.locked} />
                    </div>
                    <p className="font-bold truncate">{d.title}</p>
                    <p className="flex items-center gap-1 text-[11px] text-gray-400"><Clock className="w-3 h-3" /> {relTime(d.updatedAt)}</p>
                    {(libraryMeta[d.id]?.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(libraryMeta[d.id]?.tags ?? []).map((tag) => <span key={tag} className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-[10px] font-semibold text-gray-500">{tag}</span>)}
                      </div>
                    )}
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
                        <IconBtn title={libraryMeta[d.id]?.favorite ? 'Quitar favorito' : 'Marcar favorito'} onClick={() => toggleFavorite(d.id)} className={`${libraryMeta[d.id]?.favorite ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'}`}><Star className="w-4 h-4" /></IconBtn>
                        <IconBtn title={libraryMeta[d.id]?.pinned ? 'Desfijar' : 'Fijar'} onClick={() => togglePinned(d.id)} className={`${libraryMeta[d.id]?.pinned ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'}`}><Pin className="w-4 h-4" /></IconBtn>
                        <IconBtn title="Editar tags" onClick={() => editTags(d.id)} className="text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10"><Tags className="w-4 h-4" /></IconBtn>
                        {!d.locked && <IconBtn title="Renombrar" onClick={() => { setEditingId(d.id); setDraft(d.title); }} className="text-gray-400 hover:text-foreground hover:bg-gray-100 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></IconBtn>}
                        <IconBtn title="Duplicar" onClick={() => duplicate(d.id)} className="text-gray-400 hover:text-foreground hover:bg-gray-100 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></IconBtn>
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

function DocumentRow({
  doc,
  meta,
  trash,
  canWrite,
  isShared,
  local,
  editingId,
  draft,
  setDraft,
  setEditingId,
  saveRename,
  toggleFavorite,
  togglePinned,
  editTags,
  restore,
  destroy,
  duplicate,
  toTrash,
}: {
  doc: OfficeDoc;
  meta: (typeof TABS)[number];
  trash: boolean;
  canWrite: boolean;
  isShared: boolean;
  local: LibraryMeta;
  editingId: string | null;
  draft: string;
  setDraft: (value: string) => void;
  setEditingId: (value: string | null) => void;
  saveRename: (id: string) => void;
  toggleFavorite: (id: string) => void;
  togglePinned: (id: string) => void;
  editTags: (id: string) => void;
  restore: (id: string) => void;
  destroy: (id: string) => void;
  duplicate: (id: string) => void;
  toTrash: (id: string) => void;
}) {
  return (
    <div className="group flex flex-col gap-3 border-b border-black/5 p-4 last:border-b-0 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`inline-flex shrink-0 p-2.5 rounded-xl ${meta.tint}`}><meta.icon className={`w-5 h-5 ${meta.color}`} /></div>
        <div className="min-w-0">
          {editingId === doc.id ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(doc.id); if (e.key === 'Escape') setEditingId(null); }}
                className="min-w-0 rounded-lg bg-gray-100 px-2 py-1 text-sm font-bold outline-none dark:bg-white/10" />
              <button onClick={() => saveRename(doc.id)} className="p-1.5 rounded-full text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditingId(null)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <Link href={trash ? '#' : `/dashboard/office/${doc.id}`} onClick={(e) => { if (trash) e.preventDefault(); }} className={`block min-w-0 ${trash ? 'cursor-default' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-bold">{doc.title}</p>
                {isShared && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-500 dark:bg-blue-500/10"><Users className="h-3 w-3" /> Compartido</span>}
                {local.favorite && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:bg-amber-500/10"><Star className="h-3 w-3" /> Favorito</span>}
                {local.pinned && <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-500/10"><Pin className="h-3 w-3" /> Fijado</span>}
                <LifecycleBadge state={doc.lifecycleState ?? 'draft'} locked={doc.locked} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {relTime(doc.updatedAt)}</span>
                {doc.createdBy && <span>{doc.createdBy}</span>}
                {(local.tags ?? []).map((tag) => <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-500 dark:bg-white/5">{tag}</span>)}
              </div>
            </Link>
          )}
        </div>
      </div>

      {canWrite && editingId !== doc.id && (
        <div className="flex items-center gap-1 sm:opacity-0 sm:transition-all sm:group-hover:opacity-100">
          {trash ? (
            <>
              <IconBtn title="Restaurar" onClick={() => restore(doc.id)} className="text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><RotateCcw className="w-4 h-4" /></IconBtn>
              <IconBtn title="Eliminar para siempre" onClick={() => destroy(doc.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></IconBtn>
            </>
          ) : (
            <>
              <IconBtn title={local.favorite ? 'Quitar favorito' : 'Marcar favorito'} onClick={() => toggleFavorite(doc.id)} className={`${local.favorite ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'}`}><Star className="w-4 h-4" /></IconBtn>
              <IconBtn title={local.pinned ? 'Desfijar' : 'Fijar'} onClick={() => togglePinned(doc.id)} className={`${local.pinned ? 'text-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10'}`}><Pin className="w-4 h-4" /></IconBtn>
              <IconBtn title="Editar tags" onClick={() => editTags(doc.id)} className="text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10"><Tags className="w-4 h-4" /></IconBtn>
              {!doc.locked && <IconBtn title="Renombrar" onClick={() => { setEditingId(doc.id); setDraft(doc.title); }} className="text-gray-400 hover:text-foreground hover:bg-gray-100 dark:hover:bg-white/10"><Pencil className="w-4 h-4" /></IconBtn>}
              <IconBtn title="Duplicar" onClick={() => duplicate(doc.id)} className="text-gray-400 hover:text-foreground hover:bg-gray-100 dark:hover:bg-white/10"><Copy className="w-4 h-4" /></IconBtn>
              <IconBtn title="Mover a papelera" onClick={() => toTrash(doc.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></IconBtn>
            </>
          )}
        </div>
      )}
    </div>
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
