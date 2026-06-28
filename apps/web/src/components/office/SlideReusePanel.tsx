'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Plus, Layers } from 'lucide-react';
import { StaticCanvas } from 'fabric';
import { SLIDE_W, slideHeight } from './slideAssets';

export interface ReuseItem { slide: any; note: string; transition: string; transDur: number }

/** Miniatura real de una diapositiva (renderizada con Fabric a un PNG). */
function Thumb({ slide, ratio }: { slide: any; ratio?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const sc = new StaticCanvas(document.createElement('canvas'), { width: SLIDE_W, height: slideHeight(ratio) });
        await sc.loadFromJSON(slide);
        sc.backgroundColor = (slide?.background as string) || '#ffffff';
        sc.renderAll();
        const url = sc.toDataURL({ format: 'png', multiplier: 0.34 } as any);
        sc.dispose();
        if (active) setSrc(url);
      } catch { /* noop */ }
    })();
    return () => { active = false; };
  }, [slide, ratio]);
  return src
    ? (
      // eslint-disable-next-line @next/next/no-img-element -- Fabric renders slide thumbnails as data URLs; next/image optimization is not useful here.
      <img src={src} alt="" className="w-full h-full object-contain" />
    )
    : <div className="w-full h-full animate-pulse bg-black/5 dark:bg-white/5" />;
}

/**
 * Panel «Reutilizar diapositivas» (como PowerPoint): inserta una copia de una
 * diapositiva —de ESTA presentación o de OTRA importada (.json)— después de la
 * diapositiva actual, conservando el formato de origen. Todo client-side.
 */
export function SlideReusePanel({ current, ratio, onInsert, onClose }: {
  current: ReuseItem[];
  ratio?: string;
  onInsert: (item: ReuseItem) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'deck' | 'file'>('deck');
  const [fileItems, setFileItems] = useState<ReuseItem[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const aspect = ratio === '4:3' ? '4 / 3' : '16 / 9';

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const slides = data?.slides;
        if (!Array.isArray(slides) || !slides.length) throw new Error('sin diapositivas');
        const notes = Array.isArray(data.notes) ? data.notes : [];
        const trans = Array.isArray(data.transitions) ? data.transitions : [];
        const durs = Array.isArray(data.transDurs) ? data.transDurs : [];
        setFileItems(slides.map((s: any, i: number) => ({ slide: s, note: notes[i] || '', transition: trans[i] || 'fade', transDur: typeof durs[i] === 'number' ? durs[i] : 500 })));
        setFileName(f.name); setError(''); setTab('file');
      } catch { setError('No se pudo leer el archivo. Debe ser una presentación AXOS (.json).'); }
    };
    reader.readAsText(f);
  }

  const items = tab === 'deck' ? current : fileItems;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-amber-500" /> Reutilizar diapositivas</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <button onClick={() => setTab('deck')} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${tab === 'deck' ? 'bg-amber-500 text-white' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}>Esta presentación</button>
          <button onClick={() => setTab('file')} disabled={!fileItems.length} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${tab === 'file' ? 'bg-amber-500 text-white' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}>{fileName ? `Importada · ${fileName}`.slice(0, 28) : 'Otra presentación'}</button>
          <label className="ml-auto text-sm px-3 py-1.5 rounded-lg font-medium bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 cursor-pointer flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Importar .json
            <input type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
          </label>
        </div>
        {error && <p className="text-xs text-red-500 mb-3 flex-shrink-0">{error}</p>}
        <p className="text-xs text-gray-400 mb-3 flex-shrink-0">Inserta una copia después de la diapositiva actual (conserva el formato de origen).</p>
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {!items.length ? (
            <div className="text-center text-sm text-gray-400 py-16">{tab === 'file' ? 'Importa un archivo .json de presentación para ver sus diapositivas.' : 'No hay diapositivas.'}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-1">
              {items.map((it, i) => (
                <div key={i} className="group relative rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
                  <div className="relative bg-white" style={{ aspectRatio: aspect }}>
                    <Thumb slide={it.slide} ratio={ratio} />
                    <span className="absolute top-1.5 left-2 text-[10px] font-bold text-white bg-black/50 rounded px-1.5">{i + 1}</span>
                  </div>
                  <button onClick={() => onInsert(it)} title="Insertar copia"
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-all">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white bg-amber-500 px-3 py-1.5 rounded-lg shadow"><Plus className="w-4 h-4" /> Insertar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
