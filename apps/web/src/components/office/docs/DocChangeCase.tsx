'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { CaseSensitive } from 'lucide-react';
import { RibbonMenuButton } from '../ribbon';
import type { CaseMode } from './changeCase';

/** Menú «Cambiar mayúsculas/minúsculas» (Aa). */
export function DocChangeCase({ editor }: { editor: Editor }) {
  const run = (mode: CaseMode) => (editor.chain().focus() as any).changeCase(mode).run();
  return (
    <RibbonMenuButton icon={CaseSensitive} label="Cambiar mayúsculas" menuWidth={220} items={[
      { label: 'Tipo oración.', onClick: () => run('sentence') },
      { label: 'minúsculas', onClick: () => run('lower') },
      { label: 'MAYÚSCULAS', onClick: () => run('upper') },
      { label: 'Poner En Mayúscula Cada Palabra', onClick: () => run('title') },
      { label: 'aLTERNAR mAYÚS/minús', onClick: () => run('toggle') },
    ]} />
  );
}
