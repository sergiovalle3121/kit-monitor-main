'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { ListChecks, Palette } from 'lucide-react';
import { SheetCharts } from './SheetCharts';
import { SheetTools, type ValidationPayload, type CondFormatPayload } from './SheetTools';
import { parseRange, type ChartConfig } from '@/lib/office/charts';

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
const clone = (x: any) => JSON.parse(JSON.stringify(x));

/** Excel-like spreadsheet (Fortune-sheet, MIT) — formulas, formats, charts, validation, conditional formatting. */
export function SheetEditor({ value, onChange, readOnly }: { value: any; onChange: (data: any) => void; readOnly?: boolean }) {
  const initSheets = sheetsOf(value)?.length ? (sheetsOf(value) as any[]) : [DEFAULT_SHEET];
  const [liveData, setLiveData] = useState<any[]>(initSheets); // only swapped on a forced remount
  const [wbKey, setWbKey] = useState(0);
  const sheetsRef = useRef<any[]>(initSheets);
  const chartsRef = useRef<ChartConfig[]>(chartsOf(value));
  const [charts, setCharts] = useState<ChartConfig[]>(chartsRef.current);
  const [tool, setTool] = useState<null | 'validation' | 'condformat'>(null);
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
    if (refreshT.current) clearTimeout(refreshT.current);
    refreshT.current = setTimeout(() => setTick((t) => t + 1), 500);
  }, [emit, readOnly]);

  const addChart = useCallback((c: ChartConfig) => { chartsRef.current = [...chartsRef.current, c]; setCharts(chartsRef.current); emit(); }, [emit]);
  const removeChart = useCallback((id: string) => { chartsRef.current = chartsRef.current.filter((x) => x.id !== id); setCharts(chartsRef.current); emit(); }, [emit]);

  // Re-mount Fortune-sheet with new data (it is uncontrolled after mount).
  function remount(newSheets: any[]) {
    sheetsRef.current = newSheets;
    setLiveData(newSheets);
    setWbKey((k) => k + 1);
    emit();
  }

  function applyValidation({ range, options, sheetIndex }: ValidationPayload) {
    const rng = parseRange(range);
    if (!rng) { window.alert('Rango inválido. Ej: A1:A10'); return; }
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[sheetIndex] ?? sheets[0];
    if (!sheet) return;
    sheet.dataVerification = sheet.dataVerification || {};
    const value1 = options.split(',').map((s) => s.trim()).filter(Boolean).join(',');
    for (let r = rng.r1; r <= rng.r2; r++) {
      for (let c = rng.c1; c <= rng.c2; c++) {
        sheet.dataVerification[`${r}_${c}`] = {
          type: 'dropdown', type2: null, value1, value2: '', validity: '',
          remote: false, prohibitInput: false, hintShow: false, hintText: '', checked: false,
        };
      }
    }
    setTool(null);
    remount(sheets);
  }

  function applyCondFormat({ range, op, value: cmp, color, sheetIndex }: CondFormatPayload) {
    const rng = parseRange(range);
    if (!rng) { window.alert('Rango inválido. Ej: A1:B20'); return; }
    const num = parseFloat(cmp);
    const matches = (raw: any) => {
      if (op === 'contains') return String(raw ?? '').toLowerCase().includes(cmp.toLowerCase());
      const n = typeof raw === 'number' ? raw : parseFloat(raw);
      if (Number.isNaN(n)) return op === '=' ? String(raw) === cmp : op === '!=' ? String(raw) !== cmp : false;
      switch (op) {
        case '>': return n > num; case '>=': return n >= num;
        case '<': return n < num; case '<=': return n <= num;
        case '=': return n === num; case '!=': return n !== num;
        default: return false;
      }
    };
    const dark = /^#?(0|1|2|3|4|5)[0-9a-f]/i.test(color.replace('#', '')) && color.length >= 4;
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[sheetIndex] ?? sheets[0];
    if (!sheet) return;
    sheet.celldata = (sheet.celldata || []).map((cd: any) => {
      if (cd.r < rng.r1 || cd.r > rng.r2 || cd.c < rng.c1 || cd.c > rng.c2) return cd;
      const raw = cd.v && typeof cd.v === 'object' ? (cd.v.v ?? cd.v.m) : cd.v;
      if (raw === undefined || raw === null || raw === '') return cd;
      if (!matches(raw)) return cd;
      const v = cd.v && typeof cd.v === 'object'
        ? { ...cd.v }
        : { v: cd.v, m: String(cd.v), ct: { fa: 'General', t: typeof cd.v === 'number' ? 'n' : 's' } };
      v.bg = color;
      if (dark) v.fc = '#ffffff';
      return { ...cd, v };
    });
    setTool(null);
    remount(sheets);
  }

  const toolBtn = 'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors';

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-[#0e0e0e]">
      {!readOnly && (
        <div className="flex items-center gap-1 px-2 h-9 border-b border-gray-200 dark:border-white/10 flex-shrink-0 bg-gray-50 dark:bg-[#0e0e0e]">
          <button onClick={() => setTool('validation')} className={toolBtn}><ListChecks className="w-4 h-4 text-emerald-500" /> Validación</button>
          <button onClick={() => setTool('condformat')} className={toolBtn}><Palette className="w-4 h-4 text-blue-500" /> Formato condicional</button>
        </div>
      )}
      <div className="flex-1 min-h-0 bg-white">
        <Workbook key={wbKey} data={liveData as any} lang="es" allowEdit={!readOnly} onChange={handleSheet} />
      </div>
      <SheetCharts charts={charts} sheets={sheetsRef.current} readOnly={readOnly} onAdd={addChart} onRemove={removeChart} />
      <AnimatePresence>
        {tool && (
          <SheetTools
            mode={tool}
            sheetNames={liveData.map((s: any) => s?.name ?? '')}
            onApplyValidation={applyValidation}
            onApplyCondFormat={applyCondFormat}
            onClose={() => setTool(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
