'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { exportSlidesPdf } from '@/lib/office/slidesPdf';

/** Export-to-PDF control for the slides editor's ribbon. */
export function SlideActions({ content, title }: { content: any; title: string }) {
  const [busy, setBusy] = useState(false);
  const slides: any[] = content?.version === 2 && Array.isArray(content.slides) ? content.slides : [];

  async function exportPdf() {
    if (!slides.length) return;
    setBusy(true);
    try { await exportSlidesPdf(slides, title || 'presentacion'); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }

  return (
    <button
      onClick={exportPdf}
      disabled={busy || !slides.length}
      title="Exportar a PDF"
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
      <span className="hidden lg:inline">PDF</span>
    </button>
  );
}
