'use client';

import React, { useState } from 'react';
import { CheckCircle2, MessageSquarePlus, Trash2, X } from 'lucide-react';

export interface SlideComment {
  id: string;
  slide: number;
  objectId?: string;
  objectLabel?: string;
  author?: string;
  text: string;
  createdAt: number;
  resolved?: boolean;
}

const field = 'w-full rounded-xl bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2 text-sm outline-none focus:ring-2 ring-blue-500/40 resize-none';

export function SlideCommentsPanel({
  comments, slide, readOnly, selectedLabel, canCommentObject, onAdd, onResolve, onDelete, onClose,
}: {
  comments: SlideComment[];
  slide: number;
  readOnly?: boolean;
  selectedLabel?: string;
  canCommentObject?: boolean;
  onAdd: (text: string, target: 'slide' | 'object') => void;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<'slide' | 'object'>('slide');
  const visible = comments.filter((c) => c.slide === slide);
  const open = visible.filter((c) => !c.resolved);
  const resolved = visible.filter((c) => c.resolved);

  function submit() {
    const v = text.trim();
    if (!v) return;
    onAdd(v, target === 'object' && canCommentObject ? 'object' : 'slide');
    setText('');
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
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Escribe un comentario o acción…" className={field} />
          <button onClick={submit} disabled={!text.trim()} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold py-2 disabled:opacity-40">
            <MessageSquarePlus className="h-4 w-4" /> Agregar comentario
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visible.length === 0 ? (
          <div className="h-full min-h-40 rounded-2xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-center p-6 text-sm text-gray-400">
            Sin comentarios en esta diapositiva.
          </div>
        ) : (
          [...open, ...resolved].map((c) => (
            <div key={c.id} className={`rounded-2xl border p-3 ${c.resolved ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]'}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 truncate">{c.objectId ? `Objeto · ${c.objectLabel || 'selección'}` : 'Diapositiva'}</p>
                  <p className="text-[11px] text-gray-400">{new Date(c.createdAt).toLocaleString('es-ES')}</p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onResolve(c.id, !c.resolved)} title={c.resolved ? 'Reabrir' : 'Resolver'} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></button>
                    <button onClick={() => onDelete(c.id)} title="Eliminar" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <p className={`text-sm whitespace-pre-wrap ${c.resolved ? 'text-gray-500 line-through decoration-emerald-500/50' : 'text-gray-800 dark:text-gray-100'}`}>{c.text}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
