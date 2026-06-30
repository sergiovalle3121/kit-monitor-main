'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { Quote, BookText, X } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

/** Insertar cita (Autor, Año, Título) + insertar bibliografía. */
export function DocCitations({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState('');
  const [title, setTitle] = useState('');

  const commit = () => {
    const a = author.trim() || 'Autor';
    const y = year.trim() || 's. f.';
    const t = title.trim();
    const inText = `(${a}, ${y})`;
    const source = `${a} (${y}).${t ? ` ${t}.` : ''}`;
    (editor.chain().focus() as any).insertCitation(inText, source).run();
    setOpen(false); setAuthor(''); setYear(''); setTitle('');
  };

  const modal = open && createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4" onMouseDown={() => setOpen(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} onMouseDown={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#1b1b1d] border border-black/10 dark:border-white/10 shadow-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Quote className="w-5 h-5 text-blue-500" /> Insertar cita</h3>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="space-y-2">
            <input autoFocus value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Autor (Apellido)" className="w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-blue-500/40" />
            <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Año" className="w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-blue-500/40" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la obra (opcional)" className="w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-blue-500/40" />
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">Vista previa: <span className="font-semibold">({author.trim() || 'Autor'}, {year.trim() || 's. f.'})</span></p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={commit} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">Insertar</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      <RibbonMenuButton icon={Quote} label="Citas" menuWidth={220} items={[
        { label: 'Insertar cita…', icon: Quote, onClick: () => setOpen(true) },
        { label: 'Insertar bibliografía', icon: BookText, onClick: () => (editor.chain().focus() as any).insertBibliography().run() },
      ]} />
      {modal}
    </>
  );
}
