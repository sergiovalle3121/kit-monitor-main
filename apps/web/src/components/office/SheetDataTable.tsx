'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Grid3x3 } from 'lucide-react';

export interface DataTablePayload {
  mode: 'one' | 'two';
  formulaCell: string;
  colInputCell: string;
  colValues: string;
  rowInputCell: string;
  rowValues: string;
}

/** Diálogo «Tabla de datos» (análisis de hipótesis de una o dos variables). */
export function SheetDataTable({ defaultFormulaCell, onApply, onClose }: {
  defaultFormulaCell?: string;
  onApply: (p: DataTablePayload) => { ok: boolean; text: string };
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'one' | 'two'>('one');
  const [formulaCell, setFormulaCell] = useState(defaultFormulaCell || '');
  const [colInputCell, setColInputCell] = useState('');
  const [colValues, setColValues] = useState('');
  const [rowInputCell, setRowInputCell] = useState('');
  const [rowValues, setRowValues] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const field = 'h-9 w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40 font-mono';
  const apply = () => {
    if (!formulaCell.trim() || !colInputCell.trim() || !colValues.trim() || (mode === 'two' && (!rowInputCell.trim() || !rowValues.trim()))) {
      setMsg({ ok: false, text: 'Completa todas las casillas.' }); return;
    }
    setMsg(onApply({ mode, formulaCell: formulaCell.trim().toUpperCase(), colInputCell: colInputCell.trim().toUpperCase(), colValues: colValues.trim(), rowInputCell: rowInputCell.trim().toUpperCase(), rowValues: rowValues.trim() }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10">
          <Grid3x3 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Tabla de datos</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/10 text-sm">
            {(['one', 'two'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setMsg(null); }}
                className={`flex-1 px-3 py-1.5 rounded-lg font-semibold transition-colors ${mode === m ? 'bg-white dark:bg-white/15 shadow' : 'text-gray-500'}`}>
                {m === 'one' ? 'Una variable' : 'Dos variables'}
              </button>
            ))}
          </div>
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Celda con la fórmula</span>
            <input value={formulaCell} onChange={(e) => setFormulaCell(e.target.value)} placeholder="B1" className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Celda de entrada {mode === 'two' ? '(columna)' : ''}</span>
            <input value={colInputCell} onChange={(e) => setColInputCell(e.target.value)} placeholder="A1" className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Valores {mode === 'two' ? 'de columna' : ''} (rango o lista)</span>
            <input value={colValues} onChange={(e) => setColValues(e.target.value)} placeholder="E1:E10  ó  1, 2, 3, 4" className={field} /></label>
          {mode === 'two' && (
            <>
              <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Celda de entrada (fila)</span>
                <input value={rowInputCell} onChange={(e) => setRowInputCell(e.target.value)} placeholder="C1" className={field} /></label>
              <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Valores de fila (rango o lista)</span>
                <input value={rowValues} onChange={(e) => setRowValues(e.target.value)} placeholder="10, 20, 30" className={field} /></label>
            </>
          )}
          {msg && <div className={`text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>{msg.text}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={apply} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90">Generar</button>
            <button onClick={onClose} className="text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">Cerrar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
