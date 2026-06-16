'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { AlignVerticalSpaceAround } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';

const STEP = 12; // px ≈ 9pt, espaciado por defecto al alternar

/** Espaciado de párrafo (antes/después) y sangría de primera línea. */
export function DocParagraphMenu({ editor }: { editor: Editor }) {
  const a = editor.isActive('heading') ? editor.getAttributes('heading') : editor.getAttributes('paragraph');
  const before = a.spaceBefore || 0;
  const after = a.spaceAfter || 0;
  const fli = !!a.firstLineIndent;
  const keepNext = !!a.keepNext;
  const keepLines = !!a.keepLines;
  const breakBefore = !!a.pageBreakBefore;
  const set = (b: number | null, af: number | null) => (editor.chain().focus() as any).setParagraphSpacing(b, af).run();
  const cmd = (name: string) => (editor.chain().focus() as any)[name]().run();

  return (
    <RibbonMenuButton icon={AlignVerticalSpaceAround} label="Espaciado" menuWidth={280} items={[
      { label: before ? 'Quitar espacio antes del párrafo' : 'Agregar espacio antes del párrafo', active: !!before, onClick: () => set(before ? 0 : STEP, null) },
      { label: after ? 'Quitar espacio después del párrafo' : 'Agregar espacio después del párrafo', active: !!after, onClick: () => set(null, after ? 0 : STEP) },
      { label: 'Sangría de primera línea', active: fli, onClick: () => (editor.chain().focus() as any).toggleFirstLineIndent().run() },
      { label: 'Conservar con el siguiente', active: keepNext, onClick: () => cmd('toggleKeepNext') },
      { label: 'Conservar líneas juntas', active: keepLines, onClick: () => cmd('toggleKeepLines') },
      { label: 'Salto de página antes', active: breakBefore, onClick: () => cmd('togglePageBreakBefore') },
    ]} />
  );
}
