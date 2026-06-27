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
    ImageRun, VerticalAlign, BorderStyle, LineRuleType, LevelFormat,
    InsertedTextRun, DeletedTextRun, CommentRangeStart, CommentRangeEnd, CommentReference,
    TableOfContents,
  } = docx as any;

  const HEADINGS: any = {
    1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
  };
  // Notas al pie reales de Word: se acumulan en orden de aparición.
  let fnCount = 0;
  const footnotes: Record<number, any> = {};
  // Id incremental de revisiones (control de cambios → <w:ins>/<w:del>).
  let revId = 1;
  // Comentarios de Word: commentId (string del editor) → id numérico, y definiciones del hilo.
  const commentIdMap = new Map<string, number>();
  const commentDefs = new Map<number, any>();
  let nextCommentId = 0;
  // Mientras se construye una celda de encabezado, su texto sale en negrita (como Word).
  let inHeaderCell = false;
  // Alineación horizontal heredada de la celda de tabla en curso (Word la aplica al párrafo).
  let cellAlign: string | null = null;
  // Numeración NATIVA de Word para listas ordenadas: cada árbol de lista registra una
  // definición (reinicia en 1) y los párrafos la referencian con su nivel.
  const numbering: any[] = [];
  let numSeq = 0;
  // Niveles de una lista ordenada: decimal por nivel («1.»), o ruta completa («1.1.1») en
  // el esquema legal (doc-mlist); sangría colgante por nivel.
  const orderedLevels = (legal: boolean) => Array.from({ length: 9 }, (_, l) => ({
    level: l,
    format: LevelFormat.DECIMAL,
    text: legal ? Array.from({ length: l + 1 }, (_, i) => `%${i + 1}`).join('.') : `%${l + 1}.`,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: (l + 1) * 360, hanging: 360 } } },
  }));
  // Crea (si hace falta) una referencia de numeración para un árbol de lista ordenada.
  const newOrderedRef = (legal: boolean) => { const reference = `axos-num-${++numSeq}`; numbering.push({ reference, levels: orderedLevels(legal) }); return reference; };
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
    let rev: { type: 'ins' | 'del'; author: string; date: any } | null = null;
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
      // Control de cambios → REVISIONES reales de Word (aceptables/rechazables en el panel Revisar).
      else if (m.type === 'deletion') rev = { type: 'del', author: m.attrs?.author || 'Autor', date: new Date(m.attrs?.date || Date.now()) };
      else if (m.type === 'insertion') rev = { type: 'ins', author: m.attrs?.author || 'Autor', date: new Date(m.attrs?.date || Date.now()) };
      else if (m.type === 'textStyle') {
        if (m.attrs?.color) o.color = hex(m.attrs.color);
        if (m.attrs?.fontFamily) o.font = m.attrs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        if (m.attrs?.fontSize) { const px = parseInt(String(m.attrs.fontSize), 10); if (px) o.size = Math.round(px * 1.5); }
      }
    }
    return { o, link, rev };
  }

  // Construye el run de un nodo de texto (hipervínculo / revisión ins-del / texto normal).
  function buildTextRun(n: any): any {
    const { o, link, rev } = runOpts(n);
    if (link) return new ExternalHyperlink({ link, children: [new TextRun({ ...o, color: '0563C1', underline: {} })] });
    if (rev?.type === 'ins') return new InsertedTextRun({ ...o, id: revId++, author: rev.author, date: rev.date });
    if (rev?.type === 'del') return new DeletedTextRun({ ...o, id: revId++, author: rev.author, date: rev.date });
    return new TextRun(o);
  }
  const commentMarkOf = (n: any) => (n?.type === 'text' ? (n.marks ?? []).find((m: any) => m.type === 'comment' && m.attrs?.commentId) : null);

  function inlineRuns(content: any[]): any[] {
    const out: any[] = [];
    const items = content ?? [];
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      // Comentarios → comentarios REALES de Word: agrupa los runs contiguos con el mismo
      // commentId en un único rango <w:commentRangeStart…End> + referencia, y registra el hilo.
      const cmark = CommentRangeStart ? commentMarkOf(n) : null;
      if (cmark) {
        const cid = cmark.attrs.commentId;
        let id = commentIdMap.get(cid);
        if (id === undefined) { id = nextCommentId++; commentIdMap.set(cid, id); }
        let j = i; const runs: any[] = [];
        for (; j < items.length; j++) { const c = commentMarkOf(items[j]); if (!c || c.attrs.commentId !== cid) break; runs.push(buildTextRun(items[j])); }
        if (!commentDefs.has(id)) {
          const body: any[] = [new Paragraph({ children: [new TextRun(String(cmark.attrs.text || ''))] })];
          for (const rep of (cmark.attrs.replies ?? [])) body.push(new Paragraph({ children: [new TextRun({ text: `${rep.author ? rep.author + ': ' : ''}${rep.text || ''}`, italics: true })] }));
          commentDefs.set(id, { id, author: cmark.attrs.author || 'Autor', date: new Date(cmark.attrs.createdAt || Date.now()), children: body });
        }
        out.push(new CommentRangeStart(id), ...runs, new CommentRangeEnd(id), new TextRun({ children: [new CommentReference(id)] }));
        i = j - 1;
        continue;
      }
      if (n.type === 'text') {
        out.push(buildTextRun(n));
      } else if (n.type === 'footnoteRef') {
        fnCount += 1;
        footnotes[fnCount] = { children: [new Paragraph({ children: [new TextRun(String(n.attrs?.content || ''))] })] };
        if (FootnoteReferenceRun) out.push(new FootnoteReferenceRun(fnCount));
      } else if (n.type === 'mathInline') {
        out.push(new TextRun({ text: n.attrs?.latex || '', italics: true }));
      } else if (n.type === 'crossRef') {
        out.push(new TextRun(n.attrs?.label || n.attrs?.target || ''));
      } else if (n.type === 'axosRef') {
        const label = n.attrs?.label || `${String(n.attrs?.entity || 'AXOS').toUpperCase()} ${n.attrs?.refId || ''}`.trim();
        out.push(new TextRun({ text: label, bold: true, color: '1D4ED8' }));
      } else if (n.type === 'docField') {
        out.push(new TextRun({ text: n.attrs?.value || n.attrs?.label || n.attrs?.key || '', bold: true }));
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

  function listParas(listNode: any, kind: 'bullet' | 'ordered' | 'task', level: number, ref = ''): any[] {
    const out: any[] = [];
    for (const item of listNode.content ?? []) {
      const para = (item.content ?? []).find((n: any) => n.type === 'paragraph');
      const runs = inlineRuns(para?.content);
      if (kind === 'bullet') out.push(new Paragraph({ bullet: { level }, children: runs }));
      else if (kind === 'ordered') out.push(new Paragraph({ numbering: { reference: ref, level }, children: runs }));
      else out.push(new Paragraph({ indent: { left: (level + 1) * 360 }, children: [new TextRun({ text: item.attrs?.checked ? '☑ ' : '☐ ' }), ...runs] }));
      for (const child of item.content ?? []) {
        if (child.type === 'bulletList') out.push(...listParas(child, 'bullet', level + 1));
        else if (child.type === 'orderedList') {
          // Una lista ordenada anidada bajo otra ordenada comparte su referencia
          // (numeración jerárquica); bajo viñetas, abre una numeración propia.
          const childRef = ref || newOrderedRef((child.attrs?.listScheme || '') === 'doc-mlist');
          out.push(...listParas(child, 'ordered', level + 1, childRef));
        }
      }
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
        return [new Paragraph({ alignment: caption ? AlignmentType.CENTER : align(node.attrs?.textAlign ?? cellAlign ?? undefined), indent: indentOf(node), spacing: spacingOf(node), children: runs })];
      }
      case 'bulletList': return listParas(node, 'bullet', 0);
      case 'orderedList': return listParas(node, 'ordered', 0, newOrderedRef((node.attrs?.listScheme || '') === 'doc-mlist'));
      case 'taskList': return listParas(node, 'task', 0);
      case 'blockquote': return (node.content ?? []).map((p: any) => new Paragraph({
        indent: { left: 480 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: '9CA3AF', space: 12 } },
        spacing: { before: 40, after: 40 },
        children: inlineRuns(p.content).map((r: any) => r),
      }));
      case 'codeBlock': return String((node.content ?? []).map((t: any) => t.text).join('')).split('\n').map((line) => new Paragraph({ children: [new TextRun({ text: line, font: 'Courier New' })] }));
      case 'horizontalRule': return [new Paragraph({ thematicBreak: true })];
      case 'pageBreak': return [new Paragraph({ children: [new PageBreak()] })];
      case 'columnBreak': return [new Paragraph({ children: [new PageBreak()] })];
      case 'mathBlock': return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: node.attrs?.latex || '', italics: true })] })];
      case 'callout': {
        // Recuadro «tipo Word»: sombreado + borde del color del tono, en cada párrafo del
        // bloque (borde superior/inferior solo en el primero/último para cerrar la caja).
        const TONES: Record<string, { fill: string; color: string }> = {
          neutral: { fill: 'F3F4F6', color: '9CA3AF' }, info: { fill: 'EFF6FF', color: '3B82F6' },
          success: { fill: 'ECFDF5', color: '10B981' }, warning: { fill: 'FFFBEB', color: 'F59E0B' },
          danger: { fill: 'FEF2F2', color: 'EF4444' }, error: { fill: 'FEF2F2', color: 'EF4444' },
        };
        const t = TONES[node.attrs?.tone as string] || TONES.neutral;
        const kids: any[] = node.content ?? [];
        const out: any[] = [];
        kids.forEach((child: any, i: number) => {
          if (child.type === 'paragraph' || child.type === 'heading') {
            const edge = { style: BorderStyle.SINGLE, size: 4, color: t.color, space: 4 };
            out.push(new Paragraph({
              shading: { type: ShadingType.CLEAR, color: 'auto', fill: t.fill },
              border: { left: { style: BorderStyle.SINGLE, size: 18, color: t.color, space: 10 }, top: i === 0 ? edge : undefined, bottom: i === kids.length - 1 ? edge : undefined },
              spacing: { before: i === 0 ? 80 : 0, after: i === kids.length - 1 ? 80 : 0 },
              children: inlineRuns(child.content),
            }));
          } else out.push(...blockToEls(child));
        });
        return out.length ? out : [new Paragraph({ shading: { type: ShadingType.CLEAR, color: 'auto', fill: t.fill }, children: [] })];
      }
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
        const title = new Paragraph({ heading: HEADINGS[1], children: [new TextRun('Tabla de contenido')] });
        // Campo TOC REAL de Word: se actualiza con los títulos y SUS NÚMEROS DE PÁGINA, y es
        // clicable. (El estático no tenía páginas ni enlaces.) Fallback a texto si la API falta.
        if (TableOfContents) return [title, new TableOfContents('Contenido', { hyperlink: true, headingStyleRange: '1-5' })];
        const out: any[] = [title];
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
        const prevAlign = cellAlign;
        inHeaderCell = isHeader;
        cellAlign = cell.attrs?.textAlign ?? null;
        const paras = (cell.content ?? []).flatMap(blockToEls);
        inHeaderCell = prev;
        cellAlign = prevAlign;
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

  return new Document({
    sections: [section],
    ...(Object.keys(footnotes).length ? { footnotes } : {}),
    ...(numbering.length ? { numbering: { config: numbering } } : {}),
    ...(commentDefs.size ? { comments: { children: [...commentDefs.values()] } } : {}),
  });
}

