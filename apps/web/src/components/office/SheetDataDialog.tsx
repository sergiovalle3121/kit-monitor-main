'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { AGG_LABEL, type AggFn, type SortKey } from '@/lib/office/sheetOps';

export type DataMode = 'sort' | 'dedup' | 'split' | 'note' | 'subtotal' | 'spark' | 'fill' | 'transpose' | 'paste';
const TITLES: Record<DataMode, string> = {
  sort: 'Ordenar rango', dedup: 'Quitar duplicados', split: 'Texto en columnas',
  note: 'Nota de celda', subtotal: 'Subtotales', spark: 'Minigráfico (sparkline)',
  fill: 'Rellenar serie', transpose: 'Transponer', paste: 'Pegado especial',
};
const AGGS: AggFn[] = ['sum', 'count', 'counta', 'avg', 'min', 'max'];

/** Diálogo para operaciones de datos: ordenar (multinivel), quitar duplicados,
 *  texto en columnas, subtotales, minigráficos y notas de celda. */
export function SheetDataDialog({
  mode, sheetNames, onApply, onClose,
}: {
  mode: DataMode;
  sheetNames: string[];
  onApply: (mode: DataMode, payload: any) => void;
  onClose: () => void;
}) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const [range, setRange] = useState(
    mode === 'note' ? 'A1' : mode === 'split' ? 'A1:A20' : mode === 'spark' ? 'A1:F1'
      : mode === 'fill' ? 'A1:A3' : mode === 'transpose' || mode === 'paste' ? 'A1:B5' : 'A1:D20',
  );
  const [direction, setDirection] = useState<'down' | 'right'>('down');
  const [count, setCount] = useState(10);
  const [pasteMode, setPasteMode] = useState<'all' | 'values' | 'formats'>('all');
  const [keys, setKeys] = useState<SortKey[]>([{ colRel: 0, order: 'asc' }]);
  const [hasHeader, setHasHeader] = useState(true);
  const [delimiter, setDelimiter] = useState(',');
  const [text, setText] = useState('');
  const [groupCol, setGroupCol] = useState(1);
  const [valueCols, setValueCols] = useState('2');
  const [fn, setFn] = useState<AggFn>('sum');
  const [target, setTarget] = useState('H1');
  const [sparkType, setSparkType] = useState<'bars' | 'winloss'>('bars');
  const field = 'w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';
  const parseCols = (s: string) => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => n >= 1).map((n) => n - 1);

  function apply() {
    if (mode === 'sort') onApply('sort', { range, sheetIndex, keys, hasHeader });
    else if (mode === 'dedup') onApply('dedup', { range, sheetIndex, hasHeader });
    else if (mode === 'split') onApply('split', { range, sheetIndex, delimiter });
    else if (mode === 'subtotal') onApply('subtotal', { range, sheetIndex, groupColRel: groupCol - 1, valueColRels: parseCols(valueCols), fn, hasHeader });
    else if (mode === 'spark') onApply('spark', { dataRange: range, sheetIndex, cell: target, type: sparkType });
    else if (mode === 'fill') onApply('fill', { seedRange: range, sheetIndex, direction, count });
    else if (mode === 'transpose') onApply('transpose', { srcRange: range, sheetIndex, destCell: target });
    else if (mode === 'paste') onApply('paste', { srcRange: range, sheetIndex, destCell: target, mode: pasteMode });
    else onApply('note', { cell: range, sheetIndex, text });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{TITLES[mode]}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {sheetNames.length > 1 && (
          <label className="block text-xs text-gray-500">Hoja
            <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={field}>
              {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
            </select>
          </label>
        )}

        <label className="block text-xs text-gray-500">{mode === 'note' ? 'Celda (A1)' : mode === 'spark' ? 'Rango de datos' : mode === 'fill' ? 'Rango semilla' : (mode === 'transpose' || mode === 'paste') ? 'Rango origen' : 'Rango (A1)'}
          <input value={range} onChange={(e) => setRange(e.target.value)} placeholder={mode === 'note' ? 'B2' : 'A1:D20'} className={`${field} font-mono`} />
        </label>

        {mode === 'sort' && (
          <>
            <div className="space-y-2">
              {keys.map((k, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <label className="flex-1 text-xs text-gray-500">{i === 0 ? 'Ordenar por (columna #)' : 'Luego por (columna #)'}
                    <input type="number" min={1} value={k.colRel + 1}
                      onChange={(e) => setKeys((p) => p.map((x, j) => (j === i ? { ...x, colRel: Math.max(0, Number(e.target.value) - 1) } : x)))} className={field} />
                  </label>
                  <label className="flex-1 text-xs text-gray-500">Orden
                    <select value={k.order} onChange={(e) => setKeys((p) => p.map((x, j) => (j === i ? { ...x, order: e.target.value as any } : x)))} className={field}>
                      <option value="asc">Ascendente</option><option value="desc">Descendente</option>
                    </select>
                  </label>
                  {keys.length > 1 && <button onClick={() => setKeys((p) => p.filter((_, j) => j !== i))} className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
              {keys.length < 3 && (
                <button onClick={() => setKeys((p) => [...p, { colRel: p.length, order: 'asc' }])} className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir nivel</button>
              )}
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La primera fila es encabezado</label>
          </>
        )}
        {mode === 'dedup' && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La primera fila es encabezado</label>
        )}
        {mode === 'split' && (
          <label className="block text-xs text-gray-500">Separador
            <input value={delimiter} onChange={(e) => setDelimiter(e.target.value)} placeholder="," className={field} />
          </label>
        )}
        {mode === 'subtotal' && (
          <>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-gray-500">Agrupar por (columna #)
                <input type="number" min={1} value={groupCol} onChange={(e) => setGroupCol(Math.max(1, Number(e.target.value)))} className={field} />
              </label>
              <label className="flex-1 text-xs text-gray-500">Función
                <select value={fn} onChange={(e) => setFn(e.target.value as AggFn)} className={field}>
                  {AGGS.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs text-gray-500">Columnas de valor (#, separadas por coma)
              <input value={valueCols} onChange={(e) => setValueCols(e.target.value)} placeholder="2, 3" className={field} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La primera fila es encabezado</label>
            <p className="text-[11px] text-gray-400">Ordena antes por la columna de grupo para agrupar correctamente.</p>
          </>
        )}
        {mode === 'spark' && (
          <>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-gray-500">Celda destino
                <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="H1" className={`${field} font-mono`} />
              </label>
              <label className="flex-1 text-xs text-gray-500">Tipo
                <select value={sparkType} onChange={(e) => setSparkType(e.target.value as any)} className={field}>
                  <option value="bars">Barras ▁▂▃▅▇</option>
                  <option value="winloss">Pérdidas/ganancias ▲▼</option>
                </select>
              </label>
            </div>
            <p className="text-[11px] text-gray-400">Crea un minigráfico unicode en la celda destino a partir de los números del rango.</p>
          </>
        )}
        {mode === 'fill' && (
          <>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-gray-500">Dirección
                <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className={field}>
                  <option value="down">Hacia abajo</option><option value="right">Hacia la derecha</option>
                </select>
              </label>
              <label className="flex-1 text-xs text-gray-500">Cantidad
                <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} className={field} />
              </label>
            </div>
            <p className="text-[11px] text-gray-400">Continúa la serie de la semilla: números, fechas, meses/días o texto con número final.</p>
          </>
        )}
        {mode === 'transpose' && (
          <label className="block text-xs text-gray-500">Celda destino (superior izq.)
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="D1" className={`${field} font-mono`} />
          </label>
        )}
        {mode === 'paste' && (
          <>
            <label className="block text-xs text-gray-500">Celda destino (superior izq.)
              <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="D1" className={`${field} font-mono`} />
            </label>
            <label className="block text-xs text-gray-500">Pegar
              <select value={pasteMode} onChange={(e) => setPasteMode(e.target.value as any)} className={field}>
                <option value="all">Todo</option>
                <option value="values">Solo valores</option>
                <option value="formats">Solo formatos</option>
              </select>
            </label>
          </>
        )}
        {mode === 'note' && (
          <label className="block text-xs text-gray-500">Texto de la nota
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Comentario…" className="w-full text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 py-2 outline-none focus:ring-2 ring-emerald-500/40 resize-none" />
          </label>
        )}

        <button onClick={apply} className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar</button>
        {mode === 'split' && <p className="text-[11px] text-gray-400">Divide cada celda de la primera columna del rango y escribe las partes en las columnas a la derecha.</p>}
      </motion.div>
    </motion.div>
  );
}
