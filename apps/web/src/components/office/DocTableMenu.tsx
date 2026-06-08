'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { Table as TableIcon, ChevronDown } from 'lucide-react';

const SHADES = ['#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#f3f4f6', '#e5e7eb'];

function Item({ label, danger, onClick }: { label: string; danger?: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 ${danger ? 'text-red-500' : ''}`}>{label}</button>;
}
function Section({ title }: { title: string }) {
  return <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 pt-2 pb-0.5">{title}</div>;
}

/** Menú contextual de tabla (sólo visible con el cursor dentro de una tabla):
 *  insertar, combinar/dividir, encabezados, alineación vertical y sombreado. */
export function DocTableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const run = (fn: string) => { (editor.chain().focus() as any)[fn]().run(); };
  const cellAttr = (name: string, value: any) => { (editor.chain().focus() as any).setCellAttribute(name, value).run(); };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} title="Herramientas de tabla"
        className="flex items-center gap-1 p-2 rounded-lg bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-200">
        <TableIcon className="w-4 h-4" /> <ChevronDown className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 mt-1 z-20 w-60 max-h-[70vh] overflow-y-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-1">
              <Section title="Insertar" />
              <Item label="Fila arriba" onClick={() => run('addRowBefore')} />
              <Item label="Fila abajo" onClick={() => run('addRowAfter')} />
              <Item label="Columna izquierda" onClick={() => run('addColumnBefore')} />
              <Item label="Columna derecha" onClick={() => run('addColumnAfter')} />

              <Section title="Celdas" />
              <Item label="Combinar celdas" onClick={() => run('mergeCells')} />
              <Item label="Dividir celda" onClick={() => run('splitCell')} />

              <Section title="Encabezados" />
              <Item label="Fila de encabezado" onClick={() => run('toggleHeaderRow')} />
              <Item label="Columna de encabezado" onClick={() => run('toggleHeaderColumn')} />

              <Section title="Alineación vertical" />
              <div className="flex gap-1 px-2 py-1">
                {[['top', 'Arriba'], ['middle', 'Centro'], ['bottom', 'Abajo']].map(([v, l]) => (
                  <button key={v} onClick={() => cellAttr('verticalAlign', v)} className="flex-1 text-xs py-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/10">{l}</button>
                ))}
              </div>

              <Section title="Sombreado" />
              <div className="flex flex-wrap gap-1 px-2 py-1">
                {SHADES.map((c) => (
                  <button key={c} title={c} onClick={() => cellAttr('backgroundColor', c)} className="w-6 h-6 rounded-md border border-black/10 dark:border-white/15 hover:scale-110 transition-transform" style={{ background: c }} />
                ))}
                <button onClick={() => cellAttr('backgroundColor', null)} className="text-xs px-2 h-6 rounded-md bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/10">Quitar</button>
              </div>

              <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
              <Item label="Eliminar fila" danger onClick={() => run('deleteRow')} />
              <Item label="Eliminar columna" danger onClick={() => run('deleteColumn')} />
              <Item label="Eliminar tabla" danger onClick={() => run('deleteTable')} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
