'use client';
 

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { type TableSpec, normalizeCells } from './slides/table';

/** Editor de tabla: celdas editables + filas/columnas + encabezado/bandeado. */
export function SlideTableEditor({ spec: initial, onApply, onClose }: {
  spec: TableSpec; onApply: (spec: TableSpec) => void; onClose: () => void;
}) {
  const [spec, setSpec] = useState<TableSpec>(() => ({ ...initial, cells: normalizeCells(initial) }));

  function setCell(r: number, c: number, v: string) {
    setSpec((s) => { const cells = s.cells.map((row) => row.slice()); cells[r][c] = v; return { ...s, cells }; });
  }
  function addRow() { setSpec((s) => ({ ...s, rows: s.rows + 1, cells: [...s.cells.map((r) => r.slice()), Array(s.cols).fill('')] })); }
  function delRow() { setSpec((s) => (s.rows <= 1 ? s : { ...s, rows: s.rows - 1, cells: s.cells.slice(0, -1) })); }
  function addCol() { setSpec((s) => ({ ...s, cols: s.cols + 1, cells: s.cells.map((r) => [...r, '']) })); }
  function delCol() { setSpec((s) => (s.cols <= 1 ? s : { ...s, cols: s.cols - 1, cells: s.cells.map((r) => r.slice(0, -1)) })); }

  const cell = 'w-full h-8 px-2 text-sm rounded-md bg-black/[0.03] dark:bg-white/[0.05] border border-transparent focus:border-blue-500/50 outline-none text-gray-800 dark:text-gray-100';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[140] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <motion.div initial={{ scale: 0.97, y: 8 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#161616] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <h2 className="font-bold">Tabla <span className="text-sm font-normal text-gray-400">· datos editables</span></h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Toggle label="Fila de encabezado" on={spec.header} onClick={() => setSpec((s) => ({ ...s, header: !s.header }))} />
            <Toggle label="Filas alternas" on={spec.banded} onClick={() => setSpec((s) => ({ ...s, banded: !s.banded }))} />
            <span className="flex-1" />
            <button onClick={addRow} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Plus className="w-4 h-4" /> Fila</button>
            <button onClick={delRow} disabled={spec.rows <= 1} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Fila</button>
            <button onClick={addCol} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Plus className="w-4 h-4" /> Col</button>
            <button onClick={delCol} disabled={spec.cols <= 1} className="flex items-center gap-1 text-sm px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40"><Trash2 className="w-4 h-4" /> Col</button>
          </div>
          <table className="border-separate" style={{ borderSpacing: 4 }}>
            <tbody>
              {spec.cells.map((row, r) => (
                <tr key={r}>
                  {row.map((v, c) => (
                    <td key={c}><input value={v} onChange={(e) => setCell(r, c, e.target.value)} className={`${cell} min-w-[110px] ${spec.header && r === 0 ? 'font-semibold' : ''}`} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 h-16 border-t border-black/5 dark:border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">Cancelar</button>
          <button onClick={() => onApply(spec)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600">Aplicar</button>
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
