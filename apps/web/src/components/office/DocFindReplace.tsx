'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { X, ChevronUp, ChevronDown, CaseSensitive, WholeWord, Regex } from 'lucide-react';

interface Match { from: number; to: number }
interface Opts { caseSensitive: boolean; wholeWord: boolean; regex: boolean }

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Compila el patrón de búsqueda según las opciones (devuelve null si es inválido). */
function buildRegex(query: string, opts: Opts, global: boolean): RegExp | null {
  if (!query) return null;
  let pattern = opts.regex ? query : escapeRe(query);
  if (opts.wholeWord) pattern = `(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(pattern, `${global ? 'g' : ''}${opts.caseSensitive ? '' : 'i'}u`);
  } catch {
    return null;
  }
}

function findMatches(editor: Editor, query: string, opts: Opts): Match[] {
  const matches: Match[] = [];
  const re = buildRegex(query, opts, true);
  if (!re) return matches;
  editor.state.doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text)) !== null) {
      if (m[0] === '') { re.lastIndex += 1; continue; }
      matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
    }
  });
  return matches;
}

/** Buscar y reemplazar avanzado: regex, palabra completa, mayúsculas, resaltado. */
export function DocFindReplace({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [opts, setOpts] = useState<Opts>({ caseSensitive: false, wholeWord: false, regex: false });
  const [active, setActive] = useState(0);
  const [tick, setTick] = useState(0);

  // `tick` fuerza el recálculo tras un reemplazo (el doc cambió pero `editor` es estable).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const matches = useMemo(() => findMatches(editor, query, opts), [editor, query, opts, tick]);
  const invalid = useMemo(() => !!query && opts.regex && buildRegex(query, opts, true) === null, [query, opts]);
  // `active` se mantiene en rango de forma derivada (sin setState en efecto).
  const activeIdx = matches.length ? Math.min(active, matches.length - 1) : 0;

  // Empuja el resaltado de todas las coincidencias al plugin de decoraciones.
  useEffect(() => {
    (editor.commands as any).setSearchMatches(matches, activeIdx);
  }, [editor, matches, activeIdx]);
  // Limpia el resaltado al cerrar.
  useEffect(() => () => { (editor.commands as any).clearSearchMatches(); }, [editor]);

  function goTo(i: number) {
    if (!matches.length) return;
    const idx = ((i % matches.length) + matches.length) % matches.length;
    setActive(idx);
    const m = matches[idx];
    editor.chain().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  }

  /** Texto de reemplazo, expandiendo retro-referencias ($1, $&) en modo regex. */
  function replacedText(m: Match): string {
    if (!opts.regex) return replacement;
    const single = buildRegex(query, opts, false);
    if (!single) return replacement;
    const slice = editor.state.doc.textBetween(m.from, m.to);
    return slice.replace(single, replacement);
  }

  function replaceOne() {
    if (!matches.length) return;
    const m = matches[activeIdx] ?? matches[0];
    editor.chain().focus().insertContentAt({ from: m.from, to: m.to }, replacedText(m)).run();
    setTick((t) => t + 1);
  }

  function replaceAll() {
    if (!matches.length) return;
    let chain = editor.chain().focus();
    for (const m of [...matches].reverse()) chain = chain.insertContentAt({ from: m.from, to: m.to }, replacedText(m));
    chain.run();
    setTick((t) => t + 1);
  }

  const field = 'h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none focus:ring-2 ring-blue-500/40 w-44';
  const toggle = (on: boolean) => `p-1.5 rounded-lg transition-colors ${on ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500'}`;

  return (
    <div className="absolute top-3 right-4 z-30 w-[22rem] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') goTo(activeIdx + (e.shiftKey ? -1 : 1)); if (e.key === 'Escape') onClose(); }}
          placeholder="Buscar" className={`${field} ${invalid ? 'ring-2 ring-red-500/60' : ''}`} />
        <span className="text-[11px] text-gray-400 tabular-nums w-12 text-center">{invalid ? '!' : matches.length ? `${activeIdx + 1}/${matches.length}` : '0/0'}</span>
        <button onClick={() => goTo(activeIdx - 1)} title="Anterior" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><ChevronUp className="w-4 h-4" /></button>
        <button onClick={() => goTo(activeIdx + 1)} title="Siguiente" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><ChevronDown className="w-4 h-4" /></button>
        <button onClick={onClose} title="Cerrar" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex items-center gap-2">
        <input value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Reemplazar con" className={field} />
        <button onClick={replaceOne} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Uno</button>
        <button onClick={replaceAll} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black">Todo</button>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setOpts((o) => ({ ...o, caseSensitive: !o.caseSensitive }))} className={toggle(opts.caseSensitive)} title="Distinguir mayúsculas/minúsculas"><CaseSensitive className="w-4 h-4" /></button>
        <button onClick={() => setOpts((o) => ({ ...o, wholeWord: !o.wholeWord }))} className={toggle(opts.wholeWord)} title="Palabra completa"><WholeWord className="w-4 h-4" /></button>
        <button onClick={() => setOpts((o) => ({ ...o, regex: !o.regex }))} className={toggle(opts.regex)} title="Expresión regular"><Regex className="w-4 h-4" /></button>
        {invalid && <span className="text-[11px] text-red-500 ml-1">Regex inválida</span>}
      </div>
    </div>
  );
}
