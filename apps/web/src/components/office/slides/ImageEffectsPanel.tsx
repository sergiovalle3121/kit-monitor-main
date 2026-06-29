'use client';

import React from 'react';
import { IMAGE_FX_PRESETS, analyzeImageEffects, imageEffectsSummary, type ImgFx } from './imageEffects';

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block px-1 py-1">
      <span className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 mb-0.5">
        <span>{label}</span><span className="tabular-nums text-gray-400">{Math.round(value * 100)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-500"
      />
    </label>
  );
}

/** Panel de ajustes de imagen (filtros Fabric) para el popover del ribbon. */
export function ImageEffectsPanel({ fx, onChange, onReset }: {
  fx: ImgFx; onChange: (patch: Partial<ImgFx>) => void; onReset: () => void;
}) {
  const readiness = analyzeImageEffects(fx);
  const warningCount = readiness.issues.filter((issue) => issue.severity === 'warning').length;
  const toggle = (key: 'grayscale' | 'sepia' | 'invert', label: string) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChange({ [key]: !fx[key] } as Partial<ImgFx>)}
      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${fx[key] ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
    >
      {label}
    </button>
  );
  return (
    <div className="w-72 p-1" onMouseDown={(e) => e.stopPropagation()}>
      <div className="px-1 pb-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Presets</p>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${warningCount ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'}`}>
            {readiness.exportFidelity === 'native' ? 'PPTX nativo' : 'PPTX aprox.'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {IMAGE_FX_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(preset.fx)}
              className="rounded-lg border border-black/10 dark:border-white/15 px-2 py-1.5 text-left text-[11px] font-medium text-gray-600 transition-colors hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <Slider label="Brillo" value={fx.brightness} min={-0.6} max={0.6} step={0.02} onChange={(v) => onChange({ brightness: v })} />
      <Slider label="Contraste" value={fx.contrast} min={-0.6} max={0.6} step={0.02} onChange={(v) => onChange({ contrast: v })} />
      <Slider label="Saturacion" value={fx.saturation} min={-1} max={1} step={0.02} onChange={(v) => onChange({ saturation: v })} />
      <Slider label="Desenfoque" value={fx.blur} min={0} max={0.6} step={0.02} onChange={(v) => onChange({ blur: v })} />

      <div className="mx-1 mt-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.025] dark:bg-white/[0.04] px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{imageEffectsSummary(fx)}</p>
          <span className="text-[10px] text-gray-400">{readiness.activeCount}/7</span>
        </div>
        {readiness.issues.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {readiness.issues.slice(0, 3).map((issue) => (
              <li key={issue.code} className={`text-[10px] leading-snug ${issue.severity === 'warning' ? 'text-amber-600 dark:text-amber-300' : 'text-gray-400'}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-1 pt-1.5">
        {toggle('grayscale', 'B/N')}
        {toggle('sepia', 'Sepia')}
        {toggle('invert', 'Invertir')}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onReset}
          className="ml-auto px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Restablecer
        </button>
      </div>
    </div>
  );
}
