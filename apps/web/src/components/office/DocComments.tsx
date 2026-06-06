'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { MessageSquare, MessageSquarePlus, X, Check, Trash2 } from 'lucide-react';

interface CommentItem { id: string; text: string; author: string; createdAt: number | null; resolved: boolean; from: number; to: number; quoted: string }

const uid = () => `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

function collect(editor: Editor): CommentItem[] {
  const map = new Map<string, CommentItem>();
  editor.state.doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    for (const m of node.marks) {
      if (m.type.name === 'comment' && m.attrs.commentId) {
        const id = m.attrs.commentId;
        const existing = map.get(id);
        const from = pos;
        const to = pos + node.nodeSize;
        if (!existing) map.set(id, { id, text: m.attrs.text || '', author: m.attrs.author || '', createdAt: m.attrs.createdAt ?? null, resolved: !!m.attrs.resolved, from, to, quoted: node.text || '' });
        else { existing.to = to; existing.quoted += node.text || ''; }
      }
    }
  });
  return [...map.values()];
}

/** Comments sidebar for the document editor (mark-based, stored in the doc). */
export function DocComments({ editor, author }: { editor: Editor; author: string }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const comments = open ? collect(editor) : [];

  function addComment() {
    const { from, to } = editor.state.selection;
    if (from === to) { window.alert('Selecciona el texto que quieres comentar.'); return; }
    const text = window.prompt('Comentario');
    if (!text || !text.trim()) return;
    (editor.chain().focus() as any).setComment({ commentId: uid(), text: text.trim(), author, createdAt: Date.now(), resolved: false }).run();
    setOpen(true);
    refresh();
  }
  function goTo(c: CommentItem) { editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run(); }
  function toggleResolved(c: CommentItem) {
    (editor.chain().setTextSelection({ from: c.from, to: c.to }) as any).setComment({ commentId: c.id, text: c.text, author: c.author, createdAt: c.createdAt, resolved: !c.resolved }).run();
    refresh();
  }
  function remove(c: CommentItem) {
    (editor.chain().setTextSelection({ from: c.from, to: c.to }) as any).unsetComment().run();
    refresh();
  }

  return (
    <>
      <button onClick={addComment} title="Comentar selección"
        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
        <MessageSquarePlus className="w-4 h-4" />
      </button>
      <button onClick={() => { setOpen(true); refresh(); }} title="Ver comentarios"
        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
        <MessageSquare className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[54] bg-black/20" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: 340 }} animate={{ x: 0 }} exit={{ x: 340 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 right-0 w-80 z-[55] bg-white dark:bg-[#161616] border-l border-black/10 dark:border-white/10 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 h-12 border-b border-black/5 dark:border-white/10 flex-shrink-0">
                <span className="font-semibold text-sm">Comentarios</span>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {comments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10 px-4">Sin comentarios. Selecciona texto y pulsa «comentar».</p>
                ) : comments.map((c) => (
                  <div key={c.id} className={`rounded-xl border p-3 ${c.resolved ? 'border-black/5 dark:border-white/5 opacity-60' : 'border-black/10 dark:border-white/10'}`}>
                    <button onClick={() => goTo(c)} className="block w-full text-left">
                      <p className="text-[11px] text-gray-400 truncate italic">“{c.quoted}”</p>
                      <p className={`text-sm mt-1 ${c.resolved ? 'line-through' : ''}`}>{c.text}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{c.author || 'Anónimo'}</p>
                    </button>
                    <div className="flex items-center gap-1 mt-2">
                      <button onClick={() => toggleResolved(c)} title={c.resolved ? 'Reabrir' : 'Resolver'} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600"><Check className="w-3.5 h-3.5" /> {c.resolved ? 'Reabrir' : 'Resolver'}</button>
                      <button onClick={() => remove(c)} title="Eliminar" className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
