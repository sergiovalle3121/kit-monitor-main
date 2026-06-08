'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { RectangleVertical, RectangleHorizontal, FileText, StretchHorizontal, Columns2, Columns3, Square, Stamp, SquareDashedBottom, Hash } from 'lucide-react';
import { RibbonGroup, RibbonSeparator, RibbonMenuButton, RibbonButton } from './ribbon';

/** Controles de «Disposición» (diseño de página): se guardan en pageMeta y se
 *  reflejan en la vista, en la vista de página/impresión y en el export .docx. */
export function DocPageSetup({ editor }: { editor: Editor }) {
  const a: any = editor.state.doc.attrs || {};
  const set = (attrs: Record<string, any>) => (editor.chain() as any).setPageMeta(attrs).run();

  const orientation = a.pageOrientation || 'portrait';
  const size = a.pageSize || 'a4';
  const margin = a.pageMargin || 'normal';
  const columns = a.pageColumns || 1;
  const border = a.pageBorder || '';

  const sizeLabel: Record<string, string> = { a4: 'A4', letter: 'Carta', legal: 'Oficio' };
  const marginLabel: Record<string, string> = { normal: 'Normales', narrow: 'Estrechos', wide: 'Amplios' };

  return (
    <>
      <RibbonGroup label="Configurar página">
        <RibbonMenuButton icon={orientation === 'landscape' ? RectangleHorizontal : RectangleVertical} label="Orientación" menuWidth={200} items={[
          { label: 'Vertical', icon: RectangleVertical, active: orientation === 'portrait', onClick: () => set({ pageOrientation: 'portrait' }) },
          { label: 'Horizontal', icon: RectangleHorizontal, active: orientation === 'landscape', onClick: () => set({ pageOrientation: 'landscape' }) },
        ]} />
        <RibbonMenuButton icon={FileText} label="Tamaño" menuWidth={200} items={[
          { label: 'A4 (210 × 297 mm)', active: size === 'a4', onClick: () => set({ pageSize: 'a4' }) },
          { label: 'Carta (8.5 × 11")', active: size === 'letter', onClick: () => set({ pageSize: 'letter' }) },
          { label: 'Oficio (8.5 × 14")', active: size === 'legal', onClick: () => set({ pageSize: 'legal' }) },
        ]} />
        <RibbonMenuButton icon={StretchHorizontal} label="Márgenes" menuWidth={210} items={[
          { label: 'Normales', active: margin === 'normal', onClick: () => set({ pageMargin: 'normal' }) },
          { label: 'Estrechos', active: margin === 'narrow', onClick: () => set({ pageMargin: 'narrow' }) },
          { label: 'Amplios', active: margin === 'wide', onClick: () => set({ pageMargin: 'wide' }) },
        ]} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Columnas">
        <RibbonMenuButton icon={columns >= 3 ? Columns3 : columns === 2 ? Columns2 : Square} label={`${columns}`} menuWidth={190} items={[
          { label: 'Una columna', icon: Square, active: columns === 1, onClick: () => set({ pageColumns: 1 }) },
          { label: 'Dos columnas', icon: Columns2, active: columns === 2, onClick: () => set({ pageColumns: 2 }) },
          { label: 'Tres columnas', icon: Columns3, active: columns === 3, onClick: () => set({ pageColumns: 3 }) },
        ]} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Fondo de página">
        <RibbonButton icon={Stamp} label={a.pageWatermark ? 'Marca de agua: ✓' : 'Marca de agua'} hideLabel={false}
          onClick={() => {
            const v = window.prompt('Texto de la marca de agua (vacío = quitar)', a.pageWatermark || '');
            if (v === null) return;
            set({ pageWatermark: v.trim() });
          }} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Bordes y líneas">
        <RibbonMenuButton icon={SquareDashedBottom} label="Bordes" menuWidth={200} items={[
          { label: 'Sin borde', active: border === '', onClick: () => set({ pageBorder: '' }) },
          { label: 'Fino', active: border === 'thin', onClick: () => set({ pageBorder: 'thin' }) },
          { label: 'Grueso', active: border === 'thick', onClick: () => set({ pageBorder: 'thick' }) },
          { label: 'Doble', active: border === 'double', onClick: () => set({ pageBorder: 'double' }) },
        ]} />
        <RibbonButton icon={Hash} label="Números de línea" active={!!a.pageLineNumbers} onClick={() => set({ pageLineNumbers: !a.pageLineNumbers })} />
      </RibbonGroup>
      <span className="self-center text-[10px] text-gray-400 px-2 max-w-[150px]" title="Vista de página">{sizeLabel[size]} · {marginLabel[margin]}</span>
    </>
  );
}
