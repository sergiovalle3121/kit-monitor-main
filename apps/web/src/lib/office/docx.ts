/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Word interop for the document editor.
 *  · exportDocx: TipTap JSON → .docx via the `docx` library (MIT).
 *  · importDocx: .docx → HTML via `mammoth` (BSD), which TipTap loads directly.
 * Both libraries are imported dynamically (loaded only on use).
 */

const safe = (s: string) => (s || 'documento').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'documento';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function exportDocx(json: any, title: string) {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, ExternalHyperlink, HeadingLevel,
    AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType,
    Header, Footer, PageNumber, PageBreak, PageOrientation, FootnoteReferenceRun,
  } = docx as any;

  const HEADINGS: any = {
    1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
  };
  // Notas al pie reales de Word: se acumulan en orden de aparición.
  let fnCount = 0;
  const footnotes: Record<number, any> = {};
  const align = (a?: string) => ({ center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[a ?? 'left'] ?? AlignmentType.LEFT);
  const hex = (c?: string) => (c ? c.replace('#', '').slice(0, 6) : undefined);
  const indentOf = (node: any) => (node.attrs?.indent ? { left: node.attrs.indent * 540 } : undefined);
  function collectHeads(nodes: any[], out: { level: number; text: string }[] = []) {
    for (const n of nodes ?? []) {
      if (n.type === 'heading') out.push({ level: n.attrs?.level || 1, text: (n.content ?? []).map((t: any) => t.text || '').join('') });
      if (n.content) collectHeads(n.content, out);
    }
    return out;
  }

  function runOpts(node: any) {
    const o: any = { text: node.text || '' };
    let link: string | undefined;
    for (const m of node.marks ?? []) {
      if (m.type === 'bold') o.bold = true;
      else if (m.type === 'italic') o.italics = true;
      else if (m.type === 'underline') o.underline = {};
      else if (m.type === 'strike') o.strike = true;
      else if (m.type === 'subscript') o.subScript = true;
      else if (m.type === 'superscript') o.superScript = true;
      else if (m.type === 'code') o.font = 'Courier New';
      else if (m.type === 'link') link = m.attrs?.href;
      else if (m.type === 'highlight' && m.attrs?.color) o.shading = { type: ShadingType.CLEAR, fill: hex(m.attrs.color) };
      else if (m.type === 'deletion') { o.strike = true; o.color = o.color || 'DC2626'; }
      else if (m.type === 'insertion') { o.underline = o.underline || {}; o.color = o.color || '047857'; }
      else if (m.type === 'textStyle') {
        if (m.attrs?.color) o.color = hex(m.attrs.color);
        if (m.attrs?.fontFamily) o.font = m.attrs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (m.attrs?.fontSize) { const px = parseInt(String(m.attrs.fontSize), 10); if (px) o.size = Math.round(px * 1.5); }
      }
    }
    return { o, link };
  }

  function inlineRuns(content: any[]): any[] {
    const out: any[] = [];
    for (const n of content ?? []) {
      if (n.type === 'text') {
        const { o, link } = runOpts(n);
        if (link) out.push(new ExternalHyperlink({ link, children: [new TextRun({ ...o, color: '0563C1', underline: {} })] }));
        else out.push(new TextRun(o));
      } else if (n.type === 'footnoteRef') {
        fnCount += 1;
        footnotes[fnCount] = { children: [new Paragraph({ children: [new TextRun(String(n.attrs?.content || ''))] })] };
        if (FootnoteReferenceRun) out.push(new FootnoteReferenceRun(fnCount));
      } else if (n.type === 'mathInline') {
        out.push(new TextRun({ text: n.attrs?.latex || '', italics: true }));
      } else if (n.type === 'crossRef') {
        out.push(new TextRun(n.attrs?.label || n.attrs?.target || ''));
      } else if (n.type === 'citation') {
        out.push(new TextRun(n.attrs?.inText || ''));
      }
      // bookmark: sin representación textual (se omite).
    }
    return out;
  }

  function listParas(listNode: any, kind: 'bullet' | 'ordered' | 'task', level: number): any[] {
    const out: any[] = [];
    let idx = 1;
    for (const item of listNode.content ?? []) {
      const para = (item.content ?? []).find((n: any) => n.type === 'paragraph');
      const runs = inlineRuns(para?.content);
      if (kind === 'bullet') out.push(new Paragraph({ bullet: { level }, children: runs }));
      else if (kind === 'ordered') out.push(new Paragraph({ indent: { left: (level + 1) * 360 }, children: [new TextRun({ text: `${idx++}. ` }), ...runs] }));
      else out.push(new Paragraph({ indent: { left: (level + 1) * 360 }, children: [new TextRun({ text: item.attrs?.checked ? '☑ ' : '☐ ' }), ...runs] }));
      for (const child of item.content ?? []) {
        if (child.type === 'bulletList') out.push(...listParas(child, 'bullet', level + 1));
        else if (child.type === 'orderedList') out.push(...listParas(child, 'ordered', level + 1));
      }
    }
    return out;
  }

  function blockToEls(node: any): any[] {
    switch (node.type) {
      case 'heading': {
        const heading = node.attrs?.styleName === 'title' ? HeadingLevel.TITLE : HEADINGS[node.attrs?.level || 1];
        return [new Paragraph({ heading, alignment: align(node.attrs?.textAlign), indent: indentOf(node), children: inlineRuns(node.content) })];
      }
      case 'paragraph': {
        const sub = node.attrs?.styleName === 'subtitle';
        const caption = node.attrs?.styleName === 'caption';
        const runs = sub
          ? (node.content ?? []).filter((n: any) => n.type === 'text').map((n: any) => { const { o } = runOpts(n); return new TextRun({ ...o, size: o.size || 30, color: o.color || '6B7280' }); })
          : caption
            ? (node.content ?? []).filter((n: any) => n.type === 'text').map((n: any) => { const { o } = runOpts(n); return new TextRun({ ...o, italics: true, size: o.size || 18, color: o.color || '6B7280' }); })
            : inlineRuns(node.content);
        return [new Paragraph({ alignment: caption ? AlignmentType.CENTER : align(node.attrs?.textAlign), indent: indentOf(node), children: runs })];
      }
      case 'bulletList': return listParas(node, 'bullet', 0);
      case 'orderedList': return listParas(node, 'ordered', 0);
      case 'taskList': return listParas(node, 'task', 0);
      case 'blockquote': return (node.content ?? []).map((p: any) => new Paragraph({ indent: { left: 480 }, children: inlineRuns(p.content).map((r: any) => r) }));
      case 'codeBlock': return String((node.content ?? []).map((t: any) => t.text).join('')).split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, font: 'Courier New' })] }));
      case 'horizontalRule': return [new Paragraph({ thematicBreak: true })];
      case 'pageBreak': return [new Paragraph({ children: [new PageBreak()] })];
      case 'columnBreak': return [new Paragraph({ children: [new PageBreak()] })];
      case 'mathBlock': return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: node.attrs?.latex || '', italics: true })] })];
      case 'callout': return (node.content ?? []).flatMap(blockToEls);
      case 'signatureLine': return [
        new Paragraph({ spacing: { before: 240 }, children: [new TextRun('________________________________')] }),
        new Paragraph({ children: [new TextRun({ text: node.attrs?.name || '', bold: true })] }),
        ...(node.attrs?.title ? [new Paragraph({ children: [new TextRun({ text: node.attrs.title, color: '6B7280', size: 18 })] })] : []),
      ];
      case 'footnoteList': return []; // las notas reales se exportan por la API de footnotes de Word
      case 'bibliography': {
        const seen = new Set<string>();
        const srcs: string[] = [];
        (function walk(nodes: any[]) {
          for (const n of nodes ?? []) {
            if (n.type === 'citation' && n.attrs?.source && !seen.has(n.attrs.source)) { seen.add(n.attrs.source); srcs.push(n.attrs.source); }
            if (n.content) walk(n.content);
          }
        })(json?.content ?? []);
        srcs.sort((a, b) => a.localeCompare(b, 'es'));
        const out: any[] = [new Paragraph({ heading: HEADINGS[1], children: [new TextRun('Bibliografía')] })];
        for (const s of srcs) out.push(new Paragraph({ indent: { left: 360, hanging: 360 }, children: [new TextRun(s)] }));
        return out;
      }
      case 'toc': {
        const out: any[] = [new Paragraph({ heading: HEADINGS[1], children: [new TextRun('Tabla de contenido')] })];
        for (const h of collectHeads(json?.content ?? [])) out.push(new Paragraph({ indent: { left: (h.level - 1) * 360 }, children: [new TextRun(h.text || '(sin título)')] }));
        return out;
      }
      case 'table': return [tableToEl(node)];
      default: return node.content ? node.content.flatMap(blockToEls) : [];
    }
  }

  function tableToEl(node: any) {
    const rows = (node.content ?? []).map((row: any) => new TableRow({
      children: (row.content ?? []).map((cell: any) => {
        const paras = (cell.content ?? []).flatMap(blockToEls);
        return new TableCell({ children: paras.length ? paras : [new Paragraph({})] });
      }),
    }));
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
  }

  let children: any[];
  if (typeof json === 'string') {
    const dom = new DOMParser().parseFromString(json, 'text/html');
    children = Array.from(dom.body.querySelectorAll('h1,h2,h3,p,li,blockquote,pre')).map((el) => {
      const t = el.tagName.toLowerCase();
      const text = el.textContent || '';
      if (t === 'h1' || t === 'h2' || t === 'h3') return new Paragraph({ heading: HEADINGS[Number(t[1])], children: [new TextRun(text)] });
      return new Paragraph({ children: [new TextRun(text)] });
    });
    if (!children.length) children = [new Paragraph({ children: [new TextRun(dom.body.textContent || '')] })];
  } else {
    children = (json?.content ?? []).flatMap(blockToEls);
    if (!children.length) children = [new Paragraph({})];
  }

  // Configuración de página (desde los atributos del documento / pageMeta).
  const a: any = (json && typeof json === 'object' ? json.attrs : null) || {};
  const SIZE: Record<string, [number, number]> = { a4: [11906, 16838], letter: [12240, 15840], legal: [12240, 20160] };
  const [pw, ph] = SIZE[a.pageSize as string] || SIZE.a4;
  const landscape = a.pageOrientation === 'landscape';
  const marginTw = a.pageMargin === 'narrow' ? 720 : a.pageMargin === 'wide' ? 1800 : 1440;
  const props: any = {
    page: {
      size: { width: landscape ? ph : pw, height: landscape ? pw : ph, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
      margin: { top: marginTw, bottom: marginTw, left: marginTw, right: marginTw },
    },
  };
  if (Number(a.pageColumns) > 1) props.column = { count: Number(a.pageColumns), space: 708 };

  const section: any = { properties: props, children };
  if (a.pageHeader) {
    section.headers = { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(a.pageHeader), size: 18, color: '666666' })] })] }) };
  }
  if (a.pageFooter || a.pageNumbers) {
    const fch: any[] = [];
    if (a.pageFooter) fch.push(new TextRun({ text: `${a.pageFooter}   `, size: 18, color: '666666' }));
    if (a.pageNumbers) fch.push(new TextRun({ children: ['Página ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 18, color: '666666' }));
    section.footers = { default: new Footer({ children: [new Paragraph({ alignment: a.pageNumbers ? AlignmentType.CENTER : AlignmentType.LEFT, children: fch })] }) };
  }

  // Primera página distinta: encabezado/pie en blanco en la página 1.
  if (a.pageFirstDifferent) {
    props.titlePage = true;
    section.headers = { ...(section.headers || {}), first: new Header({ children: [new Paragraph({})] }) };
    section.footers = { ...(section.footers || {}), first: new Footer({ children: [new Paragraph({})] }) };
  }

  const doc = new Document({ sections: [section], ...(Object.keys(footnotes).length ? { footnotes } : {}) });
  download(await Packer.toBlob(doc), `${safe(title)}.docx`);
}

export async function importDocx(file: File): Promise<string> {
  const mammoth: any = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result?.value || '<p></p>';
}
