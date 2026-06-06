'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend, Title,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { BarChart3, Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { buildChartData, CHART_TYPES, type ChartConfig, type ChartType } from '@/lib/office/charts';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Title);

const uid = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function SheetCharts({
  charts, sheets, readOnly, onAdd, onRemove,
}: {
  charts: ChartConfig[];
  sheets: any[];
  readOnly?: boolean;
  onAdd: (c: ChartConfig) => void;
  onRemove: (id: string) => void;
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
        <span className="text-gray-400">({charts.length})</span>
        <span className="ml-auto">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 296 }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="h-[296px] overflow-x-auto overflow-y-hidden flex gap-3 p-3">
              {charts.map((cfg) => (
                <ChartCard key={cfg.id} cfg={cfg} sheet={sheets[cfg.sheetIndex] ?? sheets[0]} readOnly={readOnly} onRemove={() => onRemove(cfg.id)} />
              ))}
              {!readOnly && (
                adding
                  ? <AddForm sheetsCount={sheets.length} onCancel={() => setAdding(false)} onCreate={(c) => { onAdd({ ...c, id: uid() }); setAdding(false); }} />
                  : (
                    <button onClick={() => setAdding(true)} className="flex-shrink-0 w-40 h-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/15 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-emerald-500 hover:border-emerald-400 transition-colors">
                      <Plus className="w-6 h-6" /> <span className="text-xs font-semibold">Nueva gráfica</span>
                    </button>
                  )
              )}
              {charts.length === 0 && readOnly && (
                <div className="flex items-center justify-center w-full text-sm text-gray-400">Sin gráficas.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChartCard({ cfg, sheet, readOnly, onRemove }: { cfg: ChartConfig; sheet: any; readOnly?: boolean; onRemove: () => void }) {
  const data = buildChartData(sheet, cfg);
  return (
    <div className="flex-shrink-0 w-80 h-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161616] p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-semibold truncate flex-1">{cfg.title || 'Gráfica'}</p>
        <span className="text-[10px] text-gray-400 font-mono">{cfg.range}</span>
        {!readOnly && <button onClick={onRemove} title="Eliminar" className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="flex-1 min-h-0 relative">
        {data
          ? <Chart type={cfg.type as any} data={data as any} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: cfg.type !== 'bar' || data.datasets.length > 1, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } } as any} />
          : <div className="h-full flex items-center justify-center text-xs text-gray-400 text-center px-2">Rango inválido o sin datos.<br />Ej: A1:B8</div>}
      </div>
    </div>
  );
}

function AddForm({ sheetsCount, onCreate, onCancel }: { sheetsCount: number; onCreate: (c: Omit<ChartConfig, 'id'>) => void; onCancel: () => void }) {
  const [type, setType] = useState<ChartType>('bar');
  const [title, setTitle] = useState('');
  const [range, setRange] = useState('A1:B8');
  const [sheetIndex, setSheetIndex] = useState(0);
  const field = 'w-full h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2 outline-none focus:ring-2 ring-emerald-500/40';

  return (
    <div className="flex-shrink-0 w-72 h-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161616] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Nueva gráfica</p>
        <button onClick={onCancel} className="p-1 rounded-lg text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
      </div>
      <label className="text-[11px] text-gray-500">Título
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mi gráfica" className={field} />
      </label>
      <label className="text-[11px] text-gray-500">Tipo
        <select value={type} onChange={(e) => setType(e.target.value as ChartType)} className={field}>
          {CHART_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="text-[11px] text-gray-500">Rango de datos
        <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:B8" className={field} />
      </label>
      {sheetsCount > 1 && (
        <label className="text-[11px] text-gray-500">Hoja
          <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={field}>
            {Array.from({ length: sheetsCount }).map((_, i) => <option key={i} value={i}>Hoja {i + 1}</option>)}
          </select>
        </label>
      )}
      <button onClick={() => onCreate({ type, title: title.trim(), range: range.trim(), sheetIndex })}
        className="mt-auto h-8 rounded-lg bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90">
        Crear
      </button>
      <p className="text-[10px] text-gray-400 leading-tight">La 1ª fila del rango son los títulos de serie; la 1ª columna, las etiquetas.</p>
    </div>
  );
}
