'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { ListChecks, Palette, Snowflake, FileText, Sigma, Search, ArrowDownUp, CopyMinus, Columns3, StickyNote, Table2, Hash, Rows3, Activity, ArrowDownToLine, FlipVertical2, Tag, Printer } from 'lucide-react';
import { SheetCharts } from './SheetCharts';
import { SheetTools, type ValidationPayload } from './SheetTools';
import { SheetFunctionWizard } from './SheetFunctionWizard';
import { SheetFindReplace } from './SheetFindReplace';
import { SheetDataDialog, type DataMode } from './SheetDataDialog';
import { SheetPivot } from './SheetPivot';
import { SheetFormatDialog, type NumberFmtPayload, type StylePayload } from './SheetFormatDialog';
import { SheetNameManager } from './SheetNameManager';
import { SheetPrintDialog } from './SheetPrintDialog';
import { parseRange, type ChartConfig } from '@/lib/office/charts';
import { applyConditional, sortRangeMulti, removeDuplicates, textToColumns, setCellNote, replaceAll, buildPivot, pivotToCelldata, applyNumberFormat, applyCellStyle, applySubtotals, applySparkline, applyFill, transposeRange, buildPrintHtml, usedRange, colName, type CondPayload, type PivotConfig, type FindOpts, type NamedRange, type PrintOpts } from '@/lib/office/sheetOps';
import { OfficeRibbon, RibbonTab, RibbonGroup, RibbonSeparator, RibbonButton, RibbonMenuButton } from './ribbon';

// Content is either the legacy bare sheet array or the new { sheets, charts } shape.
function sheetsOf(v: any): any[] | null {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.sheets)) return v.sheets;
  return null;
}
function chartsOf(v: any): ChartConfig[] {
  return v && Array.isArray(v.charts) ? v.charts : [];
}
function namesOf(v: any): NamedRange[] {
  return v && Array.isArray(v.names) ? v.names : [];
}
const DEFAULT_SHEET = { name: 'Hoja 1', celldata: [], order: 0, row: 100, column: 30, config: {} };
const clone = (x: any) => JSON.parse(JSON.stringify(x));

