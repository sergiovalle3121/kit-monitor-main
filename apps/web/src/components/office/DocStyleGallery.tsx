'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { Type, Wand2, RotateCcw } from 'lucide-react';
import { RibbonMenuButton } from './ribbon';
import type { StyleProps } from './docs/docStyles';

const KEY_LABELS: Record<string, string> = {
  normal: 'Normal', title: 'Título', subtitle: 'Subtítulo', nospacing: 'Sin espaciado',
  reference: 'Referencia', caption: 'Leyenda', h1: 'Encabezado 1', h2: 'Encabezado 2',
  h3: 'Encabezado 3', h4: 'Encabezado 4', h5: 'Encabezado 5', h6: 'Encabezado 6',
};

/** Galería visual de estilos con nombre (tarjetas), estilo Word. */
export function DocStyleGallery({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();

  // Clave del estilo activo (para redefinir/restablecer): encabezado, estilo con
  // nombre o «normal». Los estilos de encabezado son los que alimentan la TOC.
  const headingLevel = ([1, 2, 3, 4, 5, 6] as const).find((l) => editor.isActive('heading', { level: l }));
  const curKey = headingLevel
    ? (editor.getAttributes('heading').styleName === 'title' ? 'title' : `h${headingLevel}`)
    : (editor.getAttributes('paragraph').styleName || 'normal');
  const curKeyLabel = KEY_LABELS[curKey] || curKey;
  const defs: Record<string, StyleProps> = (editor.state.doc.attrs as any)?.styleDefs || {};

  // Redefinir el estilo actual según el formato de la selección (Word).
  const redefineStyle = () => {
    const ts = editor.getAttributes('textStyle');
    const align = (['left', 'center', 'right', 'justify'] as const).find((a) => editor.isActive({ textAlign: a }));
    const lineHeight = (headingLevel ? editor.getAttributes('heading') : editor.getAttributes('paragraph')).lineHeight ?? null;
    const props: StyleProps = {
      fontFamily: ts.fontFamily ?? null, fontSize: ts.fontSize ?? null, color: ts.color ?? null,
      bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'),
      textAlign: align ?? null, lineHeight,
    };
    (editor.chain().focus() as any).setPageMeta({ styleDefs: { ...defs, [curKey]: props } }).run();
  };
  const resetStyle = () => {
    const next = { ...defs };
    delete next[curKey];
    (editor.chain().focus() as any).setPageMeta({ styleDefs: Object.keys(next).length ? next : null }).run();
  };

  const STYLES: { key: string; label: string; apply: () => void; active: () => boolean; preview: React.ReactNode }[] = [
    {
      key: 'normal', label: 'Normal',
      apply: () => (c() as any).setParagraph().updateAttributes('paragraph', { styleName: '' }).run(),
      active: () => editor.isActive('paragraph') && !editor.getAttributes('paragraph').styleName && !editor.isActive('blockquote'),
      preview: <span className="text-[13px] text-gray-700 dark:text-gray-200">Texto normal</span>,
    },
    {
      key: 'title', label: 'Título',
      apply: () => (c() as any).setHeading({ level: 1 }).updateAttributes('heading', { styleName: 'title' }).run(),
      active: () => editor.isActive('heading', { level: 1 }) && editor.getAttributes('heading').styleName === 'title',
      preview: <span className="text-2xl font-bold tracking-tight">Título</span>,
    },
    {
      key: 'subtitle', label: 'Subtítulo',
      apply: () => (c() as any).setParagraph().updateAttributes('paragraph', { styleName: 'subtitle' }).run(),
      active: () => editor.isActive('paragraph') && editor.getAttributes('paragraph').styleName === 'subtitle',
      preview: <span className="text-lg font-medium text-gray-500 dark:text-gray-400">Subtítulo</span>,
    },
    {
      key: 'h1', label: 'Encabezado 1',
      apply: () => (c() as any).setHeading({ level: 1 }).updateAttributes('heading', { styleName: '' }).run(),
      active: () => editor.isActive('heading', { level: 1 }) && !editor.getAttributes('heading').styleName,
      preview: <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Encabezado 1</span>,
    },
    {
      key: 'h2', label: 'Encabezado 2',
      apply: () => (c() as any).setHeading({ level: 2 }).updateAttributes('heading', { styleName: '' }).run(),
      active: () => editor.isActive('heading', { level: 2 }) && !editor.getAttributes('heading').styleName,
      preview: <span className="text-base font-bold text-gray-800 dark:text-gray-200">Encabezado 2</span>,
    },
    {
      key: 'h3', label: 'Encabezado 3',
      apply: () => (c() as any).setHeading({ level: 3 }).updateAttributes('heading', { styleName: '' }).run(),
      active: () => editor.isActive('heading', { level: 3 }) && !editor.getAttributes('heading').styleName,
      preview: <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Encabezado 3</span>,
    },
    {
      key: 'quote', label: 'Cita',
      apply: () => (c() as any).setBlockquote().run(),
      active: () => editor.isActive('blockquote'),
      preview: <span className="text-[13px] italic text-gray-500 border-l-2 border-gray-300 pl-2">Cita</span>,
    },
    {
      key: 'nospacing', label: 'Sin espaciado',
      apply: () => (c() as any).setParagraph().updateAttributes('paragraph', { styleName: 'nospacing' }).run(),
      active: () => editor.isActive('paragraph') && editor.getAttributes('paragraph').styleName === 'nospacing',
      preview: <span className="text-[13px] text-gray-700 dark:text-gray-200">Sin espaciado</span>,
    },
    {
      key: 'reference', label: 'Referencia',
      apply: () => (c() as any).setParagraph().updateAttributes('paragraph', { styleName: 'reference' }).run(),
      active: () => editor.isActive('paragraph') && editor.getAttributes('paragraph').styleName === 'reference',
      preview: <span className="text-[12px] uppercase tracking-wider font-semibold text-gray-600 dark:text-gray-300">Referencia</span>,
    },
    {
      key: 'caption', label: 'Leyenda',
      apply: () => (c() as any).setParagraph().updateAttributes('paragraph', { styleName: 'caption' }).run(),
      active: () => editor.isActive('paragraph') && editor.getAttributes('paragraph').styleName === 'caption',
      preview: <span className="text-[12px] italic text-gray-500">Figura 1. Leyenda</span>,
    },
  ];

  return (
    <RibbonMenuButton icon={Type} label="Estilos" menuWidth={260}>
      <div className="grid grid-cols-1 gap-1">
        {STYLES.map((s) => (
          <button
            key={s.key} type="button"
            onMouseDown={(e) => e.preventDefault()} onClick={s.apply}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors border ${s.active() ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}
          >
            <span className="flex-1 min-w-0 truncate">{s.preview}</span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-1 border-t border-black/5 dark:border-white/10 pt-1 space-y-0.5">
        <button
          type="button" onMouseDown={(e) => e.preventDefault()} onClick={redefineStyle}
          className="w-full flex items-center gap-2 text-left text-[12px] font-medium px-2.5 py-2 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <Wand2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          Redefinir «{curKeyLabel}» según la selección
        </button>
        {defs[curKey] && (
          <button
            type="button" onMouseDown={(e) => e.preventDefault()} onClick={resetStyle}
            className="w-full flex items-center gap-2 text-left text-[12px] font-medium px-2.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            Restablecer «{curKeyLabel}»
          </button>
        )}
        <button
          type="button" onMouseDown={(e) => e.preventDefault()}
          onClick={() => (c() as any).setParagraph().updateAttributes('paragraph', { styleName: '' }).unsetAllMarks().run()}
          className="w-full text-left text-[12px] font-medium px-2.5 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          Borrar formato (a Normal)
        </button>
      </div>
    </RibbonMenuButton>
  );
}
