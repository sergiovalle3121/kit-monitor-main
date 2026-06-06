'use client';

import React from 'react';
import { Printer } from 'lucide-react';

/**
 * Print / Save-as-PDF for documents. Uses the browser print pipeline, which is
 * the most faithful HTML→PDF path; print CSS (tiptap.css) isolates the page so
 * only the document — not the app chrome — is printed.
 */
export function DocActions() {
  return (
    <button
      onClick={() => window.print()}
      title="Imprimir / Guardar como PDF"
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors"
    >
      <Printer className="w-4 h-4" />
      <span className="hidden lg:inline">Imprimir / PDF</span>
    </button>
  );
}
