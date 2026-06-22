'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { ListChecks, Palette, Snowflake, FileText, Sigma, Search, ArrowDownUp, CopyMinus, Columns3, StickyNote, Table2, Hash, Rows3, Activity, ArrowDownToLine, FlipVertical2, Tag, Printer, ClipboardPaste, Filter, RefreshCw, LayoutGrid, Sparkles } from 'lucide-react';
import { SheetCharts } from './SheetCharts';
import { SheetTools, type ValidationPayload } from './SheetTools';
import { SheetFunctionWizard } from './SheetFunctionWizard';
import { SheetFindReplace } from './SheetFindReplace';
import { SheetDataDialog, type DataMode } from './SheetDataDialog';
import { SheetPivot } from './SheetPivot';
import { SheetFormatDialog, type NumberFmtPayload, type StylePayload } from './SheetFormatDialog';
import { SheetNameManager } from './SheetNameManager';
import { SheetPrintDialog } from './SheetPrintDialog';
import { SheetTableStyle, type TableStylePayload } from './SheetTableStyle';
import { parseRange, type ChartConfig } from '@/lib/office/charts';
import { applyConditional, sortRangeMulti, removeDuplicates, textToColumns, setCellNote, replaceAll, buildPivot, pivotToCelldata, applyNumberFormat, applyCellStyle, applySubtotals, applySparkline, applyFill, transposeRange, copyRange, buildFilter, buildPrintHtml, usedRange, colName, applyDataVerification, clearDataVerification, markInvalidCells, applyTableStyle, type CondPayload, type PivotConfig, type FindOpts, type NamedRange, type PrintOpts } from '@/lib/office/sheetOps';
import { normalizeCellInput } from './sheets/sheetFormula';
import { installFormulaEngine } from './sheets/formulaEngine';
import { applySpill } from './sheets/arraySpill';
import { OfficeRibbon, RibbonTab, RibbonGroup, RibbonSeparator, RibbonButton, RibbonMenuButton } from './ribbon';
import { useToast } from '@/contexts/ToastContext';

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
type StoredPivot = { id: string; config: PivotConfig; sheetName: string };
function pivotsOf(v: any): StoredPivot[] {
  return v && Array.isArray(v.pivots) ? v.pivots : [];
}
const DEFAULT_SHEET = { name: 'Hoja 1', celldata: [], order: 0, row: 100, column: 30, config: {} };
const clone = (x: any) => JSON.parse(JSON.stringify(x));

// Robustece el motor de fórmulas de la rejilla (booleanos sueltos + funciones registradas:
// XLOOKUP, TEXTJOIN, MAXIFS/MINIFS, TEXT, SI.ERROR sobre #DIV/0!…). Parchea el `Parser`
// COMPARTIDO una sola vez, en cuanto se carga el editor y ANTES de que la rejilla evalúe.
installFormulaEngine();

