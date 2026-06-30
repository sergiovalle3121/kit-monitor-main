'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { BarChart3 } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';
import { analyzeText, readability } from './readability';

function analyze(editor: Editor) {
  const text = editor.getText() || '';
  const stats = analyzeText(text);
  let paragraphs = 0;
  editor.state.doc.descendants((n: any) => { if ((n.type?.name === 'paragraph' || n.type?.name === 'heading') && n.textContent.trim()) paragraphs += 1; });
  const wps = stats.sentences ? stats.words / stats.sentences : stats.words;
  const minutes = Math.max(1, Math.round(stats.words / 200));
  const read = readability(text, stats);
  return {
    wc: stats.words, charsWith: stats.charsWithSpaces, charsNo: stats.charsNoSpaces,
    sentences: stats.sentences, paragraphs, minutes, wps: Math.round(wps * 10) / 10,
    ease: stats.words ? read.ease : 0, easeLabel: read.easeLabel, scheme: read.scheme, grade: read.grade,
  };
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
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Estadísticas</div>
        <Row k="Palabras" v={s.wc} />
        <Row k="Caracteres (con espacios)" v={s.charsWith} />
        <Row k="Caracteres (sin espacios)" v={s.charsNo} />
        <Row k="Frases" v={s.sentences} />
        <Row k="Párrafos" v={s.paragraphs} />
        <div className="my-2 h-px bg-black/5 dark:bg-white/10" />
        <Row k="Tiempo de lectura" v={`${s.minutes} min`} />
        <Row k="Palabras por frase" v={s.wps} />
        <Row k="Facilidad de lectura" v={<span title={s.scheme === 'es' ? 'Fernández-Huerta' : 'Flesch Reading Ease'}>{s.ease} · {s.easeLabel}</span>} />
        {s.scheme === 'en' && s.grade !== undefined && (
          <Row k="Nivel escolar" v={<span title="Flesch-Kincaid Grade Level">{s.grade}</span>} />
        )}
      </div>
    </RibbonMenuButton>
  );
}
