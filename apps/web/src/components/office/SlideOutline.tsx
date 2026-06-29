'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';

function bodyOf(json: any): string {
  const texts = (json?.objects ?? []).filter((o: any) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  return texts.slice(1).map((t: any) => String(t.text ?? '').replace(/\n/g, ' ')).filter(Boolean).join('  ·  ');
}
function titleOf(json: any): string {
  const t = (json?.objects ?? []).find((o: any) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  return String(t?.text ?? '').split('\n')[0];
}

/** Vista de esquema: edita el título de cada diapositiva y navega. */
export function SlideOutline({ slides, current, onTitle, onGoto, onClose }: {
  slides: any[];
  current: number;
  onTitle: (i: number, text: string) => void;
  onGoto: (i: number) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const val = (i: number) => (drafts[i] !== undefined ? drafts[i] : titleOf(slides[i]));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-white dark:bg-[#0b0b0b] flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <h2 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Esquema <span className="text-sm font-normal text-gray-400">· edita los títulos</span></h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-2">
          {slides.map((s, i) => (
            <div key={i} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${i === current ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-500/5' : 'border-black/10 dark:border-white/10'}`}>
              <button onClick={() => onGoto(i)} title="Ir a la diapositiva" className="w-7 h-7 flex-shrink-0 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-bold text-gray-500 hover:bg-black/10">{i + 1}</button>
              <div className="flex-1 min-w-0">
                <input
                  value={val(i)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                  onBlur={(e) => { onTitle(i, e.target.value); setDrafts((d) => { const n = { ...d }; delete n[i]; return n; }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  placeholder={`Título de la diapositiva ${i + 1}`}
                  className="w-full bg-transparent text-base font-semibold outline-none border-b border-transparent focus:border-blue-500/40 pb-1"
                />
                {bodyOf(s) && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{bodyOf(s)}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
