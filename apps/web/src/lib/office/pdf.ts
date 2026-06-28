/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsPDF } from 'jspdf';
import { tiptapJsonToHtmlDocument } from './html';

function safeName(name: string): string {
  return (name || 'documento').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'documento';
}

function bodyHtml(fullHtml: string): string {
  const match = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1] || fullHtml;
}

function docMeta(json: any): Record<string, any> {
  return (json?.attrs?.docProps && typeof json.attrs.docProps === 'object') ? json.attrs.docProps : {};
}

function pageFormat(json: any): 'a4' | 'letter' | 'legal' {
  const size = String(json?.attrs?.pageSize || '').toLowerCase();
  if (size === 'letter' || size === 'legal') return size;
  return 'a4';
}

function pageOrientation(json: any): 'p' | 'l' {
  return String(json?.attrs?.pageOrientation || '').toLowerCase() === 'landscape' ? 'l' : 'p';
}

function pageMargins(json: any): [number, number, number, number] {
  const margin = String(json?.attrs?.pageMargin || 'normal');
  if (margin === 'narrow') return [28, 28, 28, 28];
  if (margin === 'wide') return [72, 72, 72, 72];
  return [48, 54, 48, 54];
}

function controlledStamp(props: Record<string, any>): string {
  const parts = [props.documentNumber, props.revision ? `Rev ${props.revision}` : '', props.status].filter(Boolean);
  return parts.join(' · ');
}

/**
 * Browser-side high-fidelity PDF export. It renders the same semantic HTML export
 * into a jsPDF document instead of relying only on `window.print()`. This keeps a
 * portable download path while future backend PDF can reuse the same HTML source.
 */
export async function exportPdf(json: any, title: string) {
  const format = pageFormat(json);
  const orientation = pageOrientation(json);
  const margins = pageMargins(json);
  const props = docMeta(json);
  const pdf = new jsPDF({ unit: 'pt', format, orientation, compress: true, putOnlyUsedFonts: true });
  const html = tiptapJsonToHtmlDocument(json, title || 'Documento');
  const container = document.createElement('div');
  container.className = 'axos-pdf-export-root';
  container.innerHTML = `
    <style>
      .axos-pdf-export-root { width: 720px; color: #111827; font-family: Inter, Arial, sans-serif; font-size: 11pt; line-height: 1.48; }
      .axos-pdf-export-root h1 { font-size: 26pt; margin: 0 0 14pt; letter-spacing: -0.03em; }
      .axos-pdf-export-root h2 { font-size: 17pt; margin: 22pt 0 9pt; border-bottom: 1px solid #e5e7eb; padding-bottom: 4pt; }
      .axos-pdf-export-root h3 { font-size: 13pt; margin: 16pt 0 7pt; }
      .axos-pdf-export-root p { margin: 0 0 8pt; }
      .axos-pdf-export-root table { width: 100%; border-collapse: collapse; margin: 10pt 0 14pt; page-break-inside: avoid; }
      .axos-pdf-export-root th, .axos-pdf-export-root td { border: 1px solid #d1d5db; padding: 6pt; vertical-align: top; }
      .axos-pdf-export-root th { background: #111827; color: #fff; font-weight: 700; }
      .axos-pdf-export-root ul, .axos-pdf-export-root ol { margin: 0 0 10pt 18pt; padding: 0; }
      .axos-pdf-export-root li { margin: 3pt 0; }
      .axos-pdf-export-root .doc-callout { border-left: 4pt solid #2563eb; background: #eff6ff; padding: 9pt 10pt; margin: 10pt 0; page-break-inside: avoid; }
      .axos-pdf-export-root .doc-axos-ref, .axos-pdf-export-root .doc-field { display: inline-block; border: 1px solid #bfdbfe; border-radius: 999px; background: #eff6ff; color: #1d4ed8; padding: 1pt 5pt; font-weight: 700; }
      .axos-pdf-export-root [data-comment-id] { background: #fef3c7; }
      .axos-pdf-export-root ins { color: #047857; text-decoration: underline; }
      .axos-pdf-export-root del { color: #b91c1c; }
      .axos-pdf-export-root .page-break { break-before: page; page-break-before: always; }
      .axos-pdf-export-root img { max-width: 100%; height: auto; }
    </style>
    <div>${bodyHtml(html)}</div>
  `;
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.background = '#ffffff';
  document.body.appendChild(container);

  const [left, top, right, bottom] = margins;
  await pdf.html(container, {
    x: left,
    y: top,
    width: pdf.internal.pageSize.getWidth() - left - right,
    windowWidth: 720,
    margin: [top, right, bottom, left],
    autoPaging: 'text',
    html2canvas: { scale: 0.82, useCORS: true, backgroundColor: '#ffffff' },
    callback: (doc) => {
      const pages = doc.getNumberOfPages();
      const stamp = controlledStamp(props);
      for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        if (stamp) doc.text(stamp, left, 24);
        doc.text(`${i} / ${pages}`, w - right, h - 22, { align: 'right' });
      }
      doc.save(`${safeName(title)}.pdf`);
      container.remove();
    },
  });
}
