'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { ListTree, X } from 'lucide-react';

interface Item { level: number; text: string; pos: number }

function collect(editor: Editor): Item[] {
  const out: Item[] = [];
  editor.state.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading') out.push({ level: node.attrs.level ?? 1, text: node.textContent || '(sin título)', pos });
    else if (node.type.name === 'paragraph' && node.attrs?.outlineLevel) out.push({ level: node.attrs.outlineLevel, text: node.textContent || '(sin título)', pos });
  });
  return out;
}

/** Document outline / table of contents (navigation pane). */
export function DocOutline({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const items = open ? collect(editor) : [];

  function go(pos: number) {
    editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
  }

  return (
    <>
      <button onClick={() => { setOpen(true); force((n) => n + 1); }} title="Esquema / Índice"
        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
        <ListTree className="w-4 h-4" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[54] bg-black/20" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 w-72 z-[55] bg-white dark:bg-[#161616] border-r border-black/10 dark:border-white/10 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 h-12 border-b border-black/5 dark:border-white/10 flex-shrink-0">
                <span className="font-semibold text-sm">Esquema</span>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10 px-4">Sin títulos. Aplica estilos «Título 1-3» para construir el índice.</p>
                ) : (
                  <ul>
                    {items.map((it, i) => (
                      <li key={i}>
                        <button onClick={() => go(it.pos)} style={{ paddingLeft: 8 + (it.level - 1) * 16 }}
                          className="w-full text-left py-1.5 pr-2 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/5 truncate text-gray-700 dark:text-gray-200">
                          {it.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
