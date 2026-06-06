'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useRef, useState } from 'react';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { SheetCharts } from './SheetCharts';
import type { ChartConfig } from '@/lib/office/charts';

// Content is either the legacy bare sheet array or the new { sheets, charts } shape.
function sheetsOf(v: any): any[] | null {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.sheets)) return v.sheets;
  return null;
}
function chartsOf(v: any): ChartConfig[] {
  return v && Array.isArray(v.charts) ? v.charts : [];
}
const DEFAULT_SHEET = { name: 'Hoja 1', celldata: [], order: 0, row: 100, column: 30, config: {} };

/** Excel-like spreadsheet (Fortune-sheet, MIT) — formulas, formats, charts. */
export function SheetEditor({ value, onChange, readOnly }: { value: any; onChange: (data: any) => void; readOnly?: boolean }) {
  const initSheets = sheetsOf(value)?.length ? (sheetsOf(value) as any[]) : [DEFAULT_SHEET];
  const dataProp = useRef(initSheets).current; // stable: Fortune-sheet is uncontrolled after mount
  const sheetsRef = useRef<any[]>(initSheets);
  const chartsRef = useRef<ChartConfig[]>(chartsOf(value));
  const [charts, setCharts] = useState<ChartConfig[]>(chartsRef.current);
  const [, setTick] = useState(0);
  const refreshT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emit = useCallback(() => {
    onChangeRef.current({ sheets: sheetsRef.current, charts: chartsRef.current });
  }, []);

  const handleSheet = useCallback((d: any) => {
    sheetsRef.current = d;
    if (!readOnly) emit();
    // Refresh charts shortly after edits settle (charts read live sheet data).
    if (refreshT.current) clearTimeout(refreshT.current);
    refreshT.current = setTimeout(() => setTick((t) => t + 1), 500);
  }, [emit, readOnly]);

  const addChart = useCallback((c: ChartConfig) => {
    chartsRef.current = [...chartsRef.current, c];
    setCharts(chartsRef.current);
    emit();
  }, [emit]);
  const removeChart = useCallback((id: string) => {
    chartsRef.current = chartsRef.current.filter((x) => x.id !== id);
    setCharts(chartsRef.current);
    emit();
  }, [emit]);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-[#0e0e0e]">
      <div className="flex-1 min-h-0 bg-white">
        <Workbook data={dataProp as any} lang="es" allowEdit={!readOnly} onChange={handleSheet} />
      </div>
      <SheetCharts charts={charts} sheets={sheetsRef.current} readOnly={readOnly} onAdd={addChart} onRemove={removeChart} />
    </div>
  );
}
