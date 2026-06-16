'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { SeparatorVertical, X, RectangleVertical, RectangleHorizontal, Square, Columns2, Columns3 } from 'lucide-react';
import { RibbonGroup, RibbonMenuButton } from '../ribbon';
import { PAGE_NUMBER_FORMATS } from '../docPageExtensions';

interface SectionForm {
  breakType: string; header: string; footer: string; pageNumbers: boolean;
  pageNumberStart: number | null; pageNumberFormat: string; columns: number; orientation: string;
}
const EMPTY: SectionForm = { breakType: 'nextPage', header: '', footer: '', pageNumbers: false, pageNumberStart: null, pageNumberFormat: 'decimal', columns: 0, orientation: '' };

/** Saltos de sección + ajustes por sección (encabezado/pie/numeración/columnas/orientación). */
export function DocSections({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SectionForm>(EMPTY);

  // Abrir el editor cuando se pulsa «Configurar» en el divisor de la sección.
  useEffect(() => {
    const onEdit = () => {
      const node = (editor.state.selection as any).node;
      if (!node || node.type.name !== 'sectionBreak') return;
      setForm({ ...EMPTY, ...node.attrs });
      setOpen(true);
    };
    window.addEventListener('doc-section-edit', onEdit as any);
    return () => window.removeEventListener('doc-section-edit', onEdit as any);
  }, [editor]);

  const insert = (breakType: string) => (editor.chain().focus() as any).insertSectionBreak({ breakType }).run();

  const save = () => {
    (editor.chain().focus() as any).updateSectionBreak({
      breakType: form.breakType, header: form.header, footer: form.footer,
      pageNumbers: form.pageNumbers, pageNumberStart: form.pageNumberStart,
      pageNumberFormat: form.pageNumberFormat, columns: form.columns, orientation: form.orientation,
    }).run();
    setOpen(false);
  };
  const upd = (patch: Partial<SectionForm>) => setForm((f) => ({ ...f, ...patch }));

  const field = 'w-full h-9 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none focus:ring-2 ring-blue-500/40';
  const seg = (active: boolean) => `flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium border transition-colors ${active ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'border-black/10 dark:border-white/10 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`;

  const modal = open && createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4" onMouseDown={() => setOpen(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} onMouseDown={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-[#1b1b1d] border border-black/10 dark:border-white/10 shadow-2xl p-5 max-h-[88vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><SeparatorVertical className="w-5 h-5 text-blue-500" /> Ajustes de sección</h3>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tipo de salto</label>
              <div className="flex gap-2 mt-1">
                <button onClick={() => upd({ breakType: 'nextPage' })} className={seg(form.breakType === 'nextPage')}>Página siguiente</button>
                <button onClick={() => upd({ breakType: 'continuous' })} className={seg(form.breakType === 'continuous')}>Continuo</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Encabezado de la sección</label>
                <input value={form.header} onChange={(e) => upd({ header: e.target.value })} placeholder="(hereda del documento)" className={field} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Pie de la sección</label>
                <input value={form.footer} onChange={(e) => upd({ footer: e.target.value })} placeholder="(hereda del documento)" className={field} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Orientación</label>
              <div className="flex gap-2 mt-1">
                <button onClick={() => upd({ orientation: '' })} className={seg(form.orientation === '')}>Heredar</button>
                <button onClick={() => upd({ orientation: 'portrait' })} className={seg(form.orientation === 'portrait')}><RectangleVertical className="w-4 h-4" /> Vertical</button>
                <button onClick={() => upd({ orientation: 'landscape' })} className={seg(form.orientation === 'landscape')}><RectangleHorizontal className="w-4 h-4" /> Horizontal</button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Columnas</label>
              <div className="flex gap-2 mt-1">
                <button onClick={() => upd({ columns: 0 })} className={seg(form.columns === 0)}>Heredar</button>
                <button onClick={() => upd({ columns: 1 })} className={seg(form.columns === 1)}><Square className="w-4 h-4" /> 1</button>
                <button onClick={() => upd({ columns: 2 })} className={seg(form.columns === 2)}><Columns2 className="w-4 h-4" /> 2</button>
                <button onClick={() => upd({ columns: 3 })} className={seg(form.columns === 3)}><Columns3 className="w-4 h-4" /> 3</button>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={form.pageNumbers} onChange={(e) => upd({ pageNumbers: e.target.checked })} /> Mostrar número de página en esta sección
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Reiniciar en</label>
                  <input type="number" min={0} value={form.pageNumberStart ?? ''} onChange={(e) => upd({ pageNumberStart: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} placeholder="(continúa)" className={field} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Formato</label>
                  <select value={form.pageNumberFormat} onChange={(e) => upd({ pageNumberFormat: e.target.value })} className={field}>
                    {Object.entries(PAGE_NUMBER_FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={save} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">Guardar</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <RibbonGroup label="Secciones">
      <RibbonMenuButton icon={SeparatorVertical} label="Salto de sección" menuWidth={230} items={[
        { label: 'Página siguiente', onClick: () => insert('nextPage') },
        { label: 'Continuo', onClick: () => insert('continuous') },
      ]} />
      {modal}
    </RibbonGroup>
  );
}
