'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ChevronDown, Loader2, FileText, Presentation } from 'lucide-react';
import { exportSlidesPdf } from '@/lib/office/slidesPdf';
import { exportPptx } from '@/lib/office/pptx';

/** Export controls (PDF / PowerPoint) for the slides editor. */
export function SlideActions({ content, title }: { content: any; title: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const slides: any[] = content?.version === 2 && Array.isArray(content.slides) ? content.slides : [];
  const notes: string[] = content?.version === 2 && Array.isArray(content.notes) ? content.notes : [];
  const pptxOpts = { footer: content?.footer || '', showNumbers: !!content?.showNumbers };

  async function run(fn: () => Promise<void>) {
    setOpen(false);
    if (!slides.length) return;
    setBusy(true);
    try { await fn(); } catch { /* ignore */ } finally { setBusy(false); }
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
              className="absolute right-0 mt-1 z-20 w-48 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-1"
            >
              <button onClick={() => run(() => exportPptx(slides, title || 'presentacion', notes, pptxOpts))} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Presentation className="w-4 h-4 text-amber-500" /> PowerPoint (.pptx)</button>
              <button onClick={() => run(() => exportSlidesPdf(slides, title || 'presentacion'))} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><FileText className="w-4 h-4 text-gray-500" /> PDF</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
