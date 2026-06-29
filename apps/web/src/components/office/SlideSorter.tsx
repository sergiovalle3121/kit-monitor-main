'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { StaticCanvas } from 'fabric';
import { motion } from 'framer-motion';
import { Search, Trash2, X } from 'lucide-react';
import { groupSlidesBySection, sectionCount, sectionTitleAt } from './slides/sections';

const CW = 960;

function textOf(slide: any): string {
  return (slide?.objects || [])
    .map((o: any) => String(o?.text || o?.label || o?.chartSpec?.title || o?.smartObject?.title || ''))
    .filter(Boolean)
    .join(' ');
}

function titleOf(slide: any, fallback: string): string {
  return String(textOf(slide).split(/\s*\n\s*/)[0] || fallback).trim();
}

/** Slide-sorter overlay: search, filter by section, and drag thumbnails to reorder. */
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
  const [sectionFilter, setSectionFilter] = useState('all');

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

  const q = query.trim().toLowerCase();
  const groups = groupSlidesBySection(slides.length, sections || []);
  const unsectioned = groups.find((g) => !g.title)?.slides.length || 0;
  const visible = slides
    .map((slide, i) => {
      const section = sectionTitleAt(sections || [], i);
      const title = titleOf(slide, `Slide ${i + 1}`);
      const haystack = `${title} ${section || ''} ${textOf(slide)}`.toLowerCase();
      return { i, section, title, matches: !q || haystack.includes(q) };
    })
    .filter((item) => item.matches)
    .filter((item) => sectionFilter === 'all'
      || (sectionFilter === '__none__' ? !item.section : item.section === sectionFilter))
    .map((item, idx, arr) => ({ ...item, showHeader: idx === 0 || item.section !== arr[idx - 1]?.section }));
  const hiddenCount = slides.length - visible.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-white dark:bg-[#0b0b0b] flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <div className="min-w-0">
          <h2 className="font-bold">Slide sorter <span className="text-sm font-normal text-gray-400">- drag to reorder</span></h2>
          <p className="text-[11px] text-gray-500">{visible.length}/{slides.length} visible - {sectionCount(sections || [])} section(s)</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-shrink-0 border-b border-black/5 dark:border-white/10 px-5 py-3 space-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, slide text, or section"
              className="h-10 w-full rounded-xl border border-black/10 bg-black/[0.03] pl-9 pr-3 text-sm outline-none focus:border-amber-500/70 dark:border-white/10 dark:bg-white/[0.05]"
            />
          </label>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="rounded-lg border border-black/10 px-2 py-1 dark:border-white/10">{slides.length} slides</span>
            <span className="rounded-lg border border-black/10 px-2 py-1 dark:border-white/10">{hiddenCount} hidden</span>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 text-xs font-semibold">
          <button onClick={() => setSectionFilter('all')} className={`shrink-0 rounded-full px-3 py-1.5 ${sectionFilter === 'all' ? 'bg-amber-500 text-white' : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]'}`}>
            All ({slides.length})
          </button>
          {unsectioned > 0 && (
            <button onClick={() => setSectionFilter('__none__')} className={`shrink-0 rounded-full px-3 py-1.5 ${sectionFilter === '__none__' ? 'bg-amber-500 text-white' : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]'}`}>
              No section ({unsectioned})
            </button>
          )}
          {groups.filter((g) => g.title).map((g) => (
            <button key={g.start} onClick={() => setSectionFilter(g.title || 'all')} className={`shrink-0 rounded-full px-3 py-1.5 ${sectionFilter === g.title ? 'bg-amber-500 text-white' : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]'}`}>
              {g.title} ({g.slides.length})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {visible.length === 0 ? (
          <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-black/10 text-center text-sm text-gray-400 dark:border-white/10">
            No slides match this sorter filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {visible.map(({ i, section, title, showHeader }) => {
              const sec = showHeader ? section : null;
              return (
                <React.Fragment key={i}>
                  {sec && (
                    <div className="col-span-full mt-2 first:mt-0 flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
                      <span className="uppercase tracking-wide">{sec}</span>
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
                          <img src={imgs[i]} alt={`Slide ${i + 1}`} className="w-full h-full object-contain" />
                        ) : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">...</div>}
                      </div>
                    </button>
                    <span className="absolute top-1.5 left-2 text-xs font-bold text-gray-500 bg-white/80 dark:bg-black/50 rounded px-1.5">{i + 1}</span>
                    <span className="absolute bottom-1.5 left-2 right-2 truncate rounded bg-white/90 px-1.5 py-1 text-[10px] font-semibold text-gray-600 shadow-sm dark:bg-black/65 dark:text-gray-200">{title}</span>
                    {slides.length > 1 && (
                      <button onClick={() => onDelete(i)} className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 dark:bg-black/60 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
