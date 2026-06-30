'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Chart as ChartJS, CategoryScale, LinearScale, RadialLinearScale, BarElement, LineElement,
  PointElement, ArcElement, BubbleController, Tooltip, Legend, Title, Filler,
  BarController, LineController, PieController, DoughnutController, ScatterController, RadarController, PolarAreaController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { BarChart3, Plus, Trash2, ChevronUp, ChevronDown, X, Pencil } from 'lucide-react';
import { buildChartData, chartJsType, usesSecondaryAxis, seriesLabels, CHART_TYPES, PALETTES, type ChartConfig, type ChartType, type LegendPos, type SeriesOpt, type SeriesKind, type ChartSourceKind } from '@/lib/office/charts';

ChartJS.register(
  CategoryScale, LinearScale, RadialLinearScale, BarElement, LineElement, PointElement, ArcElement, BubbleController,
  Tooltip, Legend, Title, Filler,
  BarController, LineController, PieController, DoughnutController, ScatterController, RadarController, PolarAreaController,
);

const uid = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function SheetCharts({
  charts, sheets, tables = [], pivots = [], readOnly, onAdd, onRemove, onUpdate,
}: {
  charts: ChartConfig[];
  sheets: any[];
  tables?: StoredTable[];
  pivots?: StoredPivot[];
  readOnly?: boolean;
  onAdd: (c: ChartConfig) => void;
  onRemove: (id: string) => void;
  onUpdate?: (c: ChartConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-white/10 bg-white dark:bg-[#0e0e0e]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 h-9 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5"
      >
        <BarChart3 className="w-4 h-4 text-emerald-500" /> Gráficas
        <span className="text-gray-500 dark:text-gray-400">({charts.length})</span>
        <span className="ml-auto">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 320 }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="h-[320px] overflow-x-auto overflow-y-hidden flex gap-3 p-3">
              {charts.map((cfg) => (
                <ChartCard key={cfg.id} cfg={cfg} sheets={sheets} sheetsCount={sheets.length} sheet={sheets[cfg.sheetIndex] ?? sheets[0]} tables={tables} pivots={pivots} readOnly={readOnly}
                  onRemove={() => onRemove(cfg.id)} onUpdate={onUpdate} />
              ))}
              {!readOnly && (
                adding
                  ? <ChartForm sheets={sheets} sheetsCount={sheets.length} tables={tables} pivots={pivots} onCancel={() => setAdding(false)} onSubmit={(c) => { onAdd({ ...c, id: uid() }); setAdding(false); }} submitLabel="Crear" />
                  : (
                    <button onClick={() => setAdding(true)} className="flex-shrink-0 w-40 h-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/15 flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-emerald-500 hover:border-emerald-400 transition-colors">
                      <Plus className="w-6 h-6" /> <span className="text-xs font-semibold">Nueva gráfica</span>
                    </button>
                  )
              )}
              {charts.length === 0 && readOnly && (
                <div className="flex items-center justify-center w-full text-sm text-gray-500 dark:text-gray-400">Sin gráficas.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type StoredTable = { name: string; sheetIndex: number; range: string };
type StoredPivot = { id: string; sheetName: string; config?: any };

function usedSheetRange(sheet: any): string | null {
  const cells = (sheet?.celldata ?? []).filter((c: any) => c?.v != null && c.v !== '');
  if (!cells.length) return null;
  const col = (n: number) => { let s = ''; let x = n + 1; while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); } return s; };
  const r1 = Math.min(...cells.map((c: any) => c.r)); const r2 = Math.max(...cells.map((c: any) => c.r));
  const c1 = Math.min(...cells.map((c: any) => c.c)); const c2 = Math.max(...cells.map((c: any) => c.c));
  return `${col(c1)}${r1 + 1}:${col(c2)}${r2 + 1}`;
}

function chartOptions(cfg: ChartConfig) {
  const radial = cfg.type === 'radar' || cfg.type === 'polarArea';
  const circular = radial || cfg.type === 'pie' || cfg.type === 'doughnut' || cfg.type === 'gauge';
  const axisTitle = (t?: string) => (t ? { display: true, text: t, font: { size: 11 } } : undefined);
  const cartesian: any = {
    x: { stacked: !!cfg.stacked, title: axisTitle(cfg.xTitle) },
    y: { stacked: !!cfg.stacked, beginAtZero: true, title: axisTitle(cfg.yTitle) },
  };
  if (usesSecondaryAxis(cfg)) {
    cartesian.y1 = { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: axisTitle(cfg.type === 'pareto' ? (cfg.y1Title || 'Acumulado %') : cfg.y1Title), ticks: cfg.type === 'pareto' ? { callback: (v: any) => `${v}%` } : undefined, suggestedMax: cfg.type === 'pareto' ? 100 : undefined };
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: cfg.type === 'bar' ? 'y' : 'x',
    plugins: {
      legend: cfg.legend === 'none' ? { display: false } : { display: true, position: (cfg.legend || 'bottom') as any, labels: { boxWidth: 10, font: { size: 10 } } },
      title: cfg.title ? { display: true, text: cfg.title, font: { size: 13 } } : { display: false },
    },
    scales: circular ? (radial ? { r: { beginAtZero: true } } : {}) : cartesian,
    circumference: cfg.type === 'gauge' ? 180 : undefined,
    rotation: cfg.type === 'gauge' ? 270 : undefined,
  } as any;
}

function ChartCard({ cfg, sheet, sheets, sheetsCount, tables, pivots, readOnly, onRemove, onUpdate }: { cfg: ChartConfig; sheet: any; sheets: any[]; sheetsCount: number; tables: StoredTable[]; pivots: StoredPivot[]; readOnly?: boolean; onRemove: () => void; onUpdate?: (c: ChartConfig) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing && onUpdate) {
    return <ChartForm sheets={sheets} sheetsCount={sheetsCount} tables={tables} pivots={pivots} initial={cfg} submitLabel="Guardar" onCancel={() => setEditing(false)} onSubmit={(c) => { onUpdate({ ...cfg, ...c }); setEditing(false); }} />;
  }
  const data = buildChartData(sheet, cfg);
  return (
    <div className="flex-shrink-0 w-80 h-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161616] p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-semibold truncate flex-1">{cfg.title || 'Gráfica'}</p>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{cfg.range}</span>
        {!readOnly && onUpdate && <button onClick={() => setEditing(true)} title="Editar" className="p-1 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10"><Pencil className="w-3.5 h-3.5" /></button>}
        {!readOnly && <button onClick={onRemove} title="Eliminar" className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="flex-1 min-h-0 relative">
        {data
          ? <Chart type={chartJsType(cfg.type) as any} data={data as any} options={chartOptions(cfg)} />
          : <div className="h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 text-center px-2">Rango inválido o sin datos.<br />Ej: A1:B8</div>}
      </div>
    </div>
  );
}

function ChartForm({ sheets, sheetsCount, tables = [], pivots = [], initial, onSubmit, onCancel, submitLabel }: { sheets: any[]; sheetsCount: number; tables?: StoredTable[]; pivots?: StoredPivot[]; initial?: ChartConfig; onSubmit: (c: Omit<ChartConfig, 'id'>) => void; onCancel: () => void; submitLabel: string }) {
  const [type, setType] = useState<ChartType>(initial?.type ?? 'bar');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [sourceKind, setSourceKind] = useState<ChartSourceKind>(initial?.source?.kind ?? 'range');
  const [sourceId, setSourceId] = useState(initial?.source?.id ?? '');
  const [range, setRange] = useState(initial?.range ?? 'A1:B8');
  const [sheetIndex, setSheetIndex] = useState(initial?.sheetIndex ?? 0);
  const [legend, setLegend] = useState<LegendPos>(initial?.legend ?? 'bottom');
  const [palette, setPalette] = useState(initial?.palette ?? 'brand');
  const [stacked, setStacked] = useState(!!initial?.stacked);
  const [xTitle, setXTitle] = useState(initial?.xTitle ?? '');
  const [yTitle, setYTitle] = useState(initial?.yTitle ?? '');
  const [y1Title, setY1Title] = useState(initial?.y1Title ?? '');
  const [series, setSeries] = useState<SeriesOpt[]>(initial?.series ?? []);
  const [showSeries, setShowSeries] = useState(false);
  const field = 'w-full h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2 outline-none focus:ring-2 ring-emerald-500/40';

  const labels = seriesLabels(sheets?.[sheetIndex], range);
  const cartesian = type === 'column' || type === 'bar' || type === 'line' || type === 'area' || type === 'combo' || type === 'pareto';
  const setSeriesAt = (i: number, patch: Partial<SeriesOpt>) => setSeries((p) => { const c = [...p]; c[i] = { ...c[i], ...patch }; return c; });
  const anySecondary = type === 'pareto' || series.some((s) => s?.axis === 'y1');

  function applySource(kind: ChartSourceKind, id = '') {
    setSourceKind(kind); setSourceId(id);
    if (kind === 'table') { const t = tables.find((x) => x.name === id) ?? tables[0]; if (t) { setSheetIndex(t.sheetIndex); setRange(t.range); setSourceId(t.name); } }
    if (kind === 'pivot') { const p = pivots.find((x) => x.id === id) ?? pivots[0]; const idx = p ? sheets.findIndex((sh) => sh?.name === p.sheetName) : -1; const used = idx >= 0 ? usedSheetRange(sheets[idx]) : null; if (p && idx >= 0 && used) { setSheetIndex(idx); setRange(used); setSourceId(p.id); } }
  }
  const preview = buildChartData(sheets?.[sheetIndex], { id: initial?.id ?? 'preview', type, title, range, sheetIndex, legend, palette, stacked, xTitle, yTitle, y1Title, series });

  return (
    <div className="flex-shrink-0 w-72 h-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161616] p-3 flex flex-col gap-1.5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{initial ? 'Editar gráfica' : 'Nueva gráfica'}</p>
        <button onClick={onCancel} className="p-1 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
      <label className="text-[11px] text-gray-500">Título<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mi gráfica" className={field} /></label>
      <label className="text-[11px] text-gray-500">Tipo
        <select value={type} onChange={(e) => setType(e.target.value as ChartType)} className={field}>
          {CHART_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2"><label className="text-[11px] text-gray-500">Fuente<select value={sourceKind} onChange={(e) => applySource(e.target.value as ChartSourceKind)} className={field}><option value="range">Rango</option><option value="table" disabled={!tables.length}>Tabla</option><option value="pivot" disabled={!pivots.length}>Pivot</option></select></label>{sourceKind !== 'range' && <label className="text-[11px] text-gray-500">Origen<select value={sourceId} onChange={(e) => applySource(sourceKind, e.target.value)} className={field}>{sourceKind === 'table' ? tables.map((t) => <option key={t.name} value={t.name}>{t.name}</option>) : pivots.map((p) => <option key={p.id} value={p.id}>{p.sheetName}</option>)}</select></label>}</div><label className="text-[11px] text-gray-500">Rango de datos<input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:B8" className={field} /></label>
      <div className="flex gap-2">
        <label className="text-[11px] text-gray-500 flex-1">Leyenda
          <select value={legend} onChange={(e) => setLegend(e.target.value as LegendPos)} className={field}>
            <option value="bottom">Abajo</option><option value="top">Arriba</option>
            <option value="right">Derecha</option><option value="left">Izquierda</option>
            <option value="none">Ocultar</option>
          </select>
        </label>
        <label className="text-[11px] text-gray-500 flex-1">Paleta
          <select value={palette} onChange={(e) => setPalette(e.target.value)} className={field}>
            {Object.keys(PALETTES).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      {(type === 'column' || type === 'bar' || type === 'area') && (
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer"><input type="checkbox" checked={stacked} onChange={(e) => setStacked(e.target.checked)} /> Apilado</label>
      )}
      {cartesian && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-gray-500">Eje X<input value={xTitle} onChange={(e) => setXTitle(e.target.value)} placeholder="Título X" className={field} /></label>
          <label className="text-[11px] text-gray-500">Eje Y<input value={yTitle} onChange={(e) => setYTitle(e.target.value)} placeholder="Título Y" className={field} /></label>
          {anySecondary && <label className="text-[11px] text-gray-500 col-span-2">Eje Y secundario<input value={y1Title} onChange={(e) => setY1Title(e.target.value)} placeholder="Título Y2" className={field} /></label>}
        </div>
      )}
      {cartesian && labels.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-white/10 p-2">
          <button onClick={() => setShowSeries((s) => !s)} className="w-full flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-300">
            Series y ejes ({labels.length}) {showSeries ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          {showSeries && (
            <div className="mt-1.5 space-y-1.5">
              {labels.map((lbl, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input type="color" value={series[i]?.color ?? PALETTES[palette]?.[i % (PALETTES[palette]?.length || 1)] ?? '#3b82f6'}
                    onChange={(e) => setSeriesAt(i, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer bg-transparent flex-shrink-0" title="Color" />
                  <span className="text-[11px] truncate flex-1" title={lbl}>{lbl}</span>
                  {type === 'combo' && (
                    <select value={series[i]?.type ?? (i === 0 ? 'bar' : 'line')} onChange={(e) => setSeriesAt(i, { type: e.target.value as SeriesKind })} className="h-6 text-[10px] rounded bg-gray-100 dark:bg-white/10 px-0.5 outline-none" title="Tipo de serie">
                      <option value="bar">Barra</option><option value="line">Línea</option><option value="area">Área</option>
                    </select>
                  )}
                  <select value={series[i]?.axis ?? 'y'} onChange={(e) => setSeriesAt(i, { axis: e.target.value as 'y' | 'y1' })} className="h-6 text-[10px] rounded bg-gray-100 dark:bg-white/10 px-0.5 outline-none" title="Eje">
                    <option value="y">Y</option><option value="y1">Y2</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="min-h-32 rounded-xl border border-gray-200 dark:border-white/10 p-2"><p className="mb-1 text-[11px] font-semibold text-gray-500">Preview</p>{preview ? <div className="h-28"><Chart type={chartJsType(type) as any} data={preview as any} options={chartOptions({ id: 'preview', type, title, range, sheetIndex, legend, palette, stacked, xTitle, yTitle, y1Title, series } as ChartConfig)} /></div> : <div className="flex h-28 items-center justify-center text-center text-[11px] text-gray-500 dark:text-gray-400">Selecciona un origen con encabezados y valores numéricos.</div>}</div>
      {sheetsCount > 1 && (
        <label className="text-[11px] text-gray-500">Hoja
          <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={field}>
            {Array.from({ length: sheetsCount }).map((_, i) => <option key={i} value={i}>{sheets?.[i]?.name || `Hoja ${i + 1}`}</option>)}
          </select>
        </label>
      )}
      <button onClick={() => onSubmit({ type, title: title.trim(), range: range.trim(), sheetIndex, legend, palette, stacked, source: { kind: sourceKind, id: sourceId || undefined, label: sourceKind === 'range' ? range.trim() : undefined }, xTitle: xTitle.trim() || undefined, yTitle: yTitle.trim() || undefined, y1Title: y1Title.trim() || undefined, series: cartesian ? series.slice(0, labels.length) : undefined })}
        className="mt-auto h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90">
        {submitLabel}
      </button>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{type === 'bubble' ? 'Columnas: X, Y, Tamaño (3 columnas).' : '1ª fila = títulos de serie; 1ª columna = etiquetas.'}</p>
    </div>
  );
}
