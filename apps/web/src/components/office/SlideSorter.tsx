'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { StaticCanvas } from 'fabric';
import { motion } from 'framer-motion';
import { AlertTriangle, Search, Trash2, X } from 'lucide-react';
import {
  buildSlideNavigationItems,
  filterSlideNavigationItems,
  getSlideSectionOptions,
  summarizeSlideNavigation,
} from './slides/slideNavigation';

const CW = 960;

/** Slide-sorter overlay: thumbnail search, section filtering and drag reorder. */
export function SlideSorter({
  slides, sections, current, ratio, onReorder, onDelete, onOpen, onClose,
}: {
  slides: any[];
  sections?: (string | null)[];
  current: number;
  ratio?: string;
  onReorder: (from: number, to: number) => void;
  onDelete: (i: number) => void;
  onOpen: (i: number) => void;
  onClose: () => void;
}) {
  const CH = ratio === '4:3' ? 720 : 540;
  const aspect = ratio === '4:3' ? '4 / 3' : '16 / 9';
  const [imgs, setImgs] = useState<string[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const items = useMemo(() => buildSlideNavigationItems(slides, sections), [slides, sections]);
  const summary = useMemo(() => summarizeSlideNavigation(items), [items]);
  const sectionOptions = useMemo(() => getSlideSectionOptions(items), [items]);
  const visible = useMemo(() => filterSlideNavigationItems(items, query, section), [items, query, section]);

  useEffect(() => {
    let active = true;
    (async () => {
      const out: string[] = [];
      for (const json of slides) {
        try {
          const sc = new StaticCanvas(document.createElement('canvas'), { width: CW, height: CH });
          await sc.loadFromJSON(json);
          sc.backgroundColor = (json?.background as string) || '#ffffff';
          sc.renderAll();
          out.push(sc.toDataURL({ format: 'png', multiplier: 0.35 } as any));
          sc.dispose();
        } catch { out.push(''); }
      }
      if (active) setImgs(out);
    })();
    return () => { active = false; };
  }, [slides, CH]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-white dark:bg-[#0b0b0b] flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <h2 className="font-bold">Clasificador de diapositivas <span className="text-sm font-normal text-gray-500 dark:text-gray-400">- busca, filtra y reordena</span></h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-shrink-0 border-b border-black/5 dark:border-white/10 px-6 py-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Badge label="Slides" value={summary.slideCount} />
            <Badge label="Secciones" value={summary.sectionCount} />
            <Badge label="Objetos" value={summary.objectCount} />
            <Badge label="Sin titulo" value={summary.missingTitleCount} tone={summary.missingTitleCount ? 'amber' : 'green'} />
            {(query || section !== 'all') && <span className="font-semibold text-blue-500">{visible.length} resultado(s)</span>}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm dark:border-white/10 dark:bg-white/[0.05]">
              <Search className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar slides por titulo, contenido, seccion o numero..." className="min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            {sectionOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <FilterButton active={section === 'all'} onClick={() => setSection('all')}>Todo</FilterButton>
                {sectionOptions.map((name) => (
                  <FilterButton key={name} active={section === name} onClick={() => setSection(name)}>{name}</FilterButton>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {visible.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-black/10 p-10 text-center text-sm text-gray-500 dark:text-gray-400 dark:border-white/10">
              No hay diapositivas para este filtro.
            </div>
          )}
          {visible.map((item, position) => {
            const i = item.index;
            const showSection = !!item.section && (position === 0 || visible[position - 1]?.section !== item.section || item.sectionStart);
            return (
              <React.Fragment key={i}>
                {showSection && (
                  <div className="col-span-full mt-2 first:mt-0 flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                    <span className="uppercase tracking-wide">{item.section}</span>
                    <span className="flex-1 h-px bg-amber-200 dark:bg-amber-500/30" />
                  </div>
                )}
                <div
                  draggable
                  onDragStart={() => setDrag(i)}
                  onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  onDrop={(e) => { e.preventDefault(); if (drag !== null && drag !== i) onReorder(drag, i); setDrag(null); setOver(null); }}
                  className={`group relative rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing ${over === i && drag !== null ? 'border-amber-500 scale-[1.02]' : i === current ? 'border-amber-400' : 'border-gray-200 dark:border-white/10'} ${drag === i ? 'opacity-40' : ''}`}
                >
                  <button onClick={() => onOpen(i)} className="block w-full">
                    <div className="rounded-lg overflow-hidden bg-white" style={{ aspectRatio: aspect }}>
                      {imgs[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Fabric renders slide thumbnails as data URLs; next/image optimization is not useful here.
                        <img src={imgs[i]} alt={`Diapositiva ${i + 1}`} className="w-full h-full object-contain" />
                      ) : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">...</div>}
                    </div>
                  </button>
                  <span className="absolute top-1.5 left-2 text-xs font-bold text-gray-500 bg-white/80 dark:bg-black/50 rounded px-1.5">{i + 1}</span>
                  <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between gap-1">
                    <span className="min-w-0 truncate rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 shadow dark:bg-black/60 dark:text-gray-200">
                      {item.title || 'Sin titulo'}
                    </span>
                    {!item.hasTitle && <span title="Falta titulo de slide" className="flex-shrink-0 rounded bg-amber-500/90 p-1 text-white shadow"><AlertTriangle className="h-3 w-3" /></span>}
                  </div>
                  {slides.length > 1 && (
                    <button onClick={() => onDelete(i)} className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 dark:bg-black/60 text-gray-500 dark:text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow"><Trash2 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function Badge({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'green' }) {
  const cls = tone === 'amber'
    ? 'border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    : tone === 'green'
      ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      : 'border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.05]';
  return <span className={`rounded-lg border px-2 py-1 font-semibold ${cls}`}>{label}: {value}</span>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`h-8 max-w-[150px] truncate rounded-lg border px-2.5 text-xs font-semibold ${active ? 'border-blue-500 bg-blue-500 text-white' : 'border-black/10 text-gray-500 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'}`}>
      {children}
    </button>
  );
}
