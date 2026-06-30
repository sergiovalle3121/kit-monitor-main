'use client';

import React from 'react';
import type { ImgFx } from './imageEffects';

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block px-1 py-1">
      <span className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 mb-0.5">
        <span>{label}</span><span className="tabular-nums text-gray-500 dark:text-gray-400">{Math.round(value * 100)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500" />
    </label>
  );
}

/** Panel de ajustes de imagen (filtros Fabric) para el popover del ribbon. */
export function ImageEffectsPanel({ fx, onChange, onReset }: {
  fx: ImgFx; onChange: (patch: Partial<ImgFx>) => void; onReset: () => void;
}) {
  const toggle = (key: 'grayscale' | 'sepia' | 'invert', label: string) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChange({ [key]: !fx[key] } as Partial<ImgFx>)}
      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${fx[key] ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}>
      {label}
    </button>
  );
  return (
    <div className="w-60 p-1" onMouseDown={(e) => e.stopPropagation()}>
      <Slider label="Brillo" value={fx.brightness} min={-0.6} max={0.6} step={0.02} onChange={(v) => onChange({ brightness: v })} />
      <Slider label="Contraste" value={fx.contrast} min={-0.6} max={0.6} step={0.02} onChange={(v) => onChange({ contrast: v })} />
      <Slider label="Saturación" value={fx.saturation} min={-1} max={1} step={0.02} onChange={(v) => onChange({ saturation: v })} />
      <Slider label="Desenfoque" value={fx.blur} min={0} max={0.6} step={0.02} onChange={(v) => onChange({ blur: v })} />
      <div className="flex items-center gap-1.5 px-1 pt-1.5">
        {toggle('grayscale', 'B/N')}
        {toggle('sepia', 'Sepia')}
        {toggle('invert', 'Invertir')}
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onReset}
          className="ml-auto px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:bg-black/5 dark:hover:bg-white/10">Restablecer</button>
      </div>
    </div>
  );
}
