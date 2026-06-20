'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { MessageSquare, MessageSquarePlus, X, Check, Trash2, CornerDownRight, Send } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface Reply { author: string; text: string; createdAt: number }
interface CommentItem { id: string; text: string; author: string; createdAt: number | null; resolved: boolean; replies: Reply[]; from: number; to: number; quoted: string }

const uid = () => `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const fmt = (t: number | null) => (t ? new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

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
        if (!existing) map.set(id, { id, text: m.attrs.text || '', author: m.attrs.author || '', createdAt: m.attrs.createdAt ?? null, resolved: !!m.attrs.resolved, replies: Array.isArray(m.attrs.replies) ? m.attrs.replies : [], from, to, quoted: node.text || '' });
        else { existing.to = to; existing.quoted += node.text || ''; }
      }
    }
  });
  return [...map.values()];
}

/** Comentarios con hilos: responder, resolver, autor/fecha (guardados en la marca). */
export function DocComments({ editor, author }: { editor: Editor; author: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const refresh = () => force((n) => n + 1);
  const comments = open ? collect(editor) : [];

  // Re-aplica la marca sobre el rango del comentario con atributos nuevos.
  // Quita primero la marca existente (la marca `comment` no se excluye a sí
  // misma) para no acumular marcas duplicadas en el mismo rango.
  const update = (c: CommentItem, patch: Partial<{ resolved: boolean; replies: Reply[] }>) => {
    (editor.chain().setTextSelection({ from: c.from, to: c.to }) as any)
      .unsetComment()
      .setComment({ commentId: c.id, text: c.text, author: c.author, createdAt: c.createdAt, resolved: c.resolved, replies: c.replies, ...patch })
      .run();
    refresh();
  };

  function addComment() {
    const { from, to } = editor.state.selection;
    if (from === to) { toast.info('Selecciona el texto que quieres comentar.'); return; }
    const text = window.prompt('Comentario');
    if (!text || !text.trim()) return;
    (editor.chain().focus() as any).setComment({ commentId: uid(), text: text.trim(), author, createdAt: Date.now(), resolved: false, replies: [] }).run();
    setOpen(true);
    refresh();
  }
  const goTo = (c: CommentItem) => editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run();
  const toggleResolved = (c: CommentItem) => update(c, { resolved: !c.resolved });
  const remove = (c: CommentItem) => { (editor.chain().setTextSelection({ from: c.from, to: c.to }) as any).unsetComment().run(); refresh(); };
  function sendReply(c: CommentItem) {
    const t = replyText.trim();
    if (!t) return;
    update(c, { replies: [...c.replies, { author, text: t, createdAt: Date.now() }] });
    setReplyText('');
    setReplyTo(null);
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
                      <p className="text-[11px] text-gray-400 mt-1">{c.author || 'Anónimo'}{c.createdAt ? ` · ${fmt(c.createdAt)}` : ''}</p>
                    </button>

                    {c.replies.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-black/5 dark:border-white/10 space-y-1.5">
                        {c.replies.map((r, i) => (
                          <div key={i}>
                            <p className="text-[13px]">{r.text}</p>
                            <p className="text-[11px] text-gray-400">{r.author || 'Anónimo'} · {fmt(r.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {replyTo === c.id ? (
                      <div className="mt-2 flex items-center gap-1">
                        <input autoFocus value={replyText} onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') sendReply(c); if (e.key === 'Escape') { setReplyTo(null); setReplyText(''); } }}
                          placeholder="Responder…" className="flex-1 h-7 text-[13px] rounded-lg bg-gray-100 dark:bg-white/10 px-2 outline-none focus:ring-2 ring-blue-500/40" />
                        <button onClick={() => sendReply(c)} className="p-1.5 rounded-lg bg-blue-600 text-white"><Send className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-2">
                        <button onClick={() => { setReplyTo(c.id); setReplyText(''); }} title="Responder" className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300"><CornerDownRight className="w-3.5 h-3.5" /> Responder</button>
                        <button onClick={() => toggleResolved(c)} title={c.resolved ? 'Reabrir' : 'Resolver'} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600"><Check className="w-3.5 h-3.5" /> {c.resolved ? 'Reabrir' : 'Resolver'}</button>
                        <button onClick={() => remove(c)} title="Eliminar" className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
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
