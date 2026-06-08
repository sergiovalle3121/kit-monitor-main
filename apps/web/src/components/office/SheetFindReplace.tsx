'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { findMatches } from '@/lib/office/sheetOps';

/** Buscar y reemplazar en toda la hoja de cálculo. */
export function SheetFindReplace({
  sheets, sheetNames, onReplaceAll, onClose,
}: {
  sheets: any[];
  sheetNames: string[];
  onReplaceAll: (query: string, replacement: string, caseSensitive: boolean) => number;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const matches = useMemo(() => findMatches(sheets, query, caseSensitive), [sheets, query, caseSensitive]);
  const field = 'h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none focus:ring-2 ring-emerald-500/40 w-44';

  return (
    <div className="absolute top-3 right-4 z-30 w-[22rem] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setDone(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} placeholder="Buscar en la hoja" className={field} />
        <span className="text-[11px] text-gray-400 tabular-nums flex-1 text-center">{query ? `${matches.length}` : '0'} coinc.</span>
        <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-2">
        <input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Reemplazar con" className={field} />
        <button onClick={() => { const n = onReplaceAll(query, replacement, caseSensitive); setDone(`${n} reemplazo(s)`); }}
          disabled={!query || !matches.length}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:opacity-40">Reemplazar todo</button>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
        <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Distinguir mayúsculas
      </label>
      {done && <p className="text-[11px] text-emerald-600">{done}</p>}
      {query && matches.length > 0 && (
        <div className="max-h-28 overflow-y-auto text-[11px] text-gray-500 border-t border-black/5 dark:border-white/10 pt-1.5 space-y-0.5">
          {matches.slice(0, 30).map((m, i) => (
            <div key={i} className="font-mono">{(sheetNames[m.sheetIndex] || `Hoja ${m.sheetIndex + 1}`)}!{m.addr}</div>
          ))}
          {matches.length > 30 && <div className="text-gray-400">… y {matches.length - 30} más</div>}
        </div>
      )}
    </div>
  );
}