export async function exportDocx(json: any, title: string) {
  const docx = await import('docx');
  const doc = buildDocx(docx, json, title);
  download(await (docx as any).Packer.toBlob(doc), `${safe(title)}.docx`);
}

// Mapa de estilos de Word → HTML semántico que TipTap entiende. Mammoth ya mapea
// Heading 1–6, negrita, cursiva, listas y tablas; aquí añadimos los estilos con NOMBRE
// que de otro modo se aplanarían a un párrafo suelto (Título, Subtítulo, Cita, etc.).
const DOCX_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Subtítulo'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Cita'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='Caption'] => p.doc-caption:fresh",
  "p[style-name='List Paragraph'] => p:fresh",
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
];

/** Convierte los bytes de un .docx a HTML (mammoth + style map). Núcleo testeable sin DOM. */
export async function importDocxBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth: any = await import('mammoth');
  // En el navegador mammoth toma `{ arrayBuffer }`; en Node (tests/SSR) toma `{ buffer }`.
  const input = typeof window === 'undefined' ? { buffer: Buffer.from(arrayBuffer) } : { arrayBuffer };
  const result = await mammoth.convertToHtml(input, { styleMap: DOCX_STYLE_MAP });
  return result?.value || '<p></p>';
}

export async function importDocx(file: File): Promise<string> {
  return importDocxBuffer(await file.arrayBuffer());
}
