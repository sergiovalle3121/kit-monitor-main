'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Download, Upload, ChevronDown, Loader2, ShieldCheck,
} from 'lucide-react';
import { exportSheets, importSheets } from '@/lib/office/xlsx';
import { scanXlsxCompatibility, type XlsxCompatibilityFeature, type XlsxCompatibilitySeverity } from '@/lib/office/xlsxCompatibility';
import { auditDataQuality, formatDataQualityReport, upsertDataQualitySheet, type DataQualityIssue, type DataQualitySeverity } from '@/lib/office/dataQuality';
import { useToast } from '@/contexts/ToastContext';

const XLSX_SEVERITY_RANK: Record<XlsxCompatibilitySeverity, number> = {
  unsupported: 4,
  review: 3,
  partial: 2,
  supported: 1,
};

function sheetsOf(v: any): any[] {
  return Array.isArray(v) ? v : (Array.isArray(v?.sheets) ? v.sheets : []);
}

function namesOf(v: any): any[] {
  return v && Array.isArray(v.names) ? v.names : [];
}

function interactiveExportWarningsOf(v: any): string[] {
  const slicers = sheetsOf(v).reduce((sum, sheet) => (
    sum
    + (Array.isArray(sheet?.slicers) ? sheet.slicers.length : 0)
    + (Array.isArray(sheet?.timelines) ? sheet.timelines.length : 0)
  ), 0);
  return slicers
    ? [`${slicers} segmentacion(es)/linea(s) de tiempo no se exportan como controles interactivos.`]
    : [];
}

function xlsxSeverityLabel(severity: XlsxCompatibilitySeverity): string {
  if (severity === 'unsupported') return 'No soportado';
  if (severity === 'review') return 'Revision';
  if (severity === 'partial') return 'Parcial';
  return 'Soportado';
}

function xlsxWarningText(feature: XlsxCompatibilityFeature): string {
  return `${xlsxSeverityLabel(feature.severity)}: ${feature.label} (${feature.count}) - ${feature.note}`;
}

function qualitySeverityClass(severity: DataQualitySeverity): string {
  if (severity === 'critical') return 'border-red-500/20 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200';
  if (severity === 'warning') return 'border-amber-500/20 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
  return 'border-sky-500/20 bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200';
}

