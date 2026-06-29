'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { runSheetTransform, type SheetTransformAggregate, type SheetTransformCalculatedFormula, type SheetTransformConfig, type SheetTransformFilterOp, type SheetTransformStep } from '@/lib/office/sheetTransforms';

export interface SheetTransformApplyPayload extends SheetTransformConfig {
  outputMode: 'new-sheet' | 'cell';
  targetCell?: string;
}

type TransformPreset = 'clean' | 'filter_sort' | 'group' | 'calculated' | 'split_column' | 'unpivot' | 'select_rename';

const PRESETS: { value: TransformPreset; label: string }[] = [
  { value: 'clean', label: 'Clean table' },
  { value: 'filter_sort', label: 'Filter + sort' },
  { value: 'group', label: 'Group summary' },
  { value: 'calculated', label: 'Calculated column' },
  { value: 'split_column', label: 'Split column' },
  { value: 'unpivot', label: 'Unpivot columns' },
  { value: 'select_rename', label: 'Select + rename' },
];

const FILTER_OPS: { value: SheetTransformFilterOp; label: string }[] = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: 'contains', label: 'contains' },
  { value: 'notcontains', label: 'not contains' },
  { value: 'beginsWith', label: 'begins with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'empty', label: 'empty' },
  { value: 'notempty', label: 'not empty' },
];

const AGGS: { value: SheetTransformAggregate; label: string }[] = [
  { value: 'sum', label: 'sum' },
  { value: 'avg', label: 'average' },
  { value: 'count', label: 'count' },
  { value: 'min', label: 'min' },
  { value: 'max', label: 'max' },
];

const FORMULAS: { value: SheetTransformCalculatedFormula; label: string }[] = [
  { value: 'sum', label: 'sum' },
  { value: 'difference', label: 'difference' },
  { value: 'product', label: 'product' },
  { value: 'ratio', label: 'ratio' },
];

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseRenames(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of value.split(',')) {
    const [from, to] = pair.split('=>').map((part) => part?.trim());
    if (from && to) out[from] = to;
  }
  return out;
}

function buildSteps({
  preset,
  selectColumns,
  renamePairs,
  filterColumn,
  filterOp,
  filterValue,
  sortColumn,
  sortOrder,
  groupBy,
  aggregateColumn,
  aggregateOp,
  aggregateName,
  calcName,
  calcFormula,
  calcLeft,
  calcRight,
  splitColumn,
  splitDelimiter,
  splitInto,
  splitReplace,
  unpivotKeyColumns,
  unpivotValueColumns,
  unpivotNameColumn,
  unpivotValueColumn,
  unpivotSkipBlanks,
}: {
  preset: TransformPreset;
  selectColumns: string;
  renamePairs: string;
  filterColumn: string;
  filterOp: SheetTransformFilterOp;
  filterValue: string;
  sortColumn: string;
  sortOrder: 'asc' | 'desc';
  groupBy: string;
  aggregateColumn: string;
  aggregateOp: SheetTransformAggregate;
  aggregateName: string;
  calcName: string;
  calcFormula: SheetTransformCalculatedFormula;
  calcLeft: string;
  calcRight: string;
  splitColumn: string;
  splitDelimiter: string;
  splitInto: string;
  splitReplace: boolean;
  unpivotKeyColumns: string;
  unpivotValueColumns: string;
  unpivotNameColumn: string;
  unpivotValueColumn: string;
  unpivotSkipBlanks: boolean;
}): SheetTransformStep[] {
  if (preset === 'clean') {
    return [
      { type: 'trim_clean_text' },
      { type: 'remove_blanks', mode: 'all' },
      { type: 'remove_duplicates' },
    ];
  }
  if (preset === 'filter_sort') {
    return [
      ...(filterColumn.trim() ? [{ type: 'filter_rows' as const, column: filterColumn, op: filterOp, value: filterValue }] : []),
      ...(sortColumn.trim() ? [{ type: 'sort_rows' as const, column: sortColumn, order: sortOrder }] : []),
    ];
  }
  if (preset === 'group') {
    return [
      { type: 'normalize_number', columns: [aggregateColumn] },
      { type: 'group_by', groupBy: splitList(groupBy), aggregations: [{ column: aggregateColumn, op: aggregateOp, as: aggregateName }] },
      { type: 'sort_rows', column: aggregateName || `${aggregateOp}_${aggregateColumn}`, order: 'desc' },
    ];
  }
  if (preset === 'calculated') {
    return [
      { type: 'normalize_number', columns: [calcLeft, calcRight] },
      { type: 'add_calculated_column', name: calcName, formula: calcFormula, left: calcLeft, right: calcRight },
    ];
  }
  if (preset === 'split_column') {
    return [
      {
        type: 'split_column',
        column: splitColumn,
        delimiter: splitDelimiter,
        into: splitList(splitInto),
        removeSource: splitReplace,
        trim: true,
      },
    ];
  }
  if (preset === 'unpivot') {
    return [
      {
        type: 'unpivot_columns',
        keyColumns: splitList(unpivotKeyColumns),
        valueColumns: splitList(unpivotValueColumns),
        nameColumn: unpivotNameColumn,
        valueColumn: unpivotValueColumn,
        skipBlanks: unpivotSkipBlanks,
      },
    ];
  }
  return [
    ...(selectColumns.trim() ? [{ type: 'select_columns' as const, columns: splitList(selectColumns) }] : []),
    ...(renamePairs.trim() ? [{ type: 'rename_columns' as const, renames: parseRenames(renamePairs) }] : []),
  ];
}

