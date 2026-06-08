'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, BarChart3, BarChart2, LineChart, AreaChart, PieChart, CircleDashed } from 'lucide-react';
import { CHART_TYPES, CHART_PALETTES, buildChartGroup, type ChartSpec, type ChartType } from './slides/chart';

const TYPE_ICON: Record<ChartType, any> = { bar: BarChart3, hbar: BarChart2, line: LineChart, area: AreaChart, pie: PieChart, doughnut: CircleDashed };

/** Editor de gráfico: tipo + título + tabla de datos editable con vista previa. */
export function SlideChartEditor({ spec: initial, onApply, onClose }: {
  spec: ChartSpec; onApply: (spec: ChartSpec) => void; onClose: () => void;
}) {
  const [spec, setSpec] = useState<ChartSpec>(() => clone(initial));
  const [preview, setPreview] = useState('');

  const rows = spec.labels.length;
  const cols = spec.series.length;
  const paletteId = CHART_PALETTES.find((p) => p.colors[0] === spec.palette?.[0])?.id ?? 'Marca';

  // Vista previa (rasteriza el gráfico fuera de pantalla, con rebote).
  useEffect(() => {
    let active = true;
    const id = setTimeout(async () => {
      try {
        const { StaticCanvas } = await import('fabric');
        const sc = new StaticCanvas(document.createElement('canvas'), { width: 480, height: 300 });
        const g = buildChartGroup(spec, { left: 0, top: 0 });
        sc.add(g); sc.renderAll();
        const url = sc.toDataURL({ format: 'png', multiplier: 1 } as any);
        sc.dispose();
        if (active) setPreview(url);
      } catch { /* noop */ }
    }, 180);
    return () => { active = false; clearTimeout(id); };
  }, [spec]);

  function setType(type: ChartType) { setSpec((s) => ({ ...s, type })); }
  function setTitle(title: string) { setSpec((s) => ({ ...s, title })); }
  function setLabel(r: number, v: string) { setSpec((s) => { const labels = s.labels.slice(); labels[r] = v; return { ...s, labels }; }); }
  function setSeriesName(c: number, v: string) { setSpec((s) => { const series = s.series.map((x) => ({ ...x, data: x.data.slice() })); series[c].name = v; return { ...s, series }; }); }
  function setCell(r: number, c: number, v: string) {
    const n = v === '' ? 0 : Number(v);
    setSpec((s) => { const series = s.series.map((x) => ({ ...x, data: x.data.slice() })); series[c].data[r] = Number.isFinite(n) ? n : 0; return { ...s, series }; });
  }
  function addRow() { setSpec((s) => ({ ...s, labels: [...s.labels, `Cat ${s.labels.length + 1}`], series: s.series.map((x) => ({ ...x, data: [...x.data, 0] })) })); }
  function removeRow() { setSpec((s) => (s.labels.length <= 1 ? s : { ...s, labels: s.labels.slice(0, -1), series: s.series.map((x) => ({ ...x, data: x.data.slice(0, -1) })) })); }
  function addCol() { setSpec((s) => ({ ...s, series: [...s.series, { name: `Serie ${s.series.length + 1}`, data: s.labels.map(() => 0) }] })); }
  function removeCol() { setSpec((s) => (s.series.length <= 1 ? s : { ...s, series: s.series.slice(0, -1) })); }

  const cell = 'w-full h-8 px-2 text-sm rounded-md bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none text-gray-800 dark:text-gray-100';

  const pieNote = useMemo(() => spec.type === 'pie' && spec.series.length > 1, [spec.type, spec.series.length]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#161616] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="font-bold">Insertar gráfico <span className="text-sm font-normal text-gray-400">· datos editables</span></h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Tipo + título */}
          <div className="flex flex-wrap items-center gap-2">
            {CHART_TYPES.map((t) => {
              const Icon = TYPE_ICON[t.value];
              return (
                <button key={t.value} onClick={() => setType(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${spec.type === t.value ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}>
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
            <input value={spec.title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del gráfico"
              className="flex-1 min-w-[160px] h-9 px-3 text-sm rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none" />
          </div>

          {/* Opciones */}
          <div className="flex flex-wrap items-center gap-2">
            {(spec.type === 'bar' || spec.type === 'hbar') && (
              <Toggle label="Apilado" on={!!spec.stacked} onClick={() => setSpec((s) => ({ ...s, stacked: !s.stacked }))} />
            )}
            <Toggle label="Leyenda" on={spec.legend !== false} onClick={() => setSpec((s) => ({ ...s, legend: s.legend === false }))} />
            <Toggle label="Valores" on={!!spec.showValues} onClick={() => setSpec((s) => ({ ...s, showValues: !s.showValues }))} />
            <span className="text-xs text-gray-400 ml-1">Paleta</span>
            <select value={paletteId} onChange={(e) => setSpec((s) => ({ ...s, palette: CHART_PALETTES.find((p) => p.id === e.target.value)?.colors }))}
              className="h-8 text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.05] px-2 outline-none border border-transparent focus:border-blue-500/50">
              {CHART_PALETTES.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
            </select>
          </div>

          {/* Vista previa */}
          <div className="rounded-xl bg-gray-50 dark:bg-black/30 border border-black/5 dark:border-white/10 flex items-center justify-center p-2" style={{ minHeight: 170 }}>
            {preview ? <img src={preview} alt="Vista previa" className="max-h-[210px] w-auto" /> : <span className="text-sm text-gray-400">Generando vista previa…</span>}
          </div>
          {pieNote && <p className="text-xs text-amber-600 dark:text-amber-400">El pastel usa sólo la primera serie de datos.</p>}

          {/* Tabla de datos */}
          <div className="overflow-x-auto">
            <table className="border-separate" style={{ borderSpacing: 4 }}>
              <thead>
                <tr>
                  <th className="text-left"><span className="text-xs text-gray-400 px-1">Categoría</span></th>
                  {spec.series.map((s, c) => (
                    <th key={c} className="px-0.5">
                      <input value={s.name} onChange={(e) => setSeriesName(c, e.target.value)} className={`${cell} font-semibold min-w-[96px]`} />
                    </th>
                  ))}
                  <th className="pl-1">
                    <button onClick={addCol} title="Agregar serie" className="h-8 w-8 inline-flex items-center justify-center rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 text-gray-500"><Plus className="w-4 h-4" /></button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {spec.labels.map((lb, r) => (
                  <tr key={r}>
                    <td><input value={lb} onChange={(e) => setLabel(r, e.target.value)} className={`${cell} min-w-[120px]`} /></td>
                    {spec.series.map((s, c) => (
                      <td key={c}><input type="number" value={s.data[r] ?? 0} onChange={(e) => setCell(r, c, e.target.value)} className={`${cell} tabular-nums`} /></td>
                    ))}
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={addRow} className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300"><Plus className="w-4 h-4" /> Fila</button>
            <button onClick={removeRow} disabled={rows <= 1} className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Fila</button>
            <span className="w-px h-5 bg-black/10 dark:bg-white/10" />
            <button onClick={removeCol} disabled={cols <= 1} className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Serie</button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-black/5 dark:border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={() => onApply(spec)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600">Insertar</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function clone(s: ChartSpec): ChartSpec {
  return { type: s.type, title: s.title, labels: s.labels.slice(), series: s.series.map((x) => ({ name: x.name, data: x.data.slice() })), palette: s.palette?.slice(), stacked: s.stacked, legend: s.legend, showValues: s.showValues };
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${on ? 'bg-blue-500 text-white border-blue-500' : 'border-black/10 dark:border-white/15 text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}`}>
      {label}
    </button>
  );
}
