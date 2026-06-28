'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { SMART_KINDS, buildSmartArt, type SmartSpec, type SmartKind } from './slides/smartart';

/** Editor SmartArt: tipo de diagrama + lista de texto (una línea por elemento). */
export function SlideSmartArtEditor({ spec: initial, onApply, onClose }: {
  spec: SmartSpec; onApply: (spec: SmartSpec) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<SmartKind>(initial.kind);
  const [textValue, setTextValue] = useState(initial.items.join('\n'));
  const [preview, setPreview] = useState('');

  const items = textValue.split('\n').map((s) => s.trim()).filter(Boolean);

  useEffect(() => {
    let active = true;
    const id = setTimeout(async () => {
      try {
        const { StaticCanvas } = await import('fabric');
        const sc = new StaticCanvas(document.createElement('canvas'), { width: 820, height: 360 });
        const g = buildSmartArt({ kind, items: items.length ? items : ['Elemento'] }, { left: 0, top: 0 });
        sc.add(g); sc.renderAll();
        const url = sc.toDataURL({ format: 'png', multiplier: 1 } as any);
        sc.dispose();
        if (active) setPreview(url);
      } catch { /* noop */ }
    }, 180);
    return () => { active = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, textValue]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#161616] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="font-bold">SmartArt <span className="text-sm font-normal text-gray-400">· diagrama desde texto</span></h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {SMART_KINDS.map((k) => (
              <button key={k.value} onClick={() => setKind(k.value)} title={k.hint}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${kind === k.value ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}>
                {k.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-black/30 border border-black/5 dark:border-white/10 flex items-center justify-center p-2" style={{ minHeight: 180 }}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- SmartArt preview is a client-generated data URL from Fabric.
              <img src={preview} alt="Vista previa" className="max-h-[230px] w-auto" />
            ) : <span className="text-sm text-gray-400">Generando vista previa…</span>}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Elementos (uno por línea)</label>
            <textarea value={textValue} onChange={(e) => setTextValue(e.target.value)} rows={5}
              className="w-full resize-y rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-black/5 dark:border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={() => onApply({ kind, items: items.length ? items : ['Elemento'] })} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600">Insertar</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
