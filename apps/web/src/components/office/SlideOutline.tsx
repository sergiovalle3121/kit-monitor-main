'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, FileText, Search, X } from 'lucide-react';
import {
  buildSlideOutlineEntries,
  filterSlideOutlineEntries,
  summarizeSlideOutline,
  type SlideOutlineEntry,
} from './slides/outline';

/** Vista de esquema: edita titulos, busca contenido y revisa estructura. */
export function SlideOutline({ slides, current, onTitle, onGoto, onClose }: {
  slides: any[];
  current: number;
  onTitle: (i: number, text: string) => void;
  onGoto: (i: number) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [query, setQuery] = useState('');
  const entries = useMemo(() => buildSlideOutlineEntries(slides), [slides]);
  const filtered = useMemo(() => filterSlideOutlineEntries(entries, query), [entries, query]);
  const stats = useMemo(() => summarizeSlideOutline(entries), [entries]);
  const val = (entry: SlideOutlineEntry) => (drafts[entry.index] !== undefined ? drafts[entry.index] : entry.title);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-white dark:bg-[#0b0b0b] flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <h2 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Esquema <span className="text-sm font-normal text-gray-400">- estructura del mazo</span></h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por titulo, texto, warning o numero de slide"
                className="h-11 w-full rounded-2xl border border-black/10 bg-black/[0.03] pl-9 pr-3 text-sm outline-none focus:border-blue-500/50 dark:border-white/10 dark:bg-white/[0.05]"
              />
            </label>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <Metric label="Slides" value={stats.totalSlides} />
              <Metric label="Sin titulo" value={stats.missingTitles} tone={stats.missingTitles ? 'amber' : 'green'} />
              <Metric label="Vacias" value={stats.emptySlides} tone={stats.emptySlides ? 'amber' : 'green'} />
              <Metric label="Densas" value={stats.denseSlides} tone={stats.denseSlides ? 'amber' : 'green'} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center text-sm text-gray-400 dark:border-white/10">
              No hay diapositivas que coincidan con la busqueda.
            </div>
          ) : filtered.map((entry) => (
            <div key={entry.index} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${entry.index === current ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-500/5' : 'border-black/10 dark:border-white/10'}`}>
              <button onClick={() => onGoto(entry.index)} title="Ir a la diapositiva" className="w-8 h-8 flex-shrink-0 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-bold text-gray-500 hover:bg-black/10">{entry.index + 1}</button>
              <div className="flex-1 min-w-0">
                <input
                  value={val(entry)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [entry.index]: e.target.value }))}
                  onBlur={(e) => { onTitle(entry.index, e.target.value); setDrafts((d) => { const n = { ...d }; delete n[entry.index]; return n; }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  placeholder={`Titulo de la diapositiva ${entry.index + 1}`}
                  className="w-full bg-transparent text-base font-semibold outline-none border-b border-transparent focus:border-blue-500/40 pb-1"
                />
                {entry.body && <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{entry.body}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                  <span>{entry.objectCount} objetos</span>
                  <span>-</span>
                  <span>{entry.textObjectCount} textos</span>
                  <span>-</span>
                  <span>{entry.characterCount} caracteres</span>
                  {entry.warnings.map((warning) => (
                    <span key={warning} className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> {warning}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'amber' }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone === 'amber' ? 'border-amber-300/60 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : tone === 'green' ? 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-black/10 dark:border-white/10'}`}>
      <div className="text-base font-bold leading-none">{value}</div>
      <div className="mt-1 whitespace-nowrap text-[10px] opacity-70">{label}</div>
    </div>
  );
}