export function SheetTransformDialog({
  sheets,
  sheetNames,
  activeSheetIndex,
  defaultRange,
  onApply,
  onClose,
}: {
  sheets: any[];
  sheetNames: string[];
  activeSheetIndex: number;
  defaultRange: string;
  onApply: (payload: SheetTransformApplyPayload) => void;
  onClose: () => void;
}) {
  const [sheetIndex, setSheetIndex] = useState(activeSheetIndex);
  const [range, setRange] = useState(defaultRange || 'A1:D20');
  const [hasHeader, setHasHeader] = useState(true);
  const [preset, setPreset] = useState<TransformPreset>('clean');
  const [selectColumns, setSelectColumns] = useState('SKU, Qty, Supplier');
  const [renamePairs, setRenamePairs] = useState('SKU=>Part Number, Qty=>Required Qty');
  const [filterColumn, setFilterColumn] = useState('Status');
  const [filterOp, setFilterOp] = useState<SheetTransformFilterOp>('!=');
  const [filterValue, setFilterValue] = useState('Closed');
  const [sortColumn, setSortColumn] = useState('Due Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState('Supplier');
  const [aggregateColumn, setAggregateColumn] = useState('Qty');
  const [aggregateOp, setAggregateOp] = useState<SheetTransformAggregate>('sum');
  const [aggregateName, setAggregateName] = useState('Total Qty');
  const [calcName, setCalcName] = useState('Shortage');
  const [calcFormula, setCalcFormula] = useState<SheetTransformCalculatedFormula>('difference');
  const [calcLeft, setCalcLeft] = useState('Demand');
  const [calcRight, setCalcRight] = useState('Available');
  const [splitColumn, setSplitColumn] = useState('SKU');
  const [splitDelimiter, setSplitDelimiter] = useState('-');
  const [splitInto, setSplitInto] = useState('Family, Variant, Revision');
  const [splitReplace, setSplitReplace] = useState(false);
  const [unpivotKeyColumns, setUnpivotKeyColumns] = useState('SKU, Supplier');
  const [unpivotValueColumns, setUnpivotValueColumns] = useState('Week 1, Week 2, Week 3');
  const [unpivotNameColumn, setUnpivotNameColumn] = useState('Bucket');
  const [unpivotValueColumn, setUnpivotValueColumn] = useState('Demand');
  const [unpivotSkipBlanks, setUnpivotSkipBlanks] = useState(true);
  const [outputMode, setOutputMode] = useState<'new-sheet' | 'cell'>('new-sheet');
  const [targetCell, setTargetCell] = useState('H1');
  const field = 'w-full h-9 rounded-xl bg-gray-100 px-3 text-sm outline-none ring-emerald-500/40 focus:ring-2 dark:bg-white/10';
  const steps = useMemo(() => buildSteps({
    preset,
    selectColumns,
    renamePairs,
    filterColumn,
    filterOp,
    filterValue,
    sortColumn,
    sortOrder,
    groupBy,
    aggregateColumn,
    aggregateOp,
    aggregateName,
    calcName,
    calcFormula,
    calcLeft,
    calcRight,
    splitColumn,
    splitDelimiter,
    splitInto,
    splitReplace,
    unpivotKeyColumns,
    unpivotValueColumns,
    unpivotNameColumn,
    unpivotValueColumn,
    unpivotSkipBlanks,
  }), [aggregateColumn, aggregateName, aggregateOp, calcFormula, calcLeft, calcName, calcRight, filterColumn, filterOp, filterValue, groupBy, preset, renamePairs, selectColumns, sortColumn, sortOrder, splitColumn, splitDelimiter, splitInto, splitReplace, unpivotKeyColumns, unpivotValueColumns, unpivotNameColumn, unpivotValueColumn, unpivotSkipBlanks]);
  const config = useMemo(() => ({ range, sheetIndex, hasHeader, steps }), [hasHeader, range, sheetIndex, steps]);
  const preview = useMemo(() => runSheetTransform(sheets[sheetIndex], config), [config, sheetIndex, sheets]);
  const sampleRows = preview.rows.slice(0, 6);

  function apply() {
    onApply({ ...config, outputMode, targetCell: outputMode === 'cell' ? targetCell : undefined });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(event) => event.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-[#161616]">
        <div className="flex items-center justify-between border-b border-black/10 p-4 dark:border-white/10">
          <div>
            <h2 className="text-lg font-bold">Data Transform</h2>
            <div className="text-xs text-gray-500">Preview {preview.inputRows} input row(s) to {preview.outputRows} output row(s)</div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[340px_1fr]">
          <div className="space-y-3 border-b border-black/10 p-4 dark:border-white/10 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">Sheet
                <select value={sheetIndex} onChange={(event) => setSheetIndex(Number(event.target.value))} className={field}>
                  {sheetNames.map((name, index) => <option key={index} value={index}>{name || `Sheet ${index + 1}`}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-500">Range
                <input value={range} onChange={(event) => setRange(event.target.value)} className={`${field} font-mono`} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} />
              First row has headers
            </label>

            <label className="block text-xs text-gray-500">Recipe
              <select value={preset} onChange={(event) => setPreset(event.target.value as TransformPreset)} className={field}>
                {PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            {preset === 'filter_sort' && (
              <div className="space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10">
                <label className="block text-xs text-gray-500">Filter column
                  <input value={filterColumn} onChange={(event) => setFilterColumn(event.target.value)} className={field} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">Operator
                    <select value={filterOp} onChange={(event) => setFilterOp(event.target.value as SheetTransformFilterOp)} className={field}>
                      {FILTER_OPS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-gray-500">Value
                    <input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} className={field} disabled={filterOp === 'empty' || filterOp === 'notempty'} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">Sort column
                    <input value={sortColumn} onChange={(event) => setSortColumn(event.target.value)} className={field} />
                  </label>
                  <label className="text-xs text-gray-500">Order
                    <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')} className={field}>
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {preset === 'group' && (
              <div className="space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10">
                <label className="block text-xs text-gray-500">Group by
                  <input value={groupBy} onChange={(event) => setGroupBy(event.target.value)} className={field} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">Value column
                    <input value={aggregateColumn} onChange={(event) => setAggregateColumn(event.target.value)} className={field} />
                  </label>
                  <label className="text-xs text-gray-500">Aggregate
                    <select value={aggregateOp} onChange={(event) => setAggregateOp(event.target.value as SheetTransformAggregate)} className={field}>
                      {AGGS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-xs text-gray-500">Output column
                  <input value={aggregateName} onChange={(event) => setAggregateName(event.target.value)} className={field} />
                </label>
              </div>
            )}

            {preset === 'calculated' && (
              <div className="space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10">
                <label className="block text-xs text-gray-500">New column
                  <input value={calcName} onChange={(event) => setCalcName(event.target.value)} className={field} />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs text-gray-500">Left
                    <input value={calcLeft} onChange={(event) => setCalcLeft(event.target.value)} className={field} />
                  </label>
                  <label className="text-xs text-gray-500">Formula
                    <select value={calcFormula} onChange={(event) => setCalcFormula(event.target.value as SheetTransformCalculatedFormula)} className={field}>
                      {FORMULAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-gray-500">Right
                    <input value={calcRight} onChange={(event) => setCalcRight(event.target.value)} className={field} />
                  </label>
                </div>
              </div>
            )}

            {preset === 'split_column' && (
              <div className="space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10">
                <label className="block text-xs text-gray-500">Source column
                  <input value={splitColumn} onChange={(event) => setSplitColumn(event.target.value)} className={field} />
                </label>
                <div className="grid grid-cols-[96px_1fr] gap-2">
                  <label className="text-xs text-gray-500">Delimiter
                    <input value={splitDelimiter} onChange={(event) => setSplitDelimiter(event.target.value)} className={field} />
                  </label>
                  <label className="text-xs text-gray-500">Output columns
                    <input value={splitInto} onChange={(event) => setSplitInto(event.target.value)} className={field} />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={splitReplace} onChange={(event) => setSplitReplace(event.target.checked)} />
                  Replace source column
                </label>
              </div>
            )}

            {preset === 'unpivot' && (
              <div className="space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10">
                <label className="block text-xs text-gray-500">Key columns
                  <input value={unpivotKeyColumns} onChange={(event) => setUnpivotKeyColumns(event.target.value)} className={field} />
                </label>
                <label className="block text-xs text-gray-500">Value columns
                  <input value={unpivotValueColumns} onChange={(event) => setUnpivotValueColumns(event.target.value)} className={field} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-gray-500">Name column
                    <input value={unpivotNameColumn} onChange={(event) => setUnpivotNameColumn(event.target.value)} className={field} />
                  </label>
                  <label className="text-xs text-gray-500">Value column
                    <input value={unpivotValueColumn} onChange={(event) => setUnpivotValueColumn(event.target.value)} className={field} />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input type="checkbox" checked={unpivotSkipBlanks} onChange={(event) => setUnpivotSkipBlanks(event.target.checked)} />
                  Skip blank measure cells
                </label>
              </div>
            )}

            {preset === 'select_rename' && (
              <div className="space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10">
                <label className="block text-xs text-gray-500">Columns
                  <input value={selectColumns} onChange={(event) => setSelectColumns(event.target.value)} className={field} />
                </label>
                <label className="block text-xs text-gray-500">Rename pairs
                  <input value={renamePairs} onChange={(event) => setRenamePairs(event.target.value)} className={field} />
                </label>
              </div>
            )}

            <div className="space-y-2 rounded-2xl border border-black/10 p-3 dark:border-white/10">
              <label className="block text-xs text-gray-500">Output
                <select value={outputMode} onChange={(event) => setOutputMode(event.target.value as 'new-sheet' | 'cell')} className={field}>
                  <option value="new-sheet">New sheet</option>
                  <option value="cell">Selected workbook cell</option>
                </select>
              </label>
              {outputMode === 'cell' && (
                <label className="block text-xs text-gray-500">Target cell
                  <input value={targetCell} onChange={(event) => setTargetCell(event.target.value)} className={`${field} font-mono`} />
                </label>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col p-4">
            <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
              <Metric label="Steps" value={preview.stepsApplied} />
              <Metric label="Columns" value={preview.headers.length} />
              <Metric label="Warnings" value={preview.warnings.length} />
            </div>
            {preview.warnings.length > 0 && (
              <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                {preview.warnings.slice(0, 4).map((warning) => <div key={warning}>{warning}</div>)}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-black/10 dark:border-white/10">
              <table className="min-w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-gray-100 text-gray-600 dark:bg-[#202020] dark:text-gray-300">
                  <tr>{preview.headers.map((header) => <th key={header} className="border-b border-black/10 px-3 py-2 font-semibold dark:border-white/10">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-black/[0.02] dark:odd:bg-white/[0.03]">
                      {preview.headers.map((header, colIndex) => <td key={`${header}_${colIndex}`} className="border-b border-black/5 px-3 py-2 font-mono dark:border-white/10">{String(row[colIndex] ?? '')}</td>)}
                    </tr>
                  ))}
                  {!sampleRows.length && (
                    <tr><td colSpan={Math.max(1, preview.headers.length)} className="px-3 py-8 text-center text-gray-500">No preview rows.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-black/10 p-4 dark:border-white/10">
          <button onClick={onClose} className="h-10 rounded-xl border border-black/10 px-4 text-sm font-semibold hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10">Cancel</button>
          <button onClick={apply} disabled={!preview.ok || !steps.length} className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-gray-900">Apply transform</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-gray-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-[10px] font-semibold uppercase text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
