'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Crosshair } from 'lucide-react';
import type { SolverGoal } from './sheets/solver';

export interface SolverPayload { objective: string; goal: SolverGoal; target: string; variables: string; bounds: string }

/** Diálogo del Solver: optimiza una celda objetivo cambiando varias variables, con límites. */
export function SheetSolver({ defaultObjective, onApply, onClose }: {
  defaultObjective?: string;
  onApply: (p: SolverPayload) => { ok: boolean; text: string };
  onClose: () => void;
}) {
  const [objective, setObjective] = useState(defaultObjective || '');
  const [goal, setGoal] = useState<SolverGoal>('max');
  const [target, setTarget] = useState('');
  const [variables, setVariables] = useState('');
  const [bounds, setBounds] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const field = 'h-9 w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40 font-mono';
  const apply = () => {
    if (!objective.trim() || !variables.trim() || (goal === 'value' && target.trim() === '')) { setMsg({ ok: false, text: 'Completa objetivo, variables y (si aplica) el valor.' }); return; }
    setMsg(onApply({ objective: objective.trim().toUpperCase(), goal, target, variables, bounds }));
  };
  const GOALS: { id: SolverGoal; label: string }[] = [{ id: 'max', label: 'Máx.' }, { id: 'min', label: 'Mín.' }, { id: 'value', label: 'Valor' }];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10">
          <Crosshair className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Solver</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Encuentra los valores de varias celdas que optimizan una fórmula objetivo.</p>
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Celda objetivo (con fórmula)</span>
            <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="B10" className={field} /></label>
          <div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Objetivo</span>
            <div className="flex gap-1 p-1 mt-1 rounded-xl bg-gray-100 dark:bg-white/10 text-sm">
              {GOALS.map((g) => (
                <button key={g.id} onClick={() => setGoal(g.id)}
                  className={`flex-1 px-3 py-1.5 rounded-lg font-semibold transition-colors ${goal === g.id ? 'bg-white dark:bg-white/15 shadow' : 'text-gray-500'}`}>{g.label}</button>
              ))}
            </div>
          </div>
          {goal === 'value' && (
            <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Valor objetivo</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1000" className={field} /></label>
          )}
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Celdas variables</span>
            <input value={variables} onChange={(e) => setVariables(e.target.value)} placeholder="A1, C1" className={field} /></label>
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Restricciones (opcional)</span>
            <input value={bounds} onChange={(e) => setBounds(e.target.value)} placeholder="A1>=0, A1<=100, C1>=0" className={field} /></label>
          {msg && <div className={`text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>{msg.text}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={apply} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90">Resolver</button>
            <button onClick={onClose} className="text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">Cerrar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
