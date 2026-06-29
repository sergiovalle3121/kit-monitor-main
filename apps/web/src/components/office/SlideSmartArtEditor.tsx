'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Plus, Search, Trash2, X } from 'lucide-react';
import { SMART_KINDS, buildSmartArt, type SmartSpec, type SmartKind } from './slides/smartart';
import {
  INDUSTRIAL_SMARTART_PRESETS,
  SMARTART_PRESET_CATEGORIES,
  addSmartArtItem,
  filterSmartArtPresets,
  moveSmartArtItem,
  normalizeSmartArtItems,
  removeSmartArtItem,
  smartArtPresetStats,
  smartArtSpecFromPreset,
  updateSmartArtItem,
  type SmartArtPreset,
  type SmartArtPresetCategory,
} from './slides/smartartPresets';

/** Editor SmartArt: diagramas industriales + nodos editables. */
export function SlideSmartArtEditor({ spec: initial, onApply, onClose }: {
  spec: SmartSpec; onApply: (spec: SmartSpec) => void; onClose: () => void;
}) {
  const [kind, setKind] = useState<SmartKind>(initial.kind);
  const [nodeItems, setNodeItems] = useState<string[]>(() => initial.items.length ? initial.items.slice() : ['Elemento']);
  const [preview, setPreview] = useState('');
  const [presetCategory, setPresetCategory] = useState<SmartArtPresetCategory | 'all'>('all');
  const [presetQuery, setPresetQuery] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const items = useMemo(() => normalizeSmartArtItems(nodeItems), [nodeItems]);
  const presetStats = useMemo(() => smartArtPresetStats(), []);
  const visiblePresets = useMemo(
    () => filterSmartArtPresets(INDUSTRIAL_SMARTART_PRESETS, { category: presetCategory, query: presetQuery }),
    [presetCategory, presetQuery],
  );
  const kindLabel = SMART_KINDS.find((entry) => entry.value === kind)?.label ?? kind;

  useEffect(() => {
    let active = true;
    const id = setTimeout(async () => {
      try {
        const { StaticCanvas } = await import('fabric');
        const sc = new StaticCanvas(document.createElement('canvas'), { width: 820, height: 360 });
        const g = buildSmartArt({ kind, items }, { left: 0, top: 0 });
        sc.add(g); sc.renderAll();
        const url = sc.toDataURL({ format: 'png', multiplier: 1 } as any);
        sc.dispose();
        if (active) setPreview(url);
      } catch { /* noop */ }
    }, 180);
    return () => { active = false; clearTimeout(id); };
  }, [kind, items]);

  function pickPreset(preset: SmartArtPreset) {
    const spec = smartArtSpecFromPreset(preset);
    setKind(spec.kind);
    setNodeItems(spec.items);
    setSelectedPresetId(preset.id);
  }

  function changeKind(next: SmartKind) {
    setKind(next);
    setSelectedPresetId(null);
  }

  function changeNode(index: number, value: string) {
    setNodeItems((current) => updateSmartArtItem(current, index, value));
    setSelectedPresetId(null);
  }

  function addNode() {
    setNodeItems((current) => addSmartArtItem(current));
    setSelectedPresetId(null);
  }

  function removeNode(index: number) {
    setNodeItems((current) => removeSmartArtItem(current, index));
    setSelectedPresetId(null);
  }

  function moveNode(index: number, direction: -1 | 1) {
    setNodeItems((current) => moveSmartArtItem(current, index, index + direction));
    setSelectedPresetId(null);
  }

  function submit() {
    onApply({ kind, items });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ scale: 0.97, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#161616] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold truncate">SmartArt <span className="text-sm font-normal text-gray-400">· diagramas industriales</span></h2>
            <p className="text-[11px] text-gray-500 truncate">{kindLabel} · {items.length} nodo(s) · exporta como formas editables</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500" title="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
            <section className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {SMART_KINDS.map((entry) => (
                  <button
                    key={entry.value}
                    onClick={() => changeKind(entry.value)}
                    title={entry.hint}
                    className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${kind === entry.value ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-black/30 border border-black/5 dark:border-white/10 flex items-center justify-center p-3" style={{ minHeight: 210 }}>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- SmartArt preview is a client-generated data URL from Fabric.
                  <img src={preview} alt="Vista previa" className="max-h-[250px] w-auto max-w-full" />
                ) : <span className="text-sm text-gray-400">Generando vista previa...</span>}
              </div>

              <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-black/5 dark:border-white/10">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Nodos</p>
                    <p className="text-[11px] text-gray-400">Texto, orden y cantidad del diagrama</p>
                  </div>
                  <button onClick={addNode} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-black text-white dark:bg-white dark:text-black">
                    <Plus className="w-3.5 h-3.5" /> Nodo
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  {nodeItems.map((item, index) => (
                    <div key={`${index}-${nodeItems.length}`} className="flex items-center gap-2">
                      <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-[11px] font-bold text-gray-500 flex items-center justify-center tabular-nums">{index + 1}</span>
                      <input
                        value={item}
                        onChange={(e) => changeNode(index, e.target.value)}
                        className="min-w-0 flex-1 h-9 px-3 text-sm rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none"
                      />
                      <button onClick={() => moveNode(index, -1)} disabled={index === 0} title="Subir" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 text-gray-500"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => moveNode(index, 1)} disabled={index === nodeItems.length - 1} title="Bajar" className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-35 text-gray-500"><ArrowDown className="w-4 h-4" /></button>
                      <button onClick={() => removeNode(index)} title="Eliminar" className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="min-w-0 rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-black/[0.015] dark:bg-white/[0.03]">
              <div className="p-3 border-b border-black/5 dark:border-white/10 space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Galeria industrial</p>
                  <p className="text-[11px] text-gray-400">{presetStats.total} presets · {visiblePresets.length} visibles</p>
                </div>
                <label className="flex items-center gap-2 h-9 rounded-xl bg-white dark:bg-black/30 border border-black/10 dark:border-white/10 px-3">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    value={presetQuery}
                    onChange={(e) => setPresetQuery(e.target.value)}
                    placeholder="Buscar SIPOC, CAPA, PPAP..."
                    className="min-w-0 flex-1 bg-transparent outline-none text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SMARTART_PRESET_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setPresetCategory(category.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${presetCategory === category.id ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/10 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto p-3 space-y-2">
                {visiblePresets.length === 0 ? (
                  <div className="h-32 rounded-xl border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-center text-sm text-gray-400 px-4">
                    Sin presets para este filtro.
                  </div>
                ) : visiblePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => pickPreset(preset)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${selectedPresetId === preset.id ? 'border-blue-500 bg-blue-500/10' : 'border-black/10 dark:border-white/10 bg-white dark:bg-black/20 hover:bg-black/[0.03] dark:hover:bg-white/[0.06]'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{preset.label}</p>
                        <p className="text-[11px] text-gray-500 truncate">{preset.useCase}</p>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-black/[0.04] dark:bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">{preset.kind}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-gray-500">{preset.description}</p>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-black/5 dark:border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={submit} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600">Insertar</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
