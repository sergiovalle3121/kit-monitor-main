'use client';

import React from 'react';
import { QUICK_STYLES } from './quickStyles';

/** Galería de estilos rápidos de forma (previews en vivo según el acento). */
export function QuickStyleGallery({ accent, onPick }: { accent: string; onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 w-[260px]">
      {QUICK_STYLES.map((s) => (
        <button key={s.id} type="button" title={s.name}
          onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(s.id)}
          className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-black/[0.06] dark:hover:bg-white/10">
          <span className="w-9 h-7 rounded-md" style={{ ...s.preview(accent), border: s.preview(accent).border ?? '1px solid rgba(0,0,0,0.08)' }} />
        </button>
      ))}
    </div>
  );
}
