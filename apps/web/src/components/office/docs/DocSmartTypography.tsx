'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { Sparkles } from 'lucide-react';
import { RibbonButton } from '../ribbon';

/**
 * Botón «Tipografía inteligente» (Autoformato de Word): convierte comillas/apóstrofos en curvos, `--`
 * en raya, `...` en puntos suspensivos, `(c)/(r)/(tm)` en símbolos y `1/2`/`1/4`/`3/4` en fracciones.
 * Actúa sobre la selección, o sobre todo el documento si no hay selección.
 */
export function DocSmartTypography({ editor }: { editor: Editor }) {
  return (
    <RibbonButton
      icon={Sparkles}
      label="Tipografía inteligente"
      hideLabel={false}
      onClick={() => (editor.chain().focus() as any).applyTypography().run()}
    />
  );
}
