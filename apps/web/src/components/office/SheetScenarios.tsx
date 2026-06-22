'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Layers, Play, Trash2, Plus, BarChart3 } from 'lucide-react';
import { parseChanges, type Scenario } from './sheets/scenarios';

/** Administrador de escenarios (análisis de hipótesis): guarda, aplica y resume escenarios. */
export function SheetScenarios({ scenarios, onAdd, onRemove, onApply, onSummary, onClose }: {
  scenarios: Scenario[];
  onAdd: (s: Scenario) => void;
  onRemove: (name: string) => void;
  onApply: (s: Scenario) => void;
  onSummary: (resultCells: string) => { ok: boolean; text: string };
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [changesText, setChangesText] = useState('');
  const [resultCells, setResultCells] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const field = 'h-9 w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';
  const add = () => {
    const changes = parseChanges(changesText);
    if (!name.trim() || !changes.length) { setMsg({ ok: false, text: 'Pon un nombre y al menos un cambio (p. ej. A1=100).' }); return; }
    onAdd({ name: name.trim(), changes });
    setName(''); setChangesText(''); setMsg({ ok: true, text: `Escenario «${name.trim()}» guardado.` });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 sticky top-0 bg-white dark:bg-[#161616]">
          <Layers className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Administrador de escenarios</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {scenarios.length > 0 ? (
            <div className="space-y-1.5">
              {scenarios.map((s) => (
                <div key={s.name} className="flex items-center gap-2 rounded-xl border border-black/5 dark:border-white/10 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[11px] text-gray-500 truncate font-mono">{s.changes.map((c) => `${c.cell}=${c.value}`).join(', ')}</p>
                  </div>
                  <button title="Aplicar" onClick={() => onApply(s)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><Play className="w-4 h-4" /></button>
                  <button title="Eliminar" onClick={() => onRemove(s.name)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-gray-500">Aún no hay escenarios. Crea el primero abajo.</p>}

          <div className="space-y-2 border-t border-black/5 dark:border-white/10 pt-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nuevo escenario</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (p. ej. Optimista)" className={field} />
            <input value={changesText} onChange={(e) => setChangesText(e.target.value)} placeholder="Cambios: A1=1000, B2=0.15" className={`${field} font-mono`} />
            <button onClick={add} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90"><Plus className="w-4 h-4" /> Guardar escenario</button>
          </div>

          <div className="space-y-2 border-t border-black/5 dark:border-white/10 pt-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Informe de resumen</p>
            <input value={resultCells} onChange={(e) => setResultCells(e.target.value)} placeholder="Celdas de resultado: B5, C5" className={`${field} font-mono`} />
            <button onClick={() => setMsg(onSummary(resultCells))} disabled={!scenarios.length}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"><BarChart3 className="w-4 h-4" /> Crear resumen</button>
          </div>

          {msg && <div className={`text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>{msg.text}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}
