'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, MessageSquarePlus, Trash2, UserCheck, X } from 'lucide-react';
import {
  buildSlideCommentReview,
  formatCommentAge,
  type SlideCommentReviewFilter,
  type SlideCommentReviewScope,
  type SlideCommentReviewSort,
} from './slides/commentReview';

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

const filterLabels: Record<SlideCommentReviewFilter, string> = {
  all: 'Todo',
  open: 'Abiertos',
  assigned: 'Asign.',
  blockers: 'Bloq.',
  resolved: 'Res.',
};

const sortLabels: Record<SlideCommentReviewSort, string> = {
  priority: 'Prioridad',
  newest: 'Mas recientes',
  oldest: 'Mas antiguos',
};

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
  const [sort, setSort] = useState<SlideCommentReviewSort>('priority');
  const [query, setQuery] = useState('');
  const review = useMemo(
    () => buildSlideCommentReview(comments, { currentSlide: slide, scope, filter, sort, query }),
    [comments, filter, query, scope, slide, sort],
  );
  const { summary, threads } = review;

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
          <h3 className="text-sm font-bold">Comentarios</h3>
          <p className="text-[11px] text-gray-500">Diapositiva {slide + 1} · {summary.currentSlideOpenThreads} abierto(s) · {summary.openThreads} en revision</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="h-4 w-4" /></button>
      </div>

      {!readOnly && (
        <div className="p-3 border-b border-black/10 dark:border-white/10 space-y-2">
          <div className="inline-flex rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1 text-xs font-semibold">
            <button onClick={() => setTarget('slide')} className={`px-2.5 py-1 rounded-lg ${target === 'slide' ? 'bg-white dark:bg-black/30 shadow-sm' : 'text-gray-500'}`}>Slide</button>
            <button disabled={!canCommentObject} onClick={() => setTarget('object')} className={`px-2.5 py-1 rounded-lg disabled:opacity-40 ${target === 'object' ? 'bg-white dark:bg-black/30 shadow-sm' : 'text-gray-500'}`}>Objeto</button>
          </div>
          {target === 'object' && canCommentObject && <p className="text-[11px] text-gray-500 truncate">Anclado a: {selectedLabel}</p>}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Escribe un comentario o acción… usa @email para asignar" className={field} />
          <button onClick={submit} disabled={!text.trim()} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold py-2 disabled:opacity-40">
            <MessageSquarePlus className="h-4 w-4" /> Agregar comentario
          </button>
        </div>
      )}

      <div className="px-3 py-2 border-b border-black/10 dark:border-white/10 space-y-2">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] p-1 text-[11px] font-semibold">
          {(['slide', 'deck'] as const).map((nextScope) => (
            <button key={nextScope} onClick={() => setScope(nextScope)} className={`h-7 rounded-lg ${scope === nextScope ? 'bg-white dark:bg-black/30 shadow-sm' : 'text-gray-500'}`}>
              {nextScope === 'slide' ? 'Slide' : 'Deck'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <ReviewMetric label="Open" value={summary.openThreads} tone={summary.openThreads ? 'amber' : 'green'} />
          <ReviewMetric label="Asig." value={summary.assignedThreads} tone={summary.assignedThreads ? 'blue' : undefined} />
          <ReviewMetric label="Bloq." value={summary.blockerThreads} tone={summary.blockerThreads ? 'rose' : 'green'} />
          <ReviewMetric label="Slides" value={summary.slidesWithOpenThreads} />
        </div>
        {summary.warningMessages.length > 0 && (
          <div className="rounded-xl border border-amber-300/50 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="mb-1 flex items-center gap-1.5 font-bold"><AlertTriangle className="h-3.5 w-3.5" /> Revision pendiente</p>
            <p>{summary.warningMessages[0]}</p>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en comentarios…" className="min-w-0 flex-1 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 text-xs outline-none focus:ring-2 ring-blue-500/30" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SlideCommentReviewSort)} className="h-8 w-28 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 text-[11px] outline-none focus:ring-2 ring-blue-500/30">
            {(Object.keys(sortLabels) as SlideCommentReviewSort[]).map((option) => <option key={option} value={option}>{sortLabels[option]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-5 gap-1 text-[10px] font-semibold">
          {(Object.keys(filterLabels) as SlideCommentReviewFilter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`h-7 rounded-lg ${filter === f ? 'bg-blue-500 text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-gray-500'}`}>
              {filterLabels[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {threads.length === 0 ? (
          <div className="h-full min-h-40 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-center p-6 text-sm text-gray-400">
            Sin comentarios para este filtro.
          </div>
        ) : (
          threads.map((thread) => {
            const c = thread.root;
            return (
            <div key={c.id} className={`rounded-2xl border p-3 ${c.resolved ? 'border-emerald-500/20 bg-emerald-500/5' : thread.isBlocker ? 'border-amber-300/60 bg-amber-50/70 dark:border-amber-500/30 dark:bg-amber-500/10' : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]'}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 truncate">
                    {scope === 'deck' ? `Slide ${c.slide + 1} · ` : ''}{thread.targetLabel}
                  </p>
                  <p className="text-[11px] text-gray-400">{new Date(c.createdAt).toLocaleString('es-ES')} · {formatCommentAge(c.createdAt)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {thread.isBlocker && <ReviewChip tone="amber" icon={<AlertTriangle className="h-3 w-3" />}>Bloqueante</ReviewChip>}
                    {thread.assignedTo && <ReviewChip tone="blue" icon={<UserCheck className="h-3 w-3" />}>{thread.assignedTo}</ReviewChip>}
                    {thread.isStale && <ReviewChip tone="rose" icon={<Clock3 className="h-3 w-3" />}>{thread.ageDays}d</ReviewChip>}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onResolve(c.id, !c.resolved)} title={c.resolved ? 'Reabrir' : 'Resolver'} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(c.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <p className={`text-sm whitespace-pre-wrap ${c.resolved ? 'text-gray-500 line-through decoration-emerald-500/50' : 'text-foreground'}`}>{c.text}</p>
              {thread.replies.length > 0 && (
                <div className="mt-2 space-y-1.5 border-l-2 border-black/10 dark:border-white/10 pl-2.5">
                  {thread.replies.map((r) => (
                    <div key={r.id} className="rounded-xl bg-white/70 dark:bg-black/20 px-2.5 py-2">
                      <p className="text-[10px] text-gray-400">{r.author || 'AXOS'} · {new Date(r.createdAt).toLocaleString('es-ES')}</p>
                      <p className="text-xs whitespace-pre-wrap text-gray-700 dark:text-gray-200">{r.text}</p>
                    </div>
                  ))}
                </div>
              )}
              {!readOnly && !c.resolved && (
                <div className="mt-2 flex items-center gap-1.5">
                  <input value={reply[c.id] || ''} onChange={(e) => setReply((r) => ({ ...r, [c.id]: e.target.value }))} placeholder="Responder…" className="min-w-0 flex-1 h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 text-xs outline-none focus:ring-2 ring-blue-500/30" />
                  <button onClick={() => submitReply(c.id)} disabled={!(reply[c.id] || '').trim()} className="h-8 px-2 rounded-lg bg-blue-500 text-white text-xs font-semibold disabled:opacity-40">Enviar</button>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

function ReviewMetric({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'blue' | 'green' | 'rose' }) {
  const cls = tone === 'amber'
    ? 'border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : tone === 'blue'
      ? 'border-blue-300/60 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
      : tone === 'green'
        ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
        : tone === 'rose'
          ? 'border-rose-300/60 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          : 'border-black/10 bg-black/[0.03] text-gray-500 dark:border-white/10 dark:bg-white/[0.05]';
  return (
    <div className={`min-w-0 rounded-lg border px-1.5 py-1 text-center ${cls}`}>
      <p className="truncate text-[9px] font-bold uppercase tracking-wide">{label}</p>
      <p className="text-sm font-black leading-4">{value}</p>
    </div>
  );
}

function ReviewChip({ children, icon, tone }: { children: React.ReactNode; icon?: React.ReactNode; tone: 'amber' | 'blue' | 'rose' }) {
  const cls = tone === 'amber'
    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
    : tone === 'blue'
      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300';
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
