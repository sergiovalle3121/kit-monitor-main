'use client';

import React, { useState } from 'react';

export interface Geom { x: number; y: number; w: number; h: number; angle: number }

/** Formulario X/Y/An/Al/Giro para el objeto seleccionado (popover del ribbon).
 *  Mantiene estado local (se remonta por `key` al cambiar de selección) para no
 *  pelear con el valor mientras se escribe. */
export function PositionSizeForm({ initial, canSize, onChange }: {
  initial: Geom; canSize: boolean; onChange: (patch: Partial<Geom>) => void;
}) {
  const [g, setG] = useState<Geom>(initial);
  const set = (k: keyof Geom, v: number) => { setG((s) => ({ ...s, [k]: v })); onChange({ [k]: v } as Partial<Geom>); };
  const field = (label: string, k: keyof Geom, disabled = false) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400">{label}</span>
      <input type="number" disabled={disabled} value={Math.round(g[k])} onChange={(e) => set(k, Number(e.target.value))}
        className="w-full h-7 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 outline-none border border-transparent focus:border-blue-500/40 disabled:opacity-40 text-foreground" />
    </label>
  );
  return (
    <div className="w-56 p-1" onMouseDown={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-2 gap-2">
        {field('Posición X', 'x')}
        {field('Posición Y', 'y')}
        {field('Ancho', 'w', !canSize)}
        {field('Alto', 'h', !canSize)}
        {field('Giro (°)', 'angle')}
      </div>
    </div>
  );
}
