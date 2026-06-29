'use client';
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck, X, Printer } from 'lucide-react';
import { analyzeSheetPrintReadiness, printOptsFromLayout, type PrintOpts, type SheetPrintLayout, type SheetPrintPaperSize } from '@/lib/office/sheetOps';

/** Diálogo de impresión / diseño de página con vista previa. */
export function SheetPrintDialog({
  sheetNames, defaultRange, defaultSheetIndex, defaultTitle, layout, getHtml, onLayoutChange, onPrint, onClose,
}: {
  sheetNames: string[];
  defaultRange: string;
  defaultSheetIndex: number;
  defaultTitle: string;
  layout: SheetPrintLayout;
  getHtml: (sheetIndex: number, opts: PrintOpts) => string;
  onLayoutChange: (layout: SheetPrintLayout) => void;
  onPrint: (html: string) => void;
  onClose: () => void;
}) {
  const [sheetIndex, setSheetIndex] = useState(defaultSheetIndex || 0);
  const [range, setRange] = useState(layout.printArea || defaultRange || '');
  const [title, setTitle] = useState(defaultTitle || '');
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [orientation, setOrientation] = useState(layout.orientation);
  const [paperSize, setPaperSize] = useState<SheetPrintPaperSize>(layout.paperSize);
  const [gridlines, setGridlines] = useState(layout.showGridlines);
  const [fitToWidth, setFitToWidth] = useState(layout.fitToWidth);
  const [fitToPage, setFitToPage] = useState(layout.fitToPage);
  const field = 'h-9 text-sm rounded-xl bg-gray-100 dark:bg-white/10 px-3 outline-none focus:ring-2 ring-emerald-500/40';

  const currentLayout: SheetPrintLayout = { orientation, paperSize, printArea: range.trim() || undefined, fitToWidth, fitToPage, showGridlines: gridlines };
  const opts = printOptsFromLayout(currentLayout, { title: title.trim() || undefined, header: header.trim() || undefined, footer: footer.trim() || undefined });
  const html = useMemo(() => getHtml(sheetIndex, opts), [getHtml, sheetIndex, range, title, header, footer, orientation, paperSize, gridlines, fitToWidth, fitToPage]); // eslint-disable-line react-hooks/exhaustive-deps
  const readiness = useMemo(() => analyzeSheetPrintReadiness(null, {
    orientation, paperSize, printArea: range.trim() || undefined, fitToWidth, fitToPage, showGridlines: gridlines,
  }, { title: title.trim(), header: header.trim(), footer: footer.trim(), usedRange: defaultRange }), [defaultRange, range, title, header, footer, orientation, paperSize, gridlines, fitToWidth, fitToPage]);
  const readinessTone = readiness.status === 'blocked'
    ? 'border-red-500/20 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100'
    : readiness.status === 'review'
      ? 'border-amber-500/20 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
      : 'border-emerald-500/20 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100';
  const ReadinessIcon = readiness.status === 'ready' ? ShieldCheck : AlertTriangle;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-[90vh] rounded-3xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 h-14 border-b border-black/5 dark:border-white/10 flex-shrink-0">
          <Printer className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-bold">Imprimir</h2>
          <button onClick={onClose} className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* Opciones */}
          <div className="sm:w-72 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-black/5 dark:border-white/10 overflow-y-auto p-4 space-y-2.5">
            {sheetNames.length > 1 && (
              <label className="block text-xs text-gray-500">Hoja
                <select value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))} className={`${field} w-full`}>
                  {sheetNames.map((nm, i) => <option key={i} value={i}>{nm || `Hoja ${i + 1}`}</option>)}
                </select>
              </label>
            )}
            <label className="block text-xs text-gray-500">Área de impresión (vacío = todo)
              <input value={range} onChange={(e) => { const next = e.target.value; setRange(next); onLayoutChange({ ...currentLayout, printArea: next.trim() || undefined }); }} placeholder="A1:F40" className={`${field} w-full font-mono`} />
            </label>
            <label className="block text-xs text-gray-500">Título
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} w-full`} />
            </label>
            <div className="flex gap-2">
              <label className="block text-xs text-gray-500 flex-1">Encabezado
                <input value={header} onChange={(e) => setHeader(e.target.value)} className={`${field} w-full`} />
              </label>
              <label className="block text-xs text-gray-500 flex-1">Pie
                <input value={footer} onChange={(e) => setFooter(e.target.value)} className={`${field} w-full`} />
              </label>
            </div>
            <label className="block text-xs text-gray-500">Orientación
              <select value={orientation} onChange={(e) => { const next = e.target.value as SheetPrintLayout['orientation']; setOrientation(next); onLayoutChange({ ...currentLayout, orientation: next }); }} className={`${field} w-full`}>
                <option value="portrait">Vertical</option><option value="landscape">Horizontal</option>
              </select>
            </label>
            <label className="block text-xs text-gray-500">Tamaño de papel
              <select value={paperSize} onChange={(e) => { const next = e.target.value as SheetPrintPaperSize; setPaperSize(next); onLayoutChange({ ...currentLayout, paperSize: next }); }} className={`${field} w-full`}>
                <option value="A4">A4</option><option value="Letter">Carta</option><option value="Legal">Legal</option><option value="Tabloid">Tabloide</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={gridlines} onChange={(e) => { setGridlines(e.target.checked); onLayoutChange({ ...currentLayout, showGridlines: e.target.checked }); }} /> Líneas de cuadrícula</label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={fitToWidth} onChange={(e) => { setFitToWidth(e.target.checked); onLayoutChange({ ...currentLayout, fitToWidth: e.target.checked }); }} /> Ajustar al ancho</label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={fitToPage} onChange={(e) => { setFitToPage(e.target.checked); onLayoutChange({ ...currentLayout, fitToPage: e.target.checked }); }} /> Ajustar a una página</label>
            <div className={`rounded-xl border px-3 py-2 text-xs leading-snug ${readinessTone}`}>
              <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <ReadinessIcon className="h-3.5 w-3.5" />
                  Reporte {readiness.score}/100
                </span>
                <span>{readiness.range ?? 'Sin rango'}</span>
              </div>
              <p className="mb-1 text-[11px] opacity-85">{readiness.rows} filas x {readiness.columns} columnas</p>
              {readiness.issues.length ? (
                <div className="space-y-1">
                  {readiness.issues.slice(0, 4).map((issue) => (
                    <p key={issue.key}>- {issue.label}{issue.count ? ` (${issue.count})` : ''}</p>
                  ))}
                  {readiness.issues.length > 4 && <p>- {readiness.issues.length - 4} alerta(s) mas.</p>}
                </div>
              ) : (
                <p>Area y pagina listas para reporte controlado.</p>
              )}
            </div>
            <button onClick={() => onPrint(html)} className="w-full h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold hover:opacity-90 inline-flex items-center justify-center gap-2"><Printer className="w-4 h-4" /> Imprimir</button>
          </div>
          {/* Vista previa */}
          <div className="flex-1 min-h-0 bg-gray-100 dark:bg-[#0b0b0b] p-3">
            <iframe title="Vista previa" srcDoc={html} className="w-full h-full rounded-xl bg-white border border-black/10 dark:border-white/10" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
