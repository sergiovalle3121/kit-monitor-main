'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, FileText, Search, X } from 'lucide-react';
import {
  buildSlideNavigationItems,
  filterSlideNavigationItems,
  getSlideSectionOptions,
  summarizeSlideNavigation,
} from './slides/slideNavigation';

/** Vista de esquema: edita el titulo de cada diapositiva y navega. */
export function SlideOutline({ slides, current, onTitle, onGoto, onClose }: {
  slides: any[];
  current: number;
  onTitle: (i: number, text: string) => void;
  onGoto: (i: number) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const items = useMemo(() => buildSlideNavigationItems(slides), [slides]);
  const summary = useMemo(() => summarizeSlideNavigation(items), [items]);
  const sectionOptions = useMemo(() => getSlideSectionOptions(items), [items]);
  const visible = useMemo(() => filterSlideNavigationItems(items, query, section), [items, query, section]);
  const val = (i: number) => (drafts[i] !== undefined ? drafts[i] : items[i]?.title ?? '');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-white dark:bg-[#0b0b0b] flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
        <h2 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5" /> Esquema <span className="text-sm font-normal text-gray-500 dark:text-gray-400">- edita los titulos</span></h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-shrink-0 border-b border-black/5 dark:border-white/10 px-6 py-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Badge label="Slides" value={summary.slideCount} />
            <Badge label="Secciones" value={summary.sectionCount} />
            <Badge label="Con texto" value={summary.textSlideCount} />
            <Badge label="Sin titulo" value={summary.missingTitleCount} tone={summary.missingTitleCount ? 'amber' : 'green'} />
            {(query || section !== 'all') && <span className="font-semibold text-blue-500">{visible.length} resultado(s)</span>}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm dark:border-white/10 dark:bg-white/[0.05]">
              <Search className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por titulo, contenido o numero..." className="min-w-0 flex-1 bg-transparent outline-none" />
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
        <div className="max-w-3xl mx-auto space-y-2">
          {visible.length === 0 && (
            <div className="rounded-2xl border border-dashed border-black/10 p-10 text-center text-sm text-gray-500 dark:text-gray-400 dark:border-white/10">
              No hay diapositivas para este filtro.
            </div>
          )}
          {visible.map((item) => (
            <div key={item.index} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${item.index === current ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-500/5' : 'border-black/10 dark:border-white/10'}`}>
              <button onClick={() => onGoto(item.index)} title="Ir a la diapositiva" className="w-7 h-7 flex-shrink-0 rounded-lg bg-black/5 dark:bg-white/10 text-xs font-bold text-gray-500 hover:bg-black/10">{item.index + 1}</button>
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {item.section && <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{item.section}</span>}
                  {!item.hasTitle && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3 w-3" /> Sin titulo</span>}
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{item.objectCount} objeto(s)</span>
                </div>
                <input
                  value={val(item.index)}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.index]: e.target.value }))}
                  onBlur={(e) => { onTitle(item.index, e.target.value); setDrafts((d) => { const next = { ...d }; delete next[item.index]; return next; }); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  placeholder={`Titulo de la diapositiva ${item.index + 1}`}
                  className="w-full bg-transparent text-base font-semibold outline-none border-b border-transparent focus:border-blue-500/40 pb-1"
                />
                {item.body && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.body}</p>}
              </div>
            </div>
          ))}
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
