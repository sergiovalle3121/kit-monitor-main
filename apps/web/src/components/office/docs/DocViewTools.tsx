'use client';

import React from 'react';
import { Pilcrow, Focus, BookOpen, Ruler, ZoomIn, ZoomOut, SpellCheck2, ScanText } from 'lucide-react';
import { RibbonGroup, RibbonSeparator, RibbonButton, RibbonSelect } from '../ribbon';

export interface DocViewState {
  showMarks: boolean; setShowMarks: (v: boolean) => void;
  focusMode: boolean; setFocusMode: (v: boolean) => void;
  readingMode: boolean; setReadingMode: (v: boolean) => void;
  showRuler: boolean; setShowRuler: (v: boolean) => void;
  zoom: number; setZoom: (v: number) => void;
  spellcheck: boolean; setSpellcheck: (v: boolean) => void;
}

const ZOOMS = ['0.5', '0.75', '0.9', '1', '1.1', '1.25', '1.5', '2'];

/** Controles de la pestaña «Vista»: zoom, marcas de formato, enfoque, lectura. */
export function DocViewTools(s: DocViewState) {
  const zoomStr = String(s.zoom);
  return (
    <>
      <RibbonGroup label="Zoom">
        <RibbonButton icon={ZoomOut} label="Alejar" onClick={() => s.setZoom(Math.max(0.5, Math.round((s.zoom - 0.1) * 100) / 100))} />
        <RibbonSelect title="Zoom" value={ZOOMS.includes(zoomStr) ? zoomStr : '1'} onChange={(v) => s.setZoom(Number(v))} width={72}
          options={ZOOMS.map((z) => ({ label: `${Math.round(Number(z) * 100)}%`, value: z }))} />
        <RibbonButton icon={ZoomIn} label="Acercar" onClick={() => s.setZoom(Math.min(2, Math.round((s.zoom + 0.1) * 100) / 100))} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Mostrar">
        <RibbonButton icon={Pilcrow} label="Marcas de formato (¶)" active={s.showMarks} onClick={() => s.setShowMarks(!s.showMarks)} />
        <RibbonButton icon={Ruler} label="Regla" active={s.showRuler} onClick={() => s.setShowRuler(!s.showRuler)} />
      </RibbonGroup>
      <RibbonSeparator />
      <RibbonGroup label="Modos">
        <RibbonButton icon={Focus} label="Modo enfoque" active={s.focusMode} onClick={() => s.setFocusMode(!s.focusMode)} />
        <RibbonButton icon={BookOpen} label="Modo lectura" active={s.readingMode} onClick={() => s.setReadingMode(!s.readingMode)} />
        <RibbonButton icon={s.spellcheck ? SpellCheck2 : ScanText} label="Revisión ortográfica" active={s.spellcheck} onClick={() => s.setSpellcheck(!s.spellcheck)} />
      </RibbonGroup>
    </>
  );
}