/** Excel-like spreadsheet (Fortune-sheet, MIT) — formulas, formats, charts, validation, conditional formatting. */
export function SheetEditor({ value, onChange, readOnly, fileActions }: { value: any; onChange: (data: any) => void; readOnly?: boolean; fileActions?: React.ReactNode }) {
  const toast = useToast();
  const initSheets = sheetsOf(value)?.length ? (sheetsOf(value) as any[]) : [DEFAULT_SHEET];
  const [liveData, setLiveData] = useState<any[]>(initSheets); // only swapped on a forced remount
  const [wbKey, setWbKey] = useState(0);
  const sheetsRef = useRef<any[]>(initSheets);
  const wbRef = useRef<any>(null);
  const gridRef = useRef<HTMLDivElement>(null); // contenedor de la rejilla (foco/atajos)
  const chartsRef = useRef<ChartConfig[]>(chartsOf(value));
  const [charts, setCharts] = useState<ChartConfig[]>(chartsRef.current);
  const namesRef = useRef<NamedRange[]>(namesOf(value));
  const [names, setNames] = useState<NamedRange[]>(namesRef.current);
  const pivotsRef = useRef<StoredPivot[]>(pivotsOf(value));
  const [showNames, setShowNames] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [tool, setTool] = useState<null | 'validation' | 'condformat'>(null);
  const [dataMode, setDataMode] = useState<DataMode | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [showPivot, setShowPivot] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [, setTick] = useState(0);
  const refreshT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Atajos de teclado estilo Excel/Sheets. Ctrl/⌘+P imprimir y Ctrl/⌘+F buscar (los de
  // antes) + deshacer/rehacer y portapapeles CABLEADOS AL MOTOR de Fortune-Sheet.
  // Fortune-Sheet ya gestiona estas teclas cuando la rejilla tiene el foco (su listener
  // vive en el contenedor de la rejilla); el problema —«el deshacer no funcionaba»— es
  // que al usar la cinta o cerrar un diálogo el foco sale de la rejilla y ese listener
  // deja de recibirlas. Aquí las cubrimos a nivel ventana SÓLO cuando el foco está
  // FUERA de la rejilla (si está dentro, dejamos que el motor lo haga → sin doble disparo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'p') { e.preventDefault(); setShowPrint(true); return; }
      if (readOnly) return;
      if (k === 'f') { e.preventDefault(); setShowFind(true); return; }

      const grid = gridRef.current;
      if (grid && grid.contains(document.activeElement)) return; // la rejilla ya lo hará
      const wb = wbRef.current;
      if (!wb) return;
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) wb.handleRedo?.(); else wb.handleUndo?.(); return; }
      if (k === 'y') { e.preventDefault(); wb.handleRedo?.(); return; }
      if (k === 'c' || k === 'x' || k === 'v') {
        // Copiar/cortar/pegar requieren el foco dentro de la rejilla para que el motor
        // los capture; se lo devolvemos. El pegado se resuelve en este mismo evento
        // porque su listener vive en `document` y comprueba el elemento activo.
        const input = grid?.querySelector('.luckysheet-cell-input') as HTMLElement | null;
        input?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  // Fortune-Sheet sólo recalcula su layout (rejilla + scrollbars + barra de hojas) al
  // redimensionar la VENTANA, no su contenedor. Cuando el panel de «Gráficas» se abre o
  // cierra (o cambia el alto del editor) el contenedor de la rejilla cambia de tamaño SIN
  // un resize de ventana → su barra de scroll/hojas quedaba descolocada encima de la
  // cuadrícula. Observamos el contenedor y disparamos un «resize» (debounced) para que la
  // hoja reacomode su área y los scrollbars queden limpios bajo la rejilla.
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t);
      t = setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    });
    ro.observe(el);
    return () => { if (t) clearTimeout(t); ro.disconnect(); };
  }, []);

  const emit = useCallback(() => {
    onChangeRef.current({ sheets: sheetsRef.current, charts: chartsRef.current, names: namesRef.current, pivots: pivotsRef.current });
  }, []);

  // Entrada de celda estilo Excel para lo que se TECLEA directamente en la rejilla.
  // Fortune-Sheet sólo evalúa lo que empieza por «=»; aquí puenteamos el atajo Lotus
  // «+…»/«-…» (p. ej. +1+1, -A1*2): si la normalización cambia el texto, cancelamos
  // la escritura cruda y reaplicamos la fórmula normalizada con la API (fuera de este
  // ciclo de actualización para no anidar setContext), de modo que el motor calcule
  // f + v y recalcule dependientes. Objeto estable (definido una vez).
  const wbHooks = useMemo(() => ({
    beforeUpdateCell: (r: number, c: number, value: any): boolean => {
      if (typeof value !== 'string' || value.indexOf('\n') >= 0) return true;
      const norm = normalizeCellInput(value);
      if (norm === value) return true; // nada que reescribir → flujo normal
      const wb = wbRef.current;
      if (!wb?.setCellValue) return true;
      window.setTimeout(() => { try { wb.setCellValue(r, c, norm); } catch { /* noop */ } }, 0);
      return false; // cancela la escritura del texto crudo
    },
  }), []);

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

  function applyValidation({ range, sheetIndex, cfg, action }: ValidationPayload) {
    const rng = parseRange(range);
    if (!rng) { toast.error('Rango inválido. Ej: A1:A10'); return; }
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[sheetIndex] ?? sheets[0];
    if (!sheet) return;
    let msg = '';
    if (action === 'mark') { const n = markInvalidCells(sheet, range, cfg); msg = n ? `${n} celda(s) no válida(s) marcada(s) en rojo.` : 'No hay celdas que incumplan la regla.'; }
    else if (action === 'clear') { const n = clearDataVerification(sheet, range); msg = `Validación quitada de ${n} celda(s).`; }
    else applyDataVerification(sheet, range, cfg);
    setTool(null);
    remount(sheets);
    if (msg) window.setTimeout(() => toast.info(msg), 30);
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
    const rng = parseRange(v); if (!rng) { toast.error('Celda inválida.'); return; }
    const sheets = clone(sheetsRef.current);
    const sheet = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!sheet) return;
    sheet.frozen = { type: 'rangeBoth', range: { row_focus: Math.max(0, rng.r1 - 1), column_focus: Math.max(0, rng.c1 - 1) } };
    remount(sheets);
  }

  function applyCondFormat(p: CondPayload) {
    const rng = parseRange(p.range);
    if (!rng) { toast.error('Rango inválido. Ej: A1:B20'); return; }
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
    else if (mode === 'paste') { if (!copyRange(sheet, payload.srcRange, payload.destCell, payload.mode)) msg = 'Rango o celda inválidos.'; }
    else if (mode === 'filter') {
      const res = buildFilter(sheet, payload);
      if (!res) msg = 'Rango inválido.';
      else {
        const n = sheets.filter((s: any) => /^Filtro/.test(s?.name ?? '')).length + 1;
        sheets.forEach((s: any) => { s.status = 0; });
        sheets.push({ name: `Filtro ${n}`, celldata: res.celldata, order: sheets.length, row: Math.max(100, res.matched + 12), column: Math.max(26, res.nCols + 4), config: {}, status: 1 });
        msg = `${res.matched} fila(s) coinciden — ver «Filtro ${n}».`;
      }
    }
    else if (mode === 'note') setCellNote(sheet, payload.cell, payload.text);
    setDataMode(null);
    remount(sheets);
    if (msg) window.setTimeout(() => toast.info(msg), 30);
  }

  function insertIntoCell(text: string): boolean {
    const wb = wbRef.current;
    try {
      const sel = wb?.getSelection?.();
      const first = Array.isArray(sel) ? sel[0] : sel;
      const r = first?.row?.[0] ?? 0;
      const c = first?.column?.[0] ?? 0;
      // Normaliza al estilo Excel: «=…» y los atajos «+…»/«-…» pasan por el motor
      // de Fortune-Sheet (que calcula y guarda f + v y recalcula dependientes);
      // el texto normal queda como texto.
      if (wb?.setCellValue) { wb.setCellValue(r, c, normalizeCellInput(text)); return true; }
    } catch { /* fallback */ }
    return false;
  }
  function insertFunction(formula: string) {
    setShowWizard(false);
    if (insertIntoCell(formula)) return;
    navigator.clipboard?.writeText(formula)
      .then(() => toast.success(`Función copiada: ${formula}  — pégala en la celda y completa los argumentos.`))
      .catch(() => toast.info(`Escribe en la celda: ${formula}`));
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
    if (!w) { toast.error('Permite las ventanas emergentes para imprimir.'); return; }
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

  // Vuelve a calcular las tablas dinámicas guardadas sobre el origen actual.
  function refreshPivots() {
    const stored = pivotsRef.current;
    if (!stored.length) { toast.info('No hay tablas dinámicas guardadas para actualizar.'); return; }
    const sheets = clone(sheetsRef.current);
    let updated = 0;
    for (const sp of stored) {
      const target = sheets.find((s: any) => s.name === sp.sheetName);
      const src = sheets[sp.config.sheetIndex];
      if (!target || !src) continue; // hoja destino u origen no localizada (renombrada/borrada)
      const res = buildPivot(src, sp.config);
      if (!res.matrix.length) continue;
      target.celldata = pivotToCelldata(res, 0, 0);
      target.row = Math.max(100, res.nRows + 8);
      target.column = Math.max(26, res.nCols + 4);
      updated++;
    }
    remount(sheets);
    window.setTimeout(() => toast.success(`${updated} tabla(s) dinámica(s) actualizada(s).`), 30);
  }

  // Derrama (spill) la fórmula matricial de la celda seleccionada a las celdas vecinas
  // (UNIQUE/SORT/FILTER/SEQUENCE…), estilo Excel 365, con detección de #SPILL!.
  function doSpill() {
    const cell = selectionRange().split(':')[0];
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet) return;
    const res = applySpill(sheet, cell);
    if (!res.ok) { toast.error(res.error || 'No se pudo derramar la matriz.'); return; }
    remount(sheets);
    window.setTimeout(() => toast.success(`Matriz derramada en ${res.rows}×${res.cols} celdas desde ${cell}.`), 30);
  }

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

  function applyTable({ sheetIndex, opts }: TableStylePayload) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[sheetIndex] ?? sheets[0];
    if (!sheet) { setShowTable(false); return; }
    const n = applyTableStyle(sheet, opts);
    setShowTable(false);
    remount(sheets);
    if (!n) window.setTimeout(() => toast.error('Rango inválido para la tabla.'), 30);
  }

  function applyPivot(cfg: PivotConfig, target: { mode: 'new' | 'cell'; cell?: string }) {
    const sheets = clone(sheetsRef.current);
    const src = sheets[cfg.sheetIndex] ?? sheets[0];
    if (!src) { setShowPivot(false); return; }
    const res = buildPivot(src, cfg);
    if (!res.matrix.length) { toast.error(res.warnings[0] || 'No se pudo generar la tabla dinámica.'); return; }
    if (target.mode === 'cell') {
      const origin = parseRange(target.cell || 'A1');
      if (!origin) { toast.error('Celda destino inválida.'); return; }
      const dst = sheets[activeIndex()] ?? src;
      const cells = pivotToCelldata(res, origin.r1, origin.c1);
      const occupied = new Set(cells.map((c: any) => `${c.r}_${c.c}`));
      dst.celldata = [...(dst.celldata ?? []).filter((c: any) => !occupied.has(`${c.r}_${c.c}`)), ...cells];
      dst.column = Math.max(dst.column ?? 26, origin.c1 + res.nCols + 2);
      dst.row = Math.max(dst.row ?? 100, origin.r1 + res.nRows + 5);
    } else {
      const n = sheets.filter((s: any) => /Tabla dinámica/.test(s?.name ?? '')).length + 1;
      const name = `Tabla dinámica ${n}`;
      sheets.forEach((s: any) => { s.status = 0; });
      sheets.push({
        name, celldata: pivotToCelldata(res, 0, 0), order: sheets.length,
        row: Math.max(100, res.nRows + 8), column: Math.max(26, res.nCols + 4), config: {}, status: 1,
      });
      // Recuerda la definición para poder actualizar la tabla tras cambios en el origen.
      pivotsRef.current = [...pivotsRef.current, { id: `pv_${Date.now().toString(36)}`, config: cfg, sheetName: name }];
    }
    setShowPivot(false);
    remount(sheets);
    if (res.warnings.length) window.setTimeout(() => toast.info(res.warnings.join('\n')), 30);
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
              <RibbonButton icon={Filter} label="Filtrar a hoja" onClick={() => setDataMode('filter')} />
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
              <RibbonButton icon={ClipboardPaste} label="Pegado especial" onClick={() => setDataMode('paste')} />
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
              <RibbonButton icon={LayoutGrid} label="Dar formato como tabla" hideLabel={false} onClick={() => setShowTable(true)} />
              <RibbonButton icon={Table2} label="Tabla dinámica" hideLabel={false} onClick={() => setShowPivot(true)} />
              <RibbonButton icon={RefreshCw} label="Actualizar tablas dinámicas" onClick={refreshPivots} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Minigráficos">
              <RibbonButton icon={Activity} label="Sparkline" hideLabel={false} onClick={() => setDataMode('spark')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Matrices dinámicas">
              <RibbonButton icon={Sparkles} label="Derramar matriz (#)" hideLabel={false} onClick={doSpill} />
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

      <div ref={gridRef} className="flex-1 min-h-0 bg-white relative">
        <Workbook ref={wbRef} key={wbKey} data={liveData as any} lang="es" allowEdit={!readOnly} onChange={handleSheet} hooks={wbHooks} />
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
        {showTable && (
          <SheetTableStyle
            sheetNames={sheetNames()}
            defaultRange={selectionRange()}
            defaultSheetIndex={activeIndex()}
            onApply={applyTable}
            onClose={() => setShowTable(false)}
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
