/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Word interop for the document editor.
 *  · exportDocx: TipTap JSON → .docx via the `docx` library (MIT).
 *  · importDocx: .docx → HTML via `mammoth` (BSD), which TipTap loads directly.
 * Both libraries are imported dynamically (loaded only on use).
 */

const safe = (s: string) => (s || 'documento').replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'documento';

// ── Imágenes embebidas (data URLs) → bytes + dimensiones naturales ─────────────
// Word necesita ancho Y alto en EMU; sin alto natural deformaría la imagen, así que
// leemos las dimensiones de la cabecera del binario (PNG/JPEG/GIF/BMP) sin librerías.
const USABLE_PX = 600; // ancho útil aproximado de la página (A4, márgenes normales)

/** base64 → bytes, funciona en navegador (`atob`) y en Node (`Buffer`). */
export function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64); const len = bin.length; const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return new Uint8Array((globalThis as any).Buffer.from(b64, 'base64'));
}

/** `data:image/...;base64,...` → `{ type, bytes }` (jpeg→jpg, svg+xml→svg). */
export function parseDataUrl(src: string): { type: string; bytes: Uint8Array } | null {
  const m = /^data:image\/(png|jpe?g|gif|bmp|svg\+xml);base64,(.*)$/i.exec(src);
  if (!m) return null;
  let type = m[1].toLowerCase();
  if (type === 'jpeg') type = 'jpg';
  if (type === 'svg+xml') type = 'svg';
  try { return { type, bytes: base64ToBytes(m[2]) }; } catch { return null; }
}

/** Dimensiones naturales (px) leídas de la cabecera del binario; null si no se reconoce. */
export function imageSize(b: Uint8Array, type: string): { w: number; h: number } | null {
  try {
    if (type === 'png' && b.length > 24) {
      const w = b[16] * 0x1000000 + (b[17] << 16) + (b[18] << 8) + b[19];
      const h = b[20] * 0x1000000 + (b[21] << 16) + (b[22] << 8) + b[23];
      if (w > 0 && h > 0) return { w, h };
    }
    if (type === 'gif' && b.length > 10) {
      const w = b[6] | (b[7] << 8); const h = b[8] | (b[9] << 8);
      if (w > 0 && h > 0) return { w, h };
    }
    if (type === 'bmp' && b.length > 26) {
      const w = b[18] | (b[19] << 8) | (b[20] << 16) | (b[21] << 24);
      const h = b[22] | (b[23] << 8) | (b[24] << 16) | (b[25] << 24);
      if (w > 0 && h !== 0) return { w, h: Math.abs(h) };
    }
    if (type === 'jpg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xFF) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          const h = (b[i + 5] << 8) | b[i + 6]; const w = (b[i + 7] << 8) | b[i + 8];
          if (w > 0 && h > 0) return { w, h };
          break;
        }
        const len = (b[i + 2] << 8) | b[i + 3];
        if (len <= 0) break;
        i += 2 + len;
      }
    }
  } catch { /* cabecera ilegible → sin tamaño */ }
  return null;
}

/** Ancho objetivo (px) desde el atributo del editor ("300px"/"50%"); cae al natural acotado. */
export function targetWidth(widthAttr: any, naturalW: number): number {
  if (typeof widthAttr === 'string') {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(widthAttr.trim());
    if (px) return Math.min(USABLE_PX, parseFloat(px[1]));
    const pct = /^(\d+(?:\.\d+)?)%$/.exec(widthAttr.trim());
    if (pct) return Math.max(1, Math.round((parseFloat(pct[1]) / 100) * USABLE_PX));
  }
  return Math.min(USABLE_PX, naturalW || 480);
}

/** Atributos de imagen de TipTap → `ImageRun` de Word (sólo data URLs embebibles). */
function imageRun(ImageRun: any, attrs: any): any {
  const src = attrs?.src;
  if (!ImageRun || typeof src !== 'string' || !src.startsWith('data:')) return null;
  const parsed = parseDataUrl(src);
  if (!parsed || parsed.type === 'svg') return null; // svg necesita dimensiones explícitas
  const nat = imageSize(parsed.bytes, parsed.type) || { w: 480, h: 360 };
  const w = targetWidth(attrs?.width, nat.w);
  const h = Math.max(1, Math.round((nat.h / nat.w) * w));
  try { return new ImageRun({ data: parsed.bytes, type: parsed.type, transformation: { width: Math.round(w), height: h } }); }
  catch { return null; }
}

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

/**
 * Construye el `Document` de la librería `docx` a partir del JSON de TipTap (función PURA:
 * recibe el módulo `docx` ya cargado, sin tocar el DOM, para poder probarla sin navegador).
 */
