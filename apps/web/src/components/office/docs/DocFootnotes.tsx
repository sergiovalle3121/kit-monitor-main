'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { Superscript, ListEnd, X } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

/** Notas al pie: insertar marcador, insertar área de notas y editar la nota. */
export function DocFootnotes({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState<false | 'insert' | 'edit'>(false);
  const [text, setText] = useState('');

  useEffect(() => {
    const onEdit = () => {
      const node = (editor.state.selection as any).node;
      if (!node || node.type.name !== 'footnoteRef') return;
      setText(node.attrs.content || '');
      setOpen('edit');
    };
    window.addEventListener('doc-footnote-edit', onEdit as any);
    return () => window.removeEventListener('doc-footnote-edit', onEdit as any);
  }, [editor]);

  const commit = () => {
    const t = text.trim();
    if (open === 'edit') (editor.chain().focus() as any).updateSelectedFootnote(t).run();
    else (editor.chain().focus() as any).insertFootnote(t).run();
    setOpen(false);
    setText('');
  };

  const modal = open && createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4" onMouseDown={() => setOpen(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} onMouseDown={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#1b1b1d] border border-black/10 dark:border-white/10 shadow-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Superscript className="w-5 h-5 text-blue-500" /> {open === 'edit' ? 'Editar nota al pie' : 'Nueva nota al pie'}</h3>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus rows={4} placeholder="Texto de la nota…"
            className="w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 p-3 outline-none focus:ring-2 ring-blue-500/40 resize-y" />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={commit} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">{open === 'edit' ? 'Guardar' : 'Insertar'}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      <RibbonMenuButton icon={Superscript} label="Nota al pie" menuWidth={220} items={[
        { label: 'Insertar nota al pie', icon: Superscript, onClick: () => { setText(''); setOpen('insert'); } },
        { label: 'Insertar área de notas', icon: ListEnd, onClick: () => (editor.chain().focus() as any).insertFootnoteList().run() },
      ]} />
      {modal}
    </>
  );
}
