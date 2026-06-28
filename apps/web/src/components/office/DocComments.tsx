'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { MessageSquare, MessageSquarePlus, X, Check, Trash2, CornerDownRight, Send } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface Reply { id?: string; author: string; text: string; mentions?: string[]; createdAt: number | string }
type CommentFilter = 'all' | 'open' | 'resolved' | 'assigned';
interface CommentItem { id: string; persistedId?: string; text: string; author: string; createdAt: number | string | null; resolved: boolean; replies: Reply[]; from: number; to: number; quoted: string; mentions?: string[]; assignedTo?: string | null }

const uid = () => `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const fmt = (t: number | string | null) => (t ? new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const mentionsOf = (text: string) => [...new Set((text.match(/@[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|@[A-Za-z0-9._-]+/g) ?? []).map((m) => m.slice(1).toLowerCase()))];

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
export function DocComments({ editor, author, docId }: { editor: Editor; author: string; docId?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [persisted, setPersisted] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState<CommentFilter>('open');
  const [query, setQuery] = useState('');
  const refresh = () => force((n) => n + 1);
  React.useEffect(() => {
    if (!open || !docId) return;
    let active = true;
    const params = new URLSearchParams({ status: filter === 'assigned' ? 'open' : filter });
    if (filter === 'assigned' && author) params.set('assignedTo', author);
    if (query.trim()) params.set('q', query.trim());
    apiFetch(`${API_BASE}/office-documents/${docId}/comments?${params.toString()}`).then(async (r) => {
      if (!active || !r.ok) return;
      const rows = await r.json();
      const next: Record<string, any> = {};
      for (const row of rows) next[row.anchorId] = row;
      setPersisted(next);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [open, docId, filter, query, author]);

  const comments = open ? (() => {
    const local = collect(editor).map((c) => {
      const row = persisted[c.id];
      return row ? { ...c, persistedId: row.id, text: row.text, author: row.author || c.author, createdAt: row.createdAt, resolved: !!row.resolved, replies: Array.isArray(row.replies) ? row.replies : [], mentions: row.mentions ?? [], assignedTo: row.assignedTo ?? null } : c;
    });
    const localIds = new Set(local.map((c) => c.id));
    const serverOnly = Object.values(persisted).filter((row: any) => !localIds.has(row.anchorId)).map((row: any) => ({
      id: row.anchorId,
      persistedId: row.id,
      text: row.text,
      author: row.author || '',
      createdAt: row.createdAt ?? null,
      resolved: !!row.resolved,
      replies: Array.isArray(row.replies) ? row.replies : [],
      from: typeof row.anchor?.from === 'number' ? row.anchor.from : 0,
      to: typeof row.anchor?.to === 'number' ? row.anchor.to : 0,
      quoted: row.quotedText || 'Ancla no disponible en el contenido actual',
      mentions: row.mentions ?? [],
      assignedTo: row.assignedTo ?? null,
    }));
    return [...local, ...serverOnly];
  })().filter((c) => {
    if (filter === 'open' && c.resolved) return false;
    if (filter === 'resolved' && !c.resolved) return false;
    if (filter === 'assigned' && (!author || c.assignedTo !== author.toLowerCase())) return false;
    const q = query.trim().toLowerCase();
    return !q || c.text.toLowerCase().includes(q) || c.quoted.toLowerCase().includes(q) || c.replies.some((r: Reply) => r.text.toLowerCase().includes(q));
  }) : [];

  // Re-aplica la marca sobre el rango del comentario con atributos nuevos.
  // Quita primero la marca existente (la marca `comment` no se excluye a sí
  // misma) para no acumular marcas duplicadas en el mismo rango.
  const update = async (c: CommentItem, patch: Partial<{ resolved: boolean; replies: Reply[]; assignedTo: string | null }>) => {
    (editor.chain().setTextSelection({ from: c.from, to: c.to }) as any)
      .unsetComment()
      .setComment({ commentId: c.id, text: c.text, author: c.author, createdAt: c.createdAt, resolved: c.resolved, replies: c.replies, ...patch })
      .run();
    if (docId && c.persistedId) {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/comments/${c.persistedId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (r.ok) { const row = await r.json(); setPersisted((m) => ({ ...m, [row.anchorId]: row })); }
    }
    refresh();
  };

  async function addComment() {
    const { from, to } = editor.state.selection;
    if (from === to) { toast.info('Selecciona el texto que quieres comentar.'); return; }
    const text = window.prompt('Comentario');
    if (!text || !text.trim()) return;
    const commentId = uid();
    const quotedText = editor.state.doc.textBetween(from, to, ' ').slice(0, 1000);
    const base = { commentId, text: text.trim(), author, createdAt: Date.now(), resolved: false, replies: [], mentions: mentionsOf(text), assignedTo: null };
    (editor.chain().focus() as any).setComment(base).run();
    if (docId) {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anchorId: commentId, text: text.trim(), quotedText, anchor: { from, to }, mentions: mentionsOf(text) }) });
      if (r.ok) { const row = await r.json(); setPersisted((m) => ({ ...m, [row.anchorId]: row })); }
    }
    setOpen(true);
    refresh();
  }
  const goTo = (c: CommentItem) => {
    if (c.from > 0 && c.to > c.from) editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run();
  };
  const toggleResolved = (c: CommentItem) => update(c, { resolved: !c.resolved });
  const assign = (c: CommentItem) => {
    const next = window.prompt('Asignar a usuario/email (vacío para quitar asignación)', c.assignedTo ?? '');
    if (next === null) return;
    update(c, { assignedTo: next.trim() || null });
  };
  const remove = async (c: CommentItem) => {
    if (docId && c.persistedId) await apiFetch(`${API_BASE}/office-documents/${docId}/comments/${c.persistedId}`, { method: 'DELETE' }).catch(() => undefined);
    (editor.chain().setTextSelection({ from: c.from, to: c.to }) as any).unsetComment().run();
    refresh();
  };
  async function sendReply(c: CommentItem) {
    const t = replyText.trim();
    if (!t) return;
    const localReplies = [...c.replies, { author, text: t, mentions: mentionsOf(t), createdAt: Date.now() }];
    if (docId && c.persistedId) {
      const r = await apiFetch(`${API_BASE}/office-documents/${docId}/comments/${c.persistedId}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t, mentions: mentionsOf(t) }) });
      if (r.ok) { const row = await r.json(); setPersisted((m) => ({ ...m, [row.anchorId]: row })); update(c, { replies: Array.isArray(row.replies) ? row.replies : localReplies }); }
      else update(c, { replies: localReplies });
    } else update(c, { replies: localReplies });
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
              <div className="p-2 border-b border-black/5 dark:border-white/10 space-y-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en comentarios…" className="w-full h-8 text-[13px] rounded-lg bg-gray-100 dark:bg-white/10 px-2 outline-none focus:ring-2 ring-blue-500/40" />
                <div className="grid grid-cols-4 gap-1">
                  {(['open', 'all', 'resolved', 'assigned'] as CommentFilter[]).map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={`h-7 rounded-lg text-[11px] font-semibold ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/15'}`}>
                      {f === 'open' ? 'Abiertos' : f === 'all' ? 'Todos' : f === 'resolved' ? 'Resueltos' : 'Míos'}
                    </button>
                  ))}
                </div>
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
                      {c.assignedTo ? <p className="text-[11px] text-blue-500 mt-1">Asignado a {c.assignedTo}</p> : null}
                    </button>

                    {c.replies.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-black/5 dark:border-white/10 space-y-1.5">
                        {c.replies.map((r: Reply, i: number) => (
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
                        <button onClick={() => assign(c)} title="Asignar" className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 text-blue-600">@</button>
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
