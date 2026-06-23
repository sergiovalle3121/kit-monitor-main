'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, FileText, Upload, ChevronDown, Download, Loader2 } from 'lucide-react';
import { exportDocx, importDocx } from '@/lib/office/docx';
import { tiptapJsonToMarkdown, markdownToHtml } from '@/lib/office/markdown';
import { useToast } from '@/contexts/ToastContext';

/** Export (PDF / Word) + Import (.docx) for the document editor. */
export function DocActions({
  content, title, onImport, readOnly,
}: {
  content: any;
  title: string;
  onImport: (html: string) => void;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function word() {
    setOpen(false);
    setBusy(true);
    try { await exportDocx(content, title || 'documento'); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }
  // Impresión nativa del lienzo: con la vista paginada activa, el CSS de impresión
  // (printPageCss) fija tamaño de papel y márgenes y rompe en los saltos reales
  // (.doc-print-break). La salida fiel con encabezado/pie/numeración por página es
  // la «Vista de página» (Paged.js), accesible desde la pestaña Vista.
  function pdf() { setOpen(false); window.print(); }

  // Exporta a Markdown (GFM) — texto plano, versionable y portable (ver lib/office/markdown.ts).
  function markdown() {
    setOpen(false);
    try {
      const md = tiptapJsonToMarkdown(content);
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${title || 'documento'}.md`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error('No se pudo exportar a Markdown.'); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const name = f.name.toLowerCase();
      if (/\.(md|markdown|txt)$/.test(name)) onImport(markdownToHtml(await f.text()));
      else onImport(await importDocx(f));
    }
    catch { toast.error('No se pudo importar el archivo.'); }
    finally { setBusy(false); }
  }

  const btn = 'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-colors';

  return (
    <div className="flex items-center gap-0.5">
      {!readOnly && (
        <>
          <input ref={fileRef} type="file" accept=".docx,.md,.markdown,.txt" onChange={onFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className={btn} title="Importar .docx o .md">
            <Upload className="w-4 h-4" /> <span className="hidden lg:inline">Importar</span>
          </button>
        </>
      )}
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
                className="absolute right-0 mt-1 z-20 w-44 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl p-1"
              >
                <button onClick={word} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><FileText className="w-4 h-4 text-blue-500" /> Word (.docx)</button>
                <button onClick={markdown} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><FileText className="w-4 h-4 text-emerald-500" /> Markdown (.md)</button>
                <button onClick={pdf} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Printer className="w-4 h-4 text-gray-500" /> PDF / Imprimir</button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
