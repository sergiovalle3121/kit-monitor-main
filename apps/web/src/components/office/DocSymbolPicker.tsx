'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { Editor } from '@tiptap/react';
import { Omega } from 'lucide-react';
import { RibbonMenuButton } from './ribbon';

const GROUPS: { label: string; chars: string[] }[] = [
  { label: 'Comunes', chars: ['©', '®', '™', '§', '¶', '†', '‡', '•', '…', '°', '·', '№'] },
  { label: 'Moneda', chars: ['€', '£', '¥', '¢', '$', '₿', '₽', '₹'] },
  { label: 'Matemáticas', chars: ['±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∑', '∫', '∂', 'µ', 'π', 'Ω', '∆', '½', '¼', '¾'] },
  { label: 'Flechas', chars: ['→', '←', '↑', '↓', '↔', '⇒', '⇐', '⇔', '➡', '⬅'] },
  { label: 'Puntuación', chars: ['«', '»', '“', '”', '‘', '’', '–', '—', '¿', '¡'] },
];

/** Inserción de caracteres especiales / símbolos (Σ). */
export function DocSymbolPicker({ editor }: { editor: Editor }) {
  const insert = (ch: string) => (editor.chain().focus() as any).insertContent(ch).run();
  return (
    <RibbonMenuButton icon={Omega} label="Símbolo" menuWidth={280}>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] font-semibold text-gray-400 px-1 pb-1 uppercase tracking-wide">{g.label}</div>
            <div className="grid grid-cols-8 gap-0.5">
              {g.chars.map((ch) => (
                <button
                  key={ch} type="button" title={ch}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)}
                  className="h-8 rounded-lg text-base hover:bg-black/[0.06] dark:hover:bg-white/10 text-gray-700 dark:text-gray-200"
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </RibbonMenuButton>
  );
}