export function buildDocx(docx: any, json: any, title: string): any {
  const {
    Document, Paragraph, TextRun, ExternalHyperlink, HeadingLevel,
    AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType,
    Header, Footer, PageNumber, PageBreak, PageOrientation, FootnoteReferenceRun,
    ImageRun, VerticalAlign, BorderStyle, LineRuleType,
  } = docx as any;

  const HEADINGS: any = {
    1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
  };
  // Notas al pie reales de Word: se acumulan en orden de aparición.
  let fnCount = 0;
  const footnotes: Record<number, any> = {};
  // Mientras se construye una celda de encabezado, su texto sale en negrita (como Word).
  let inHeaderCell = false;
  // Bordes finos y grises para que las tablas se vean «tipo Word».
  const tableBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' };
  const tableBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder, insideHorizontal: tableBorder, insideVertical: tableBorder };
  const align = (a?: string) => ({ center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }[a ?? 'left'] ?? AlignmentType.LEFT);
  const hex = (c?: string) => (c ? c.replace('#', '').slice(0, 6) : undefined);
  const indentOf = (node: any) => {
    const ind: any = {};
    if (node.attrs?.indent) ind.left = node.attrs.indent * 540;
    if (node.attrs?.firstLineIndent) ind.firstLine = 480;
    return Object.keys(ind).length ? ind : undefined;
  };
  // Espaciado antes/después en twips (px ≈ 15 twips) + interlineado (múltiplo → 240avos).
  const spacingOf = (node: any) => {
    const sp: any = {};
    if (node.attrs?.spaceBefore) sp.before = node.attrs.spaceBefore * 15;
    if (node.attrs?.spaceAfter) sp.after = node.attrs.spaceAfter * 15;
    const lh = node.attrs?.lineHeight;
    if (lh) { const mult = parseFloat(String(lh)); if (mult > 0) { sp.line = Math.round(mult * 240); sp.lineRule = LineRuleType.AUTO; } }
    return Object.keys(sp).length ? sp : undefined;
  };
  function collectHeads(nodes: any[], out: { level: number; text: string }[] = []) {
    for (const n of nodes ?? []) {
      if (n.type === 'heading') out.push({ level: n.attrs?.level || 1, text: (n.content ?? []).map((t: any) => t.text || '').join('') });
      if (n.content) collectHeads(n.content, out);
    }
    return out;
  }

  function runOpts(node: any) {
    const o: any = { text: node.text || '' };
    if (inHeaderCell) o.bold = true; // celdas de encabezado en negrita
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
      } else if (n.type === 'image') {
        const ir = imageRun(ImageRun, n.attrs);
        if (ir) out.push(ir);
      }
      // bookmark: sin representación textual (se omite).
    }
    return out;
  }

  function listParas(listNode: any, kind: 'bullet' | 'ordered' | 'task', level: number, scheme = '', prefix = ''): any[] {
    const out: any[] = [];
    const legal = kind === 'ordered' && scheme === 'doc-mlist';
    let idx = 1;
    for (const item of listNode.content ?? []) {
      const para = (item.content ?? []).find((n: any) => n.type === 'paragraph');
      const runs = inlineRuns(para?.content);
      if (kind === 'bullet') out.push(new Paragraph({ bullet: { level }, children: runs }));
      else if (kind === 'ordered') {
        const num = legal ? `${prefix}${idx}.` : `${idx}.`;
        out.push(new Paragraph({ indent: { left: (level + 1) * 360 }, children: [new TextRun({ text: `${num} ` }), ...runs] }));
      } else out.push(new Paragraph({ indent: { left: (level + 1) * 360 }, children: [new TextRun({ text: item.attrs?.checked ? '☑ ' : '☐ ' }), ...runs] }));
      const childPrefix = legal ? `${prefix}${idx}.` : '';
      for (const child of item.content ?? []) {
        if (child.type === 'bulletList') out.push(...listParas(child, 'bullet', level + 1, child.attrs?.listScheme || '', ''));
        else if (child.type === 'orderedList') out.push(...listParas(child, 'ordered', level + 1, scheme, childPrefix));
      }
      idx += 1;
    }
    return out;
  }

  function blockToEls(node: any): any[] {
    switch (node.type) {
      case 'heading': {
        const heading = node.attrs?.styleName === 'title' ? HeadingLevel.TITLE : HEADINGS[node.attrs?.level || 1];
        return [new Paragraph({ heading, alignment: align(node.attrs?.textAlign), indent: indentOf(node), spacing: spacingOf(node), children: inlineRuns(node.content) })];
      }
      case 'paragraph': {
        const sub = node.attrs?.styleName === 'subtitle';
        const caption = node.attrs?.styleName === 'caption';
        const runs = sub
          ? (node.content ?? []).filter((n: any) => n.type === 'text').map((n: any) => { const { o } = runOpts(n); return new TextRun({ ...o, size: o.size || 30, color: o.color || '6B7280' }); })
          : caption
            ? (node.content ?? []).filter((n: any) => n.type === 'text').map((n: any) => { const { o } = runOpts(n); return new TextRun({ ...o, italics: true, size: o.size || 18, color: o.color || '6B7280' }); })
            : inlineRuns(node.content);
        return [new Paragraph({ alignment: caption ? AlignmentType.CENTER : align(node.attrs?.textAlign), indent: indentOf(node), spacing: spacingOf(node), children: runs })];
      }
      case 'bulletList': return listParas(node, 'bullet', 0);
      case 'orderedList': return listParas(node, 'ordered', 0, node.attrs?.listScheme || '', '');
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
      case 'image': {
        const ir = imageRun(ImageRun, node.attrs);
        return ir ? [new Paragraph({ alignment: align(node.attrs?.align), children: [ir] })] : [];
      }
      case 'table': return [tableToEl(node)];
      default: return node.content ? node.content.flatMap(blockToEls) : [];
    }
  }

  // Tabla «tipo Word»: sombreado de celda, anchos de columna, combinaciones
  // (colspan/rowspan), alineación vertical, encabezados en negrita y bordes finos.
  function tableToEl(node: any) {
    const VALIGN: any = { middle: VerticalAlign.CENTER, center: VerticalAlign.CENTER, bottom: VerticalAlign.BOTTOM, top: VerticalAlign.TOP };
    const rows = (node.content ?? []).map((row: any) => new TableRow({
      tableHeader: (row.content ?? []).length > 0 && (row.content ?? []).every((c: any) => c.type === 'tableHeader') ? true : undefined,
      children: (row.content ?? []).map((cell: any) => {
        const isHeader = cell.type === 'tableHeader';
        const prev = inHeaderCell;
        inHeaderCell = isHeader;
        const paras = (cell.content ?? []).flatMap(blockToEls);
        inHeaderCell = prev;
        const opts: any = { children: paras.length ? paras : [new Paragraph({})] };
        const bg = cell.attrs?.backgroundColor ? hex(cell.attrs.backgroundColor) : (isHeader ? 'F3F4F6' : undefined);
        if (bg) opts.shading = { type: ShadingType.CLEAR, color: 'auto', fill: bg };
        if (Number(cell.attrs?.colspan) > 1) opts.columnSpan = Number(cell.attrs.colspan);
        if (Number(cell.attrs?.rowspan) > 1) opts.rowSpan = Number(cell.attrs.rowspan);
        if (cell.attrs?.verticalAlign && VALIGN[cell.attrs.verticalAlign]) opts.verticalAlign = VALIGN[cell.attrs.verticalAlign];
        const cw = Array.isArray(cell.attrs?.colwidth) ? cell.attrs.colwidth[0] : null;
        if (cw) opts.width = { size: Math.round(cw * 15), type: WidthType.DXA }; // px → twips
        return new TableCell(opts);
      }),
    }));
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: tableBorders });
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

  // Campos de encabezado/pie: {title}/{date} → literales; {page}/{pages} → campos
  // reales de Word (número de página / total). Coincide con la vista paginada.
  const fieldDate = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const hasPageField = (t: string) => /\{(page|pages)\}/.test(t || '');
  const fieldChildren = (text: string): any[] => {
    const lit = String(text || '').replace(/\{title\}/g, title || '').replace(/\{date\}/g, fieldDate);
    const parts = lit.split(/(\{page\}|\{pages\})/g).filter((s) => s !== '');
    return parts.map((p) => (p === '{page}' ? PageNumber.CURRENT : p === '{pages}' ? PageNumber.TOTAL_PAGES : p));
  };

  const section: any = { properties: props, children };
  if (a.pageHeader) {
    section.headers = { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: fieldChildren(a.pageHeader), size: 18, color: '666666' })] })] }) };
  }
  if (a.pageFooter || a.pageNumbers) {
    const footerHasField = hasPageField(a.pageFooter);
    const fch: any[] = [];
    if (a.pageFooter) fch.push(new TextRun({ children: fieldChildren(a.pageFooter), size: 18, color: '666666' }));
    // Numeración automática sólo si se pide y el texto del pie no la trae ya.
    if (a.pageNumbers && !footerHasField) {
      if (a.pageFooter) fch.push(new TextRun({ text: '   ', size: 18, color: '666666' }));
      fch.push(new TextRun({ children: ['Página ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 18, color: '666666' }));
    }
    section.footers = { default: new Footer({ children: [new Paragraph({ alignment: (a.pageNumbers && !footerHasField) ? AlignmentType.CENTER : AlignmentType.LEFT, children: fch })] }) };
  }

  // Primera página distinta: encabezado/pie en blanco en la página 1.
  if (a.pageFirstDifferent) {
    props.titlePage = true;
    section.headers = { ...(section.headers || {}), first: new Header({ children: [new Paragraph({})] }) };
    section.footers = { ...(section.footers || {}), first: new Footer({ children: [new Paragraph({})] }) };
  }

  return new Document({ sections: [section], ...(Object.keys(footnotes).length ? { footnotes } : {}) });
}

export async function exportDocx(json: any, title: string) {
  const docx = await import('docx');
  const doc = buildDocx(docx, json, title);
  download(await (docx as any).Packer.toBlob(doc), `${safe(title)}.docx`);
}

export async function importDocx(file: File): Promise<string> {
  const mammoth: any = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result?.value || '<p></p>';
}
