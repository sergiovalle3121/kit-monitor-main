'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { DV_OPERATORS, type CondKind, type CondPayload, type DvType, type DvOperator, type DvConfig } from '@/lib/office/sheetOps';

const COLORS = ['#fee2e2', '#fef9c3', '#dcfce7', '#dbeafe', '#f3e8ff', '#fce7f3', '#ffd54f', '#f8696b', '#63be7b'];

export interface ValidationPayload { range: string; sheetIndex: number; cfg: DvConfig; action: 'apply' | 'mark' }
export type { CondPayload } from '@/lib/office/sheetOps';

const DV_TYPES: { value: DvType; label: string }[] = [
  { value: 'dropdown', label: 'Lista desplegable' },
  { value: 'number', label: 'Número (decimal o entero)' },
  { value: 'number_integer', label: 'Número entero' },
  { value: 'number_decimal', label: 'Número decimal' },
  { value: 'date', label: 'Fecha' },
  { value: 'text_length', label: 'Longitud del texto' },
  { value: 'text_content', label: 'Texto' },
];
const DV_OP_LABEL: Record<DvOperator, string> = {
  between: 'está entre', notBetween: 'no está entre',
  equal: 'es igual a', notEqualTo: 'no es igual a',
  moreThanThe: 'es mayor que', lessThan: 'es menor que',
  greaterOrEqualTo: 'es mayor o igual que', lessThanOrEqualTo: 'es menor o igual que',
  include: 'contiene', exclude: 'no contiene',
  earlierThan: 'es anterior a', noEarlierThan: 'no es anterior a',
  laterThan: 'es posterior a', noLaterThan: 'no es posterior a',
};

