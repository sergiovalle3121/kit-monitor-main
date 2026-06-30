'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search, ArrowRight, Replace as ReplaceIcon, CaseSensitive } from 'lucide-react';

/** Buscar y reemplazar texto en TODAS las diapositivas. */
export function SlideFindReplace({ onClose, onCount, onNext, onReplaceAll }: {
  onClose: () => void;
  onCount: (q: string, cs: boolean) => number;
  onNext: (q: string, cs: boolean) => void;
  onReplaceAll: (q: string, repl: string, cs: boolean) => number;
}) {
  const [query, setQuery] = useState('');
  const [repl, setRepl] = useState('');
  const [cs, setCs] = useState(false);
  const [info, setInfo] = useState('');

  const count = query ? onCount(query, cs) : 0;
  const field = 'w-full h-9 px-3 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none';

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="fixed top-24 right-6 z-[150] w-80 rounded-2xl bg-white dark:bg-[#161616] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 h-12 border-b border-black/5 dark:border-white/10">
        <span className="font-semibold text-sm flex items-center gap-2"><Search className="w-4 h-4" /> Buscar y reemplazar</span>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 space-y-2.5">
        <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setInfo(''); }} placeholder="Buscar…" className={field}
          onKeyDown={(e) => { if (e.key === 'Enter' && query) onNext(query, cs); }} />
        <input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Reemplazar con…" className={field} />
        <div className="flex items-center justify-between">
          <button onClick={() => setCs((v) => !v)} title="Distinguir mayúsculas"
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors ${cs ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>
            <CaseSensitive className="w-4 h-4" /> Aa
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">{query ? `${count} coincidencia${count === 1 ? '' : 's'}` : ''}{info && ` · ${info}`}</span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => query && onNext(query, cs)} disabled={!query || !count}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40">
            <ArrowRight className="w-4 h-4" /> Siguiente
          </button>
          <button onClick={() => { if (!query) return; const n = onReplaceAll(query, repl, cs); setInfo(`${n} reemplazo${n === 1 ? '' : 's'}`); }} disabled={!query || !count}
            className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40">
            <ReplaceIcon className="w-4 h-4" /> Todo
          </button>
        </div>
      </div>
    </motion.div>
  );
}
