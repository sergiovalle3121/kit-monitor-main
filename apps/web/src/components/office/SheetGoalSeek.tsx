'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Target } from 'lucide-react';

export interface GoalSeekPayload { formulaCell: string; target: string; variableCell: string }

/** Diálogo «Buscar objetivo» (Goal Seek) — análisis de hipótesis estilo Excel. */
export function SheetGoalSeek({ defaultFormulaCell, onApply, onClose }: {
  defaultFormulaCell?: string;
  onApply: (p: GoalSeekPayload) => { ok: boolean; text: string };
  onClose: () => void;
}) {
  const [formulaCell, setFormulaCell] = useState(defaultFormulaCell || '');
  const [target, setTarget] = useState('');
  const [variableCell, setVariableCell] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const field = 'h-9 w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40 font-mono';
  const apply = () => {
    if (!formulaCell.trim() || !variableCell.trim() || target.trim() === '') { setMsg({ ok: false, text: 'Completa las tres casillas.' }); return; }
    setMsg(onApply({ formulaCell: formulaCell.trim().toUpperCase(), target: target.trim(), variableCell: variableCell.trim().toUpperCase() }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10">
          <Target className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Buscar objetivo</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Encuentra el valor de una celda que hace que una fórmula alcance un objetivo.</p>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Definir la celda (con fórmula)</span>
            <input value={formulaCell} onChange={(e) => setFormulaCell(e.target.value)} placeholder="B5" className={field} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Con el valor</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1000" className={field} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Cambiando la celda</span>
            <input value={variableCell} onChange={(e) => setVariableCell(e.target.value)} placeholder="A1" className={field} />
          </label>
          {msg && (
            <div className={`text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {msg.text}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={apply} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90">Aceptar</button>
            <button onClick={onClose} className="text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">Cerrar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
