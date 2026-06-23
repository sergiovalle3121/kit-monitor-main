'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import { BookOpen, X, Printer, Loader2 } from 'lucide-react';
import { PAGE_FORMAT_CSS } from './docPageExtensions';
import { hasPageField } from './docs/pagination';

const esc = (s: string) => (s || '').replace(/["\\]/g, '\\$&');

interface FieldCtx { title: string; date: string }
/** Resuelve {title}/{date} a literales (los de página van como counters CSS). */
const litFields = (s: string, ctx: FieldCtx) => (s || '').replace(/\{title\}/g, ctx.title).replace(/\{date\}/g, ctx.date);
/**
 * Construye el valor `content` de una caja de margen @page a partir de un texto
 * que puede mezclar literales y campos {page}/{pages}: los campos se emiten como
 * `counter(page)` / `counter(pages)` (numeración real de Paged.js).
 */
function boxContent(text: string, ctx: FieldCtx, format: string): string | null {
  const lit = litFields(text, ctx);
  if (!lit) return null;
  const fmt = PAGE_FORMAT_CSS[format] || 'decimal';
  const parts = lit.split(/(\{page\}|\{pages\})/g).filter((s) => s !== '');
  return parts
    .map((p) => (p === '{page}' ? `counter(page, ${fmt})` : p === '{pages}' ? 'counter(pages)' : `"${esc(p)}"`))
    .join(' ');
}

const CONTENT_CSS = `
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
  .doc-content [data-section-break]{display:none}
  .doc-content p,.doc-content li{orphans:2;widows:2}
  .doc-content [data-break-before]{break-before:page}
  .doc-content [data-keep-lines]{break-inside:avoid}
  .doc-content [data-keep-next]{break-after:avoid}
  .doc-content h1,.doc-content h2,.doc-content h3,.doc-content h4{break-after:avoid;break-inside:avoid}
`;

const SIZE_KW: Record<string, string> = { a4: 'A4', letter: 'Letter', legal: 'Legal' };
function sizeFor(docAttrs: any, orientation?: string) {
  const kw = SIZE_KW[docAttrs?.pageSize as string] || 'A4';
  const o = (orientation || docAttrs?.pageOrientation || 'portrait') === 'landscape' ? 'landscape' : 'portrait';
  return `${kw} ${o}`;
}
function marginFor(docAttrs: any) {
  return docAttrs?.pageMargin === 'narrow' ? '14mm' : docAttrs?.pageMargin === 'wide' ? '30mm 26mm' : '22mm 18mm';
}
/** Cajas de margen @page (encabezado / pie / número con formato + campos). */
function marginBoxes(header: string, footer: string, nums: boolean, format: string, withTotal: boolean, ctx: FieldCtx) {
  let out = '';
  const h = boxContent(header, ctx, format);
  if (h) out += `@top-center { content: ${h}; font: 10px system-ui, sans-serif; color:#666; }`;
  const f = boxContent(footer, ctx, format);
  if (f) out += `@bottom-left { content: ${f}; font: 10px system-ui, sans-serif; color:#666; }`;
  // Numeración automática sólo si se pide y el texto no trae ya un campo {page}/{pages}.
  if (nums && !hasPageField(header) && !hasPageField(footer)) {
    const fmt = PAGE_FORMAT_CSS[format] || 'decimal';
    const content = withTotal ? `"Página " counter(page) " / " counter(pages)` : `"Página " counter(page, ${fmt})`;
    out += `@bottom-right { content: ${content}; font: 10px system-ui, sans-serif; color:#666; }`;
  }
  return out;
}

/** CSS de una sola sección (fallback sin saltos de sección). */
function buildCss(header: string, footer: string, nums: boolean, ctx: FieldCtx, firstDiff = false) {
  return `
  @page { size: A4; margin: 22mm 18mm; ${marginBoxes(header, footer, nums, 'decimal', true, ctx)} }
  ${firstDiff ? '@page:first { @top-center { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }' : ''}
  ${CONTENT_CSS}
  `;
}

interface PreviewSection { attrs: any; nodes: HTMLElement[] }

/**
 * Divide el HTML del editor en secciones (en los `div[data-section-break]`) y
 * genera HTML + CSS de Paged.js con **páginas con nombre** por sección, cada una
 * con su encabezado/pie, numeración (formato + reinicio), columnas y orientación.
 */
function buildSectioned(rawHtml: string, opts: { header: string; footer: string; nums: boolean; firstDiff: boolean; docAttrs: any; ctx: FieldCtx }) {
  const { header, footer, nums, firstDiff, docAttrs, ctx } = opts;
  const tmp = document.createElement('div');
  tmp.innerHTML = rawHtml;
  const sections: PreviewSection[] = [{ attrs: null, nodes: [] }];
  Array.from(tmp.children).forEach((child) => {
    const el = child as HTMLElement;
    if (el.matches && el.matches('div[data-section-break]')) {
      const d = el.dataset;
      sections.push({
        attrs: {
          breakType: d.sectionBreak || 'nextPage', header: d.header || '', footer: d.footer || '',
          pageNumbers: d.pageNumbers === 'true', pageStart: d.pageStart ? Number(d.pageStart) : null,
          pageFormat: d.pageFormat || 'decimal', columns: Number(d.columns) || 0, orientation: d.orientation || '',
        },
        nodes: [],
      });
    } else {
      sections[sections.length - 1].nodes.push(el);
    }
  });

  const htmlBody = sections.map((s, i) => `<section class="doc-section sec${i}">${s.nodes.map((n) => n.outerHTML).join('')}</section>`).join('');
  const html = `<div class="doc-content">${htmlBody}</div>`;

  let css = `@page { size: ${sizeFor(docAttrs)}; margin: ${marginFor(docAttrs)}; ${marginBoxes(header, footer, nums, 'decimal', true, ctx)} }`;
  if (firstDiff) css += ` @page:first { @top-center { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }`;
  const rule = docAttrs?.pageColumnRule ? ' column-rule: 1px solid #ccc;' : '';
  const baseCols = Number(docAttrs?.pageColumns || 1);
  if (baseCols > 1) css += ` .doc-section.sec0 { column-count: ${baseCols}; column-gap: 2rem;${rule} }`;
  sections.forEach((s, i) => {
    if (i === 0 || !s.attrs) return;
    const a = s.attrs;
    const h = a.header || header;
    const f = a.footer || footer;
    const n = a.pageNumbers || nums;
    css += ` @page sec${i} { size: ${sizeFor(docAttrs, a.orientation)}; margin: ${marginFor(docAttrs)}; ${marginBoxes(h, f, n, a.pageFormat, false, ctx)} }`;
    css += ` .doc-section.sec${i} { page: sec${i}; }`;
    if (a.columns > 1) css += ` .doc-section.sec${i} { column-count: ${a.columns}; column-gap: 2rem;${rule} }`;
    if (a.pageStart != null) css += ` .doc-section.sec${i} { counter-reset: page ${Math.max(0, a.pageStart - 1)}; }`;
  });
  return { html, css: CONTENT_CSS + css };
}

/** Paginated print preview (Paged.js) with real headers / footers / page numbers. */
export function DocPageView({ editor, title }: { editor: Editor; title?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState('');
  const [footer, setFooter] = useState('');
  const [nums, setNums] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fieldCtx = (): FieldCtx => ({ title: title || '', date: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) });

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
    const ctx = fieldCtx();
    try {
      const { Previewer } = (await import('pagedjs')) as any;
      const docAttrs = (editor.state.doc.attrs as any) || {};
      const firstDiff = !!docAttrs.pageFirstDifferent;
      const { html, css } = buildSectioned(editor.getHTML(), { header, footer, nums, firstDiff, docAttrs, ctx });
      await new Previewer().preview(html, [{ paged: css }], container);
    } catch {
      // Fallback robusto: vista de una sola sección si algo falla con las secciones.
      try {
        const { Previewer } = (await import('pagedjs')) as any;
        const firstDiff = !!(editor.state.doc.attrs as any)?.pageFirstDifferent;
        const html = `<div class="doc-content">${editor.getHTML()}</div>`;
        await new Previewer().preview(html, [{ paged: buildCss(header, footer, nums, ctx, firstDiff) }], container);
      } catch {
        container.innerHTML = '<p style="text-align:center;color:#999;padding:40px">No se pudo generar la vista paginada.</p>';
      }
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
