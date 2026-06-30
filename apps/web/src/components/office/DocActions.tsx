'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, FileText, Upload, ChevronDown, Download, Loader2 } from 'lucide-react';
import { exportDocx, importDocx } from '@/lib/office/docx';
import { tiptapJsonToMarkdown, tiptapJsonToPlainText, markdownToHtml } from '@/lib/office/markdown';
import { exportHtml } from '@/lib/office/html';
import { exportPdf } from '@/lib/office/pdf';
import { useToast } from '@/contexts/ToastContext';
import { apiFetch } from '@/lib/apiFetch';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Export (PDF / Word) + Import (.docx) for the document editor. */
export function DocActions({
  content, title, onImport, readOnly, docId,
}: {
  content: any;
  title: string;
  onImport: (html: string) => void;
  readOnly?: boolean;
  docId?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  async function recordDistribution(format: 'pdf' | 'docx' | 'html' | 'markdown' | 'txt' | 'print') {
    if (!docId) return;
    await apiFetch(`${API_BASE}/office-documents/${docId}/distributions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: format === 'print' ? 'print' : 'export', format, purpose: 'Exportado desde AXOS Docs' }),
    }).catch(() => undefined);
  }

  async function word() {
    setOpen(false);
    setBusy(true);
    try { await exportDocx(content, title || 'documento'); await recordDistribution('docx'); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  }
  async function pdf() {
    setOpen(false);
    setBusy(true);
    try { await exportPdf(content, title || 'documento'); await recordDistribution('pdf'); }
    catch { toast.error('No se pudo exportar a PDF. Usa Imprimir como alternativa.'); }
    finally { setBusy(false); }
  }

  // Impresión nativa del lienzo: conserva la ruta de fallback del navegador.
  function print() { setOpen(false); void recordDistribution('print'); window.print(); }

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
      void recordDistribution('markdown');
    } catch { toast.error('No se pudo exportar a Markdown.'); }
  }

  function html() {
    setOpen(false);
    try { exportHtml(content, title || 'documento'); void recordDistribution('html'); }
    catch { toast.error('No se pudo exportar a HTML.'); }
  }

  // Exporta a texto sin formato (.txt) — ver lib/office/markdown.ts:tiptapJsonToPlainText.
  function plain() {
    setOpen(false);
    try {
      const txt = tiptapJsonToPlainText(content);
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${title || 'documento'}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      void recordDistribution('txt');
    } catch { toast.error('No se pudo exportar a texto.'); }
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
                <button onClick={plain} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" /> Texto plano (.txt)</button>
                <button onClick={html} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><FileText className="w-4 h-4 text-orange-500" /> HTML (.html)</button>
                <button onClick={pdf} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Printer className="w-4 h-4 text-red-500" /> PDF (.pdf)</button>
                <button onClick={print} className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"><Printer className="w-4 h-4 text-gray-500" /> Imprimir</button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
