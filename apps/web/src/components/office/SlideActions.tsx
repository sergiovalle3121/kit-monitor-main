'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileCode2, FileText, Image as ImageIcon, Info, Loader2, Presentation } from 'lucide-react';
import { exportSlidesPdf } from '@/lib/office/slidesPdf';
import { exportPptx } from '@/lib/office/pptx';
import { exportAllPng, exportAllSvg } from './slides/exportImages';
import { buildPptxExportPreflight, type PptxExportPreflightIssue } from './slides/pptxExportPreflight';

/** Export controls (PDF / PowerPoint) for the slides editor. */
export function SlideActions({ content, title }: { content: any; title: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeHiddenSlides, setIncludeHiddenSlides] = useState(false);
  const slides: any[] = content?.version === 2 && Array.isArray(content.slides) ? content.slides : [];
  const notes: string[] = content?.version === 2 && Array.isArray(content.notes) ? content.notes : [];
  const comments: any[] = content?.version === 2 && Array.isArray(content.comments) ? content.comments : [];
  const transitions: string[] = content?.version === 2 && Array.isArray(content.transitions) ? content.transitions : [];
  const ratio: string = content?.ratio || '16:9';
  const pptxOpts = { footer: content?.footer || '', showNumbers: !!content?.showNumbers, ratio };
  const hasNotes = notes.some((note) => String(note || '').trim());
  const pptxPayload = buildPptxExportPreflight({
    slides,
    notes,
    comments,
    transitions,
    pptxCompatibility: content?.pptxCompatibility,
    options: { includeNotes, includeHiddenSlides },
  });
  const preflight = pptxPayload.report;

  async function run(fn: () => Promise<void>) {
    setOpen(false);
    if (!slides.length) return;
    setBusy(true);
    try { await fn(); } catch { /* ignore */ } finally { setBusy(false); }
  }

  // Render the shared master furniture to PNG so the PPTX writer can compose it
  // behind each slide without changing the stored Fabric JSON format.
  async function masterImg(): Promise<string | undefined> {
    const m = content?.master;
    if (!m || !Array.isArray(m.objects) || !m.objects.length) return undefined;
    try {
      const { StaticCanvas } = await import('fabric');
      const sc = new StaticCanvas(document.createElement('canvas'), { width: 960, height: ratio === '4:3' ? 720 : 540 });
      await sc.loadFromJSON(m);
      sc.backgroundColor = ''; sc.renderAll();
      const url = sc.toDataURL({ format: 'png', multiplier: 1 } as any);
      sc.dispose();
      return url;
    } catch { return undefined; }
  }

  async function exportPowerPoint() {
    await run(async () => exportPptx(pptxPayload.slides, title || 'presentacion', pptxPayload.notes, { ...pptxOpts, masterImg: await masterImg() }));
  }

  const btn = 'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50';

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={busy || !slides.length} className={btn} title="Exportar">
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
              className="absolute right-0 mt-1 z-20 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-2"
            >
              <div className="rounded-lg border border-amber-500/20 bg-amber-50/70 p-3 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">PowerPoint preflight</p>
                    <p className="mt-0.5 text-xs text-amber-900/70 dark:text-amber-100/70">{preflight.exportedSlideCount} de {preflight.slideCount} diapositivas listas para .pptx</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${preflight.exportReady ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'}`}>
                    {preflight.exportReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {preflight.exportReady ? 'Ready' : `${preflight.dangerCount} blocker(s)`}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <Metric label="Charts" value={preflight.nativeChartCount} />
                  <Metric label="Tables" value={preflight.nativeTableCount} />
                  <Metric label="Notes" value={preflight.notesCount} />
                  <Metric label="Comments" value={preflight.openCommentCount} />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Toggle checked={includeNotes} onChange={setIncludeNotes} label="Speaker notes" disabled={!hasNotes} />
                <Toggle checked={includeHiddenSlides} onChange={setIncludeHiddenSlides} label="Hidden slides" disabled={!preflight.hiddenSlideCount} />
              </div>

              <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-black/5 dark:border-white/10">
                {preflight.issues.length ? preflight.issues.slice(0, 6).map((item) => <IssueRow key={item.code} issue={item} />) : (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> No export warnings detected.</div>
                )}
              </div>

              <button onClick={exportPowerPoint} disabled={!preflight.exportedSlideCount} className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                <Presentation className="w-4 h-4" /> Exportar PowerPoint (.pptx)
              </button>

              <div className="mt-1 grid grid-cols-3 gap-1">
                <button onClick={() => run(() => exportSlidesPdf(slides, title || 'presentacion', ratio))} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"><FileText className="w-4 h-4 text-gray-500" /> PDF</button>
                <button onClick={() => run(() => exportAllPng(slides, title || 'presentacion', ratio))} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"><ImageIcon className="w-4 h-4 text-emerald-500" /> PNG</button>
                <button onClick={() => run(() => exportAllSvg(slides, title || 'presentacion', ratio))} className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10"><FileCode2 className="w-4 h-4 text-blue-500" /> SVG</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-white/75 px-2 py-1 dark:bg-white/10"><span className="text-amber-900/60 dark:text-amber-100/60">{label}</span> <b>{value}</b></div>;
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-45 ${checked ? 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' : 'border-black/10 text-gray-600 hover:bg-black/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10'}`}>
      <span>{label}</span>
      <span className={`h-4 w-7 rounded-full p-0.5 transition-colors ${checked ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-3' : ''}`} />
      </span>
    </button>
  );
}

function IssueRow({ issue }: { issue: PptxExportPreflightIssue }) {
  const tone = issue.severity === 'danger'
    ? 'text-red-700 dark:text-red-300'
    : issue.severity === 'warning'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-blue-700 dark:text-blue-300';
  const Icon = issue.severity === 'info' ? Info : AlertTriangle;
  return (
    <div className="flex items-start gap-2 border-b border-black/5 px-3 py-2 last:border-b-0 dark:border-white/10">
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${tone}`} />
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${tone}`}>{issue.title}{issue.count ? ` (${issue.count})` : ''}</p>
        <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">{issue.detail}</p>
      </div>
    </div>
  );
}
