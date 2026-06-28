'use client';

import React, { useState } from 'react';
import { CheckCircle2, MessageSquarePlus, Trash2, X } from 'lucide-react';

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
  const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'resolved'>('all');
  const [query, setQuery] = useState('');
  const visible = comments.filter((c) => c.slide === slide);
  const repliesOf = (id: string) => visible.filter((c) => c.parentId === id);
  const q = query.trim().toLowerCase();
  const roots = visible.filter((c) => {
    if (c.parentId) return false;
    if (filter === 'open' && c.resolved) return false;
    if (filter === 'assigned' && !c.assignedTo) return false;
    if (filter === 'resolved' && !c.resolved) return false;
    if (!q) return true;
    const thread = [c, ...repliesOf(c.id)];
    return thread.some((x) => `${x.text} ${x.objectLabel || ''} ${x.assignedTo || ''} ${x.author || ''}`.toLowerCase().includes(q));
  });
  const open = roots.filter((c) => !c.resolved);
  const resolved = roots.filter((c) => c.resolved);

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
          <p className="text-[11px] text-gray-500">Diapositiva {slide + 1} · {open.length} abierto(s)</p>
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
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en comentarios…" className="w-full h-8 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 text-xs outline-none focus:ring-2 ring-blue-500/30" />
        <div className="grid grid-cols-4 gap-1 text-[10px] font-semibold">
          {(['all', 'open', 'assigned', 'resolved'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`h-7 rounded-lg ${filter === f ? 'bg-blue-500 text-white' : 'bg-black/[0.04] dark:bg-white/[0.06] text-gray-500'}`}>
              {f === 'all' ? 'Todo' : f === 'open' ? 'Abiertos' : f === 'assigned' ? 'Asign.' : 'Res.'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {roots.length === 0 ? (
          <div className="h-full min-h-40 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-center p-6 text-sm text-gray-400">
            Sin comentarios para este filtro.
          </div>
        ) : (
          [...open, ...resolved].map((c) => (
            <div key={c.id} className={`rounded-2xl border p-3 ${c.resolved ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]'}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 truncate">{c.objectId ? `Objeto · ${c.objectLabel || 'selección'}` : 'Diapositiva'}</p>
                  <p className="text-[11px] text-gray-400">{new Date(c.createdAt).toLocaleString('es-ES')}</p>
                  {c.assignedTo && <p className="text-[11px] font-semibold text-blue-500 truncate">Asignado a {c.assignedTo}</p>}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onResolve(c.id, !c.resolved)} title={c.resolved ? 'Reabrir' : 'Resolver'} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(c.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <p className={`text-sm whitespace-pre-wrap ${c.resolved ? 'text-gray-500 line-through decoration-emerald-500/50' : 'text-foreground'}`}>{c.text}</p>
              {repliesOf(c.id).length > 0 && (
                <div className="mt-2 space-y-1.5 border-l-2 border-black/10 dark:border-white/10 pl-2.5">
                  {repliesOf(c.id).map((r) => (
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
          ))
        )}
      </div>
    </aside>
  );
}
