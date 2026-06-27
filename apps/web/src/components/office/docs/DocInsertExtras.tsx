'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { Type, SquareDashed, Columns, Bookmark as BookmarkIcon, Link as LinkIcon, PenTool, Captions, Factory } from 'lucide-react';
import { RibbonGroup, RibbonSeparator, RibbonButton, RibbonMenuButton } from '../ribbon';

const AXOS_REFS = [
  { entity: 'work_order', label: 'Work Order', sample: 'WO-00001' },
  { entity: 'bom', label: 'BOM', sample: 'BOM-00001' },
  { entity: 'routing', label: 'Routing', sample: 'RT-00001' },
  { entity: 'model', label: 'Modelo', sample: 'MDL-00001' },
  { entity: 'ncr', label: 'NCR', sample: 'NCR-00001' },
  { entity: 'capa', label: 'CAPA', sample: 'CAPA-00001' },
  { entity: 'supplier', label: 'Proveedor', sample: 'SUP-00001' },
  { entity: 'customer', label: 'Cliente', sample: 'CUS-00001' },
];

const TONES = [
  { key: 'neutral', label: 'Neutro' },
  { key: 'info', label: 'Información' },
  { key: 'success', label: 'Éxito' },
  { key: 'warning', label: 'Advertencia' },
  { key: 'danger', label: 'Peligro' },
];

function bookmarks(editor: Editor): string[] {
  const names = new Set<string>();
  editor.state.doc.descendants((n: any) => { if (n.type?.name === 'bookmark' && n.attrs.name) names.add(n.attrs.name); });
  return [...names];
}

/** Grupos de «Insertar»: letra capital, cuadro de texto, salto de columna,
 *  marcador y referencia cruzada. */
export function DocInsertExtras({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  const bm = bookmarks(editor);

  const addBookmark = () => {
    const name = window.prompt('Nombre del marcador (sin espacios)');
    if (!name) return;
    (c() as any).insertBookmark(name.trim().replace(/\s+/g, '-')).run();
  };
  const addSignature = () => {
    const name = window.prompt('Nombre para la firma');
    if (name === null) return;
    const title = window.prompt('Cargo / título (opcional)') || '';
    (c() as any).insertSignatureLine(name.trim(), title.trim()).run();
  };
  const addAxosRef = (entity: string, label: string, sample: string) => {
    const refId = window.prompt(`${label}: ID o código`, sample);
    if (!refId) return;
    const display = window.prompt('Texto visible', `${label} ${refId.trim()}`) || `${label} ${refId.trim()}`;
    (c() as any).insertAxosRef({ entity, refId: refId.trim(), label: display.trim() }).run();
  };
  const isCaption = editor.getAttributes('paragraph').styleName === 'caption';
  const toggleCaption = () => (c() as any).updateAttributes('paragraph', { styleName: isCaption ? '' : 'caption' }).run();

  return (
    <>
      <RibbonGroup label="Texto">
        <RibbonButton icon={Type} label="Letra capital" hideLabel={false} active={!!editor.getAttributes('paragraph').dropCap} onClick={() => (c() as any).toggleDropCap().run()} />
        <RibbonMenuButton icon={SquareDashed} label="Cuadro de texto" menuWidth={210} items={[
          { label: editor.isActive('callout') ? 'Quitar cuadro' : 'Insertar cuadro', onClick: () => (c() as any).toggleCallout('neutral').run() },
          ...TONES.map((t) => ({ label: `Estilo: ${t.label}`, active: editor.isActive('callout', { tone: t.key }), onClick: () => (c() as any).setCalloutTone(t.key).run() })),
        ]} />
        <RibbonButton icon={Captions} label="Leyenda de figura" active={isCaption} onClick={toggleCaption} />
        <RibbonButton icon={PenTool} label="Línea de firma" onClick={addSignature} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="AXOS">
        <RibbonMenuButton icon={Factory} label="Referencia AXOS" menuWidth={230} items={AXOS_REFS.map((r) => ({ label: r.label, icon: Factory, onClick: () => addAxosRef(r.entity, r.label, r.sample) }))} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Vínculos del documento">
        <RibbonButton icon={Columns} label="Salto de columna" onClick={() => (c() as any).setColumnBreak().run()} />
        <RibbonButton icon={BookmarkIcon} label="Marcador" onClick={addBookmark} />
        <RibbonMenuButton icon={LinkIcon} label="Ref. cruzada" menuWidth={220} items={
          bm.length
            ? bm.map((name) => ({ label: name, icon: BookmarkIcon, onClick: () => (c() as any).insertCrossRef(name, name).run() }))
            : [{ label: 'No hay marcadores aún', onClick: () => {} }]
        } />
      </RibbonGroup>
    </>
  );
}
