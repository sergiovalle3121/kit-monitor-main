'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

interface Match { from: number; to: number }

function findMatches(editor: Editor, query: string, caseSensitive: boolean): Match[] {
  const matches: Match[] = [];
  if (!query) return matches;
  const needle = caseSensitive ? query : query.toLowerCase();
  editor.state.doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    const hay = caseSensitive ? node.text : node.text.toLowerCase();
    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      matches.push({ from: pos + i, to: pos + i + query.length });
      i += query.length;
    }
  });
  return matches;
}

/** Find & replace panel for the document editor. */
export function DocFindReplace({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);

  // Recompute on query/case/edit. `tick` is bumped after each replace.
  const matches = useMemo(() => findMatches(editor, query, caseSensitive), [editor, query, caseSensitive, tick]);

  useEffect(() => { setActive(0); }, [query, caseSensitive]);

  function goTo(i: number) {
    if (!matches.length) return;
    const idx = ((i % matches.length) + matches.length) % matches.length;
    setActive(idx);
    const m = matches[idx];
    editor.chain().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  }

  function replaceOne() {
    if (!matches.length) return;
    const m = matches[active] ?? matches[0];
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replacement).run();
    setTick((t) => t + 1);
  }

  function replaceAll() {
    if (!matches.length) return;
    let chain = editor.chain().focus();
    // Apply from the end so earlier positions stay valid.
    for (const m of [...matches].reverse()) chain = chain.insertContentAt({ from: m.from, to: m.to }, replacement);
    chain.run();
    setTick((t) => t + 1);
  }

  const field = 'h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none focus:ring-2 ring-blue-500/40 w-44';

  return (
    <div className="absolute top-3 right-4 z-30 w-[20rem] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') goTo(active + 1); if (e.key === 'Escape') onClose(); }}
          placeholder="Buscar" className={field} />
        <span className="text-[11px] text-gray-400 tabular-nums w-12 text-center">{matches.length ? `${active + 1}/${matches.length}` : '0/0'}</span>
        <button onClick={() => goTo(active - 1)} title="Anterior" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><ChevronUp className="w-4 h-4" /></button>
        <button onClick={() => goTo(active + 1)} title="Siguiente" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><ChevronDown className="w-4 h-4" /></button>
        <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-2">
        <input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Reemplazar con" className={field} />
        <button onClick={replaceOne} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Uno</button>
        <button onClick={replaceAll} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black">Todo</button>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
        <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Distinguir mayúsculas
      </label>
    </div>
  );
}
