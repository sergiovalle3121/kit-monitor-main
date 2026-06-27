'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { StaticCanvas } from 'fabric';
import { motion } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';

const CW = 960;

/** Slide-sorter (classifier) overlay: drag thumbnails to reorder. */
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
        <h2 className="font-bold">Clasificador de diapositivas <span className="text-sm font-normal text-gray-400">· arrastra para reordenar</span></h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {slides.map((_, i) => {
            const sec = (sections?.[i] ?? '').trim();
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
                    <img src={imgs[i]} alt={`Diapositiva ${i + 1}`} className="w-full h-full object-contain" />
                  ) : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">…</div>}
                </div>
              </button>
              <span className="absolute top-1.5 left-2 text-xs font-bold text-gray-500 bg-white/80 dark:bg-black/50 rounded px-1.5">{i + 1}</span>
              {slides.length > 1 && (
                <button onClick={() => onDelete(i)} className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white/90 dark:bg-black/60 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow"><Trash2 className="w-3.5 h-3.5" /></button>
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
