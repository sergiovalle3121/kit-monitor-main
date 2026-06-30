'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { findMatches, buildFindRegex, type FindOpts } from '@/lib/office/sheetOps';

/** Buscar y reemplazar pro: alcance hoja/libro, mayúsculas, celda completa y regex. */
export function SheetFindReplace({
  sheets, sheetNames, activeSheetIndex, onReplaceAll, onClose,
}: {
  sheets: any[];
  sheetNames: string[];
  activeSheetIndex: number;
  onReplaceAll: (query: string, replacement: string, opts: FindOpts) => number;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeCell, setWholeCell] = useState(false);
  const [regex, setRegex] = useState(false);
  const [scope, setScope] = useState<'book' | 'sheet'>('book');
  const [done, setDone] = useState<string | null>(null);

  const opts: FindOpts = { caseSensitive, wholeCell, regex, sheetIndex: scope === 'sheet' ? activeSheetIndex : undefined };
  const invalid = regex && !!query && !buildFindRegex(query, { regex: true });
  const matches = useMemo(() => findMatches(sheets, query, opts), [sheets, query, caseSensitive, wholeCell, regex, scope, activeSheetIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  const field = 'h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none focus:ring-2 ring-emerald-500/40 w-44';
  const chk = 'flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none';

  return (
    <div className="absolute top-3 right-4 z-30 w-[24rem] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input autoFocus value={query} onChange={(e) => { setQuery(e.target.value); setDone(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} placeholder="Buscar" className={field} />
        <span className={`text-[11px] tabular-nums flex-1 text-center ${invalid ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{invalid ? 'regex ✗' : (query ? `${matches.length}` : '0')} {invalid ? '' : 'coinc.'}</span>
        <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-2">
        <input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Reemplazar con" className={field} />
        <button onClick={() => { const n = onReplaceAll(query, replacement, opts); setDone(`${n} reemplazo(s)`); }}
          disabled={!query || !matches.length || invalid}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black disabled:opacity-40">Reemplazar todo</button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-0.5">
        <label className={chk}><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Distinguir mayúsculas</label>
        <label className={chk}><input type="checkbox" checked={wholeCell} onChange={(e) => setWholeCell(e.target.checked)} /> Celda completa</label>
        <label className={chk}><input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} /> Expresión regular</label>
        <label className={chk}>
          Alcance:
          <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="ml-1 h-6 text-[11px] rounded-md bg-gray-100 dark:bg-white/10 px-1 outline-none">
            <option value="book">Libro</option><option value="sheet">Hoja actual</option>
          </select>
        </label>
      </div>
      {done && <p className="text-[11px] text-emerald-600">{done}</p>}
      {query && !invalid && matches.length > 0 && (
        <div className="max-h-28 overflow-y-auto text-[11px] text-gray-500 border-t border-black/5 dark:border-white/10 pt-1.5 space-y-0.5">
          {matches.slice(0, 30).map((m, i) => (
            <div key={i} className="font-mono">{(sheetNames[m.sheetIndex] || `Hoja ${m.sheetIndex + 1}`)}!{m.addr}</div>
          ))}
          {matches.length > 30 && <div className="text-gray-500 dark:text-gray-400">… y {matches.length - 30} más</div>}
        </div>
      )}
    </div>
  );
}
