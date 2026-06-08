'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { CondKind, CondPayload } from '@/lib/office/sheetOps';

const COLORS = ['#fee2e2', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#ffd54f', '#f8696b', '#63be7b'];

export interface ValidationPayload { range: string; options: string; sheetIndex: number }
export type { CondPayload } from '@/lib/office/sheetOps';

const KINDS: { value: CondKind; label: string }[] = [
  { value: 'compare', label: 'Comparación (>, <, =, contiene)' },
  { value: 'scale2', label: 'Escala de 2 colores' },
  { value: 'scale3', label: 'Escala de 3 colores' },
  { value: 'top', label: 'Valores superiores (N)' },
  { value: 'bottom', label: 'Valores inferiores (N)' },
  { value: 'duplicates', label: 'Valores duplicados' },
  { value: 'iconset', label: 'Conjunto de iconos' },
  { value: 'databar', label: 'Barras de datos' },
  { value: 'clear', label: 'Limpiar formato del rango' },
];
const ICON_SETS: { label: string; icons: string[] }[] = [
  { label: 'Semáforo 🔴🟡🟢', icons: ['🔴', '🟡', '🟢'] },
  { label: 'Flechas ⬇️➡️⬆️', icons: ['⬇️', '➡️', '⬆️'] },
  { label: 'Triángulos ▼▬▲', icons: ['▼', '▬', '▲'] },
];

/** Validación de datos (listas) y formato condicional avanzado. */
export function SheetTools({
  mode, sheetNames, onApplyValidation, onApplyCondFormat, onClose,
}: {
  mode: 'validation' | 'condformat';
  sheetNames: string[];
  onApplyValidation: (p: ValidationPayload) => void;
  onApplyCondFormat: (p: CondPayload) => void;
  onClose: () => void;
}) {
  const [range, setRange] = useState('A1:A10');
  const [options, setOptions] = useState('Sí, No, Pendiente');
  const [sheetIndex, setSheetIndex] = useState(0);
  // Formato condicional
  const [kind, setKind] = useState<CondKind>('compare');
  const [op, setOp] = useState('>');
  const [value, setValue] = useState('0');
  const [color, setColor] = useState(COLORS[2]);
  const [c1, setC1] = useState('#f8696b');
  const [c2, setC2] = useState('#ffeb84');
  const [c3, setC3] = useState('#63be7b');
  const [n, setN] = useState(3);
  const [iconIdx, setIconIdx] = useState(0);
  const field = 'w-full h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  const swatches = (cur: string, set: (c: string) => void) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {COLORS.map((c) => (
        <button key={c} onClick={() => set(c)} className={`w-7 h-7 rounded-full border-2 ${cur === c ? 'border-black dark:border-white' : 'border-gray-200 dark:border-white/20'}`} style={{ background: c }} />
      ))}
      <label className="ml-1 cursor-pointer relative inline-flex">
        <span className="w-7 h-7 rounded-full border border-gray-300 inline-block" style={{ background: 'conic-gradient(red,orange,yellow,green,blue,violet,red)' }} />
        <input type="color" onChange={(e) => set(e.target.value)} className="w-0 h-0 opacity-0 absolute inset-0" />
      </label>
    </div>
  );

  function applyCond() {
    const base = { kind, range, sheetIndex } as CondPayload;
    if (kind === 'compare') Object.assign(base, { op, value, color });
    else if (kind === 'scale2') Object.assign(base, { c1, c2 });
    else if (kind === 'scale3') Object.assign(base, { c1, c2, c3 });
    else if (kind === 'top' || kind === 'bottom') Object.assign(base, { n, color });
    else if (kind === 'duplicates' || kind === 'databar') Object.assign(base, { color });
    else if (kind === 'iconset') Object.assign(base, { icons: ICON_SETS[iconIdx].icons });
    onApplyCondFormat(base);
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl p-6 space-y-3 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{mode === 'validation' ? 'Validación de datos' : 'Formato condicional'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        {sheetNames.length > 1 && (
          <label className="block text-xs text-gray-500">Hoja
            <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={field}>
              {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
            </select>
          </label>
        )}
        <label className="block text-xs text-gray-500">Rango (A1)
          <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:B20" className={field} />
        </label>

        {mode === 'validation' ? (
          <>
            <label className="block text-xs text-gray-500">Opciones de la lista (separadas por coma)
              <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Sí, No, Pendiente" className={field} />
            </label>
            <button onClick={() => onApplyValidation({ range, options, sheetIndex })}
              className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar lista desplegable</button>
          </>
        ) : (
          <>
            <label className="block text-xs text-gray-500">Tipo de regla
              <select value={kind} onChange={(e) => setKind(e.target.value as CondKind)} className={field}>
                {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </label>

            {kind === 'compare' && (
              <>
                <div className="flex gap-2">
                  <label className="flex-1 text-xs text-gray-500">Condición
                    <select value={op} onChange={(e) => setOp(e.target.value)} className={field}>
                      <option value=">">Mayor que</option><option value=">=">Mayor o igual</option>
                      <option value="<">Menor que</option><option value="<=">Menor o igual</option>
                      <option value="=">Igual a</option><option value="!=">Distinto de</option>
                      <option value="contains">Contiene</option>
                    </select>
                  </label>
                  <label className="flex-1 text-xs text-gray-500">Valor
                    <input value={value} onChange={(e) => setValue(e.target.value)} className={field} />
                  </label>
                </div>
                <div className="text-xs text-gray-500">Color de relleno<div className="mt-1">{swatches(color, setColor)}</div></div>
              </>
            )}
            {(kind === 'top' || kind === 'bottom') && (
              <>
                <label className="block text-xs text-gray-500">Cantidad (N)
                  <input type="number" min={1} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value)))} className={field} />
                </label>
                <div className="text-xs text-gray-500">Color de relleno<div className="mt-1">{swatches(color, setColor)}</div></div>
              </>
            )}
            {kind === 'duplicates' && (
              <div className="text-xs text-gray-500">Color de relleno<div className="mt-1">{swatches(color, setColor)}</div></div>
            )}
            {kind === 'databar' && (
              <>
                <div className="text-xs text-gray-500">Color de la barra<div className="mt-1">{swatches(color, setColor)}</div></div>
                <p className="text-[11px] text-gray-400">Dibuja una barra proporcional (█) en cada celda del rango.</p>
              </>
            )}
            {kind === 'scale2' && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                Mín <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} className="w-9 h-9 rounded-lg" />
                Máx <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} className="w-9 h-9 rounded-lg" />
              </div>
            )}
            {kind === 'scale3' && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                Mín <input type="color" value={c1} onChange={(e) => setC1(e.target.value)} className="w-9 h-9 rounded-lg" />
                Medio <input type="color" value={c2} onChange={(e) => setC2(e.target.value)} className="w-9 h-9 rounded-lg" />
                Máx <input type="color" value={c3} onChange={(e) => setC3(e.target.value)} className="w-9 h-9 rounded-lg" />
              </div>
            )}
            {kind === 'iconset' && (
              <label className="block text-xs text-gray-500">Conjunto
                <select value={iconIdx} onChange={(e) => setIconIdx(Number(e.target.value))} className={field}>
                  {ICON_SETS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                </select>
              </label>
            )}
            {kind === 'clear' && <p className="text-xs text-gray-400">Quita relleno, color de texto e iconos del rango indicado.</p>}

            <button onClick={applyCond}
              className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">
              {kind === 'clear' ? 'Limpiar' : 'Aplicar formato'}
            </button>
          </>
        )}
        <p className="text-[11px] text-gray-400">Se aplica sobre el rango indicado de la hoja seleccionada.</p>
      </motion.div>
    </motion.div>
  );
}
