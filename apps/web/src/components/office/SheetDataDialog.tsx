'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export type DataMode = 'sort' | 'dedup' | 'split' | 'note';
const TITLES: Record<DataMode, string> = {
  sort: 'Ordenar rango', dedup: 'Quitar duplicados', split: 'Texto en columnas', note: 'Nota de celda',
};

/** Diálogo para operaciones de datos: ordenar, quitar duplicados, texto en
 *  columnas y notas de celda. Emite un payload que el editor aplica sobre los datos. */
export function SheetDataDialog({
  mode, sheetNames, onApply, onClose,
}: {
  mode: DataMode;
  sheetNames: string[];
  onApply: (mode: DataMode, payload: any) => void;
  onClose: () => void;
}) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const [range, setRange] = useState(mode === 'note' ? 'A1' : mode === 'split' ? 'A1:A20' : 'A1:D20');
  const [colPos, setColPos] = useState(1);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [hasHeader, setHasHeader] = useState(true);
  const [delimiter, setDelimiter] = useState(',');
  const [text, setText] = useState('');
  const field = 'w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  function apply() {
    if (mode === 'sort') onApply('sort', { range, sheetIndex, colRel: colPos - 1, order, hasHeader });
    else if (mode === 'dedup') onApply('dedup', { range, sheetIndex, hasHeader });
    else if (mode === 'split') onApply('split', { range, sheetIndex, delimiter });
    else onApply('note', { cell: range, sheetIndex, text });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{TITLES[mode]}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {sheetNames.length > 1 && (
          <label className="block text-xs text-gray-500">Hoja
            <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={field}>
              {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
            </select>
          </label>
        )}

        <label className="block text-xs text-gray-500">{mode === 'note' ? 'Celda (A1)' : 'Rango (A1)'}
          <input value={range} onChange={(e) => setRange(e.target.value)} placeholder={mode === 'note' ? 'B2' : 'A1:D20'} className={field} />
        </label>

        {mode === 'sort' && (
          <>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-gray-500">Columna (# en el rango)
                <input type="number" min={1} value={colPos} onChange={(e) => setColPos(Math.max(1, Number(e.target.value)))} className={field} />
              </label>
              <label className="flex-1 text-xs text-gray-500">Orden
                <select value={order} onChange={(e) => setOrder(e.target.value as any)} className={field}>
                  <option value="asc">Ascendente (A→Z, 0→9)</option>
                  <option value="desc">Descendente (Z→A, 9→0)</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La primera fila es encabezado</label>
          </>
        )}
        {mode === 'dedup' && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La primera fila es encabezado</label>
        )}
        {mode === 'split' && (
          <label className="block text-xs text-gray-500">Separador
            <input value={delimiter} onChange={(e) => setDelimiter(e.target.value)} placeholder="," className={field} />
          </label>
        )}
        {mode === 'note' && (
          <label className="block text-xs text-gray-500">Texto de la nota
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Comentario…" className="w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-emerald-500/40 resize-none" />
          </label>
        )}

        <button onClick={apply} className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar</button>
        {mode === 'split' && <p className="text-[11px] text-gray-400">Divide cada celda de la primera columna del rango y escribe las partes en las columnas a la derecha.</p>}
      </motion.div>
    </motion.div>
  );
}
