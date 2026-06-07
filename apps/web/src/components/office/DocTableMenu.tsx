'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { Table as TableIcon, ChevronDown } from 'lucide-react';

/** Contextual table menu — shown only when the cursor is inside a table. */
export function DocTableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const run = (fn: string) => { (editor.chain().focus() as any)[fn]().run(); setOpen(false); };

  const Item = ({ fn, label, danger }: { fn: string; label: string; danger?: boolean }) => (
    <button onClick={() => run(fn)} className={`w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 ${danger ? 'text-red-500' : ''}`}>{label}</button>
  );

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Tabla"
        className="flex items-center gap-1 p-2 rounded-lg bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-200">
        <TableIcon className="w-4 h-4" /> <ChevronDown className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 mt-1 z-20 w-52 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-1">
              <Item fn="addRowBefore" label="Insertar fila arriba" />
              <Item fn="addRowAfter" label="Insertar fila abajo" />
              <Item fn="addColumnBefore" label="Insertar columna izquierda" />
              <Item fn="addColumnAfter" label="Insertar columna derecha" />
              <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
              <Item fn="mergeCells" label="Combinar celdas" />
              <Item fn="splitCell" label="Dividir celda" />
              <Item fn="toggleHeaderRow" label="Alternar fila de encabezado" />
              <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
              <Item fn="deleteRow" label="Eliminar fila" danger />
              <Item fn="deleteColumn" label="Eliminar columna" danger />
              <Item fn="deleteTable" label="Eliminar tabla" danger />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
