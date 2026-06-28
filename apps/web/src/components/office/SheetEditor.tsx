'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { ListChecks, Palette, Snowflake, FileText, Sigma, Search, ArrowDownUp, CopyMinus, Columns3, StickyNote, Table2, Hash, Rows3, Activity, ArrowDownToLine, FlipVertical2, Tag, Printer, ClipboardPaste, Filter, RefreshCw, LayoutGrid, Sparkles, Target, Grid3x3, Layers, Crosshair, Combine, CalendarRange, Lock, MessageSquare, Home, Eye, Clipboard, Scissors, Trash2, PaintBucket, Columns3 as ColumnsIcon, Percent, DollarSign, Eraser, MinusCircle, PlusCircle, Presentation } from 'lucide-react';
import dynamic from 'next/dynamic';
import { SheetTools, type ValidationPayload } from './SheetTools';
import { SheetFunctionWizard } from './SheetFunctionWizard';
import { SheetFindReplace } from './SheetFindReplace';
import { SheetDataDialog, type DataMode } from './SheetDataDialog';
import { SheetPivot } from './SheetPivot';
import { SheetFormatDialog, type NumberFmtPayload, type StylePayload } from './SheetFormatDialog';
import { SheetNameManager } from './SheetNameManager';
import { SheetPrintDialog } from './SheetPrintDialog';
import { SheetTableStyle, type TableStylePayload } from './SheetTableStyle';
import { SheetSlicer } from './sheets/SheetSlicer';
import { slicerValues, applySlicers, makeSlicer, makeTimeline, type Slicer, type Timeline } from './sheets/slicer';
import { parseRange, type ChartConfig } from '@/lib/office/charts';
import { applyConditional, sortRangeMulti, removeDuplicates, textToColumns, setCellNote, replaceAll, buildPivot, pivotToCelldata, applyNumberFormat, applyCellStyle, applySubtotals, applySparkline, applyFill, transposeRange, copyRange, buildFilter, mergeCells, unmergeCells, setAutoFilter, clearAutoFilter, buildPrintHtml, usedRange, colName, applyDataVerification, clearDataVerification, markInvalidCells, applyTableStyle, rawOf, type CondPayload, type PivotConfig, type FindOpts, type NamedRange, type PrintOpts } from '@/lib/office/sheetOps';
import { normalizeCellInput } from './sheets/sheetFormula';
import { rangeToMarkdown } from '@/lib/office/sheetMarkdown';
import { installFormulaEngine } from './sheets/formulaEngine';
import { applySpill } from './sheets/arraySpill';
import { goalSeek } from './sheets/goalSeek';
import { SheetGoalSeek, type GoalSeekPayload } from './SheetGoalSeek';
import { dataTable1, dataTable2 } from './sheets/dataTable';
import { SheetDataTable, type DataTablePayload } from './SheetDataTable';
import { autoSumPlan, type AggFn } from './sheets/autoSum';
import { applyScenario, scenarioSummary, type Scenario } from './sheets/scenarios';
import { SheetScenarios } from './SheetScenarios';
import { solve, type SolverVar } from './sheets/solver';
import { SheetSolver, type SolverPayload } from './SheetSolver';
import { consolidateByPosition, consolidateByCategory } from './sheets/consolidate';
import { SheetConsolidate, type ConsolidatePayload } from './SheetConsolidate';
import { setTableRegistry, type TableDef } from './sheets/tableRefs';
import { OfficeRibbon, RibbonTab, RibbonGroup, RibbonSeparator, RibbonButton, RibbonMenuButton } from './ribbon';
import { useToast } from '@/contexts/ToastContext';
import { estimateWorkbookStats, shouldEmitWorkbook, workbookPerformanceLabel, type SignatureState } from '@/lib/office/workbookPerformance';
import { AXOS_SHEET_CONNECTORS, buildAxosConnectorRefresh, buildAxosConnectorTable, connectorProtectionFor, createAxosConnectorInstance, suggestedChartsForConnector, type AxosConnectorInstance, type AxosConnectorType } from '@/lib/office/axosConnectors';
import { addSheetCommentReply, commentsForSelection, createSheetCommentThread, deleteSheetComment, formatSheetCommentSummary, reopenSheetComment, resolveSheetComment, type SheetCommentThread } from '@/lib/office/sheetComments';
import { auditWorkbookFormulas, formatFormulaAuditSummary } from '@/lib/office/formulaAudit';
import { analyzeWorkbookHealth, deriveSheetSelectionStats, deriveWorkbookHealth, formatWorkbookHealthReport } from '@/lib/office/workbookHealth';
import { scanXlsxCompatibility } from '@/lib/office/xlsxCompatibility';
import { formatPivotRefreshReport, refreshStoredPivots } from '@/lib/office/pivotGovernance';
import { buildExecutiveDashboard } from '@/lib/office/dashboardBuilder';

