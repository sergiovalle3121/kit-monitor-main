'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, LayoutTemplate, Plus, Trash2, X } from 'lucide-react';
import {
  INDUSTRIAL_TABLE_PRESETS,
  TABLE_PRESET_CATEGORY_LABEL,
  createTablePresetSpec,
  normalizeCells,
  type TablePresetCategory,
  type TableSpec,
} from './slides/table';

const PRESET_FILTERS: Array<TablePresetCategory | 'all'> = ['all', 'operations', 'quality', 'launch', 'supplier', 'logistics'];

/** Table editor: industrial presets, editable cells, rows/cols, header and banding. */
export function SlideTableEditor({ spec: initial, onApply, onClose }: {
  spec: TableSpec; onApply: (spec: TableSpec) => void; onClose: () => void;
}) {
  const [spec, setSpec] = useState<TableSpec>(() => ({ ...initial, cells: normalizeCells(initial) }));
  const [presetFilter, setPresetFilter] = useState<TablePresetCategory | 'all'>('all');
  const visiblePresets = useMemo(
    () => INDUSTRIAL_TABLE_PRESETS.filter((preset) => presetFilter === 'all' || preset.category === presetFilter),
    [presetFilter],
  );

  function setCell(r: number, c: number, v: string) {
    setSpec((s) => { const cells = s.cells.map((row) => row.slice()); cells[r][c] = v; return { ...s, cells }; });
  }
  function addRow() {
    setSpec((s) => ({ ...s, rows: s.rows + 1, cells: [...normalizeCells(s), Array(s.cols).fill('')], presetId: undefined, presetLabel: undefined }));
  }
  function delRow() {
    setSpec((s) => (s.rows <= 1 ? s : { ...s, rows: s.rows - 1, cells: normalizeCells(s).slice(0, -1), presetId: undefined, presetLabel: undefined }));
  }
  function addCol() {
    setSpec((s) => ({ ...s, cols: s.cols + 1, cells: normalizeCells(s).map((r) => [...r, '']), presetId: undefined, presetLabel: undefined }));
  }
  function delCol() {
    setSpec((s) => (s.cols <= 1 ? s : { ...s, cols: s.cols - 1, cells: normalizeCells(s).map((r) => r.slice(0, -1)), presetId: undefined, presetLabel: undefined }));
  }
  function applyPreset(presetId: string) {
    const preset = INDUSTRIAL_TABLE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSpec((s) => createTablePresetSpec(preset, s.accent ?? initial.accent));
  }
  function apply() {
    onApply({ ...spec, cells: normalizeCells(spec) });
  }

  const cell = 'w-full h-8 px-2 text-sm rounded-md bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none text-foreground';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#161616] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="font-bold">Tabla <span className="text-sm font-normal text-gray-500 dark:text-gray-400">· presets industriales y datos editables</span></h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-5">
          <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
            <section className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.03] p-3">
              <div className="mb-3 flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-blue-500" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Presets industriales</p>
                  <p className="text-[11px] text-gray-500">{INDUSTRIAL_TABLE_PRESETS.length} tablas editables</p>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PRESET_FILTERS.map((filter) => (
                  <button key={filter} onClick={() => setPresetFilter(filter)}
                    className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                      presetFilter === filter
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-black/10 text-gray-500 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
                    }`}>
                    {filter === 'all' ? 'Todos' : TABLE_PRESET_CATEGORY_LABEL[filter]}
                  </button>
                ))}
              </div>
              <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
                {visiblePresets.map((preset) => {
                  const active = spec.presetId === preset.id;
                  return (
                    <button key={preset.id} type="button" onClick={() => applyPreset(preset.id)}
                      className={`w-full rounded-xl border p-2 text-left transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.05]'
                      }`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md ${active ? 'bg-blue-500 text-white' : 'bg-black/5 text-gray-400 dark:bg-white/10'}`}>
                          {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <LayoutTemplate className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-gray-800 dark:text-gray-100">{preset.label}</span>
                          <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{preset.description}</span>
                          <span className="mt-1 inline-flex rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-white/[0.08]">
                            {TABLE_PRESET_CATEGORY_LABEL[preset.category]} - {preset.cells.length}x{Math.max(...preset.cells.map((row) => row.length))}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Toggle label="Fila de encabezado" on={spec.header} onClick={() => setSpec((s) => ({ ...s, header: !s.header }))} />
                <Toggle label="Filas alternas" on={spec.banded} onClick={() => setSpec((s) => ({ ...s, banded: !s.banded }))} />
                {spec.presetLabel && <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-600 dark:text-blue-300">{spec.presetLabel}</span>}
                <span className="flex-1" />
                <button onClick={addRow} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Plus className="w-4 h-4" /> Fila</button>
                <button onClick={delRow} disabled={spec.rows <= 1} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Fila</button>
                <button onClick={addCol} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Plus className="w-4 h-4" /> Col</button>
                <button onClick={delCol} disabled={spec.cols <= 1} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Col</button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-black/10 bg-white p-2 dark:border-white/10 dark:bg-black/20">
                <table className="border-separate" style={{ borderSpacing: 4 }}>
                  <tbody>
                    {normalizeCells(spec).map((row, r) => (
                      <tr key={r}>
                        {row.map((v, c) => (
                          <td key={c}><input value={v} onChange={(e) => setCell(r, c, e.target.value)} className={`${cell} min-w-[120px] ${spec.header && r === 0 ? 'font-semibold' : ''}`} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-black/5 dark:border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={apply} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600">Aplicar</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${on ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}>
      {label}
    </button>
  );
}
