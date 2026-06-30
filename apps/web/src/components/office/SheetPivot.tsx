'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Table2, Rows3, Columns3, Sigma, Filter, GripVertical, ChevronUp, ChevronDown, Wand2 } from 'lucide-react';
import {
  pivotFields, fieldValues, usedRange, AGG_LABEL,
  type AggFn, type PivotConfig, type PivotValueField,
} from '@/lib/office/sheetOps';
import { analyzePivotDraft } from '@/lib/office/pivotGovernance';

type Zone = 'rows' | 'cols' | 'values' | 'filters';
interface FilterField { field: string; include: string[] }

const ZONE_META: { id: Zone; label: string; icon: any; hint: string }[] = [
  { id: 'filters', label: 'Filtros', icon: Filter, hint: 'Filtrar por valor' },
  { id: 'cols', label: 'Columnas', icon: Columns3, hint: 'Encabezados de columna' },
  { id: 'rows', label: 'Filas', icon: Rows3, hint: 'Etiquetas de fila (anidables)' },
  { id: 'values', label: 'Valores', icon: Sigma, hint: 'Campos a agregar' },
];
const AGGS: AggFn[] = ['sum', 'count', 'counta', 'avg', 'min', 'max', 'product', 'stdev', 'var'];

/** Constructor de tablas dinámicas: arrastra campos a Filas/Columnas/Valores/Filtros. */
export function SheetPivot({
  sheets, sheetNames, activeSheetIndex, onApply, onClose,
}: {
  sheets: any[];
  sheetNames: string[];
  activeSheetIndex: number;
  onApply: (cfg: PivotConfig, target: { mode: 'new' | 'cell'; cell?: string; name?: string }) => void;
  onClose: () => void;
}) {
  const [srcIndex, setSrcIndex] = useState(activeSheetIndex);
  const [range, setRange] = useState(() => usedRange(sheets[activeSheetIndex]) ?? 'A1:D20');
  const [rows, setRows] = useState<string[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [values, setValues] = useState<PivotValueField[]>([]);
  const [filters, setFilters] = useState<FilterField[]>([]);
  const [showSub, setShowSub] = useState(true);
  const [showRowTot, setShowRowTot] = useState(true);
  const [showColTot, setShowColTot] = useState(true);
  const [target, setTarget] = useState<'new' | 'cell'>('new');
  const [cell, setCell] = useState('A1');
  const [drag, setDrag] = useState<string | null>(null);
  const [overZone, setOverZone] = useState<Zone | null>(null);
  const [filterEditing, setFilterEditing] = useState<string | null>(null);

  const fields = useMemo(() => pivotFields(sheets[srcIndex], range), [sheets, srcIndex, range]);
  const used = new Set<string>([...rows, ...cols, ...values.map((v) => v.field), ...filters.map((f) => f.field)]);
  const available = fields.filter((f) => !used.has(f));

  // Si cambia la fuente, propone un rango y limpia zonas con campos inexistentes.
  useEffect(() => {
    queueMicrotask(() => {
      const r = usedRange(sheets[srcIndex]); if (r) setRange(r);
      setRows([]); setCols([]); setValues([]); setFilters([]);
    });
  }, [srcIndex, sheets]);

  const field = 'h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';
  const numAgg = (f: string): AggFn => {
    // Heurística: campos numéricos → suma; texto → cuenta.
    const read = fieldValues(sheets[srcIndex], range, f);
    const numeric = read.length > 0 && read.every((v) => v === '' || !Number.isNaN(Number(v)));
    return numeric ? 'sum' : 'counta';
  };

  function addTo(zone: Zone, f: string) {
    if (!f) return;
    setRows((p) => p.filter((x) => x !== f)); setCols((p) => p.filter((x) => x !== f));
    setValues((p) => p.filter((x) => x.field !== f)); setFilters((p) => p.filter((x) => x.field !== f));
    if (zone === 'rows') setRows((p) => [...p, f]);
    else if (zone === 'cols') setCols((p) => [...p, f]);
    else if (zone === 'values') setValues((p) => [...p, { field: f, agg: numAgg(f) }]);
    else setFilters((p) => [...p, { field: f, include: fieldValues(sheets[srcIndex], range, f) }]);
  }
  const removeFrom = (zone: Zone, f: string) => {
    if (zone === 'rows') setRows((p) => p.filter((x) => x !== f));
    else if (zone === 'cols') setCols((p) => p.filter((x) => x !== f));
    else if (zone === 'values') setValues((p) => p.filter((x) => x.field !== f));
    else setFilters((p) => p.filter((x) => x.field !== f));
  };
  const move = (zone: Zone, f: string, dir: -1 | 1) => {
    const swap = (arr: any[], key: (x: any) => string) => {
      const i = arr.findIndex((x) => key(x) === f); const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const c = [...arr];[c[i], c[j]] = [c[j], c[i]]; return c;
    };
    if (zone === 'rows') setRows((p) => swap(p, (x) => x)); else if (zone === 'cols') setCols((p) => swap(p, (x) => x));
    else if (zone === 'values') setValues((p) => swap(p, (x) => x.field));
  };

  const draftConfig = useMemo<PivotConfig>(() => ({
    range, sheetIndex: srcIndex, rows, cols, values,
    filters: filters.filter((f) => f.include.length), showSubtotals: showSub,
    showRowTotals: showRowTot, showColTotals: showColTot,
  }), [range, srcIndex, rows, cols, values, filters, showSub, showRowTot, showColTot]);
  const draft = useMemo(() => analyzePivotDraft(sheets, draftConfig), [sheets, draftConfig]);

  function build(): PivotConfig {
    return draftConfig;
  }
  const canApply = draft.canCreate;

  const zoneItems = (z: Zone): string[] =>
    z === 'rows' ? rows : z === 'cols' ? cols : z === 'values' ? values.map((v) => v.field) : filters.map((f) => f.field);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[90vh] rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <Table2 className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Tabla dinámica</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">Arrastra campos a las áreas</span>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Origen */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-500 flex-1 min-w-[120px]">Hoja de origen
              <select value={srcIndex} onChange={(e) => setSrcIndex(Number(e.target.value))} className={`${field} w-full`}>
                {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500 flex-1 min-w-[120px]">Rango de datos
              <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="A1:E100" className={`${field} w-full font-mono`} />
            </label>
            <button onClick={() => { const r = usedRange(sheets[srcIndex]); if (r) setRange(r); }}
              className="h-9 px-3 rounded-xl bg-gray-100 dark:bg-white/10 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-gray-200 dark:hover:bg-white/15">
              <Wand2 className="w-3.5 h-3.5" /> Detectar
            </button>
          </div>
          {!fields.length && <p className="text-xs text-amber-600">No se detectaron campos. Revisa el rango (1ª fila = encabezados).</p>}

          {/* Campos disponibles */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Campos ({available.length})</p>
            <div className="flex flex-wrap gap-1.5 min-h-[2rem] rounded-xl border border-dashed border-gray-200 dark:border-white/10 p-2"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => { if (drag) { removeFrom('rows', drag); removeFrom('cols', drag); removeFrom('values', drag); removeFrom('filters', drag); } setDrag(null); }}>
              {available.map((f) => (
                <button key={f} draggable onDragStart={() => setDrag(f)} onDragEnd={() => setDrag(null)}
                  onClick={() => addTo(numAgg(f) === 'sum' ? 'values' : 'rows', f)}
                  className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200/60 dark:border-emerald-500/20 cursor-grab active:cursor-grabbing hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                  <GripVertical className="w-3 h-3 opacity-50" /> {f}
                </button>
              ))}
              {!available.length && <span className="text-xs text-gray-500 dark:text-gray-400">Todos los campos están en uso.</span>}
            </div>
          </div>

          {/* Zonas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ZONE_META.map((zm) => {
              const Icon = zm.icon;
              const items = zoneItems(zm.id);
              const over = overZone === zm.id;
              return (
                <div key={zm.id}
                  onDragOver={(e) => { e.preventDefault(); setOverZone(zm.id); }}
                  onDragLeave={() => setOverZone((z) => (z === zm.id ? null : z))}
                  onDrop={() => { if (drag) addTo(zm.id, drag); setDrag(null); setOverZone(null); }}
                  className={`rounded-2xl border p-3 transition-colors ${over ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-white/10'}`}>
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <Icon className="w-4 h-4 text-emerald-500" /> {zm.label}
                    <span className="text-gray-500 dark:text-gray-400 font-normal">· {zm.hint}</span>
                  </div>
                  <div className="space-y-1.5 min-h-[2rem]">
                    {items.length === 0 && <p className="text-[11px] text-gray-500 dark:text-gray-400">Suelta campos aquí.</p>}
                    {items.map((f, i) => (
                      <div key={f} className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/[0.06] rounded-lg px-2 py-1 text-xs">
                        <span className="flex-1 truncate font-medium">{f}</span>
                        {zm.id === 'values' && (
                          <>
                            <select value={values.find((v) => v.field === f)?.agg ?? 'sum'}
                              onChange={(e) => setValues((p) => p.map((v) => (v.field === f ? { ...v, agg: e.target.value as AggFn } : v)))}
                              className="h-6 text-[11px] rounded-md bg-white dark:bg-white/10 px-1 outline-none" title="Función de agregación">
                              {AGGS.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
                            </select>
                            <select value={values.find((v) => v.field === f)?.showAs ?? 'normal'}
                              onChange={(e) => setValues((p) => p.map((v) => (v.field === f ? { ...v, showAs: e.target.value as any } : v)))}
                              className="h-6 text-[10px] rounded-md bg-white dark:bg-white/10 px-0.5 outline-none" title="Mostrar valores como">
                              <option value="normal">Valor</option>
                              <option value="pctTotal">% total</option>
                            </select>
                          </>
                        )}
                        {zm.id === 'filters' && (
                          <button onClick={() => setFilterEditing(filterEditing === f ? null : f)}
                            className="text-[11px] px-1.5 h-6 rounded-md bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/15">
                            {filters.find((x) => x.field === f)?.include.length ?? 0} val.
                          </button>
                        )}
                        {(zm.id === 'rows' || zm.id === 'cols' || zm.id === 'values') && i > 0 && (
                          <button onClick={() => move(zm.id, f, -1)} className="p-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><ChevronUp className="w-3.5 h-3.5" /></button>
                        )}
                        {(zm.id === 'rows' || zm.id === 'cols' || zm.id === 'values') && i < items.length - 1 && (
                          <button onClick={() => move(zm.id, f, 1)} className="p-0.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"><ChevronDown className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => removeFrom(zm.id, f)} className="p-0.5 text-gray-500 dark:text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    {/* Editor de filtro por valores */}
                    {zm.id === 'filters' && filterEditing && items.includes(filterEditing) && (
                      <FilterValues
                        all={fieldValues(sheets[srcIndex], range, filterEditing)}
                        selected={filters.find((f) => f.field === filterEditing)?.include ?? []}
                        onChange={(sel) => setFilters((p) => p.map((f) => (f.field === filterEditing ? { ...f, include: sel } : f)))}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Opciones */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showSub} onChange={(e) => setShowSub(e.target.checked)} /> Subtotales (filas anidadas)</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showRowTot} onChange={(e) => setShowRowTot(e.target.checked)} /> Totales de fila</label>
            <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showColTot} onChange={(e) => setShowColTot(e.target.checked)} /> Total general</label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-500">Ubicar resultado
              <select value={target} onChange={(e) => setTarget(e.target.value as any)} className={`${field} w-44`}>
                <option value="new">Hoja nueva</option>
                <option value="cell">En la hoja actual…</option>
              </select>
            </label>
            {target === 'cell' && (
              <label className="text-xs text-gray-500">Celda superior izq.
                <input value={cell} onChange={(e) => setCell(e.target.value)} placeholder="H1" className={`${field} w-28 font-mono`} />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.04] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Preview y diagnostico</div>
                <p className="mt-1 text-xs text-gray-500">{draft.summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${pivotStatusClass(draft.status)}`}>{draft.status}</span>
                <span className="rounded-full border border-black/10 dark:border-white/10 px-2 py-0.5 text-[10px] font-semibold">{draft.resultRows} x {draft.resultCols}</span>
              </div>
            </div>
            {draft.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {draft.warnings.slice(0, 4).map((warning) => (
                  <div key={warning} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-200">{warning}</div>
                ))}
              </div>
            )}
            {draft.preview.rows.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-black/20">
                <div className="max-h-56 overflow-auto">
                  <table className="min-w-full table-fixed text-left text-[11px]">
                    <tbody>
                      {draft.preview.rows.map((row, r) => (
                        <tr key={r} className={r === 0 ? 'bg-gray-100 font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-200' : 'border-t border-black/5 dark:border-white/10'}>
                          {row.map((cellValue, c) => (
                            <td key={`${r}_${c}`} className="max-w-[150px] truncate px-2.5 py-1.5">{cellValue || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(draft.preview.truncatedRows || draft.preview.truncatedColumns) && (
                  <div className="border-t border-black/5 px-2.5 py-1.5 text-[10px] text-gray-500 dark:border-white/10">
                    Preview limitado para mantener el builder ligero; la tabla completa se genera al crear.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-black/10 p-3 text-[11px] text-gray-500 dark:border-white/10">Configura campos validos para ver el preview antes de insertar.</div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 px-5 h-16 border-t border-black/5 dark:border-white/10">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 flex-1">{draft.summary}</p>
          <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10">Cancelar</button>
          <button disabled={!canApply} onClick={() => onApply(build(), { mode: target, cell })}
            className="h-10 px-5 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 disabled:opacity-40">
            Crear tabla dinámica
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function pivotStatusClass(status: ReturnType<typeof analyzePivotDraft>['status']): string {
  if (status === 'ready') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200';
  if (status === 'warnings') return 'bg-amber-500/15 text-amber-700 dark:text-amber-200';
  if (status === 'needs-fields') return 'bg-gray-500/15 text-gray-600 dark:text-gray-300';
  return 'bg-red-500/15 text-red-700 dark:text-red-200';
}

function FilterValues({ all, selected, onChange }: { all: string[]; selected: string[]; onChange: (s: string[]) => void }) {
  const sel = new Set(selected);
  const toggle = (v: string) => { const n = new Set(sel); if (n.has(v)) n.delete(v); else n.add(v); onChange([...n]); };
  return (
    <div className="mt-1 rounded-lg border border-gray-200 dark:border-white/10 p-2 max-h-32 overflow-y-auto bg-white dark:bg-[#111]">
      <div className="flex gap-2 mb-1 text-[11px]">
        <button onClick={() => onChange([...all])} className="text-emerald-600 hover:underline">Todos</button>
        <button onClick={() => onChange([])} className="text-gray-500 hover:underline">Ninguno</button>
      </div>
      {all.map((v) => (
        <label key={v} className="flex items-center gap-1.5 text-[11px] py-0.5 cursor-pointer">
          <input type="checkbox" checked={sel.has(v)} onChange={() => toggle(v)} /> <span className="truncate">{v || '(vacío)'}</span>
        </label>
      ))}
      {!all.length && <span className="text-[11px] text-gray-500 dark:text-gray-400">Sin valores.</span>}
    </div>
  );
}