// chart.js + react-chartjs-2 son pesados y solo se usan al insertar gráficas:
// carga diferida para que abrir una hoja sin gráficas no los traiga al bundle.
const SheetCharts = dynamic(
  () => import('./SheetCharts').then((m) => m.SheetCharts),
  { ssr: false },
);

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
function scenariosOf(v: any): Scenario[] {
  return v && Array.isArray(v.scenarios) ? v.scenarios : [];
}
function commentsOf(v: any): SheetCommentThread[] {
  return v && Array.isArray(v.comments) ? v.comments : [];
}
function connectorsOf(v: any): AxosConnectorInstance[] {
  return v && Array.isArray(v.connectors) ? v.connectors : [];
}
type StoredTable = { name: string; sheetIndex: number; range: string };
function tablesOf(v: any): StoredTable[] {
  return v && Array.isArray(v.tables) ? v.tables : [];
}
const DEFAULT_SHEET = { name: 'Hoja 1', celldata: [], order: 0, row: 100, column: 30, config: {} };
const clone = (x: any) => JSON.parse(JSON.stringify(x));
function rangeHasCell(range: string, r: number, c: number): boolean {
  const rng = parseRange(range);
  return !!rng && r >= rng.r1 && r <= rng.r2 && c >= rng.c1 && c <= rng.c2;
}
function isCellProtected(sheet: any, r: number, c: number): boolean {
  const protection = sheet?.axosProtection;
  if (!protection) return false;
  if (protection.sheetLocked) return true;
  return Array.isArray(protection.ranges) && protection.ranges.some((x: any) => x.locked !== false && rangeHasCell(x.range, r, c));
}

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
  const scenariosRef = useRef<Scenario[]>(scenariosOf(value));
  const [scenarios, setScenarios] = useState<Scenario[]>(scenariosRef.current);
  const tablesRef = useRef<StoredTable[]>(tablesOf(value));
  const commentsRef = useRef<SheetCommentThread[]>(commentsOf(value));
  const connectorsRef = useRef<AxosConnectorInstance[]>(connectorsOf(value));
  const [showScenarios, setShowScenarios] = useState(false);
  const [showNames, setShowNames] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [tool, setTool] = useState<null | 'validation' | 'condformat'>(null);
  const [dataMode, setDataMode] = useState<DataMode | null>(null);
  const [showSlicers, setShowSlicers] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [showPivot, setShowPivot] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [showGoalSeek, setShowGoalSeek] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const [showSolver, setShowSolver] = useState(false);
  const [showConsolidate, setShowConsolidate] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'workbook' | 'cell' | 'data' | 'charts' | 'pivot' | 'comments' | 'protection' | 'xlsx' | 'axos'>('workbook');
  const [selectionText, setSelectionText] = useState('A1');
  const [formulaText, setFormulaText] = useState('');
  const [editMode, setEditMode] = useState<'Listo' | 'Editando'>('Listo');
  const [zoom, setZoom] = useState(100);
  const [contextMenu, setContextMenu] = useState<null | { x: number; y: number }>(null);
  const [, setTick] = useState(0);
  const refreshT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emitSignatureRef = useRef<SignatureState>({});

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


  useEffect(() => {
    const refresh = () => {
      try {
        const range = selectionRange();
        setSelectionText(range);
        const sheet = sheetsRef.current[activeIndex()] ?? sheetsRef.current[0];
        const first = range.split(':')[0];
        const rng = parseRange(first);
        const cd = rng ? (sheet?.celldata ?? []).find((x: any) => x.r === rng.r1 && x.c === rng.c1) : null;
        const v = cd?.v;
        setFormulaText(v && typeof v === 'object' && v.f ? String(v.f) : String(rawOf(cd as any) ?? ''));
      } catch { /* noop: selection is not ready while Fortune-Sheet mounts */ }
    };
    refresh();
    const t = window.setInterval(refresh, 700);
    return () => window.clearInterval(t);
  }, []);

  const workbookPayload = useCallback(() => ({
    sheets: sheetsRef.current,
    charts: chartsRef.current,
    names: namesRef.current,
    pivots: pivotsRef.current,
    scenarios: scenariosRef.current,
    tables: tablesRef.current,
    comments: commentsRef.current,
    connectors: connectorsRef.current,
  }), []);

  const emit = useCallback(() => {
    const payload = workbookPayload();
    if (!shouldEmitWorkbook(payload, emitSignatureRef.current)) return;
    onChangeRef.current(payload);
  }, [workbookPayload]);

  const currentWorkbookStats = () => {
    const stats = estimateWorkbookStats(workbookPayload());
    return { ...stats, label: workbookPerformanceLabel(stats) };
  };

  // Registro de tablas con nombre para las referencias estructuradas `Tabla[Columna]`. Se
  // resuelve a TableDef[] (con nombre de hoja, rango y cabeceras leídas de la fila superior) y se
  // publica en el motor (registro global que consulta el parche del parser).
  function rebuildTableRegistry() {
    const sheets = sheetsRef.current;
    const defs: TableDef[] = [];
    for (const t of tablesRef.current) {
      const sheet = sheets[t.sheetIndex]; if (!sheet) continue;
      const rng = parseRange(t.range); if (!rng) continue;
      const map = new Map<string, any>((sheet.celldata ?? []).map((cd: any) => [`${cd.r}_${cd.c}`, cd]));
      const headers: string[] = [];
      for (let c = rng.c1; c <= rng.c2; c++) { const cd = map.get(`${rng.r1}_${c}`); const raw = cd?.v && typeof cd.v === 'object' ? (cd.v.v ?? cd.v.m) : cd?.v; headers.push(String(raw ?? '')); }
      defs.push({ name: t.name, sheetName: sheet.name || `Hoja ${t.sheetIndex + 1}`, r1: rng.r1, c1: rng.c1, r2: rng.r2, c2: rng.c2, headers });
    }
    setTableRegistry(defs);
  }
  // Publica el registro al montar (y cuando se recarga el documento).
  useEffect(() => { rebuildTableRegistry(); }, []);

  // Entrada de celda estilo Excel para lo que se TECLEA directamente en la rejilla.
  // Fortune-Sheet sólo evalúa lo que empieza por «=»; aquí puenteamos el atajo Lotus
  // «+…»/«-…» (p. ej. +1+1, -A1*2): si la normalización cambia el texto, cancelamos
  // la escritura cruda y reaplicamos la fórmula normalizada con la API (fuera de este
  // ciclo de actualización para no anidar setContext), de modo que el motor calcule
  // f + v y recalcule dependientes. Objeto estable (definido una vez).
  const wbHooks = useMemo(() => ({
    beforeUpdateCell: (r: number, c: number, value: any): boolean => {
      const sheet = sheetsRef.current[activeIndex()] ?? sheetsRef.current[0];
      if (isCellProtected(sheet, r, c)) {
        toast.error('Celda protegida. Quita la protección de hoja o rango para editar.');
        return false;
      }
      if (typeof value !== 'string' || value.indexOf('\n') >= 0) return true;
      const norm = normalizeCellInput(value);
      if (norm === value) return true; // nada que reescribir → flujo normal
      const wb = wbRef.current;
      if (!wb?.setCellValue) return true;
      window.setTimeout(() => { try { wb.setCellValue(r, c, norm); } catch { /* noop */ } }, 0);
      return false; // cancela la escritura del texto crudo
    },
  }), [toast]);

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

  function selectionStats() {
    const sheet = sheetsRef.current[activeIndex()] ?? sheetsRef.current[0];
    return deriveSheetSelectionStats(sheet, selectionRange(), commentsRef.current.filter((c) => c.sheetIndex === activeIndex()));
  }
  function commitFormulaBar() {
    const cell = selectionRange().split(':')[0];
    const rng = parseRange(cell);
    const wb = wbRef.current;
    if (!rng || !wb?.setCellValue) return;
    try { wb.setCellValue(rng.r1, rng.c1, normalizeCellInput(formulaText)); setEditMode('Listo'); }
    catch { toast.error('No se pudo escribir en la celda seleccionada.'); }
  }
  function applyQuickNumberFormat(code: string, currency?: string) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0]; if (!sheet) return;
    applyNumberFormat(sheet, selectionRange(), code, { currency });
    remount(sheets);
  }
  function applyQuickStyle(style: any) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0]; if (!sheet) return;
    applyCellStyle(sheet, selectionRange(), style);
    remount(sheets);
  }
  function clearSelectedFormatting() {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0]; const rng = parseRange(selectionRange());
    if (!sheet || !rng) return;
    for (const cd of sheet.celldata ?? []) if (cd.r >= rng.r1 && cd.r <= rng.r2 && cd.c >= rng.c1 && cd.c <= rng.c2 && cd.v && typeof cd.v === 'object') {
      for (const k of ['bg', 'fc', 'bl', 'it', 'fs', 'ff', 'ht', 'vt', 'tb', 'cl', 'un', 'bd']) delete cd.v[k];
      cd.v.ct = { fa: 'General', t: typeof cd.v.v === 'number' ? 'n' : 's' };
    }
    remount(sheets);
  }
  function shiftRows(at: number, delta: 1 | -1) {
    const sheets = clone(sheetsRef.current); const sheet = sheets[activeIndex()] ?? sheets[0]; if (!sheet) return;
    sheet.celldata = (sheet.celldata ?? [])
      .filter((cd: any) => !(delta < 0 && cd.r === at))
      .map((cd: any) => (cd.r >= at + (delta < 0 ? 1 : 0) ? { ...cd, r: cd.r + delta } : cd));
    sheet.row = Math.max(1, (sheet.row ?? 100) + delta);
    remount(sheets);
  }
  function shiftCols(at: number, delta: 1 | -1) {
    const sheets = clone(sheetsRef.current); const sheet = sheets[activeIndex()] ?? sheets[0]; if (!sheet) return;
    sheet.celldata = (sheet.celldata ?? [])
      .filter((cd: any) => !(delta < 0 && cd.c === at))
      .map((cd: any) => (cd.c >= at + (delta < 0 ? 1 : 0) ? { ...cd, c: cd.c + delta } : cd));
    sheet.column = Math.max(1, (sheet.column ?? 26) + delta);
    remount(sheets);
  }
  function selectionOrigin() {
    const rng = parseRange(selectionRange());
    return { r: rng?.r1 ?? 0, c: rng?.c1 ?? 0 };
  }


  function upsertConnectorProtection(sheet: any, instance: AxosConnectorInstance) {
    const protection = sheet.axosProtection ?? {};
    const ranges = Array.isArray(protection.ranges) ? protection.ranges : [];
    const next = connectorProtectionFor(instance);
    sheet.axosProtection = {
      ...protection,
      ranges: [...ranges.filter((r: any) => r.connectorId !== instance.id && !(r.connectorType === instance.type && r.range === instance.range)), next],
    };
  }

  function insertAxosConnector(type: AxosConnectorType) {
    if (readOnly) return;
    const sheets = clone(sheetsRef.current);
    const sheetIndex = activeIndex();
    const sheet = sheets[sheetIndex] ?? sheets[0]; if (!sheet) return;
    const origin = selectionOrigin();
    const built = buildAxosConnectorTable(type, origin);
    sheet.celldata = sheet.celldata || [];
    const occupied = new Map<string, any>((sheet.celldata ?? []).map((cd: any) => [`${cd.r}_${cd.c}`, cd]));
    built.celldata.forEach((cd) => occupied.set(`${cd.r}_${cd.c}`, cd));
    sheet.celldata = [...occupied.values()];
    sheet.row = Math.max(sheet.row ?? 100, origin.r + built.nRows + 3);
    sheet.column = Math.max(sheet.column ?? 30, origin.c + built.nCols + 2);
    const instance = createAxosConnectorInstance(type, sheetIndex, built.range);
    upsertConnectorProtection(sheet, instance);
    const chartSuggestions = suggestedChartsForConnector(instance);
    if (chartSuggestions.length) {
      chartsRef.current = [...chartsRef.current.filter((chart) => !chartSuggestions.some((next) => next.id === chart.id)), ...chartSuggestions];
      setCharts(chartsRef.current);
    }
    connectorsRef.current = [...connectorsRef.current.filter((c) => !(c.sheetIndex === sheetIndex && c.type === type && c.range === built.range)), instance];
    remount(sheets);
    window.setTimeout(() => toast.success(`${instance.label} insertado en ${built.range}.`), 30);
  }


  function refreshAxosConnectors() {
    if (readOnly) return;
    if (!connectorsRef.current.length) { toast.info('No hay conectores AXOS insertados en este libro.'); return; }
    const sheets = clone(sheetsRef.current);
    const refreshed: AxosConnectorInstance[] = [];
    let count = 0;
    for (const connector of connectorsRef.current) {
      const sheet = sheets[connector.sheetIndex];
      const built = buildAxosConnectorRefresh(connector);
      if (!sheet || !built) { refreshed.push(connector); continue; }
      const occupied = new Map<string, any>((sheet.celldata ?? []).map((cd: any) => [`${cd.r}_${cd.c}`, cd]));
      built.table.celldata.forEach((cd) => occupied.set(`${cd.r}_${cd.c}`, cd));
      sheet.celldata = [...occupied.values()];
      sheet.row = Math.max(sheet.row ?? 100, built.table.celldata.reduce((m, cd) => Math.max(m, cd.r + 4), 0));
      sheet.column = Math.max(sheet.column ?? 30, built.table.celldata.reduce((m, cd) => Math.max(m, cd.c + 3), 0));
      upsertConnectorProtection(sheet, built.instance);
      const chartSuggestions = suggestedChartsForConnector(built.instance);
      if (chartSuggestions.length) chartsRef.current = [...chartsRef.current.filter((chart) => !chartSuggestions.some((next) => next.id === chart.id)), ...chartSuggestions];
      refreshed.push(built.instance);
      count++;
    }
    connectorsRef.current = refreshed;
    setCharts(chartsRef.current);
    remount(sheets);
    window.setTimeout(() => toast.success(`${count} conectores AXOS actualizados.`), 30);
  }

  function runGridCommand(cmd: 'copy' | 'cut' | 'paste') {
    const wb = wbRef.current;
    const grid = gridRef.current;
    grid?.querySelector<HTMLElement>('.luckysheet-cell-input')?.focus();
    if (cmd === 'copy') wb?.handleCopy?.();
    else if (cmd === 'cut') wb?.handleCut?.();
    else wb?.handlePaste?.();
  }


  function selectedCommentThreads(includeResolved = false) {
    return commentsForSelection(commentsRef.current, activeIndex(), selectionRange(), includeResolved);
  }
  function addSheetComment() {
    const text = window.prompt('Comentario para la celda/rango seleccionado:');
    if (!text?.trim()) return;
    const comment = createSheetCommentThread({ sheetIndex: activeIndex(), range: selectionRange(), text, author: 'AXOS' });
    commentsRef.current = [...commentsRef.current, comment];
    emit();
    toast.success(`Comentario agregado en ${comment.range}.`);
  }
  function showSheetComments() {
    const mine = commentsRef.current.filter((c) => c.sheetIndex === activeIndex() && !c.resolved);
    if (!mine.length) { toast.info('No hay comentarios abiertos en esta hoja.'); return; }
    window.alert(mine.map((c, i) => `${i + 1}. ${formatSheetCommentSummary(c)}`).join('\n'));
  }
  function replySelectionComment() {
    const [first] = selectedCommentThreads();
    if (!first) { toast.info(`No hay comentarios abiertos exactamente en ${selectionRange()}.`); return; }
    const text = window.prompt('Respuesta al comentario seleccionado:');
    if (!text?.trim()) return;
    commentsRef.current = addSheetCommentReply(commentsRef.current, first.id, text, 'AXOS');
    emit();
    toast.success(`Respuesta agregada en ${first.range}.`);
  }
  function resolveSelectionComments() {
    const threads = selectedCommentThreads();
    if (!threads.length) { toast.info(`No hay comentarios abiertos exactamente en ${selectionRange()}.`); return; }
    for (const thread of threads) commentsRef.current = resolveSheetComment(commentsRef.current, thread.id);
    emit();
    toast.success(`Comentarios resueltos en ${selectionRange()}.`);
  }
  function reopenSelectionComments() {
    const threads = selectedCommentThreads(true).filter((c) => c.resolved);
    if (!threads.length) { toast.info(`No hay comentarios resueltos exactamente en ${selectionRange()}.`); return; }
    for (const thread of threads) commentsRef.current = reopenSheetComment(commentsRef.current, thread.id);
    emit();
    toast.success(`Comentarios reabiertos en ${selectionRange()}.`);
  }
  function deleteSelectionComments() {
    const threads = selectedCommentThreads(true);
    if (!threads.length) { toast.info(`No hay comentarios exactamente en ${selectionRange()}.`); return; }
    if (!window.confirm(`Eliminar ${threads.length} comentario(s) de ${selectionRange()}?`)) return;
    for (const thread of threads) commentsRef.current = deleteSheetComment(commentsRef.current, thread.id);
    emit();
    toast.success(`Comentarios eliminados en ${selectionRange()}.`);
  }
  function protectSheet(lock: boolean) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet) return;
    sheet.axosProtection = { ...(sheet.axosProtection ?? {}), sheetLocked: lock };
    remount(sheets);
    window.setTimeout(() => toast.success(lock ? 'Hoja protegida.' : 'Protección de hoja desactivada.'), 30);
  }
  function protectSelectionRange() {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet) return;
    const range = selectionRange();
    sheet.axosProtection = { ...(sheet.axosProtection ?? {}), ranges: [...(sheet.axosProtection?.ranges ?? []), { range, locked: true, createdAt: new Date().toISOString() }] };
    remount(sheets);
    window.setTimeout(() => toast.success(`Rango protegido: ${range}.`), 30);
  }
  function clearRangeProtection() {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet?.axosProtection?.ranges?.length) { toast.info('No hay rangos protegidos en esta hoja.'); return; }
    const range = selectionRange();
    sheet.axosProtection.ranges = sheet.axosProtection.ranges.filter((x: any) => x.range !== range);
    remount(sheets);
    window.setTimeout(() => toast.info(`Protección quitada para ${range} si existía.`), 30);
  }

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

  // Combinar / separar celdas sobre la selección actual del grid (formato `config.merge`).
  function applyMerge(doMerge: boolean) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!sheet) return;
    const range = selectionRange();
    if (doMerge) {
      if (!mergeCells(sheet, range)) { toast.info('Selecciona dos o más celdas para combinar.'); return; }
      remount(sheets); window.setTimeout(() => toast.info(`Celdas combinadas (${range}).`), 30);
    } else {
      const n = unmergeCells(sheet, range);
      remount(sheets); window.setTimeout(() => toast.info(n ? `${n} combinación(es) separada(s).` : 'No hay combinaciones en la selección.'), 30);
    }
  }

  // Autofiltro nativo en su sitio (flechas en el encabezado) sobre la selección actual.
  function applyAutoFilter(enable: boolean) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!sheet) return;
    if (enable) {
      const range = selectionRange();
      if (!setAutoFilter(sheet, range)) { toast.error('Rango inválido.'); return; }
      remount(sheets); window.setTimeout(() => toast.info(`Autofiltro activado (${range}).`), 30);
    } else {
      const had = clearAutoFilter(sheet);
      remount(sheets); window.setTimeout(() => toast.info(had ? 'Autofiltro quitado.' : 'No había autofiltro.'), 30);
    }
  }

  // ── Segmentaciones (slicers) y escala de tiempo ──────────────────────────────
  const activeSheetLive = () => liveData.find((s: any) => s?.status === 1) ?? liveData[0];
  function headerLabel(sheet: any, r: number, c: number): string {
    const cd = (sheet?.celldata ?? []).find((x: any) => x.r === r && x.c === c);
    const v = cd?.v; const disp = v == null ? '' : String((typeof v === 'object' ? (v.m ?? v.v) : v) ?? '');
    return disp || colName(c);
  }
  function insertSlicer(kind: 'slicer' | 'timeline') {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!sheet) return;
    const rng = parseRange(selectionRange()); if (!rng) { toast.error('Selecciona una columna con encabezado.'); return; }
    const header = headerLabel(sheet, rng.r1, rng.c1);
    const range = `${colName(rng.c1)}${rng.r1 + 1}:${colName(rng.c1)}${rng.r2 + 1}`;
    if (kind === 'slicer') sheet.slicers = [...(sheet.slicers ?? []), makeSlicer(range, 0, header)];
    else sheet.timelines = [...(sheet.timelines ?? []), makeTimeline(range, 0, header)];
    applySlicers(sheet); remount(sheets); setShowSlicers(true);
  }
  function mutateSlicers(fn: (sheet: any) => void) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets.find((s: any) => s.status === 1) ?? sheets[0];
    if (!sheet) return;
    fn(sheet); applySlicers(sheet); remount(sheets);
  }
  const slicerValuesFor = (s: Slicer) => slicerValues(activeSheetLive(), s.range, s.colRel);
  const toggleSlicerValue = (id: string, value: string) => mutateSlicers((sheet) => {
    const s = (sheet.slicers ?? []).find((x: Slicer) => x.id === id); if (!s) return;
    const all = slicerValues(sheet, s.range, s.colRel);
    let sel = s.selected == null ? [...all] : [...s.selected];
    sel = sel.includes(value) ? sel.filter((x: string) => x !== value) : [...sel, value];
    s.selected = sel.length === all.length ? null : sel;
  });
  const clearSlicer = (id: string) => mutateSlicers((sheet) => { const s = (sheet.slicers ?? []).find((x: Slicer) => x.id === id); if (s) s.selected = null; });
  const removeSlicer = (id: string) => mutateSlicers((sheet) => { sheet.slicers = (sheet.slicers ?? []).filter((x: Slicer) => x.id !== id); });
  const setTimelineRange = (id: string, from: string, to: string) => mutateSlicers((sheet) => { const t = (sheet.timelines ?? []).find((x: Timeline) => x.id === id); if (t) { t.from = from || null; t.to = to || null; } });
  const removeTimeline = (id: string) => mutateSlicers((sheet) => { sheet.timelines = (sheet.timelines ?? []).filter((x: Timeline) => x.id !== id); });

  // Copia la selección actual como tabla Markdown (GFM) al portapapeles.
  async function copyRangeAsMarkdown() {
    const sheet = sheetsRef.current.find((s: any) => s.status === 1) ?? sheetsRef.current[0];
    if (!sheet) return;
    const range = selectionRange();
    const md = rangeToMarkdown(sheet, range);
    if (!md) { toast.error('Selección vacía.'); return; }
    try { await navigator.clipboard.writeText(md); window.setTimeout(() => toast.info(`Tabla Markdown copiada (${range}).`), 30); }
    catch { toast.error('No se pudo copiar al portapapeles.'); }
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
    const { sheets, report } = refreshStoredPivots(sheetsRef.current, stored);
    if (report.updated > 0) remount(sheets);
    const message = formatPivotRefreshReport(report);
    window.setTimeout(() => {
      if (report.skipped > 0) toast.info(message);
      else toast.success(message);
    }, 30);
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

  // Buscar objetivo (Goal Seek): resuelve el valor de la celda variable que hace que la
  // fórmula alcance el objetivo, y lo escribe en la hoja.
  function doGoalSeek(p: GoalSeekPayload): { ok: boolean; text: string } {
    const tgt = Number(p.target.replace(',', '.'));
    if (!Number.isFinite(tgt)) return { ok: false, text: 'El valor objetivo debe ser un número.' };
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet) return { ok: false, text: 'No hay hoja activa.' };
    const res = goalSeek(sheet, p.formulaCell, tgt, p.variableCell);
    if (!res.ok) return { ok: false, text: res.error || 'No se encontró solución.' };
    remount(sheets);
    return { ok: true, text: `${p.variableCell} = ${res.value} hace que ${p.formulaCell} ≈ ${res.result} (${res.iterations} iteraciones).` };
  }

  // Administrador de escenarios: guarda/aplica conjuntos de valores de entrada y genera un
  // informe de resumen (cada celda de resultado bajo cada escenario) en una hoja nueva.
  const addScenario = useCallback((sc: Scenario) => { scenariosRef.current = [...scenariosRef.current.filter((s) => s.name !== sc.name), sc]; setScenarios(scenariosRef.current); emit(); }, [emit]);
  const removeScenario = useCallback((name: string) => { scenariosRef.current = scenariosRef.current.filter((s) => s.name !== name); setScenarios(scenariosRef.current); emit(); }, [emit]);
  function applyScenarioToActive(sc: Scenario) {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet) return;
    applyScenario(sheet, sc);
    remount(sheets);
    window.setTimeout(() => toast.success(`Escenario «${sc.name}» aplicado.`), 30);
  }
  function doScenarioSummary(resultCellsText: string): { ok: boolean; text: string } {
    const cells = resultCellsText.split(/[,;\s]+/).filter(Boolean).map((s) => s.toUpperCase());
    if (!cells.length) return { ok: false, text: 'Indica al menos una celda de resultado (p. ej. B5).' };
    if (!scenariosRef.current.length) return { ok: false, text: 'No hay escenarios guardados.' };
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    const sum = scenarioSummary(sheet, scenariosRef.current, cells);
    const cd: any[] = [{ r: 0, c: 0, v: { v: 'Celda de resultado', m: 'Celda de resultado', bl: 1 } }];
    sum.headers.forEach((h, j) => cd.push({ r: 0, c: j + 1, v: { v: h, m: h, bl: 1 } }));
    sum.rows.forEach((row, i) => {
      cd.push({ r: i + 1, c: 0, v: { v: row.cell, m: row.cell, bl: 1 } });
      row.values.forEach((v, j) => cd.push({ r: i + 1, c: j + 1, v: { v, m: String(v) } }));
    });
    const n = sheets.filter((s: any) => /Resumen de escenarios/.test(s?.name ?? '')).length + 1;
    pushResultSheet(sheets, `Resumen de escenarios ${n}`, cd, sum.rows.length + 3, sum.headers.length + 3);
    remount(sheets);
    return { ok: true, text: `Resumen generado en una hoja nueva (${cells.length} celda(s) × ${sum.headers.length} escenario(s)).` };
  }

  // Consolidar datos: lee varios rangos (admite «Hoja!A1:C4») y los combina en una hoja nueva.
  function readRangeGrid(sheets: any[], spec: string): any[][] | null {
    let sheetName: string | null = null; let rangeStr = spec;
    const bang = spec.indexOf('!');
    if (bang >= 0) { sheetName = spec.slice(0, bang).replace(/^'|'$/g, ''); rangeStr = spec.slice(bang + 1); }
    const sheet = sheetName ? sheets.find((s: any) => (s.name || '') === sheetName) : (sheets[activeIndex()] ?? sheets[0]);
    if (!sheet) return null;
    const rng = parseRange(rangeStr);
    if (!rng) return null;
    const map = new Map<string, any>((sheet.celldata ?? []).map((cd: any) => [`${cd.r}_${cd.c}`, cd]));
    const grid: any[][] = [];
    for (let r = rng.r1; r <= rng.r2; r++) {
      const row: any[] = [];
      for (let c = rng.c1; c <= rng.c2; c++) { const cd = map.get(`${r}_${c}`); const raw = cd?.v && typeof cd.v === 'object' ? (cd.v.v ?? cd.v.m) : cd?.v; row.push(raw ?? ''); }
      grid.push(row);
    }
    return grid;
  }
  function doConsolidate(p: ConsolidatePayload): { ok: boolean; text: string } {
    const sheets = clone(sheetsRef.current);
    const specs = p.ranges.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
    const tables: any[][][] = [];
    for (const spec of specs) { const g = readRangeGrid(sheets, spec); if (!g) return { ok: false, text: `Rango inválido: ${spec}` }; tables.push(g); }
    const result = p.mode === 'category' ? consolidateByCategory(tables, p.agg) : consolidateByPosition(tables, p.agg);
    if (!result.length) return { ok: false, text: 'No hay datos para consolidar.' };
    const cd: any[] = [];
    result.forEach((row, r) => row.forEach((v, c) => { if (v !== '' && v != null) cd.push({ r, c, v: { v, m: String(v), ...(r === 0 || (p.mode === 'category' && c === 0) ? { bl: 1 } : {}) } }); }));
    const n = sheets.filter((s: any) => /Consolidado/.test(s?.name ?? '')).length + 1;
    pushResultSheet(sheets, `Consolidado ${n}`, cd, result.length + 3, (result[0]?.length ?? 4) + 3);
    remount(sheets);
    return { ok: true, text: `Consolidado de ${tables.length} rango(s) en «Consolidado ${n}».` };
  }

  // Solver: optimiza una celda objetivo cambiando varias variables (con restricciones >=/<=).
  function doSolve(p: SolverPayload): { ok: boolean; text: string } {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet) return { ok: false, text: 'No hay hoja activa.' };
    const cells = p.variables.split(/[,;\s]+/).filter(Boolean).map((s) => s.toUpperCase());
    if (!cells.length) return { ok: false, text: 'Indica al menos una celda variable.' };
    const bounds = new Map<string, { min?: number; max?: number }>();
    (p.bounds || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean).forEach((b) => {
      const m = /^([A-Za-z]+\d+)\s*(<=|>=|≤|≥)\s*(-?\d+(?:[.,]\d+)?)$/.exec(b);
      if (!m) return;
      const cell = m[1].toUpperCase(); const val = Number(m[3].replace(',', '.')); const cur = bounds.get(cell) || {};
      if (m[2] === '>=' || m[2] === '≥') cur.min = val; else cur.max = val;
      bounds.set(cell, cur);
    });
    const variables: SolverVar[] = cells.map((c) => ({ cell: c, ...(bounds.get(c) || {}) }));
    const target = Number((p.target || '0').replace(',', '.'));
    const res = solve(sheet, p.objective, p.goal, target, variables);
    if (!res.ok || !res.values) return { ok: false, text: res.error || 'No se encontró solución.' };
    remount(sheets);
    return { ok: true, text: `Óptimo: ${res.values.map((v) => `${v.cell}=${v.value}`).join(', ')} → objetivo ${res.objective} (${res.iterations} it).` };
  }

  // Autosuma: inserta =FN(rango seleccionado) en la celda contigua (debajo/derecha).
  function doAutoSum(fn: AggFn) {
    const plan = autoSumPlan(selectionRange(), fn);
    if (!plan) { toast.error('Selecciona un rango para la autosuma.'); return; }
    const t = parseRange(plan.targetCell);
    const wb = wbRef.current;
    if (t && wb?.setCellValue) {
      try { wb.setCellValue(t.r1, t.c1, plan.formula); toast.success(`${plan.formula} → ${plan.targetCell}`); return; }
      catch { /* fallback al portapapeles */ }
    }
    navigator.clipboard?.writeText(plan.formula).then(() => toast.info(`Copiado: ${plan.formula}`)).catch(() => toast.info(plan.formula));
  }

  // Tabla de datos (análisis de hipótesis): evalúa la fórmula para cada valor de entrada y
  // escribe la rejilla de resultados en una hoja nueva.
  function readValues(sheet: any, text: string): number[] {
    const rng = parseRange(text);
    if (rng) {
      const out: number[] = [];
      const map = new Map<string, any>((sheet.celldata ?? []).map((cd: any) => [`${cd.r}_${cd.c}`, cd]));
      for (let r = rng.r1; r <= rng.r2; r++) for (let c = rng.c1; c <= rng.c2; c++) {
        const cd = map.get(`${r}_${c}`); const raw = cd?.v && typeof cd.v === 'object' ? (cd.v.v ?? cd.v.m) : cd?.v;
        const n = Number(raw); if (Number.isFinite(n) && raw !== '' && raw != null) out.push(n);
      }
      return out;
    }
    return text.split(/[,;\s]+/).filter(Boolean).map((s) => Number(s.replace(',', '.'))).filter((n) => Number.isFinite(n));
  }
  function pushResultSheet(sheets: any[], name: string, celldata: any[], rows: number, cols: number) {
    sheets.forEach((s: any) => { s.status = 0; });
    sheets.push({ name, celldata, order: sheets.length, row: Math.max(100, rows + 8), column: Math.max(26, cols + 4), config: {}, status: 1 });
  }
  function doDataTable(p: DataTablePayload): { ok: boolean; text: string } {
    const sheets = clone(sheetsRef.current);
    const sheet = sheets[activeIndex()] ?? sheets[0];
    if (!sheet) return { ok: false, text: 'No hay hoja activa.' };
    const colVals = readValues(sheet, p.colValues);
    if (!colVals.length) return { ok: false, text: 'No hay valores de entrada válidos.' };
    const n = sheets.filter((s: any) => /Tabla de datos/.test(s?.name ?? '')).length + 1;
    const name = `Tabla de datos ${n}`;
    if (p.mode === 'one') {
      const res = dataTable1(sheet, p.formulaCell, p.colInputCell, colVals);
      if (!res.ok || !res.results) return { ok: false, text: res.error || 'No se pudo calcular.' };
      const cd: any[] = [{ r: 0, c: 0, v: { v: 'Valor', m: 'Valor', bl: 1 } }, { r: 0, c: 1, v: { v: 'Resultado', m: 'Resultado', bl: 1 } }];
      colVals.forEach((v, i) => { cd.push({ r: i + 1, c: 0, v: { v, m: String(v) } }, { r: i + 1, c: 1, v: { v: res.results![i], m: String(res.results![i]) } }); });
      pushResultSheet(sheets, name, cd, colVals.length + 2, 4);
    } else {
      const rowVals = readValues(sheet, p.rowValues);
      if (!rowVals.length) return { ok: false, text: 'No hay valores de fila válidos.' };
      const res = dataTable2(sheet, p.formulaCell, p.rowInputCell, p.colInputCell, rowVals, colVals);
      if (!res.ok || !res.matrix) return { ok: false, text: res.error || 'No se pudo calcular.' };
      const cd: any[] = [];
      colVals.forEach((cv, j) => cd.push({ r: 0, c: j + 1, v: { v: cv, m: String(cv), bl: 1 } }));
      rowVals.forEach((rv, i) => {
        cd.push({ r: i + 1, c: 0, v: { v: rv, m: String(rv), bl: 1 } });
        colVals.forEach((_, j) => cd.push({ r: i + 1, c: j + 1, v: { v: res.matrix![i][j], m: String(res.matrix![i][j]) } }));
      });
      pushResultSheet(sheets, name, cd, rowVals.length + 2, colVals.length + 3);
    }
    remount(sheets);
    return { ok: true, text: `Tabla de datos generada en «${name}».` };
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



  function showWorkbookHealth() {
    const report = analyzeWorkbookHealth(workbookPayload());
    window.alert(formatWorkbookHealthReport(report));
  }

  function auditFormulas() {
    const result = auditWorkbookFormulas(workbookPayload());
    if (!result.total) { toast.info('No hay fórmulas para auditar en este libro.'); return; }
    window.alert(formatFormulaAuditSummary(result));
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
    // Tabla con nombre → referencias estructuradas `TablaN[Columna]` (sólo si tiene encabezado).
    let created = '';
    if (n && opts.hasHeader !== false && parseRange(opts.range)) {
      created = `Tabla${tablesRef.current.length + 1}`;
      tablesRef.current = [...tablesRef.current, { name: created, sheetIndex, range: opts.range }];
      rebuildTableRegistry();
    }
    remount(sheets);
    if (!n) window.setTimeout(() => toast.error('Rango inválido para la tabla.'), 30);
    else if (created) window.setTimeout(() => toast.success(`Tabla creada: ${created} — usa ${created}[Columna] en fórmulas.`), 30);
  }


  function createExecutiveDashboard() {
    if (readOnly) return;
    const sheets = clone(sheetsRef.current);
    sheets.forEach((sheet: any) => { sheet.status = 0; });
    const result = buildExecutiveDashboard({
      sheets,
      charts: chartsRef.current,
      pivots: pivotsRef.current,
      connectors: connectorsRef.current,
    });
    sheets.push(result.sheet);
    chartsRef.current = result.charts;
    setCharts(chartsRef.current);
    remount(sheets);
    window.setTimeout(() => toast.success(`${result.sheet.name} creado con KPIs, narrativa ejecutiva y visualizaciones.`), 30);
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
          <RibbonTab id="home" label="Inicio" icon={Home}>
            <RibbonGroup label="Portapapeles">
              <RibbonButton icon={Clipboard} label="Copiar" onClick={() => runGridCommand('copy')} />
              <RibbonButton icon={Scissors} label="Cortar" onClick={() => runGridCommand('cut')} />
              <RibbonButton icon={ClipboardPaste} label="Pegar" onClick={() => runGridCommand('paste')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Número">
              <RibbonButton icon={DollarSign} label="Moneda" onClick={() => applyQuickNumberFormat('"$"#,##0.00', 'USD')} />
              <RibbonButton icon={Percent} label="Porcentaje" onClick={() => applyQuickNumberFormat('0.0%')} />
              <RibbonButton icon={Hash} label="General" onClick={() => applyQuickNumberFormat('General')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Formato rápido">
              <RibbonButton icon={PaintBucket} label="Relleno AXOS" onClick={() => applyQuickStyle({ bg: '#ecfdf5', fc: '#065f46' })} />
              <RibbonButton icon={Eraser} label="Limpiar formato" onClick={clearSelectedFormatting} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Celdas">
              <RibbonButton icon={PlusCircle} label="Insertar fila" onClick={() => shiftRows(selectionOrigin().r, 1)} />
              <RibbonButton icon={MinusCircle} label="Eliminar fila" onClick={() => shiftRows(selectionOrigin().r, -1)} />
              <RibbonButton icon={ColumnsIcon} label="Insertar columna" onClick={() => shiftCols(selectionOrigin().c, 1)} />
              <RibbonButton icon={Trash2} label="Eliminar columna" onClick={() => shiftCols(selectionOrigin().c, -1)} />
            </RibbonGroup>
          </RibbonTab>
        )}
        {!readOnly && (
          <RibbonTab id="data" label="Datos">
            <RibbonGroup label="Herramientas de datos">
              <RibbonButton icon={ListChecks} label="Validación de datos" onClick={() => setTool('validation')} />
              <RibbonButton icon={Palette} label="Formato condicional" onClick={() => setTool('condformat')} />
              <RibbonButton icon={Hash} label="Copiar como Markdown" hideLabel={false} onClick={copyRangeAsMarkdown} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Ordenar y filtrar">
              <RibbonButton icon={ArrowDownUp} label="Ordenar rango (multinivel)" onClick={() => setDataMode('sort')} />
              <RibbonMenuButton icon={Filter} label="Autofiltro" menuWidth={250} items={[
                { label: 'Activar autofiltro (selección)', onClick: () => applyAutoFilter(true) },
                { label: 'Quitar autofiltro', onClick: () => applyAutoFilter(false) },
              ]} />
              <RibbonButton icon={Filter} label="Filtrar a hoja" onClick={() => setDataMode('filter')} />
              <RibbonButton icon={Crosshair} label="Segmentación de datos" onClick={() => insertSlicer('slicer')} />
              <RibbonButton icon={CalendarRange} label="Escala de tiempo" onClick={() => insertSlicer('timeline')} />
              <RibbonButton icon={CopyMinus} label="Quitar duplicados" onClick={() => setDataMode('dedup')} />
              <RibbonButton icon={Columns3} label="Texto en columnas" onClick={() => setDataMode('split')} />
              <RibbonButton icon={Combine} label="Consolidar" onClick={() => setShowConsolidate(true)} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Esquema">
              <RibbonButton icon={Rows3} label="Subtotales" onClick={() => setDataMode('subtotal')} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Análisis de hipótesis">
              <RibbonButton icon={Target} label="Buscar objetivo" hideLabel={false} onClick={() => setShowGoalSeek(true)} />
              <RibbonButton icon={Grid3x3} label="Tabla de datos" hideLabel={false} onClick={() => setShowDataTable(true)} />
              <RibbonButton icon={Layers} label="Administrador de escenarios" hideLabel={false} onClick={() => setShowScenarios(true)} />
              <RibbonButton icon={Crosshair} label="Solver" hideLabel={false} onClick={() => setShowSolver(true)} />
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
            <RibbonGroup label="Dashboards">
              <RibbonButton icon={Presentation} label="Dashboard ejecutivo" hideLabel={false} onClick={createExecutiveDashboard} />
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
              <RibbonMenuButton icon={LayoutGrid} label="Combinar" menuWidth={240} items={[
                { label: 'Combinar celdas', onClick: () => applyMerge(true) },
                { label: 'Separar celdas', onClick: () => applyMerge(false) },
              ]} />
            </RibbonGroup>
          </RibbonTab>
        )}
        <RibbonTab id="view" label="Vista" icon={Eye}>
          <RibbonGroup label="Ventana">
            <RibbonMenuButton icon={Snowflake} label="Inmovilizar" menuWidth={250} items={[
              { label: 'Inmovilizar fila 1', onClick: () => applyFreeze('row') },
              { label: 'Inmovilizar columna A', onClick: () => applyFreeze('column') },
              { label: 'Inmovilizar fila 1 + columna A', onClick: () => applyFreeze('both') },
              { label: 'Inmovilizar hasta una celda…', onClick: applyFreezeAt },
              { label: 'Quitar inmovilización', onClick: () => applyFreeze('') },
            ]} />
          </RibbonGroup>
        </RibbonTab>
        <RibbonTab id="axos" label="AXOS" icon={Activity}>
          <RibbonGroup label="Conectores ERP/MES">
            <RibbonMenuButton icon={RefreshCw} label="Insertar conector" menuWidth={320} items={AXOS_SHEET_CONNECTORS.map((connector) => ({
              label: `${connector.label} · ${connector.domain}`,
              onClick: () => insertAxosConnector(connector.type),
            }))} />
            <RibbonButton icon={Table2} label="Inventario" onClick={() => insertAxosConnector('inventory_snapshot')} />
            <RibbonButton icon={Activity} label="OEE" onClick={() => insertAxosConnector('oee_by_line')} />
            <RibbonButton icon={RefreshCw} label="Refrescar" onClick={refreshAxosConnectors} />
          </RibbonGroup>
        </RibbonTab>
        <RibbonTab id="layout" label="Diseño de página">
          <RibbonGroup label="Imprimir">
            <RibbonButton icon={Printer} label="Imprimir / vista previa" shortcut="Ctrl+P" hideLabel={false} onClick={() => setShowPrint(true)} />
          </RibbonGroup>
        </RibbonTab>
        {!readOnly && (
          <RibbonTab id="formulas" label="Fórmulas">
            <RibbonGroup label="Autosuma">
              <RibbonMenuButton icon={Sigma} label="Autosuma" menuWidth={200} items={[
                { label: 'Suma', onClick: () => doAutoSum('SUM') },
                { label: 'Promedio', onClick: () => doAutoSum('AVERAGE') },
                { label: 'Contar números', onClick: () => doAutoSum('COUNT') },
                { label: 'Máximo', onClick: () => doAutoSum('MAX') },
                { label: 'Mínimo', onClick: () => doAutoSum('MIN') },
              ]} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Biblioteca de funciones">
              <RibbonButton icon={Sigma} label="Insertar función" hideLabel={false} onClick={() => setShowWizard(true)} />
              <RibbonButton icon={Search} label="Auditar fórmulas" hideLabel={false} onClick={auditFormulas} />
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
              <RibbonButton icon={Activity} label="Salud del workbook" hideLabel={false} onClick={showWorkbookHealth} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Comentarios">
              <RibbonButton icon={StickyNote} label="Nota de celda" onClick={() => setDataMode('note')} />
              <RibbonButton icon={MessageSquare} label="Comentar rango" onClick={addSheetComment} />
              <RibbonMenuButton icon={MessageSquare} label="Comentarios" menuWidth={260} items={[
                { label: 'Ver comentarios abiertos', onClick: showSheetComments },
                { label: 'Responder comentario de la selección', onClick: replySelectionComment },
                { label: 'Resolver comentarios de la selección', onClick: resolveSelectionComments },
                { label: 'Reabrir comentarios de la selección', onClick: reopenSelectionComments },
                { label: 'Eliminar comentarios de la selección', onClick: deleteSelectionComments },
              ]} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Protección">
              <RibbonMenuButton icon={Lock} label="Proteger" menuWidth={260} items={[
                { label: 'Proteger hoja activa', onClick: () => protectSheet(true) },
                { label: 'Quitar protección de hoja', onClick: () => protectSheet(false) },
                { label: 'Proteger rango seleccionado', onClick: protectSelectionRange },
                { label: 'Quitar protección del rango', onClick: clearRangeProtection },
              ]} />
            </RibbonGroup>
          </RibbonTab>
        )}
      </OfficeRibbon>

      <div className="h-10 flex items-center gap-2 border-y border-black/5 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.03] px-3">
        <input
          value={selectionText}
          onChange={(e) => setSelectionText(e.target.value.toUpperCase())}
          className="h-7 w-28 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 px-2 text-xs font-semibold text-gray-600 dark:text-gray-300 outline-none focus:ring-2 focus:ring-emerald-500/30"
          aria-label="Name box"
        />
        <div className="h-6 w-px bg-black/10 dark:bg-white/10" />
        <span className="text-xs font-bold text-emerald-600">fx</span>
        <input
          value={formulaText}
          readOnly={readOnly}
          onFocus={() => setEditMode('Editando')}
          onBlur={() => setEditMode('Listo')}
          onChange={(e) => setFormulaText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !readOnly) commitFormulaBar(); if (e.key === 'Escape') setEditMode('Listo'); }}
          className="h-7 flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-black/20 px-3 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500/30"
          placeholder="Escribe una fórmula o valor…"
          aria-label="Barra de fórmula"
        />
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div
        ref={gridRef}
        className="flex-1 min-h-0 bg-white relative overflow-hidden"
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        onClick={() => setContextMenu(null)}
      >
        <div className="absolute inset-0" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${10000 / zoom}%`, height: `${10000 / zoom}%` }}>
          <Workbook ref={wbRef} key={wbKey} data={liveData as any} lang="es" allowEdit={!readOnly} onChange={handleSheet} hooks={wbHooks} />
        </div>
        {showFind && <SheetFindReplace sheets={sheetsRef.current} sheetNames={sheetNames()} activeSheetIndex={activeIndex()} onReplaceAll={doReplaceAll} onClose={() => setShowFind(false)} />}
        </div>
        <SheetWorkbenchInspector
          tab={inspectorTab}
          onTab={setInspectorTab}
          health={deriveWorkbookHealth(workbookPayload())}
          compatibility={scanXlsxCompatibility(workbookPayload())}
          selection={selectionStats()}
          sheets={sheetsRef.current}
          activeSheetIndex={activeIndex()}
          charts={chartsRef.current}
          pivots={pivotsRef.current}
          comments={commentsRef.current}
          connectors={connectorsRef.current}
          names={namesRef.current}
          readOnly={readOnly}
          onOpenValidation={() => setTool('validation')}
          onOpenConditional={() => setTool('condformat')}
          onOpenNames={() => setShowNames(true)}
          onOpenPivot={() => setShowPivot(true)}
          onOpenChart={() => setDataMode('spark')}
          onOpenDashboard={createExecutiveDashboard}
          onOpenScenarios={() => setShowScenarios(true)}
          onOpenGoalSeek={() => setShowGoalSeek(true)}
          onOpenSolver={() => setShowSolver(true)}
          onAddComment={addSheetComment}
          onProtectSelection={protectSelectionRange}
          onProtectSheet={() => protectSheet(true)}
          onRefreshConnectors={refreshAxosConnectors}
          onInsertConnector={insertAxosConnector}
        />
      </div>

      {contextMenu && !readOnly && (
        <div className="fixed z-[70] w-56 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#161616] p-1.5 shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {[
            ['Copiar', () => runGridCommand('copy')], ['Cortar', () => runGridCommand('cut')], ['Pegar', () => runGridCommand('paste')],
            ['Formato moneda', () => applyQuickNumberFormat('"$"#,##0.00', 'USD')], ['Formato porcentaje', () => applyQuickNumberFormat('0.0%')],
            ['Limpiar formato', clearSelectedFormatting], ['Insertar fila', () => shiftRows(selectionOrigin().r, 1)], ['Eliminar fila', () => shiftRows(selectionOrigin().r, -1)],
            ['Insertar columna', () => shiftCols(selectionOrigin().c, 1)], ['Eliminar columna', () => shiftCols(selectionOrigin().c, -1)],
          ].map(([label, fn]) => <button key={String(label)} onClick={() => { (fn as () => void)(); setContextMenu(null); }} className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10">{String(label)}</button>)}
        </div>
      )}

      <SheetCharts charts={charts} sheets={sheetsRef.current} readOnly={readOnly} onAdd={addChart} onRemove={removeChart} onUpdate={updateChart} />

      <div className="h-8 flex items-center justify-between border-t border-black/5 dark:border-white/10 bg-gray-50 dark:bg-[#111] px-3 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="font-semibold text-emerald-600">{editMode}</span>
          <span>{selectionText}</span>
          {(() => { const s = selectionStats(); return <span className="truncate">Conteo {s.count} · Núm {s.nums} · Suma {s.sum.toLocaleString()} · Prom {s.average.toLocaleString()} · Min {s.min ?? '—'} · Max {s.max ?? '—'}</span>; })()}
          <span className="hidden lg:inline-flex rounded-full border border-black/10 dark:border-white/10 px-2 py-0.5 uppercase tracking-wide">{(() => { const p = currentWorkbookStats(); return `${p.label} · ${p.cells.toLocaleString()} celdas · ${(p.approxJsonBytes / 1024).toFixed(0)} KB`; })()}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom((z) => Math.max(60, z - 10))} className="px-2 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10">−</button>
          <span className="w-12 text-center font-semibold">{zoom}%</span>
          <button onClick={() => setZoom((z) => Math.min(160, z + 10))} className="px-2 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10">+</button>
        </div>
      </div>

      {showSlicers && (
        <SheetSlicer
          slicers={activeSheetLive()?.slicers ?? []}
          timelines={activeSheetLive()?.timelines ?? []}
          valuesOf={slicerValuesFor}
          onToggle={toggleSlicerValue}
          onClearSlicer={clearSlicer}
          onRemoveSlicer={removeSlicer}
          onTimeline={setTimelineRange}
          onRemoveTimeline={removeTimeline}
          onClose={() => setShowSlicers(false)}
        />
      )}

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
        {showGoalSeek && (
          <SheetGoalSeek defaultFormulaCell={selectionRange().split(':')[0]} onApply={doGoalSeek} onClose={() => setShowGoalSeek(false)} />
        )}
        {showDataTable && (
          <SheetDataTable defaultFormulaCell={selectionRange().split(':')[0]} onApply={doDataTable} onClose={() => setShowDataTable(false)} />
        )}
        {showScenarios && (
          <SheetScenarios scenarios={scenarios} onAdd={addScenario} onRemove={removeScenario} onApply={applyScenarioToActive} onSummary={doScenarioSummary} onClose={() => setShowScenarios(false)} />
        )}
        {showSolver && (
          <SheetSolver defaultObjective={selectionRange().split(':')[0]} onApply={doSolve} onClose={() => setShowSolver(false)} />
        )}
        {showConsolidate && (
          <SheetConsolidate onApply={doConsolidate} onClose={() => setShowConsolidate(false)} />
        )}
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

function SheetWorkbenchInspector({
  tab, onTab, health, compatibility, selection, sheets, activeSheetIndex, charts, pivots, comments, connectors, names, readOnly,
  onOpenValidation, onOpenConditional, onOpenNames, onOpenPivot, onOpenChart, onOpenDashboard, onOpenScenarios, onOpenGoalSeek, onOpenSolver,
  onAddComment, onProtectSelection, onProtectSheet, onRefreshConnectors, onInsertConnector,
}: any) {
  const tabs = [
    ['workbook', 'Workbook'], ['cell', 'Cell'], ['data', 'Data'], ['charts', 'Charts'], ['pivot', 'Pivot'], ['comments', 'Comments'], ['protection', 'Protection'], ['xlsx', 'XLSX'], ['axos', 'AXOS'],
  ];
  const activeSheet = sheets[activeSheetIndex] ?? sheets[0] ?? {};
  const openComments = comments.filter((c: any) => !c.resolved);
  const protectedRanges = sheets.flatMap((s: any, i: number) => [
    ...(s?.axosProtection?.sheetLocked ? [{ sheet: s.name || `Hoja ${i + 1}`, range: 'Hoja completa', locked: true }] : []),
    ...(Array.isArray(s?.axosProtection?.ranges) ? s.axosProtection.ranges.map((r: any) => ({ ...r, sheet: s.name || `Hoja ${i + 1}` })) : []),
  ]);
  const tool = 'w-full rounded-xl border border-black/10 dark:border-white/10 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40';
  return (
    <aside className="hidden xl:flex w-[340px] shrink-0 flex-col border-l border-black/10 dark:border-white/10 bg-gray-50/80 dark:bg-[#101010]">
      <div className="border-b border-black/10 dark:border-white/10 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">AXOS Sheets Workbench v2</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Inspector industrial</div>
          <span className="rounded-full border border-black/10 dark:border-white/10 px-2 py-0.5 text-[10px] font-semibold">{health.score}/100</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-black/10 dark:border-white/10 p-2">
        {tabs.map(([id, label]) => <button key={id} onClick={() => onTab(id)} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${tab === id ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'}`}>{label}</button>)}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs text-gray-600 dark:text-gray-300">
        {tab === 'workbook' && <Panel title="Workbook Health">
          <Metric label="Hojas" value={health.sheets} /><Metric label="Celdas usadas" value={health.usedCells} /><Metric label="Fórmulas" value={health.formulas} /><Metric label="Charts" value={health.charts} /><Metric label="Pivots" value={health.pivots} /><Metric label="Validaciones" value={health.validations} /><Metric label="Comentarios" value={health.comments} /><Metric label="Rangos protegidos" value={health.protectedRanges} /><Metric label="Nombres definidos" value={health.namedRanges} /><Metric label="Warnings import/XLSX" value={health.importWarnings + health.unsupportedXlsxFeatures} />
          <div className="mt-3 space-y-2">{health.findings.slice(0, 5).map((f: any) => <div key={f.code} className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]"><b>{f.severity}</b> · {f.message}</div>)}{!health.findings.length && <div className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]">Sin hallazgos relevantes para compartir/exportar.</div>}</div>
        </Panel>}
        {tab === 'cell' && <Panel title="Selección / celda">
          <Metric label="Rango" value={selection.range} /><Metric label="Count" value={selection.count} /><Metric label="Números" value={selection.nums} /><Metric label="Sum" value={selection.sum.toLocaleString()} /><Metric label="Average" value={selection.average.toLocaleString()} /><Metric label="Min" value={selection.min ?? '—'} /><Metric label="Max" value={selection.max ?? '—'} /><Metric label="Fórmulas" value={selection.formulas} /><Metric label="Comentarios" value={selection.comments} /><Metric label="Estado" value={selection.protected ? 'Protected' : 'Ready'} />
        </Panel>}
        {tab === 'data' && <Panel title="Data Tools">
          <button disabled={readOnly} className={tool} onClick={onOpenValidation}>Validación de datos — reglas por rango</button>
          <button disabled={readOnly} className={tool} onClick={onOpenConditional}>Formato condicional — resaltar riesgos</button>
          <button disabled={readOnly} className={tool} onClick={onOpenNames}>Nombres definidos — manager</button>
          <button disabled={readOnly} className={tool} onClick={onOpenScenarios}>Escenarios — what-if industrial</button>
          <button disabled={readOnly} className={tool} onClick={onOpenGoalSeek}>Goal Seek — objetivo financiero/OEE</button>
          <button disabled={readOnly} className={tool} onClick={onOpenSolver}>Solver — optimización restringida</button>
        </Panel>}
        {tab === 'charts' && <Panel title="Charts">
          <button disabled={readOnly} className={tool} onClick={onOpenChart}>Insertar sparkline desde rango</button>
          <button disabled={readOnly} className={tool} onClick={onOpenDashboard}>Crear dashboard ejecutivo</button>
          {charts.map((c: any) => <div key={c.id} className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]"><b>{c.title || 'Chart'}</b><br />{c.type} · {c.range}</div>)}{!charts.length && <Empty text="No hay charts persistidos; usa Insertar para construir visualizaciones." />}
        </Panel>}
        {tab === 'pivot' && <Panel title="Pivot Workbench">
          <button disabled={readOnly} className={tool} onClick={onOpenPivot}>Crear tabla dinámica desde selección</button>
          {pivots.map((p: any) => <div key={p.id} className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]"><b>{p.sheetName}</b><br />Rows {(p.config?.rows ?? []).join(', ') || '—'} · Values {(p.config?.values ?? []).length}</div>)}{!pivots.length && <Empty text="Sin definiciones de pivot guardadas." />}
        </Panel>}
        {tab === 'comments' && <Panel title="Comments">
          <button disabled={readOnly} className={tool} onClick={onAddComment}>Agregar comentario a {selection.range}</button>
          {openComments.map((c: any) => <div key={c.id} className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]"><b>{sheets[c.sheetIndex]?.name || 'Hoja'}</b> · {c.range}<br />{c.text || c.messages?.[0]?.text || 'Comentario'}</div>)}{!openComments.length && <Empty text="No hay comentarios abiertos." />}
        </Panel>}
        {tab === 'protection' && <Panel title="Protection">
          <button disabled={readOnly} className={tool} onClick={onProtectSelection}>Bloquear rango seleccionado</button>
          <button disabled={readOnly} className={tool} onClick={onProtectSheet}>Proteger hoja activa</button>
          {protectedRanges.map((p: any, i: number) => <div key={i} className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]"><b>{p.sheet}</b> · {p.range}</div>)}{!protectedRanges.length && <Empty text="La hoja activa no tiene protección AXOS visible." />}
        </Panel>}
        {tab === 'xlsx' && <Panel title="XLSX Compatibility Review">
          <Metric label="Score" value={`${compatibility.score}/100`} /><Metric label="Revisión" value={compatibility.reviewCount} /><Metric label="No soportado" value={compatibility.unsupportedCount} />
          <div className="mt-3 space-y-2">{compatibility.features.map((f: any) => <div key={f.key} className="rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]"><b>{f.label}</b> · {f.count} · {f.severity}<br /><span className="text-gray-500">{f.note}</span></div>)}</div>
        </Panel>}
        {tab === 'axos' && <Panel title="AXOS Data">
          <button className={tool} onClick={onRefreshConnectors}>Refrescar conectores insertados</button>
          <div className="grid grid-cols-1 gap-2">{AXOS_SHEET_CONNECTORS.map((c) => <button key={c.type} disabled={readOnly} onClick={() => onInsertConnector(c.type)} className={tool}><b>{c.label}</b><br /><span className="text-gray-500">{c.description}</span></button>)}</div>
          <div className="mt-3 text-[11px] text-gray-500">Contratos reales ERP/MES: se insertan solo conectores soportados por metadata AXOS; endpoints externos quedan pendientes de contrato, sin simular refresh.</div>
          {connectors.map((c: any) => <div key={c.id} className="mt-2 rounded-xl bg-white p-2 shadow-sm dark:bg-white/[0.04]"><b>{c.label}</b> · {c.range}<br />Último refresh {c.lastRefreshedAt || '—'}</div>)}
        </Panel>}
      </div>
      <div className="border-t border-black/10 dark:border-white/10 p-3 text-[11px] text-gray-500">Hoja activa: {activeSheet.name || `Hoja ${activeSheetIndex + 1}`} · {names.length} nombres · {connectors.length} conectores</div>
    </aside>
  );
}
function Panel({ title, children }: any) { return <div className="space-y-2"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h3>{children}</div>; }
function Metric({ label, value }: any) { return <div className="flex items-center justify-between border-b border-black/5 py-1 dark:border-white/10"><span>{label}</span><b className="text-gray-900 dark:text-gray-100">{value}</b></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-black/10 p-3 text-gray-500 dark:border-white/10">{text}</div>; }
