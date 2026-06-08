'use client';

import React, { useState } from 'react';
import { BG_PRESETS } from './backgrounds';

/** Galería de fondos de degradado, con opción «aplicar a todas». */
export function BgGallery({ onApply, onRemove }: {
  onApply: (id: string, all: boolean) => void;
  onRemove: (all: boolean) => void;
}) {
  const [all, setAll] = useState(false);
  return (
    <div className="w-[248px] space-y-2" onMouseDown={(e) => e.stopPropagation()}>
      <label className="flex items-center gap-2 px-1 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-blue-500" />
        Aplicar a todas las diapositivas
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        {BG_PRESETS.map((p) => (
          <button key={p.id} type="button" title={p.name}
            onMouseDown={(e) => e.preventDefault()} onClick={() => onApply(p.id, all)}
            className="h-10 rounded-lg border border-black/10 dark:border-white/15 hover:scale-105 transition-transform"
            style={{ backgroundImage: p.css }} />
        ))}
      </div>
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onRemove(all)}
        className="w-full text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg py-1.5 hover:bg-black/5 dark:hover:bg-white/10">
        Quitar degradado
      </button>
    </div>
  );
}