const KINDS: { value: CondKind; label: string }[] = [
  { value: 'compare', label: 'Comparación (>, <, =, contiene)' },
  { value: 'scale2', label: 'Escala de 2 colores' },
  { value: 'scale3', label: 'Escala de 3 colores' },
  { value: 'top', label: 'Valores superiores (N)' },
  { value: 'bottom', label: 'Valores inferiores (N)' },
  { value: 'duplicates', label: 'Valores duplicados' },
  { value: 'unique', label: 'Valores únicos' },
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
  // Validación de datos
  const [dvType, setDvType] = useState<DvType>('dropdown');
  const [dvOp, setDvOp] = useState<DvOperator>('between');
  const [dvV1, setDvV1] = useState('');
  const [dvV2, setDvV2] = useState('');
  const [dvReject, setDvReject] = useState(true);
  const [dvHint, setDvHint] = useState('');
  const [dvFromRange, setDvFromRange] = useState(false);
  const [dvListRange, setDvListRange] = useState('A1:A10');
  // Formato condicional
  const [kind, setKind] = useState<CondKind>('compare');
  const [op, setOp] = useState('>');
  const [value, setValue] = useState('0');
  const [value2, setValue2] = useState('100');
  const [color, setColor] = useState(COLORS[2]);
  const [c1, setC1] = useState('#f8696b');
  const [c2, setC2] = useState('#ffeb84');
  const [c3, setC3] = useState('#63be7b');
  const [n, setN] = useState(3);
  const [percent, setPercent] = useState(false);
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

  const dvOps = DV_OPERATORS[dvType];
  const dvNeedsTwo = dvOp === 'between' || dvOp === 'notBetween';
  const dvCurrentOp = dvOps.includes(dvOp) ? dvOp : (dvOps[0] ?? undefined);
  function buildDvConfig(): DvConfig {
    if (dvType === 'dropdown') return { type: 'dropdown', value1: dvFromRange ? dvListRange : options, fromRange: dvFromRange, prohibitInput: dvReject, hintText: dvHint };
    return { type: dvType, operator: dvCurrentOp, value1: dvV1, value2: dvV2, prohibitInput: dvReject, hintText: dvHint };
  }
  function submitValidation(action: 'apply' | 'mark') {
    onApplyValidation({ range, sheetIndex, cfg: buildDvConfig(), action });
  }

  function applyCond() {
    const base = { kind, range, sheetIndex } as CondPayload;
    if (kind === 'compare') Object.assign(base, { op, value, value2, color });
    else if (kind === 'scale2') Object.assign(base, { c1, c2 });
    else if (kind === 'scale3') Object.assign(base, { c1, c2, c3 });
    else if (kind === 'top' || kind === 'bottom') Object.assign(base, { n, color, percent });
    else if (kind === 'duplicates' || kind === 'unique' || kind === 'databar') Object.assign(base, { color });
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
            <label className="block text-xs text-gray-500">Permitir
              <select value={dvType} onChange={(e) => setDvType(e.target.value as DvType)} className={field}>
                {DV_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            {dvType === 'dropdown' ? (
              <>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={dvFromRange} onChange={(e) => setDvFromRange(e.target.checked)} /> Tomar la lista de un rango
                </label>
                {dvFromRange ? (
                  <label className="block text-xs text-gray-500">Rango de origen (A1)
                    <input value={dvListRange} onChange={(e) => setDvListRange(e.target.value)} placeholder="A1:A10 o Hoja2!A1:A10" className={`${field} font-mono`} />
                  </label>
                ) : (
                  <label className="block text-xs text-gray-500">Opciones de la lista (separadas por coma)
                    <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Sí, No, Pendiente" className={field} />
                  </label>
                )}
              </>
            ) : dvType === 'text_content' ? (
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-gray-500">Condición
                  <select value={dvCurrentOp} onChange={(e) => setDvOp(e.target.value as DvOperator)} className={field}>
                    {dvOps.map((o) => <option key={o} value={o}>{DV_OP_LABEL[o]}</option>)}
                  </select>
                </label>
                <label className="flex-1 text-xs text-gray-500">Texto
                  <input value={dvV1} onChange={(e) => setDvV1(e.target.value)} placeholder="AXOS" className={field} />
                </label>
              </div>
            ) : (
              <>
                <label className="block text-xs text-gray-500">Condición
                  <select value={dvCurrentOp} onChange={(e) => setDvOp(e.target.value as DvOperator)} className={field}>
                    {dvOps.map((o) => <option key={o} value={o}>{DV_OP_LABEL[o]}</option>)}
                  </select>
                </label>
                <div className="flex gap-2">
                  <label className="flex-1 text-xs text-gray-500">{dvNeedsTwo ? 'Mínimo' : 'Valor'}
                    <input type={dvType === 'date' ? 'date' : 'number'} value={dvV1} onChange={(e) => setDvV1(e.target.value)} className={field} />
                  </label>
                  {dvNeedsTwo && (
                    <label className="flex-1 text-xs text-gray-500">Máximo
                      <input type={dvType === 'date' ? 'date' : 'number'} value={dvV2} onChange={(e) => setDvV2(e.target.value)} className={field} />
                    </label>
                  )}
                </div>
              </>
            )}

            <label className="block text-xs text-gray-500">Mensaje de entrada (opcional)
              <input value={dvHint} onChange={(e) => setDvHint(e.target.value)} placeholder="Aparece al seleccionar la celda" className={field} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={dvReject} onChange={(e) => setDvReject(e.target.checked)} /> Rechazar entradas no válidas
            </label>
            <div className="flex gap-2">
              <button onClick={() => submitValidation('apply')}
                className="flex-1 h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar validación</button>
              <button onClick={() => submitValidation('mark')}
                className="h-10 px-3 rounded-xl border border-gray-300 dark:border-white/15 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Marcar no válidos</button>
            </div>
            <p className="text-[11px] text-gray-400">«Rechazar» bloquea valores fuera de la regla; si no, solo avisa. «Marcar no válidos» rellena en rojo las celdas existentes que no cumplen.</p>
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
                      <option value="between">Entre</option><option value="notbetween">No entre</option>
                      <option value="contains">Contiene el texto</option>
                      <option value="notcontains">No contiene el texto</option>
                      <option value="beginsWith">Empieza por</option>
                      <option value="endsWith">Termina en</option>
                    </select>
                  </label>
                  <label className="flex-1 text-xs text-gray-500">{op === 'between' || op === 'notbetween' ? 'Mínimo' : 'Valor'}
                    <input value={value} onChange={(e) => setValue(e.target.value)} className={field} />
                  </label>
                  {(op === 'between' || op === 'notbetween') && (
                    <label className="flex-1 text-xs text-gray-500">Máximo
                      <input value={value2} onChange={(e) => setValue2(e.target.value)} className={field} />
                    </label>
                  )}
                </div>
                <div className="text-xs text-gray-500">Color de relleno<div className="mt-1">{swatches(color, setColor)}</div></div>
              </>
            )}
            {(kind === 'top' || kind === 'bottom') && (
              <>
                <label className="block text-xs text-gray-500">{percent ? 'Porcentaje (%)' : 'Cantidad (N)'}
                  <input type="number" min={1} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value)))} className={field} />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={percent} onChange={(e) => setPercent(e.target.checked)} /> Por porcentaje (p. ej. {kind === 'top' ? 'el 10% superior' : 'el 10% inferior'})
                </label>
                <div className="text-xs text-gray-500">Color de relleno<div className="mt-1">{swatches(color, setColor)}</div></div>
              </>
            )}
            {(kind === 'duplicates' || kind === 'unique') && (
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
