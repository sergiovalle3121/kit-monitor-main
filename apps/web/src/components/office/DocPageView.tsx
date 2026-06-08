'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { BookOpen, X, Printer, Loader2 } from 'lucide-react';

const esc = (s: string) => (s || '').replace(/["\\]/g, '\\$&');

function buildCss(header: string, footer: string, nums: boolean, firstDiff = false) {
  return `
  @page { size: A4; margin: 22mm 18mm;
    ${header ? `@top-center { content: "${esc(header)}"; font: 10px system-ui, sans-serif; color:#666; }` : ''}
    ${footer ? `@bottom-left { content: "${esc(footer)}"; font: 10px system-ui, sans-serif; color:#666; }` : ''}
    ${nums ? `@bottom-right { content: "Página " counter(page) " / " counter(pages); font: 10px system-ui, sans-serif; color:#666; }` : ''}
  }
  ${firstDiff ? '@page:first { @top-center { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }' : ''}
  .pagedjs_page { background:#fff; box-shadow:0 2px 14px rgba(0,0,0,.18); margin:0 auto 18px; }
  .doc-content { font-family: system-ui, -apple-system, sans-serif; color:#111; font-size:11pt; line-height:1.5; }
  .doc-content h1{font-size:22pt;font-weight:700;margin:.5em 0}
  .doc-content h2{font-size:17pt;font-weight:700;margin:.5em 0}
  .doc-content h3{font-size:13pt;font-weight:700;margin:.4em 0}
  .doc-content p{margin:.4em 0}
  .doc-content ul,.doc-content ol{padding-left:1.4em;margin:.4em 0}
  .doc-content blockquote{border-left:3px solid #ddd;padding-left:12px;color:#555;margin:.5em 0}
  .doc-content table{border-collapse:collapse;width:100%;margin:.6em 0}
  .doc-content td,.doc-content th{border:1px solid #ccc;padding:4px 8px}
  .doc-content img{max-width:100%}
  .doc-content .page-break{break-before:page;height:0}
  `;
}

/** Paginated print preview (Paged.js) with real headers / footers / page numbers. */
export function DocPageView({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [nums, setNums] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  function openView() {
    const a = editor.state.doc.attrs as any;
    setHeader(a?.pageHeader || '');
    setFooter(a?.pageFooter || '');
    setNums(a?.pageNumbers ?? true);
    setOpen(true);
  }

  async function render() {
    const container = containerRef.current;
    if (!container) return;
    setBusy(true);
    container.innerHTML = '';
    // Persist the page setup back into the document.
    (editor.chain() as any).setPageMeta({ pageHeader: header, pageFooter: footer, pageNumbers: nums }).run();
    try {
      const { Previewer } = (await import('pagedjs')) as any;
      const firstDiff = !!(editor.state.doc.attrs as any)?.pageFirstDifferent;
      const html = `<div class="doc-content">${editor.getHTML()}</div>`;
      await new Previewer().preview(html, [{ paged: buildCss(header, footer, nums, firstDiff) }], container);
    } catch {
      container.innerHTML = '<p style="text-align:center;color:#999;padding:40px">No se pudo generar la vista paginada.</p>';
    } finally {
      setBusy(false);
    }
  }

  // Render whenever the view opens.
  useEffect(() => {
    if (open) render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function print() {
    document.body.classList.add('preview-printing');
    const after = () => { document.body.classList.remove('preview-printing'); window.removeEventListener('afterprint', after); };
    window.addEventListener('afterprint', after);
    window.print();
  }

  return (
    <>
      <button onClick={openView} title="Vista de página / impresión"
        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300">
        <BookOpen className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80]">
            <div className="paged-preview-root absolute inset-0 bg-gray-200 dark:bg-[#0b0b0b] flex flex-col">
              <div className="paged-preview-toolbar flex items-center gap-2 px-4 h-14 bg-white dark:bg-[#161616] border-b border-black/10 dark:border-white/10 flex-shrink-0 flex-wrap">
                <span className="font-bold text-sm mr-2">Vista de página</span>
                <input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="Encabezado" className="h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none w-40" />
                <input value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Pie de página" className="h-8 text-sm rounded-lg bg-gray-100 dark:bg-white/10 px-2.5 outline-none w-40" />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer"><input type="checkbox" checked={nums} onChange={(e) => setNums(e.target.checked)} /> Números de página</label>
                <button onClick={render} disabled={busy} className="h-8 px-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-semibold disabled:opacity-60">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar'}</button>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={print} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"><Printer className="w-4 h-4" /> Imprimir / PDF</button>
                  <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div ref={containerRef} className="flex-1 overflow-auto p-8 flex flex-col items-center">
                {busy && <div className="text-gray-400 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Generando páginas…</div>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
