'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Layers, Plus, Search, StickyNote, Upload, X } from 'lucide-react';
import { StaticCanvas } from 'fabric';
import { SLIDE_W, slideHeight } from './slideAssets';
import {
  buildSlideReuseItems,
  filterSlideReuseItems,
  summarizeSlideReuseItems,
  type SlideReuseFilter,
} from './slides/slideReuse';

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
 * Panel "Reutilizar diapositivas" (como PowerPoint): inserta una copia de una
 * diapositiva de esta presentacion o de otra importada (.json) despues de la
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SlideReuseFilter>('all');
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
      } catch { setError('No se pudo leer el archivo. Debe ser una presentacion AXOS (.json).'); }
    };
    reader.readAsText(f);
  }

  const items = tab === 'deck' ? current : fileItems;
  const reuseItems = useMemo(() => buildSlideReuseItems(items), [items]);
  const summary = useMemo(() => summarizeSlideReuseItems(reuseItems), [reuseItems]);
  const filtered = useMemo(() => filterSlideReuseItems(reuseItems, query, filter), [reuseItems, query, filter]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-amber-500" /> Reutilizar diapositivas</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          <button onClick={() => setTab('deck')} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${tab === 'deck' ? 'bg-amber-500 text-white' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}>Esta presentacion</button>
          <button onClick={() => setTab('file')} disabled={!fileItems.length} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${tab === 'file' ? 'bg-amber-500 text-white' : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20'}`}>{fileName ? `Importada - ${fileName}`.slice(0, 28) : 'Otra presentacion'}</button>
          <label className="ml-auto text-sm px-3 py-1.5 rounded-lg font-medium bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 cursor-pointer flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Importar .json
            <input type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
          </label>
        </div>
        {error && <p className="text-xs text-red-500 mb-3 flex-shrink-0">{error}</p>}
        <div className="mb-3 flex-shrink-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Badge label="Slides" value={summary.slideCount} />
            <Badge label="Con notas" value={summary.withNotes} tone={summary.withNotes ? 'blue' : undefined} />
            <Badge label="Sin titulo" value={summary.missingTitles} tone={summary.missingTitles ? 'amber' : 'green'} />
            <Badge label="Transiciones" value={summary.withTransitions} />
            {(query || filter !== 'all') && <span className="font-semibold text-blue-500">{filtered.length} resultado(s)</span>}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm dark:border-white/10 dark:bg-white/[0.05]">
              <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por titulo, contenido, notas o transicion..." className="min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>Todo</FilterButton>
              <FilterButton active={filter === 'withNotes'} onClick={() => setFilter('withNotes')}>Con notas</FilterButton>
              <FilterButton active={filter === 'missingTitle'} onClick={() => setFilter('missingTitle')}>Sin titulo</FilterButton>
              <FilterButton active={filter === 'withTransition'} onClick={() => setFilter('withTransition')}>Transicion</FilterButton>
            </div>
          </div>
          <p className="text-xs text-gray-400">Inserta una copia despues de la diapositiva actual. Se conservan formato, notas y transicion del origen.</p>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          {!items.length ? (
            <div className="text-center text-sm text-gray-400 py-16">{tab === 'file' ? 'Importa un archivo .json de presentacion para ver sus diapositivas.' : 'No hay diapositivas.'}</div>
          ) : !filtered.length ? (
            <div className="text-center text-sm text-gray-400 py-16">No hay diapositivas para este filtro.</div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pb-1">
              {filtered.map((meta) => (
                <div key={meta.index} className="group relative rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-black/20">
                  <div className="relative bg-white" style={{ aspectRatio: aspect }}>
                    <Thumb slide={meta.item.slide} ratio={ratio} />
                    <span className="absolute top-1.5 left-2 text-[10px] font-bold text-white bg-black/50 rounded px-1.5">{meta.index + 1}</span>
                    {!meta.hasTitle && <span title="Falta titulo de slide" className="absolute top-1.5 right-2 rounded bg-amber-500/90 p-1 text-white shadow"><AlertTriangle className="h-3 w-3" /></span>}
                  </div>
                  <div className="min-h-[74px] border-t border-black/5 dark:border-white/10 px-2.5 py-2">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{meta.title || 'Sin titulo'}</p>
                      {meta.hasNotes && <StickyNote className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">{meta.body || (meta.hasNotes ? meta.item.note : 'Sin contenido de texto.')}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span>{meta.objectCount} obj.</span>
                      {meta.hasTransition && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300">{meta.item.transition}</span>}
                    </div>
                  </div>
                  <button onClick={() => onInsert(meta.item)} title="Insertar copia"
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

function Badge({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'green' | 'blue' }) {
  const cls = tone === 'amber'
    ? 'border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : tone === 'green'
      ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : tone === 'blue'
        ? 'border-blue-300/60 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
        : 'border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.05]';
  return <span className={`rounded-lg border px-2 py-1 font-semibold ${cls}`}>{label}: {value}</span>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`h-8 rounded-lg border px-2.5 text-xs font-semibold ${active ? 'border-amber-500 bg-amber-500 text-white' : 'border-black/10 text-gray-500 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'}`}>
      {children}
    </button>
  );
}
