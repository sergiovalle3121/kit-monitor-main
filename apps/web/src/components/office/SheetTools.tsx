'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const COLORS = ['#fee2e2', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#111827'];

export interface ValidationPayload { range: string; options: string; sheetIndex: number }
export interface CondFormatPayload { range: string; op: string; value: string; color: string; sheetIndex: number }

/** Dialog for data validation (dropdown lists) and conditional formatting. */
export function SheetTools({
  mode, sheetNames, onApplyValidation, onApplyCondFormat, onClose,
}: {
  mode: 'validation' | 'condformat';
  sheetNames: string[];
  onApplyValidation: (p: ValidationPayload) => void;
  onApplyCondFormat: (p: CondFormatPayload) => void;
  onClose: () => void;
}) {
  const [range, setRange] = useState('A1:A10');
  const [options, setOptions] = useState('Sí, No, Pendiente');
  const [op, setOp] = useState('>');
  const [value, setValue] = useState('0');
  const [color, setColor] = useState(COLORS[2]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const field = 'w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{mode === 'validation' ? 'Validación de datos' : 'Formato condicional'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {sheetNames.length > 1 && (
          <label className="block text-xs text-gray-500">Hoja
            <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={field}>
              {sheetNames.map((n, i) => <option key={i} value={i}>{n || `Hoja ${i + 1}`}</option>)}
            </select>
          </label>
        )}
        <label className="block text-xs text-gray-500">Rango (A1)
          <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:A10" className={field} />
        </label>

        {mode === 'validation' ? (
          <>
            <label className="block text-xs text-gray-500">Opciones de la lista (separadas por coma)
              <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Sí, No, Pendiente" className={field} />
            </label>
            <button onClick={() => onApplyValidation({ range, options, sheetIndex })}
              className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar lista desplegable</button>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-gray-500">Condición
                <select value={op} onChange={(e) => setOp(e.target.value)} className={field}>
                  <option value=">">Mayor que</option>
                  <option value=">=">Mayor o igual</option>
                  <option value="<">Menor que</option>
                  <option value="<=">Menor o igual</option>
                  <option value="=">Igual a</option>
                  <option value="!=">Distinto de</option>
                  <option value="contains">Contiene</option>
                </select>
              </label>
              <label className="flex-1 text-xs text-gray-500">Valor
                <input value={value} onChange={(e) => setValue(e.target.value)} className={field} />
              </label>
            </div>
            <div className="text-xs text-gray-500">Color de relleno
              <div className="flex items-center gap-2 mt-1">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-black dark:border-white' : 'border-gray-200 dark:border-white/20'}`} style={{ background: c }} />
                ))}
                <label className="ml-1 cursor-pointer relative inline-flex">
                  <span className="w-7 h-7 rounded-full border border-gray-300 inline-block" style={{ background: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' }} />
                  <input type="color" onChange={(e) => setColor(e.target.value)} className="w-0 h-0 opacity-0 absolute inset-0" />
                </label>
              </div>
            </div>
            <button onClick={() => onApplyCondFormat({ range, op, value, color, sheetIndex })}
              className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar formato</button>
          </>
        )}
        <p className="text-[11px] text-gray-400">Se aplica sobre el rango indicado de la hoja seleccionada.</p>
      </motion.div>
    </motion.div>
  );
}
