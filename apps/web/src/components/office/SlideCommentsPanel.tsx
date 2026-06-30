'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, MessageSquarePlus, Search, Trash2, X } from 'lucide-react';
import {
  buildSlideCommentReview,
  type SlideCommentReviewFilter,
  type SlideCommentReviewScope,
  type SlideCommentThreadReview,
} from './slides/commentsReview';

export interface SlideComment {
  id: string;
  parentId?: string;
  slide: number;
  objectId?: string;
  objectLabel?: string;
  author?: string;
  assignedTo?: string;
  text: string;
  createdAt: number;
  resolved?: boolean;
}

const field = 'w-full rounded-xl bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500/40 resize-none';

export function SlideCommentsPanel({
  comments, slide, readOnly, selectedLabel, canCommentObject, onAdd, onReply, onResolve, onDelete, onClose,
}: {
  comments: SlideComment[];
  slide: number;
  readOnly?: boolean;
  selectedLabel?: string;
  canCommentObject?: boolean;
  onAdd: (text: string, target: 'slide' | 'object') => void;
  onReply: (parentId: string, text: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [reply, setReply] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<'slide' | 'object'>('slide');
  const [scope, setScope] = useState<SlideCommentReviewScope>('slide');
  const [filter, setFilter] = useState<SlideCommentReviewFilter>('all');
  const [query, setQuery] = useState('');
  const review = useMemo(() => buildSlideCommentReview({ comments, currentSlide: slide, scope, filter, query }), [comments, filter, query, scope, slide]);
  const { summary, visibleThreads } = review;
  const hasDeckRisk = summary.openThreads > 0 || summary.orphanReplyCount > 0 || summary.objectThreadsMissingLabel > 0;

  function submit() {
    const v = text.trim();
    if (!v) return;
    onAdd(v, target === 'object' && canCommentObject ? 'object' : 'slide');
    setText('');
  }

  function submitReply(parentId: string) {
    const v = (reply[parentId] || '').trim();
    if (!v) return;
    onReply(parentId, v);
    setReply((r) => ({ ...r, [parentId]: '' }));
  }

  return (
    <aside className="w-80 flex-shrink-0 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-[#151515]/95 shadow-xl overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold"><ClipboardList className="h-4 w-4 text-blue-500" /> Revision</h3>
          <p className="text-[11px] text-gray-500">Slide {slide + 1} - {summary.currentSlideOpenThreads} abierto(s) aqui - {summary.openThreads} en deck</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="h-4 w-4" /></button>
      </div>

      {!readOnly && (
        <div className="p-3 border-b border-black/10 dark:border-white/10 space-y-2">
          <div className="inline-flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1 text-xs font-semibold">
            <button onClick={() => setTarget('slide')} className={`px-2.5 py-1 rounded-lg ${target === 'slide' ? 'bg-white dark:bg-black/30 shadow-sm' : 'text-gray-500'}`}>Slide</button>
            <button disabled={!canCommentObject} onClick={() => setTarget('object')} className={`px-2.5 py-1 rounded-lg disabled:opacity-40 ${target === 'object' ? 'bg-white dark:bg-black/30 shadow-sm' : 'text-gray-500'}`}>Objeto</button>
          </div>
          {target === 'object' && canCommentObject && <p className="text-[11px] text-gray-500 truncate">Anclado a: {selectedLabel}</p>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Escribe un comentario o accion... usa @email para asignar" className={field} />
          <button onClick={submit} disabled={!text.trim()} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold py-2 disabled:opacity-40">
            <MessageSquarePlus className="h-4 w-4" /> Agregar comentario
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-b border-black/10 dark:border-white/10 space-y-2">
        <div className="grid grid-cols-4 gap-1.5 text-[10px]">
          <Metric label="Abiertos" value={summary.openThreads} tone={summary.openThreads ? 'amber' : 'green'} />
          <Metric label="Asign." value={summary.assignedThreads} tone={summary.assignedThreads ? 'blue' : undefined} />
          <Metric label="Objetos" value={summary.objectThreads} />
          <Metric label="Slides" value={summary.slidesWithOpenThreads} tone={summary.slidesWithOpenThreads ? 'amber' : 'green'} />
        </div>
        {hasDeckRisk && (
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
            Resolver comentarios abiertos antes de exportar. Los comentarios aun permanecen en AXOS y no salen al PPTX.
          </p>
        )}
        <div className="inline-flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1 text-xs font-semibold">
          {(['slide', 'deck'] as const).map((mode) => (
            <button key={mode} onClick={() => setScope(mode)} className={`px-2.5 py-1 rounded-lg ${scope === mode ? 'bg-white dark:bg-black/30 shadow-sm' : 'text-gray-500'}`}>
              {mode === 'slide' ? 'Slide actual' : 'Todo el deck'}
            </button>
          ))}
        </div>
        <label className="flex h-8 items-center gap-2 rounded-lg bg-black/[0.04] px-2 text-xs dark:bg-white/[0.06]">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar texto, autor, objeto o slide..." className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <div className="flex flex-wrap gap-1 text-[10px] font-semibold">
          {(['all', 'open', 'assigned', 'object', 'resolved'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`h-7 rounded-lg px-2 ${filter === f ? 'bg-blue-500 text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-gray-500'}`}>
              {f === 'all' ? 'Todo' : f === 'open' ? 'Abiertos' : f === 'assigned' ? 'Asign.' : f === 'object' ? 'Objeto' : 'Res.'}
            </button>
          ))}
        </div>
        {(query || scope === 'deck' || filter !== 'all') && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{summary.visibleThreads} de {summary.totalThreads} hilo(s) visibles - {summary.replyCount} respuesta(s)</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visibleThreads.length === 0 ? (
          <div className="h-full min-h-40 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-center p-6 text-sm text-gray-500 dark:text-gray-400">
            Sin comentarios para este filtro.
          </div>
        ) : (
          visibleThreads.map((thread) => (
            <ThreadCard
              key={thread.root.id}
              thread={thread}
              readOnly={readOnly}
              reply={reply}
              onReplyDraft={setReply}
              onReply={submitReply}
              onResolve={onResolve}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function ThreadCard({
  thread, readOnly, reply, onReplyDraft, onReply, onResolve, onDelete,
}: {
  thread: SlideCommentThreadReview;
  readOnly?: boolean;
  reply: Record<string, string>;
  onReplyDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onReply: (parentId: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const c = thread.root;
  return (
    <div className={`rounded-2xl border p-3 ${c.resolved ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]'}`}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${thread.isCurrentSlide ? 'bg-blue-500 text-white' : 'bg-black/5 text-gray-500 dark:bg-white/10'}`}>Slide {thread.slide + 1}</span>
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/10">{c.objectId ? `Objeto - ${c.objectLabel || 'seleccion'}` : 'Diapositiva'}</span>
            {c.resolved && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">Resuelto</span>}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{new Date(c.createdAt).toLocaleString('es-ES')}</p>
          {thread.assignedTo && <p className="truncate text-[11px] font-semibold text-blue-500">Asignado a {thread.assignedTo}</p>}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button onClick={() => onResolve(c.id, !c.resolved)} title={c.resolved ? 'Reabrir' : 'Resolver'} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></button>
            <button onClick={() => onDelete(c.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      <p className={`whitespace-pre-wrap text-sm ${c.resolved ? 'text-gray-500 line-through decoration-emerald-500/50' : 'text-foreground'}`}>{c.text}</p>
      {thread.replies.length > 0 && (
        <div className="mt-2 space-y-1.5 border-l-2 border-black/10 pl-2.5 dark:border-white/10">
          {thread.replies.map((r) => (
            <div key={r.id} className="rounded-xl bg-white/70 px-2.5 py-2 dark:bg-black/20">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{r.author || 'AXOS'} - {new Date(r.createdAt).toLocaleString('es-ES')}{r.assignedTo ? ` - @${r.assignedTo}` : ''}</p>
              <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-200">{r.text}</p>
            </div>
          ))}
        </div>
      )}
      {!readOnly && !c.resolved && (
        <div className="mt-2 flex items-center gap-1.5">
          <input value={reply[c.id] || ''} onChange={(e) => onReplyDraft((r) => ({ ...r, [c.id]: e.target.value }))} placeholder="Responder..." className="min-w-0 flex-1 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 text-xs outline-none focus:ring-2 ring-blue-500/30" />
          <button onClick={() => onReply(c.id)} disabled={!(reply[c.id] || '').trim()} className="h-8 px-2 rounded-lg bg-blue-500 text-white text-xs font-semibold disabled:opacity-40">Enviar</button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'green' | 'blue' }) {
  const cls = tone === 'amber'
    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : tone === 'blue'
        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
        : 'bg-black/[0.04] text-gray-500 dark:bg-white/[0.06]';
  return <div className={`rounded-lg px-1.5 py-1 text-center font-semibold ${cls}`}><div className="text-sm leading-none">{value}</div><div className="mt-0.5 leading-none">{label}</div></div>;
}
