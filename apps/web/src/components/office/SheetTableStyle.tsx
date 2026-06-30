'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { TABLE_STYLES, type TableStyleOpts } from '@/lib/office/sheetOps';

export interface TableStylePayload { sheetIndex: number; opts: TableStyleOpts }

/** Diálogo «dar formato como tabla»: galería de estilos, bandas, autofiltro y totales. */
export function SheetTableStyle({
  sheetNames, defaultRange, defaultSheetIndex, onApply, onClose,
}: {
  sheetNames: string[];
  defaultRange: string;
  defaultSheetIndex: number;
  onApply: (p: TableStylePayload) => void;
  onClose: () => void;
}) {
  const [range, setRange] = useState(defaultRange || 'A1:D20');
  const [sheetIndex, setSheetIndex] = useState(defaultSheetIndex || 0);
  const [styleId, setStyleId] = useState(TABLE_STYLES[0].id);
  const [hasHeader, setHasHeader] = useState(true);
  const [banded, setBanded] = useState(true);
  const [withFilter, setWithFilter] = useState(true);
  const [withBorders, setWithBorders] = useState(true);
  const [totalRow, setTotalRow] = useState(false);
  const field = 'w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  function apply() {
    const st = TABLE_STYLES.find((s) => s.id === styleId) ?? TABLE_STYLES[0];
    onApply({ sheetIndex, opts: { range, hasHeader, banded, withFilter, withBorders, totalRow, headerBg: st.headerBg, headerFc: st.headerFc, band1: st.band1, band2: st.band2 } });
  }

  const toggle = (checked: boolean, set: (b: boolean) => void, label: string) => (
    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} /> {label}
    </label>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Dar formato como tabla</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {sheetNames.length > 1 && (
          <label className="block text-xs text-gray-500">Hoja
            <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={field}>
              {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
            </select>
          </label>
        )}
        <label className="block text-xs text-gray-500">Rango de la tabla (A1)
          <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:D20" className={`${field} font-mono`} />
        </label>

        <div className="text-xs text-gray-500">Estilo
          <div className="mt-1 grid grid-cols-5 gap-2">
            {TABLE_STYLES.map((s) => (
              <button key={s.id} onClick={() => setStyleId(s.id)} title={s.label}
                className={`relative rounded-lg overflow-hidden border-2 ${styleId === s.id ? 'border-black dark:border-white' : 'border-transparent'}`}>
                <div className="h-4" style={{ background: s.headerBg }} />
                <div className="h-3" style={{ background: s.band1 }} />
                <div className="h-3" style={{ background: s.band2 }} />
                {styleId === s.id && <Check className="w-3 h-3 absolute top-0.5 right-0.5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {toggle(hasHeader, setHasHeader, 'Con encabezado')}
          {toggle(banded, setBanded, 'Filas con bandas')}
          {toggle(withFilter, setWithFilter, 'Autofiltro')}
          {toggle(withBorders, setWithBorders, 'Bordes')}
          {toggle(totalRow, setTotalRow, 'Fila de totales')}
        </div>

        <button onClick={apply} className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar formato de tabla</button>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Aplica encabezado, bandas y autofiltro al rango. El autofiltro usa el filtro nativo de la hoja.</p>
      </motion.div>
    </motion.div>
  );
}