/** Excel-like spreadsheet (Fortune-sheet, MIT) — formulas, formats, charts, validation, conditional formatting. */
export function SheetEditor({ value, onChange, readOnly, fileActions }: { value: any; onChange: (data: any) => void; readOnly?: boolean; fileActions?: React.ReactNode }) {
  const initSheets = sheetsOf(value)?.length ? (sheetsOf(value) as any[]) : [DEFAULT_SHEET];
  const [liveData, setLiveData] = useState<any[]>(initSheets); // only swapped on a forced remount
  const [wbKey, setWbKey] = useState(0);
  const sheetsRef = useRef<any[]>(initSheets);
  const wbRef = useRef<any>(null);
  const chartsRef = useRef<ChartConfig[]>(chartsOf(value));
  const [charts, setCharts] = useState<ChartConfig[]>(chartsRef.current);
  const namesRef = useRef<NamedRange[]>(namesOf(value));
  const [names, setNames] = useState<NamedRange[]>(namesRef.current);
  const [showNames, setShowNames] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [tool, setTool] = useState<null | 'validation' | 'condformat'>(null);
  const [dataMode, setDataMode] = useState<DataMode | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [showPivot, setShowPivot] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [, setTick] = useState(0);
  const refreshT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Atajos: Ctrl/⌘+F buscar y reemplazar; Ctrl/⌘+P imprimir.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); setShowPrint(true); return; }
      if (readOnly) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowFind(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  const emit = useCallback(() => {
    onChangeRef.current({ sheets: sheetsRef.current, charts: chartsRef.current, names: namesRef.current });
  }, []);

  const addName = useCallback((nr: NamedRange) => { namesRef.current = [...namesRef.current, nr]; setNames(namesRef.current); emit(); }, [emit]);
  const removeName = useCallback((nm: string) => { namesRef.current = namesRef.current.filter((n) => n.name !== nm); setNames(namesRef.current); emit(); }, [emit]);

  const handleSheet = useCallback((d: any) => {
    sheetsRef.current = d;
    if (!readOnly) emit();
    if (refreshT.current) clearTimeout(refreshT.current);
    refreshT.current = setTimeout(() => setTick((t) => t + 1), 500);
  }, [emit, readOnly]);

  const addChart = useCallback((c: ChartConfig) => { chartsRef.current = [...chartsRef.current, c]; setCharts(chartsRef.current); emit(); }, [emit]);
  const removeChart = useCallback((id: string) => { chartsRef.current = chartsRef.current.filter((x) => x.id !== id); setCharts(chartsRef.current); emit(); }, [emit]);
  const updateChart = useCallback((c: ChartConfig) => { chartsRef.current = chartsRef.current.map((x) => (x.id === c.id ? c : x)); setCharts(chartsRef.current); emit(); }, [emit]);

  // Re-mount Fortune-sheet with new data (it is uncontrolled after mount).
  function remount(newSheets: any[]) {
    sheetsRef.current = newSheets;
    setLiveData(newSheets);
    setWbKey((k) => k + 1);
    emit();
  }
  const sheetNames = () => liveData.map((s: any) => s?.name ?? '');

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

  function applyFreeze(type: string) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!sheet) return;
    if (!type) delete sheet.frozen;
    else sheet.frozen = { type, range: { row_focus: 0, column_focus: 0 } };
    remount(sheets);
  }
  function applyFreezeAt() {
    const v = window.prompt('Inmovilizar filas/columnas ANTES de esta celda (ej.: C4 → filas 1-3 y columnas A-B):', 'B2');
    if (!v) return;
    const rng = parseRange(v); if (!rng) { window.alert('Celda inválida.'); return; }
    const sheets = clone(sheetsRef.current);
    const sheet = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!sheet) return;
    sheet.frozen = { type: 'rangeBoth', range: { row_focus: Math.max(0, rng.r1 - 1), column_focus: Math.max(0, rng.c1 - 1) } };
    remount(sheets);
  }

  function applyCondFormat(p: CondPayload) {
    const rng = parseRange(p.range);
    if (!rng) { window.alert('Rango inválido. Ej: A1:B20'); return; }
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[p.sheetIndex] ?? sheets[0];
    if (!sheet) return;
    applyConditional(sheet, p);
    setTool(null);
    remount(sheets);
  }

  function applyData(mode: DataMode, payload: any) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[payload.sheetIndex] ?? sheets[0];
    if (!sheet) { setDataMode(null); return; }
    let msg = '';
    if (mode === 'sort') sortRangeMulti(sheet, payload);
    else if (mode === 'dedup') { const n = removeDuplicates(sheet, payload); msg = `${Math.max(0, n)} fila(s) duplicada(s) eliminada(s).`; }
    else if (mode === 'split') textToColumns(sheet, payload);
    else if (mode === 'subtotal') { const n = applySubtotals(sheet, payload); msg = `${n} fila(s) de subtotal/total insertadas.`; }
    else if (mode === 'spark') { if (!applySparkline(sheet, payload.dataRange, payload.cell, payload.type)) msg = 'Rango o celda inválidos.'; }
    else if (mode === 'fill') { const n = applyFill(sheet, payload); msg = `${n} celda(s) rellenada(s).`; }
    else if (mode === 'transpose') { if (!transposeRange(sheet, payload.srcRange, payload.destCell)) msg = 'Rango o celda inválidos.'; }
    else if (mode === 'note') setCellNote(sheet, payload.cell, payload.text);
    setDataMode(null);
    remount(sheets);
    if (msg) window.setTimeout(() => window.alert(msg), 30);
  }

  function insertIntoCell(text: string): boolean {
    const wb = wbRef.current;
    try {
      const sel = wb?.getSelection?.();
      const first = Array.isArray(sel) ? sel[0] : sel;
      const r = first?.row?.[0] ?? 0;
      const c = first?.column?.[0] ?? 0;
      if (wb?.setCellValue) { wb.setCellValue(r, c, text); return true; }
    } catch { /* fallback */ }
    return false;
  }
  function insertFunction(formula: string) {
    setShowWizard(false);
    if (insertIntoCell(formula)) return;
    navigator.clipboard?.writeText(formula)
      .then(() => window.alert(`Función copiada: ${formula}  — pégala en la celda y completa los argumentos.`))
      .catch(() => window.alert(`Escribe en la celda: ${formula}`));
  }
  function insertNameRef(ref: string) {
    if (!insertIntoCell(ref)) navigator.clipboard?.writeText(ref).catch(() => {});
  }

  const printHtml = useCallback((sheetIndex: number, opts: PrintOpts) => {
    const sheet = sheetsRef.current[sheetIndex] ?? sheetsRef.current[0];
    return sheet ? buildPrintHtml(sheet, opts) : '<p>Hoja vacía.</p>';
  }, []);
  function doPrint(html: string) {
    setShowPrint(false);
    const w = window.open('', '_blank');
    if (!w) { window.alert('Permite las ventanas emergentes para imprimir.'); return; }
    w.document.open(); w.document.write(html); w.document.close(); w.focus();
    window.setTimeout(() => { try { w.print(); } catch { /* el usuario puede imprimir manualmente */ } }, 300);
  }

  function doReplaceAll(query: string, replacement: string, opts: FindOpts): number {
    const sheets = clone(sheetsRef.current);
    const n = replaceAll(sheets, query, replacement, opts);
    if (n > 0) remount(sheets);
    return n;
  }

  const activeIndex = () => { const i = sheetsRef.current.findIndex((s: any) => s?.status === 1); return i >= 0 ? i : 0; };

  // Rango A1 de la selección actual del grid (para prefijar diálogos de formato).
  function selectionRange(): string {
    try {
      const sel = wbRef.current?.getSelection?.();
      const first = Array.isArray(sel) ? sel[0] : sel;
      if (first?.row && first?.column) {
        const r1 = first.row[0] ?? 0, r2 = first.row[1] ?? r1;
        const c1 = first.column[0] ?? 0, c2 = first.column[1] ?? c1;
        return `${colName(c1)}${r1 + 1}:${colName(c2)}${r2 + 1}`;
      }
    } catch { /* sin selección */ }
    return 'A1:A10';
  }

  function applyNumberFmt(p: NumberFmtPayload) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[p.sheetIndex] ?? sheets[0]; if (!sheet) { setShowFormat(false); return; }
    applyNumberFormat(sheet, p.range, p.code, { currency: p.currency });
    setShowFormat(false); remount(sheets);
  }
  function applyStyleFmt(p: StylePayload) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[p.sheetIndex] ?? sheets[0]; if (!sheet) return;
    applyCellStyle(sheet, p.range, p.style);
    remount(sheets);
  }

  function applyPivot(cfg: PivotConfig, target: { mode: 'new' | 'cell'; cell?: string }) {
    const sheets = clone(sheetsRef.current);
    const src = sheets[cfg.sheetIndex] ?? sheets[0];
    if (!src) { setShowPivot(false); return; }
    const res = buildPivot(src, cfg);
    if (!res.matrix.length) { window.alert(res.warnings[0] || 'No se pudo generar la tabla dinámica.'); return; }
    if (target.mode === 'cell') {
      const origin = parseRange(target.cell || 'A1');
      if (!origin) { window.alert('Celda destino inválida.'); return; }
      const dst = sheets[activeIndex()] ?? src;
      const cells = pivotToCelldata(res, origin.r1, origin.c1);
      const occupied = new Set(cells.map((c: any) => `${c.r}_${c.c}`));
      dst.celldata = [...(dst.celldata ?? []).filter((c: any) => !occupied.has(`${c.r}_${c.c}`)), ...cells];
      dst.column = Math.max(dst.column ?? 26, origin.c1 + res.nCols + 2);
      dst.row = Math.max(dst.row ?? 100, origin.r1 + res.nRows + 5);
    } else {
      const n = sheets.filter((s: any) => /Tabla dinámica/.test(s?.name ?? '')).length + 1;
      sheets.forEach((s: any) => { s.status = 0; });
      sheets.push({
        name: `Tabla dinámica ${n}`, celldata: pivotToCelldata(res, 0, 0), order: sheets.length,
        row: Math.max(100, res.nRows + 8), column: Math.max(26, res.nCols + 4), config: {}, status: 1,
      });
    }
    setShowPivot(false);
    remount(sheets);
    if (res.warnings.length) window.setTimeout(() => window.alert(res.warnings.join('\n')), 30);
  }

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-[#0e0e0e]">
      <OfficeRibbon storageKey="ribbon:sheet">
        {fileActions != null && (
          <RibbonTab id="file" label="Archivo" icon={FileText}>
            <RibbonGroup label="Hoja de cálculo">{fileActions}</RibbonGroup>
          </RibbonTab>
        )}
        {!readOnly && (
          <RibbonTab id="data" label="Datos">
            <RibbonGroup label="Herramientas de datos">
              <RibbonButton icon={ListChecks} label="Validación de datos" onClick={() => setTool('validation')} />
              <RibbonButton icon={Palette} label="Formato condicional" onClick={() => setTool('condformat')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Ordenar y filtrar">
              <RibbonButton icon={ArrowDownUp} label="Ordenar rango (multinivel)" onClick={() => setDataMode('sort')} />
              <RibbonButton icon={CopyMinus} label="Quitar duplicados" onClick={() => setDataMode('dedup')} />
              <RibbonButton icon={Columns3} label="Texto en columnas" onClick={() => setDataMode('split')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Esquema">
              <RibbonButton icon={Rows3} label="Subtotales" onClick={() => setDataMode('subtotal')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Rellenar y transponer">
              <RibbonButton icon={ArrowDownToLine} label="Rellenar serie" onClick={() => setDataMode('fill')} />
              <RibbonButton icon={FlipVertical2} label="Transponer" onClick={() => setDataMode('transpose')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Vista">
              <RibbonMenuButton icon={Snowflake} label="Inmovilizar" menuWidth={250} items={[
                { label: 'Inmovilizar fila 1', onClick: () => applyFreeze('row') },
                { label: 'Inmovilizar columna A', onClick: () => applyFreeze('column') },
                { label: 'Inmovilizar fila 1 + columna A', onClick: () => applyFreeze('both') },
                { label: 'Inmovilizar hasta una celda…', onClick: applyFreezeAt },
                { label: 'Quitar inmovilización', onClick: () => applyFreeze('') },
              ]} />
            </RibbonGroup>
          </RibbonTab>
        )}
        {!readOnly && (
          <RibbonTab id="insert" label="Insertar">
            <RibbonGroup label="Tablas">
              <RibbonButton icon={Table2} label="Tabla dinámica" hideLabel={false} onClick={() => setShowPivot(true)} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Minigráficos">
              <RibbonButton icon={Activity} label="Sparkline" hideLabel={false} onClick={() => setDataMode('spark')} />
            </RibbonGroup>
          </RibbonTab>
        )}
        {!readOnly && (
          <RibbonTab id="format" label="Formato">
            <RibbonGroup label="Celdas">
              <RibbonButton icon={Hash} label="Formato de número y estilos" hideLabel={false} onClick={() => setShowFormat(true)} />
            </RibbonGroup>
          </RibbonTab>
        )}
        <RibbonTab id="layout" label="Diseño de página">
          <RibbonGroup label="Imprimir">
            <RibbonButton icon={Printer} label="Imprimir / vista previa" shortcut="Ctrl+P" hideLabel={false} onClick={() => setShowPrint(true)} />
          </RibbonGroup>
        </RibbonTab>
        {!readOnly && (
          <RibbonTab id="formulas" label="Fórmulas">
            <RibbonGroup label="Biblioteca de funciones">
              <RibbonButton icon={Sigma} label="Insertar función" hideLabel={false} onClick={() => setShowWizard(true)} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Nombres definidos">
              <RibbonButton icon={Tag} label="Administrador de nombres" hideLabel={false} onClick={() => setShowNames(true)} />
            </RibbonGroup>
          </RibbonTab>
        )}
        {!readOnly && (
          <RibbonTab id="review" label="Revisar">
            <RibbonGroup label="Edición">
              <RibbonButton icon={Search} label="Buscar y reemplazar" shortcut="Ctrl+F" onClick={() => setShowFind(true)} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Comentarios">
              <RibbonButton icon={StickyNote} label="Nota de celda" onClick={() => setDataMode('note')} />
            </RibbonGroup>
          </RibbonTab>
        )}
      </OfficeRibbon>

      <div className="flex-1 min-h-0 bg-white relative">
        <Workbook ref={wbRef} key={wbKey} data={liveData as any} lang="es" allowEdit={!readOnly} onChange={handleSheet} />
        {showFind && <SheetFindReplace sheets={sheetsRef.current} sheetNames={sheetNames()} activeSheetIndex={activeIndex()} onReplaceAll={doReplaceAll} onClose={() => setShowFind(false)} />}
      </div>

      <SheetCharts charts={charts} sheets={sheetsRef.current} readOnly={readOnly} onAdd={addChart} onRemove={removeChart} onUpdate={updateChart} />

      <AnimatePresence>
        {tool && (
          <SheetTools
            mode={tool}
            sheetNames={sheetNames()}
            onApplyValidation={applyValidation}
            onApplyCondFormat={applyCondFormat}
            onClose={() => setTool(null)}
          />
        )}
        {dataMode && (
          <SheetDataDialog mode={dataMode} sheetNames={sheetNames()} onApply={applyData} onClose={() => setDataMode(null)} />
        )}
        {showWizard && <SheetFunctionWizard onInsert={insertFunction} onClose={() => setShowWizard(false)} />}
        {showPivot && (
          <SheetPivot
            sheets={sheetsRef.current}
            sheetNames={sheetNames()}
            activeSheetIndex={activeIndex()}
            onApply={applyPivot}
            onClose={() => setShowPivot(false)}
          />
        )}
        {showFormat && (
          <SheetFormatDialog
            sheetNames={sheetNames()}
            defaultRange={selectionRange()}
            defaultSheetIndex={activeIndex()}
            onApplyNumber={applyNumberFmt}
            onApplyStyle={applyStyleFmt}
            onClose={() => setShowFormat(false)}
          />
        )}
        {showNames && (
          <SheetNameManager
            names={names}
            sheetNames={sheetNames()}
            activeSheetIndex={activeIndex()}
            onAdd={addName}
            onRemove={removeName}
            onInsert={(ref) => { insertNameRef(ref); setShowNames(false); }}
            onClose={() => setShowNames(false)}
          />
        )}
        {showPrint && (
          <SheetPrintDialog
            sheetNames={sheetNames()}
            defaultSheetIndex={activeIndex()}
            defaultRange={usedRange(sheetsRef.current[activeIndex()]) ?? ''}
            defaultTitle={sheetNames()[activeIndex()] ?? ''}
            getHtml={printHtml}
            onPrint={doPrint}
            onClose={() => setShowPrint(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
