'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Tag, ClipboardCopy, CornerDownLeft } from 'lucide-react';
import { validateRangeName, qualifiedRef, type NamedRange } from '@/lib/office/sheetOps';

/** Administrador de rangos con nombre: crear, eliminar e insertar referencias. */
export function SheetNameManager({
  names, sheetNames, activeSheetIndex, onAdd, onRemove, onInsert, onClose,
}: {
  names: NamedRange[];
  sheetNames: string[];
  activeSheetIndex: number;
  onAdd: (nr: NamedRange) => void;
  onRemove: (name: string) => void;
  onInsert: (ref: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [range, setRange] = useState('A1:A10');
  const [sheetIndex, setSheetIndex] = useState(activeSheetIndex || 0);
  const [err, setErr] = useState<string | null>(null);
  const field = 'h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  function add() {
    const e = validateRangeName(name, names.map((n) => n.name));
    if (e) { setErr(e); return; }
    onAdd({ name: name.trim(), range: range.trim().toUpperCase(), sheetIndex });
    setName(''); setErr(null);
  }
  const copy = (ref: string) => { navigator.clipboard?.writeText(ref).catch(() => {}); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <Tag className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Administrador de nombres</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          {/* Lista */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
            {names.length === 0 && <p className="text-sm text-gray-400 p-4 text-center">Aún no hay rangos con nombre.</p>}
            {names.map((n) => {
              const ref = qualifiedRef(n, sheetNames);
              return (
                <div key={n.name} className="flex items-center gap-2 p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{n.name}</div>
                    <code className="text-[11px] text-gray-400 truncate">{ref}</code>
                  </div>
                  <button onClick={() => { onInsert(ref); }} title="Insertar referencia en la celda activa" className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"><CornerDownLeft className="w-4 h-4" /></button>
                  <button onClick={() => copy(ref)} title="Copiar referencia" className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"><ClipboardCopy className="w-4 h-4" /></button>
                  <button onClick={() => onRemove(n.name)} title="Eliminar" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>

          {/* Nuevo */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500">Nuevo nombre</p>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} placeholder="Ventas_2026" className={`${field} flex-1`} />
              <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:A10" className={`${field} w-32 font-mono`} />
            </div>
            <div className="flex gap-2 items-center">
              {sheetNames.length > 1 && (
                <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={`${field} flex-1`}>
                  {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
                </select>
              )}
              <button onClick={add} className="ml-auto h-9 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 inline-flex items-center gap-1.5"><Plus className="w-4 h-4" /> Añadir</button>
            </div>
            {err && <p className="text-[11px] text-red-500">{err}</p>}
          </div>
          <p className="text-[11px] text-gray-400">Los nombres se guardan con el documento. «Insertar» coloca la referencia A1 cualificada en la celda activa; también puedes copiarla para usarla en una fórmula.</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
