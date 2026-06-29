'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardCheck, Download, Loader2, ShieldAlert, Upload } from 'lucide-react';
import { exportSheets, importSheets } from '@/lib/office/xlsx';
import { analyzeSheetQualityPreflight, formatSheetQualityPreflight } from '@/lib/office/sheetQualityPreflight';
import { useToast } from '@/contexts/ToastContext';

/** Export (.xlsx/.csv) + Import controls for the spreadsheet editor's ribbon. */
export function SheetActions({
  content, title, onImport, readOnly,
}: {
  content: any;
  title: string;
  onImport: (content: any) => void;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Content is either the legacy sheet array or the new { sheets, charts, names } shape.
  const sheetsOf = (v: any): any[] => (Array.isArray(v) ? v : (Array.isArray(v?.sheets) ? v.sheets : []));
  const namesOf = (v: any): any[] => (v && Array.isArray(v.names) ? v.names : []);
  const exportWarningsOf = (v: any): string[] => {
    const slicers = sheetsOf(v).reduce((sum, sheet) => sum + (Array.isArray(sheet?.slicers) ? sheet.slicers.length : 0) + (Array.isArray(sheet?.timelines) ? sheet.timelines.length : 0), 0);
    const charts = Array.isArray(v?.charts) ? v.charts.length : 0;
    const warnings: string[] = [];
    if (slicers) warnings.push(`${slicers} segmentación(es)/línea(s) de tiempo no se exportan como controles interactivos.`);
    if (charts) warnings.push(`${charts} chart(s) de dashboard se preservan como metadata AXOS, no como objetos nativos en el archivo.`);
    return warnings;
  };
  const preflight = useMemo(() => analyzeSheetQualityPreflight(content), [content]);
  const PreflightIcon = preflight.status === 'pass' ? CheckCircle2 : preflight.status === 'blocked' ? ShieldAlert : AlertTriangle;
  const preflightTone = preflight.status === 'pass'
    ? 'text-emerald-700 dark:text-emerald-300'
    : preflight.status === 'blocked'
      ? 'text-red-600 dark:text-red-300'
      : 'text-amber-700 dark:text-amber-300';
  const preflightBg = preflight.status === 'pass'
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : preflight.status === 'blocked'
      ? 'bg-red-500/10 border-red-500/20'
      : 'bg-amber-500/10 border-amber-500/20';

  async function doExport(fmt: 'xlsx' | 'csv', delimiter = ',') {
    setOpen(false);
    const warnings = exportWarningsOf(content);
    if (warnings.length) toast.info(`Exportación con advertencias: ${warnings.join(' ')}`);
    if (preflight.status === 'blocked') toast.error('Preflight de calidad bloqueado: revisa errores criticos antes de compartir.');
    else if (preflight.status === 'review') toast.info('Preflight de calidad requiere revision: hay validaciones, warnings o errores visibles.');
    setBusy(true);
    try { await exportSheets(sheetsOf(content), title || 'hoja', fmt, { delimiter }, namesOf(content)); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }

  async function copyPreflight() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(formatSheetQualityPreflight(preflight));
      toast.success('Resumen de preflight copiado.');
    } catch {
      toast.info(formatSheetQualityPreflight(preflight));
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    // Importar reemplaza el documento; preserva los nombres definidos del .xlsx para que
    // el administrador de nombres y las fórmulas que los usen sigan resolviendo.
    try { const { sheets, names } = await importSheets(f); onImport({ sheets, names }); }
    catch { toast.error('No se pudo importar el archivo. Verifica que sea un .xlsx o .csv válido.'); }
    finally { setBusy(false); }
  }

  const btn = 'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors';

  return (
    <div className="flex items-center gap-0.5">
      {!readOnly && (
        <>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className={btn} title="Importar .xlsx / .csv">
            <Upload className="w-4 h-4" /> <span className="hidden lg:inline">Importar</span>
          </button>
        </>
      )}
      <div className="relative">
        <button onClick={() => setPreflightOpen((o) => !o)} className={`${btn} ${preflightTone}`} title="Preflight de calidad de datos">
          <PreflightIcon className="w-4 h-4" /> <span className="hidden xl:inline">Preflight</span>
        </button>
        <AnimatePresence>
          {preflightOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPreflightOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 mt-1 z-20 w-80 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-2"
              >
                <div className={`rounded-xl border p-3 ${preflightBg}`}>
                  <div className={`flex items-center gap-2 text-sm font-bold ${preflightTone}`}>
                    <PreflightIcon className="h-4 w-4" />
                    <span>{preflight.status === 'pass' ? 'Export-ready' : preflight.status === 'blocked' ? 'Bloqueado' : 'Revisar antes de exportar'}</span>
                    <span className="ml-auto tabular-nums">{preflight.score}/100</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    <Metric label="Formula errors" value={preflight.formulaErrors.total} />
                    <Metric label="Invalid DV" value={`${preflight.dataValidations.invalid}/${preflight.dataValidations.rules}`} />
                    <Metric label="Findings" value={preflight.issueCount} />
                  </div>
                </div>
                <div className="mt-2 max-h-48 space-y-1 overflow-auto text-[11px] text-gray-600 dark:text-gray-300">
                  {preflight.findings.length ? preflight.findings.slice(0, 8).map((finding) => (
                    <div key={finding} className="rounded-lg bg-black/[0.03] px-2 py-1.5 dark:bg-white/[0.06]">{finding}</div>
                  )) : (
                    <div className="rounded-lg border border-dashed border-black/10 px-2 py-3 text-center text-gray-500 dark:border-white/10">Sin hallazgos visibles.</div>
                  )}
                </div>
                <button onClick={copyPreflight} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
                  <ClipboardCheck className="h-4 w-4" /> Copiar resumen
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)} className={btn} title="Exportar">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden lg:inline">Exportar</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 mt-1 z-20 w-64 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-1"
              >
                <div className={`m-1 rounded-lg border px-2.5 py-2 text-[11px] leading-snug ${preflightBg} ${preflightTone}`}>
                  <b>Preflight {preflight.score}/100:</b> {preflight.status === 'pass' ? 'listo para exportar.' : preflight.status === 'blocked' ? 'bloqueado por hallazgos criticos.' : 'requiere revision.'}
                </div>
                {exportWarningsOf(content).length > 0 && (
                  <div className="m-1 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                    {exportWarningsOf(content).map((warning) => <p key={warning}>• {warning}</p>)}
                  </div>
                )}
                <MenuItem onClick={() => doExport('xlsx')} label="Excel (.xlsx)" />
                <MenuItem onClick={() => doExport('csv', ',')} label="CSV (coma)" />
                <MenuItem onClick={() => doExport('csv', ';')} label="CSV (punto y coma)" />
                <MenuItem onClick={() => doExport('csv', '\t')} label="CSV (tabulación)" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-white/70 px-2 py-1 text-center shadow-sm dark:bg-black/20">
      <div className="font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
      {label}
    </button>
  );
}
