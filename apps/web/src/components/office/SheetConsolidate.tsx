'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Combine } from 'lucide-react';
import type { ConsAgg } from './sheets/consolidate';

export interface ConsolidatePayload { mode: 'position' | 'category'; agg: ConsAgg; ranges: string }

/** Diálogo «Consolidar datos»: combina varios rangos en una tabla agregada. */
export function SheetConsolidate({ onApply, onClose }: {
  onApply: (p: ConsolidatePayload) => { ok: boolean; text: string };
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'position' | 'category'>('category');
  const [agg, setAgg] = useState<ConsAgg>('sum');
  const [ranges, setRanges] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const AGGS: { id: ConsAgg; label: string }[] = [
    { id: 'sum', label: 'Suma' }, { id: 'average', label: 'Promedio' }, { id: 'count', label: 'Contar' }, { id: 'max', label: 'Máx.' }, { id: 'min', label: 'Mín.' },
  ];
  const apply = () => {
    const list = ranges.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (list.length < 2) { setMsg({ ok: false, text: 'Indica al menos dos rangos (uno por línea).' }); return; }
    setMsg(onApply({ mode, agg, ranges }));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10">
          <Combine className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Consolidar datos</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/10 text-sm">
            {([['category', 'Por categoría'], ['position', 'Por posición']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 px-3 py-1.5 rounded-lg font-semibold transition-colors ${mode === m ? 'bg-white dark:bg-white/15 shadow' : 'text-gray-500'}`}>{label}</button>
            ))}
          </div>
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Función</span>
            <select value={agg} onChange={(e) => setAgg(e.target.value as ConsAgg)} className="h-9 w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40">
              {AGGS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select></label>
          <label className="block"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Rangos (uno por línea; admite «Hoja2!A1:C4»)</span>
            <textarea value={ranges} onChange={(e) => setRanges(e.target.value)} rows={4} placeholder={'A1:C5\nHoja2!A1:C5'}
              className="w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 p-3 outline-none focus:ring-2 ring-emerald-500/40 font-mono resize-y" /></label>
          <p className="text-[11px] text-gray-500">«Por categoría»: la 1ª fila son cabeceras y la 1ª columna etiquetas; se alinean aunque difieran. «Por posición»: celda a celda.</p>
          {msg && <div className={`text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>{msg.text}</div>}
          <div className="flex gap-2 pt-1">
            <button onClick={apply} className="flex-1 text-sm font-semibold px-3 py-2 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90">Consolidar</button>
            <button onClick={onClose} className="text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">Cerrar</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
