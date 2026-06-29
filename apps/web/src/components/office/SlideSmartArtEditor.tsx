'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, X } from 'lucide-react';
import { SMART_KINDS, buildSmartArt, type SmartSpec, type SmartKind } from './slides/smartart';
import {
  INDUSTRIAL_SMART_ART_PRESETS,
  SMART_ART_PRESET_CATEGORIES,
  SMART_ART_PRESET_CATEGORY_LABEL,
  cloneSmartArtPresetSpec,
  filterSmartArtPresets,
  smartArtPresetStats,
  type SmartArtPreset,
  type SmartArtPresetCategory,
} from './slides/smartArtPresets';

/** Editor SmartArt: tipo de diagrama + lista de texto (una línea por elemento). */
export function SlideSmartArtEditor({ spec: initial, onApply, onClose }: {
  spec: SmartSpec; onApply: (spec: SmartSpec) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<SmartKind>(initial.kind);
  const [textValue, setTextValue] = useState(initial.items.join('\n'));
  const [preview, setPreview] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SmartArtPresetCategory | 'all'>('all');
  const [selectedPreset, setSelectedPreset] = useState('');

  const items = textValue.split('\n').map((s) => s.trim()).filter(Boolean);
  const stats = smartArtPresetStats();
  const presets = filterSmartArtPresets(INDUSTRIAL_SMART_ART_PRESETS, { query, category });

  function applyPreset(preset: SmartArtPreset) {
    const spec = cloneSmartArtPresetSpec(preset);
    setKind(spec.kind);
    setTextValue(spec.items.join('\n'));
    setSelectedPreset(preset.id);
  }

  useEffect(() => {
    let active = true;
    const id = setTimeout(async () => {
      try {
        const { StaticCanvas } = await import('fabric');
        const sc = new StaticCanvas(document.createElement('canvas'), { width: 820, height: 360 });
        const g = buildSmartArt({ kind, items: items.length ? items : ['Elemento'] }, { left: 0, top: 0 });
        sc.add(g); sc.renderAll();
        const url = sc.toDataURL({ format: 'png', multiplier: 1 } as any);
        sc.dispose();
        if (active) setPreview(url);
      } catch { /* noop */ }
    }, 180);
    return () => { active = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, textValue]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#161616] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="font-bold">SmartArt <span className="text-sm font-normal text-gray-500 dark:text-gray-400">· diagrama desde texto</span></h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] p-3 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Presets industriales</p>
                <p className="text-[11px] text-gray-400">{presets.length} / {stats.total} disponibles</p>
              </div>
              <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-sm dark:border-white/10 dark:bg-black/20">
                <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar 8D, SOP, supplier, visual aid..." className="min-w-0 flex-1 bg-transparent outline-none" />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <PresetFilter active={category === 'all'} onClick={() => setCategory('all')}>Todo</PresetFilter>
              {SMART_ART_PRESET_CATEGORIES.map((c) => (
                <PresetFilter key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                  {c.label}
                </PresetFilter>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto pr-1">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`rounded-xl border p-3 text-left transition-colors ${selectedPreset === preset.id ? 'border-blue-500 bg-blue-500/10' : 'border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 hover:border-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-500/10'}`}
                >
                  <span className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{preset.label}</span>
                    <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/[0.08] dark:text-gray-300">{SMART_ART_PRESET_CATEGORY_LABEL[preset.category]}</span>
                  </span>
                  <span className="block text-[11px] font-medium text-blue-600 dark:text-blue-300">{preset.useCase}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-snug text-gray-500 dark:text-gray-400">{preset.description}</span>
                  <span className="mt-2 block truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{preset.kind} - {preset.items.length} nodos</span>
                </button>
              ))}
              {!presets.length && (
                <div className="sm:col-span-2 lg:col-span-3 rounded-xl border border-dashed border-black/10 dark:border-white/10 p-6 text-center text-sm text-gray-400">
                  Sin presets para este filtro.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SMART_KINDS.map((k) => (
              <button key={k.value} onClick={() => { setKind(k.value); setSelectedPreset(''); }} title={k.hint}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${kind === k.value ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}>
                {k.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-black/30 border border-black/5 dark:border-white/10 flex items-center justify-center p-2" style={{ minHeight: 180 }}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- SmartArt preview is a client-generated data URL from Fabric.
              <img src={preview} alt="Vista previa" className="max-h-[230px] w-auto" />
            ) : <span className="text-sm text-gray-500 dark:text-gray-400">Generando vista previa…</span>}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Elementos (uno por línea)</label>
            <textarea value={textValue} onChange={(e) => { setTextValue(e.target.value); setSelectedPreset(''); }} rows={5}
              className="w-full resize-y rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-black/5 dark:border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={() => onApply({ kind, items: items.length ? items : ['Elemento'] })} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600">Insertar</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PresetFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-lg border px-2.5 text-xs font-semibold ${active ? 'border-blue-500 bg-blue-500 text-white' : 'border-black/10 text-gray-500 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}
