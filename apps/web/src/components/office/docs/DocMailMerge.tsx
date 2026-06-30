'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Mail, Download, Plus } from 'lucide-react';
import { parseDelimited, findMergeFields, mailMergeDocs } from './mailMerge';
import { exportDocx } from '@/lib/office/docx';
import { RibbonButton } from '../ribbon';

/** Combinar correspondencia (Mail Merge): plantilla con campos {{campo}} + datos CSV/TSV. */
export function DocMailMerge({ editor, title }: { editor: any; title?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState('');
  const [fieldName, setFieldName] = useState('');

  const json = open ? editor.getJSON() : null;
  const fields = json ? findMergeFields(json) : [];
  const parsed = data.trim() ? parseDelimited(data) : { headers: [], rows: [] };
  const missing = fields.filter((f) => !parsed.headers.includes(f));

  const insertField = () => { const f = fieldName.trim(); if (!f) return; editor.chain().focus().insertContent(`{{${f}}}`).run(); setFieldName(''); };
  const combine = () => {
    if (!parsed.rows.length) return;
    exportDocx(mailMergeDocs(editor.getJSON(), parsed.rows), `${title || 'documento'}-combinado`);
    setOpen(false);
  };

  return (
    <>
      <RibbonButton icon={Mail} label="Combinar correspondencia" hideLabel={false} onClick={() => setOpen(true)} />
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 sticky top-0 bg-white dark:bg-[#161616]">
              <Mail className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold">Combinar correspondencia</h2>
              <button onClick={() => setOpen(false)} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">1. Inserta campos en el documento</p>
                <div className="flex gap-2">
                  <input value={fieldName} onChange={(e) => setFieldName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && insertField()}
                    placeholder="nombre" className="h-9 flex-1 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40 font-mono" />
                  <button onClick={insertField} className="inline-flex items-center gap-1 text-sm font-semibold px-3 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90"><Plus className="w-4 h-4" /> Insertar</button>
                </div>
                {fields.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {fields.map((f) => <code key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{`{{${f}}}`}</code>)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">2. Pega los datos (CSV o TSV, con cabecera)</p>
                <textarea value={data} onChange={(e) => setData(e.target.value)} rows={6}
                  placeholder={'nombre,ciudad,saldo\nAna,Madrid,€1.234\nLuis,Vigo,€567'}
                  className="w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 p-3 outline-none focus:ring-2 ring-emerald-500/40 font-mono resize-y" />
                {parsed.rows.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{parsed.rows.length} registro(s) · columnas: {parsed.headers.join(', ')}</p>
                )}
                {missing.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠ Campos sin columna de datos: {missing.map((f) => `{{${f}}}`).join(', ')}</p>
                )}
              </div>
              <button onClick={combine} disabled={!parsed.rows.length}
                className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-3 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
                <Download className="w-4 h-4" /> Combinar y descargar .docx ({parsed.rows.length || 0})
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