function qualityTarget(issue: DataQualityIssue): string {
  if (issue.sheetName) return `${issue.sheetName}${issue.cell || issue.range ? `!${issue.cell ?? issue.range}` : ''}`;
  return issue.cell ?? issue.range ?? 'Workbook';
}

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
  const [qualityOpen, setQualityOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const quality = useMemo(() => auditDataQuality(content), [content]);
  const compatibility = useMemo(() => scanXlsxCompatibility(content), [content]);
  const compatibilityFindings = useMemo(
    () => compatibility.features
      .filter((feature) => feature.count > 0 && feature.severity !== 'supported')
      .sort((a, b) => XLSX_SEVERITY_RANK[b.severity] - XLSX_SEVERITY_RANK[a.severity]),
    [compatibility],
  );
  const interactiveWarnings = useMemo(() => interactiveExportWarningsOf(content), [content]);
  const exportWarnings = useMemo(
    () => [...interactiveWarnings, ...compatibilityFindings.map(xlsxWarningText)],
    [compatibilityFindings, interactiveWarnings],
  );
  const hasXlsxRisk = compatibility.unsupportedCount > 0 || compatibility.reviewCount > 0 || interactiveWarnings.length > 0;
  const hasQualityRisk = quality.critical > 0 || quality.warnings > 0;

  function toggleQualityPanel() {
    setOpen(false);
    setQualityOpen((value) => !value);
  }

  function createQualityReportSheet() {
    if (readOnly) return;
    const { content: nextContent, report } = upsertDataQualitySheet(content);
    onImport(nextContent);
    setQualityOpen(false);
    toast.info(`Hoja AXOS Data Quality generada: ${report.critical} critical, ${report.warnings} warning.`);
  }

  async function doExport(fmt: 'xlsx' | 'csv', delimiter = ',') {
    setOpen(false);
    if (exportWarnings.length) toast.info(`Exportacion con advertencias: ${exportWarnings.join(' ')}`);
    setBusy(true);
    try { await exportSheets(sheetsOf(content), title || 'hoja', fmt, { delimiter }, namesOf(content)); } catch { /* ignore */ } finally { setBusy(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    // Import replaces the document; defined names from .xlsx remain available to formulas.
    try { const { sheets, names } = await importSheets(f); onImport({ sheets, names }); } catch { toast.error('No se pudo importar el archivo. Verifica que sea un .xlsx o .csv valido.'); } finally { setBusy(false); }
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
        <button onClick={toggleQualityPanel} className={btn} title={`Data quality ${quality.score}/100`}>
          {hasQualityRisk ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          <span className="hidden lg:inline">Calidad</span>
          <span className={`hidden xl:inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${hasQualityRisk ? 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200' : 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'}`}>
            DQ {quality.score}
          </span>
        </button>
        <AnimatePresence>
          {qualityOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setQualityOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 mt-1 z-20 w-96 rounded-xl border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#1a1a1a]"
              >
                <div className={`m-1 rounded-lg border px-2.5 py-2 text-[11px] leading-snug ${hasQualityRisk ? 'border-amber-500/20 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100' : 'border-emerald-500/20 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100'}`}>
                  <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      {hasQualityRisk ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Data quality {quality.score}/100
                    </span>
                    <span>{quality.critical} critical | {quality.warnings} warning | {quality.info} info</span>
                  </div>
                  <p>Industrial checks combine validation rules, formula errors, duplicate keys, negative quantities, invalid dates, connector freshness, failed connector states, and import warnings.</p>
                </div>
                <div className="max-h-72 overflow-auto p-1">
                  {quality.issues.length ? quality.issues.slice(0, 8).map((issue) => (
                    <div key={issue.id} className={`mb-1 rounded-lg border px-2.5 py-2 text-[11px] ${qualitySeverityClass(issue.severity)}`}>
                      <div className="flex items-center justify-between gap-2 font-semibold">
                        <span>{issue.severity.toUpperCase()} - {issue.type}</span>
                        <span className="truncate text-right">{qualityTarget(issue)}</span>
                      </div>
                      <div className="mt-1 text-current/90">{issue.message}</div>
                      <div className="mt-1 text-current/70">{issue.suggestedFix}</div>
                    </div>
                  )) : (
                    <div className="m-1 rounded-lg border border-emerald-500/20 bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100">
                      No visible industrial data issues detected.
                    </div>
                  )}
                  {quality.issues.length > 8 && <div className="px-2.5 py-1 text-[11px] text-gray-500">{quality.issues.length - 8} more issue(s) available in the report sheet.</div>}
                </div>
                <button onClick={() => window.alert(formatDataQualityReport(quality))} className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10">
                  Ver resumen completo
                </button>
                <button onClick={createQualityReportSheet} disabled={readOnly} className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10">
                  Crear hoja AXOS Data Quality
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      <div className="relative">
        <button onClick={() => { setQualityOpen(false); setOpen((o) => !o); }} className={btn} title={`Exportar. XLSX readiness ${compatibility.score}/100`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden lg:inline">Exportar</span>
          <span className={`hidden xl:inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${hasXlsxRisk ? 'border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200' : 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'}`}>
            {hasXlsxRisk ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
            XLSX {compatibility.score}
          </span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 mt-1 z-20 w-80 rounded-xl border border-black/10 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#1a1a1a]"
              >
                <div className={`m-1 rounded-lg px-2.5 py-2 text-[11px] leading-snug ${hasXlsxRisk ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100'}`}>
                  <div className="mb-1 flex items-center justify-between gap-2 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      {hasXlsxRisk ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      XLSX readiness {compatibility.score}/100
                    </span>
                    <span>{compatibility.unsupportedCount} blocked | {compatibility.reviewCount} review</span>
                  </div>
                  {hasXlsxRisk ? (
                    <div className="space-y-1">
                      {interactiveWarnings.map((warning) => <p key={warning}>- {warning}</p>)}
                      {compatibilityFindings.slice(0, 5).map((feature) => (
                        <p key={feature.key}>
                          - {feature.label}: {feature.count} ({xlsxSeverityLabel(feature.severity)})
                        </p>
                      ))}
                      {compatibilityFindings.length > 5 && <p>- {compatibilityFindings.length - 5} alerta(s) mas en el panel XLSX.</p>}
                    </div>
                  ) : (
                    <p>Sin alertas de compatibilidad XLSX detectadas para este workbook.</p>
                  )}
                </div>
                <MenuItem onClick={() => doExport('xlsx')} label="Excel (.xlsx)" />
                <MenuItem onClick={() => doExport('csv', ',')} label="CSV (coma)" />
                <MenuItem onClick={() => doExport('csv', ';')} label="CSV (punto y coma)" />
                <MenuItem onClick={() => doExport('csv', '\t')} label="CSV (tabulacion)" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MenuItem({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10">
      {label}
    </button>
  );
}
