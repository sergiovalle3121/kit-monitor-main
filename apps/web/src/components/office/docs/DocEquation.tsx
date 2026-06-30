'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import katex from 'katex';
import { Sigma, X, FunctionSquare } from 'lucide-react';
import { RibbonButton, RibbonMenuButton } from '../ribbon';

/** Plantillas / símbolos LaTeX por categoría para el editor de ecuaciones. */
const PALETTE: { label: string; items: { tex: string; ins: string }[] }[] = [
  { label: 'Estructuras', items: [
    { tex: '\\frac{a}{b}', ins: '\\frac{}{}' }, { tex: '\\sqrt{x}', ins: '\\sqrt{}' },
    { tex: '\\sqrt[n]{x}', ins: '\\sqrt[]{}' }, { tex: 'x^{n}', ins: '^{}' },
    { tex: 'x_{i}', ins: '_{}' }, { tex: '\\sum', ins: '\\sum_{}^{}' },
    { tex: '\\int', ins: '\\int_{}^{}' }, { tex: '\\lim', ins: '\\lim_{x \\to 0}' },
    { tex: '\\binom{n}{k}', ins: '\\binom{}{}' }, { tex: '\\vec{x}', ins: '\\vec{}' },
  ] },
  { label: 'Griegas', items: '\\alpha \\beta \\gamma \\delta \\epsilon \\theta \\lambda \\mu \\pi \\sigma \\phi \\omega \\Gamma \\Delta \\Theta \\Sigma \\Phi \\Omega'.split(' ').map((t) => ({ tex: t, ins: t + ' ' })) },
  { label: 'Operadores', items: '\\times \\div \\pm \\mp \\cdot \\ast \\circ \\oplus \\otimes \\nabla \\partial \\infty'.split(' ').map((t) => ({ tex: t, ins: t + ' ' })) },
  { label: 'Relaciones', items: '\\leq \\geq \\neq \\approx \\equiv \\sim \\propto \\in \\notin \\subset \\supseteq \\forall \\exists'.split(' ').map((t) => ({ tex: t, ins: t + ' ' })) },
  { label: 'Flechas', items: '\\to \\gets \\Rightarrow \\Leftarrow \\Leftrightarrow \\mapsto \\uparrow \\downarrow'.split(' ').map((t) => ({ tex: t, ins: t + ' ' })) },
];

function Preview({ latex, display }: { latex: string; display: boolean }) {
  const html = useMemo(() => {
    try { return katex.renderToString(latex || '\\,', { throwOnError: true, displayMode: display }); }
    catch (e: any) { return `<span style="color:#ef4444;font-size:13px">${(e?.message || 'LaTeX inválido').replace(/</g, '&lt;')}</span>`; }
  }, [latex, display]);
  return <div className="min-h-[60px] flex items-center justify-center p-4 rounded-xl bg-gray-50 dark:bg-white/5 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Botones de ribbon + diálogo para insertar / editar ecuaciones (KaTeX). */
export function DocEquation({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState(true);
  const [latex, setLatex] = useState('');
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const selectedMath = () => {
    const node = (editor.state.selection as any).node;
    return node && (node.type.name === 'mathInline' || node.type.name === 'mathBlock') ? node : null;
  };

  // Abrir en modo edición cuando se hace doble clic en una ecuación.
  useEffect(() => {
    const onEdit = () => {
      const node = selectedMath();
      if (!node) return;
      setDisplay(node.type.name === 'mathBlock');
      setLatex(node.attrs.latex || '');
      setEditing(true);
      setOpen(true);
    };
    window.addEventListener('doc-math-edit', onEdit as any);
    return () => window.removeEventListener('doc-math-edit', onEdit as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const start = (asBlock: boolean) => { setEditing(false); setDisplay(asBlock); setLatex(''); setOpen(true); };

  const insertSnippet = (snippet: string) => {
    const el = ref.current;
    if (!el) { setLatex((l) => l + snippet); return; }
    const s = el.selectionStart ?? latex.length;
    const e = el.selectionEnd ?? latex.length;
    const next = latex.slice(0, s) + snippet + latex.slice(e);
    setLatex(next);
    requestAnimationFrame(() => {
      el.focus();
      const caret = s + (snippet.indexOf('{}') >= 0 ? snippet.indexOf('{}') + 1 : snippet.length);
      el.setSelectionRange(caret, caret);
    });
  };

  const commit = () => {
    const tex = latex.trim();
    if (editing) {
      (editor.chain().focus() as any).updateSelectedMath(tex).run();
    } else if (display) {
      (editor.chain().focus() as any).insertMathBlock(tex).run();
    } else {
      (editor.chain().focus() as any).insertMathInline(tex).run();
    }
    setOpen(false);
  };

  const dialog = open && createPortal(
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex items-center justify-center p-4" onMouseDown={() => setOpen(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <motion.div initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
          onMouseDown={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-[#1b1b1d] border border-black/10 dark:border-white/10 shadow-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Sigma className="w-5 h-5 text-blue-500" /> {editing ? 'Editar ecuación' : 'Insertar ecuación'}</h3>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
          </div>

          {!editing && (
            <div className="flex gap-1 mb-3 text-xs">
              <button onClick={() => setDisplay(true)} className={`px-3 py-1.5 rounded-lg font-semibold ${display ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-black/5 dark:bg-white/10'}`}>En bloque</button>
              <button onClick={() => setDisplay(false)} className={`px-3 py-1.5 rounded-lg font-semibold ${!display ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-black/5 dark:bg-white/10'}`}>En línea</button>
            </div>
          )}

          <Preview latex={latex} display={display} />

          <textarea ref={ref} value={latex} onChange={(e) => setLatex(e.target.value)} autoFocus rows={3} spellCheck={false}
            placeholder="Escribe LaTeX, p. ej. \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
            className="mt-3 w-full font-mono text-sm rounded-xl bg-gray-100 dark:bg-white/10 p-3 outline-none focus:ring-2 ring-blue-500/40 resize-y" />

          <div className="mt-3 max-h-44 overflow-y-auto space-y-2">
            {PALETTE.map((cat) => (
              <div key={cat.label}>
                <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{cat.label}</div>
                <div className="flex flex-wrap gap-1">
                  {cat.items.map((it, i) => (
                    <button key={i} title={it.ins} onMouseDown={(e) => e.preventDefault()} onClick={() => insertSnippet(it.ins)}
                      className="h-8 min-w-8 px-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: (() => { try { return katex.renderToString(it.tex, { throwOnError: false }); } catch { return it.tex; } })() }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
            <button onClick={commit} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">{editing ? 'Actualizar' : 'Insertar'}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      <RibbonMenuButton icon={Sigma} label="Ecuación" menuWidth={210} items={[
        { label: 'Ecuación en bloque', icon: Sigma, onClick: () => start(true) },
        { label: 'Ecuación en línea', icon: FunctionSquare, onClick: () => start(false) },
      ]} />
      {selectedMath() && <RibbonButton icon={FunctionSquare} label="Editar ecuación" hideLabel={false} onClick={() => window.dispatchEvent(new CustomEvent('doc-math-edit'))} />}
      {dialog}
    </>
  );
}
