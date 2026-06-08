'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Printer } from 'lucide-react';
import type { PrintOpts } from '@/lib/office/sheetOps';

/** Diálogo de impresión / diseño de página con vista previa. */
export function SheetPrintDialog({
  sheetNames, defaultRange, defaultSheetIndex, defaultTitle, getHtml, onPrint, onClose,
}: {
  sheetNames: string[];
  defaultRange: string;
  defaultSheetIndex: number;
  defaultTitle: string;
  getHtml: (sheetIndex: number, opts: PrintOpts) => string;
  onPrint: (html: string) => void;
  onClose: () => void;
}) {
  const [sheetIndex, setSheetIndex] = useState(defaultSheetIndex || 0);
  const [range, setRange] = useState(defaultRange || '');
  const [title, setTitle] = useState(defaultTitle || '');
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [gridlines, setGridlines] = useState(true);
  const [fitToWidth, setFitToWidth] = useState(false);
  const field = 'h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  const opts: PrintOpts = { range: range.trim() || undefined, title: title.trim() || undefined, header: header.trim() || undefined, footer: footer.trim() || undefined, orientation, gridlines, fitToWidth };
  const html = useMemo(() => getHtml(sheetIndex, opts), [getHtml, sheetIndex, range, title, header, footer, orientation, gridlines, fitToWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-[90vh] rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <Printer className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Imprimir</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* Opciones */}
          <div className="sm:w-72 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-black/5 dark:border-white/10 overflow-y-auto p-4 space-y-2.5">
            {sheetNames.length > 1 && (
              <label className="block text-xs text-gray-500">Hoja
                <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={`${field} w-full`}>
                  {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
                </select>
              </label>
            )}
            <label className="block text-xs text-gray-500">Área de impresión (vacío = todo)
              <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:F40" className={`${field} w-full font-mono`} />
            </label>
            <label className="block text-xs text-gray-500">Título
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} w-full`} />
            </label>
            <div className="flex gap-2">
              <label className="block text-xs text-gray-500 flex-1">Encabezado
                <input value={header} onChange={(e) => setHeader(e.target.value)} className={`${field} w-full`} />
              </label>
              <label className="block text-xs text-gray-500 flex-1">Pie
                <input value={footer} onChange={(e) => setFooter(e.target.value)} className={`${field} w-full`} />
              </label>
            </div>
            <label className="block text-xs text-gray-500">Orientación
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as any)} className={`${field} w-full`}>
                <option value="portrait">Vertical</option><option value="landscape">Horizontal</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={gridlines} onChange={(e) => setGridlines(e.target.checked)} /> Líneas de cuadrícula</label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={fitToWidth} onChange={(e) => setFitToWidth(e.target.checked)} /> Ajustar al ancho</label>
            <button onClick={() => onPrint(html)} className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 inline-flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Imprimir</button>
          </div>
          {/* Vista previa */}
          <div className="flex-1 min-h-0 bg-gray-100 dark:bg-[#0b0b0b] p-3">
            <iframe title="Vista previa" srcDoc={html} className="w-full h-full rounded-xl bg-white border border-black/10 dark:border-white/10" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
