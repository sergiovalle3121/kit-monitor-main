'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { ListTree, RefreshCw } from 'lucide-react';
import { RibbonGroup, RibbonMenuButton, RibbonButton } from '../ribbon';

/** Tabla de contenido automática: insertar (eligiendo niveles) y actualizar. */
export function DocToc({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  const hasToc = (() => { let f = false; editor.state.doc.descendants((n: any) => { if (n.type.name === 'toc') f = true; }); return f; })();

  return (
    <RibbonGroup label="Tabla de contenido">
      <RibbonMenuButton icon={ListTree} label="Tabla de contenido" menuWidth={240} items={[
        { label: 'Insertar — títulos 1 a 3', onClick: () => (c() as any).insertToc(3).run() },
        { label: 'Insertar — títulos 1 a 2', onClick: () => (c() as any).insertToc(2).run() },
        { label: 'Insertar — todos (1 a 6)', onClick: () => (c() as any).insertToc(6).run() },
        ...(hasToc ? [
          { label: 'Cambiar niveles → 1 a 2', onClick: () => (c() as any).setTocLevels(2).run() },
          { label: 'Cambiar niveles → 1 a 3', onClick: () => (c() as any).setTocLevels(3).run() },
          { label: 'Cambiar niveles → todos', onClick: () => (c() as any).setTocLevels(6).run() },
        ] : []),
      ]} />
      <RibbonButton icon={RefreshCw} label="Actualizar tabla" hideLabel={false} disabled={!hasToc} onClick={() => (c() as any).updateToc().run()} />
    </RibbonGroup>
  );
}
