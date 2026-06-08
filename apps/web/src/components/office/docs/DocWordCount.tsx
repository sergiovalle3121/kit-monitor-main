'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { BarChart3 } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

function syllablesEs(word: string): number {
  const groups = word.toLowerCase().match(/[aeiouáéíóúüy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function analyze(editor: Editor) {
  const text = editor.getText() || '';
  const words = (text.match(/[\p{L}\p{N}'’-]+/gu) || []);
  const wc = words.length;
  const charsWith = text.replace(/\n/g, '').length;
  const charsNo = text.replace(/\s/g, '').length;
  const sentences = (text.match(/[^.!?…]+[.!?…]+/g) || []).filter((s) => s.trim().length > 1).length || (wc ? 1 : 0);
  let paragraphs = 0;
  editor.state.doc.descendants((n: any) => { if ((n.type?.name === 'paragraph' || n.type?.name === 'heading') && n.textContent.trim()) paragraphs += 1; });
  const syl = words.reduce((a, w) => a + syllablesEs(w), 0);
  const wps = sentences ? wc / sentences : wc;
  const spw = wc ? syl / wc : 0;
  // Fernández-Huerta (legibilidad en español): 206.84 − 60·(síl/palabra) − 1.02·(palabras/frase)
  const ease = wc ? Math.max(0, Math.min(100, Math.round(206.84 - 60 * spw - 1.02 * wps))) : 0;
  const easeLabel = ease >= 80 ? 'Muy fácil' : ease >= 65 ? 'Fácil' : ease >= 50 ? 'Normal' : ease >= 30 ? 'Difícil' : 'Muy difícil';
  const minutes = Math.max(1, Math.round(wc / 200));
  return { wc, charsWith, charsNo, sentences, paragraphs, ease, easeLabel, minutes, wps: Math.round(wps * 10) / 10 };
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between py-1 text-sm"><span className="text-gray-500 dark:text-gray-400">{k}</span><span className="font-semibold tabular-nums">{v}</span></div>;
}

/** Panel de «Revisar»: recuento de palabras y legibilidad. */
export function DocWordCount({ editor }: { editor: Editor }) {
  const s = analyze(editor);
  return (
    <RibbonMenuButton icon={BarChart3} label="Recuento" menuWidth={260}>
      <div className="px-1.5 py-1" onClick={(e) => e.stopPropagation()}>
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">Estadísticas</div>
        <Row k="Palabras" v={s.wc} />
        <Row k="Caracteres (con espacios)" v={s.charsWith} />
        <Row k="Caracteres (sin espacios)" v={s.charsNo} />
        <Row k="Frases" v={s.sentences} />
        <Row k="Párrafos" v={s.paragraphs} />
        <div className="my-2 h-px bg-black/5 dark:bg-white/10" />
        <Row k="Tiempo de lectura" v={`${s.minutes} min`} />
        <Row k="Palabras por frase" v={s.wps} />
        <Row k="Legibilidad" v={<span title="Fernández-Huerta">{s.ease} · {s.easeLabel}</span>} />
      </div>
    </RibbonMenuButton>
  );
}
