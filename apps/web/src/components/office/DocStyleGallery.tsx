'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { Type } from 'lucide-react';
import { RibbonMenuButton } from './ribbon';

/** Galería visual de estilos con nombre (tarjetas), estilo Word. */
export function DocStyleGallery({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();

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
    </RibbonMenuButton>
  );
}
