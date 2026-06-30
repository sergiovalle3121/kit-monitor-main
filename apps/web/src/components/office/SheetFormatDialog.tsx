'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Hash, Palette, AlignLeft, AlignCenter, AlignRight, WrapText } from 'lucide-react';
import {
  formatNumber, NUMFMT_PRESETS, CELL_STYLES, type CellStyle,
} from '@/lib/office/sheetOps';

export interface NumberFmtPayload { range: string; sheetIndex: number; code: string; currency: string }
export interface StylePayload { range: string; sheetIndex: number; style: CellStyle }

/** Diálogo de formato: formatos de número (con vista previa) y estilos de celda. */
export function SheetFormatDialog({
  sheetNames, defaultRange, defaultSheetIndex, onApplyNumber, onApplyStyle, onClose,
}: {
  sheetNames: string[];
  defaultRange: string;
  defaultSheetIndex: number;
  onApplyNumber: (p: NumberFmtPayload) => void;
  onApplyStyle: (p: StylePayload) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'number' | 'style'>('number');
  const [range, setRange] = useState(defaultRange || 'A1:A10');
  const [sheetIndex, setSheetIndex] = useState(defaultSheetIndex || 0);
  const [presetId, setPresetId] = useState('int');
  const [custom, setCustom] = useState('');
  const [currency, setCurrency] = useState('$');
  const [sample, setSample] = useState('1234.567');

  const code = custom.trim() || (NUMFMT_PRESETS.find((p) => p.id === presetId)?.code ?? 'General');
  const field = 'h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';
  const preview = (() => { const n = Number(sample); return formatNumber(Number.isNaN(n) ? sample : n, code, { currency }); })();

  const header = (
    <>
      {sheetNames.length > 1 && (
        <label className="block text-xs text-gray-500">Hoja
          <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={`${field} w-full`}>
            {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
          </select>
        </label>
      )}
      <label className="block text-xs text-gray-500">Rango
        <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:B20" className={`${field} w-full font-mono`} />
      </label>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="text-lg font-bold">Formato de celdas</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-1 px-5 pt-3 flex-shrink-0">
          {([['number', 'Número', Hash], ['style', 'Estilos', Palette]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-sm font-semibold transition-colors ${tab === id ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          {header}

          {tab === 'number' ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {NUMFMT_PRESETS.map((p) => (
                  <button key={p.id} onClick={() => { setPresetId(p.id); setCustom(''); }}
                    className={`text-left px-3 py-2 rounded-xl border text-sm transition-colors ${!custom && presetId === p.id ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-white/10 hover:border-emerald-300'}`}>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono truncate">{p.sample}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <label className="text-xs text-gray-500 flex-1">Código personalizado
                  <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder='#,##0.00 · 0.0% · dd/mm/yyyy' className={`${field} w-full font-mono`} />
                </label>
                <label className="text-xs text-gray-500 w-24">Moneda
                  <input value={currency} onChange={(e) => setCurrency(e.target.value)} className={`${field} w-full`} />
                </label>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] p-3">
                <input value={sample} onChange={(e) => setSample(e.target.value)} className="w-28 h-8 text-sm rounded-lg bg-white dark:bg-white/10 px-2 outline-none font-mono" />
                <span className="text-gray-500 dark:text-gray-400">→</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{preview}</span>
                <code className="ml-auto text-[10px] text-gray-500 dark:text-gray-400 truncate">{code}</code>
              </div>
              <button onClick={() => onApplyNumber({ range, sheetIndex, code, currency })}
                className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90">Aplicar formato de número</button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {CELL_STYLES.map((s) => (
                  <button key={s.id} onClick={() => onApplyStyle({ range, sheetIndex, style: s.style })}
                    className="px-2 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-emerald-400 transition-colors text-sm"
                    style={{ background: s.style.bg ?? undefined, color: s.style.fc ?? undefined, fontWeight: s.style.bold ? 700 : 400, fontStyle: s.style.italic ? 'italic' : undefined }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="border-t border-black/5 dark:border-white/10 pt-3">
                <p className="text-xs text-gray-500 mb-1.5">Alineación y ajuste</p>
                <div className="flex flex-wrap gap-1.5">
                  <StyleBtn icon={AlignLeft} label="Izquierda" onClick={() => onApplyStyle({ range, sheetIndex, style: { align: 'left' } })} />
                  <StyleBtn icon={AlignCenter} label="Centrar" onClick={() => onApplyStyle({ range, sheetIndex, style: { align: 'center' } })} />
                  <StyleBtn icon={AlignRight} label="Derecha" onClick={() => onApplyStyle({ range, sheetIndex, style: { align: 'right' } })} />
                  <StyleBtn icon={WrapText} label="Ajustar texto" onClick={() => onApplyStyle({ range, sheetIndex, style: { wrap: true } })} />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Los estilos se aplican al rango indicado al instante.</p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StyleBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-medium hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10">
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
