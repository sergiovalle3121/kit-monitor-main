/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Serializa un documento **Tiptap/ProseMirror** (el modelo de Docs) a **Markdown** (sabor GFM).
 *
 * Función **pura** y sin dependencias: recorre el árbol JSON y mapea los nodos y marcas comunes a su
 * sintaxis Markdown (encabezados, énfasis, enlaces, listas anidadas y de tareas, citas, bloques de
 * código, reglas, imágenes, tablas GFM). Las marcas sin equivalente en Markdown (subrayado, resalte,
 * sub/superíndice, color, control de cambios, comentarios) **degradan** conservando el texto; los
 * nodos exóticos (math, footnotes) caen a un texto razonable. Complementa la exportación a `.docx`
 * (`docx.ts`) con un formato de texto plano, versionable y portable.
 */

type MdNode = { type?: string; attrs?: any; content?: MdNode[]; text?: string; marks?: any[] };

/** Escapa los caracteres con significado especial en texto Markdown normal. */
function escapeText(s: string): string {
  return s.replace(/[\\`*_[\]]/g, '\\$&');
}

// Recolector de notas al pie del documento en curso: el texto de cada nota vive en
// `footnoteRef.attrs.content` (en línea), así que se acumula al serializar y se vuelca como
// definiciones `[^N]: …` al final. Se reinicia en cada llamada a `tiptapJsonToMarkdown`.
let FOOTNOTES: string[] = [];
// Raíz del documento en curso: `toc` y `bibliography` se generan recorriendo todo el árbol
// (títulos y fuentes de citas), no su propio contenido. Se fija en `tiptapJsonToMarkdown`.
let ROOT: MdNode[] = [];

/** Texto plano (sin marcas ni sintaxis) de una secuencia de nodos — sin efectos secundarios. */
function plainText(nodes: MdNode[] = []): string {
  return (nodes ?? []).map((n) => (typeof n.text === 'string' ? n.text : n.content ? plainText(n.content) : '')).join('');
}

/** Títulos del documento (para la tabla de contenido), en orden, con su nivel. */
function collectHeadings(nodes: MdNode[]): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  (function walk(ns: MdNode[]) {
    for (const n of ns ?? []) {
      if (n.type === 'heading') out.push({ level: n.attrs?.level ?? 1, text: plainText(n.content).trim() });
      else if (n.content) walk(n.content);
    }
  })(nodes);
  return out;
}

/** Fuentes de las citas del documento (para la bibliografía), únicas y ordenadas. */
function collectSources(nodes: MdNode[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  (function walk(ns: MdNode[]) {
    for (const n of ns ?? []) {
      const src = n.type === 'citation' ? n.attrs?.source : undefined;
      if (src && !seen.has(src)) { seen.add(src); out.push(String(src)); }
      if (n.content) walk(n.content);
    }
  })(nodes);
  return out.sort((a, b) => a.localeCompare(b, 'es'));
}

/** Texto de una secuencia de nodos en línea, aplicando marcas. */
function serializeInline(nodes: MdNode[] = []): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'hardBreak') { out += '  \n'; continue; }
    if (n.type === 'image') { out += `![${n.attrs?.alt ?? ''}](${n.attrs?.src ?? ''})`; continue; }
    if (n.type === 'mathInline') { out += `$${n.attrs?.latex ?? ''}$`; continue; }
    if (n.type === 'footnoteRef') { FOOTNOTES.push(String(n.attrs?.content ?? '').replace(/\s*\n\s*/g, ' ').trim()); out += `[^${FOOTNOTES.length}]`; continue; }
    if (n.type === 'crossRef') { out += escapeText(String(n.attrs?.label ?? n.attrs?.target ?? '')); continue; }
    if (n.type === 'citation') { out += escapeText(String(n.attrs?.inText ?? '')); continue; }
    if (typeof n.text === 'string') { out += applyMarks(n.text, n.marks); continue; }
    if (n.content) out += serializeInline(n.content); // nodo en línea desconocido con hijos
  }
  return out;
}

/** Envuelve `raw` según sus marcas. El código va literal (sin escapar); el resto, escapado. */
function applyMarks(raw: string, marks: any[] = []): string {
  const hasCode = marks.some((m) => m?.type === 'code');
  let s = hasCode ? '`' + raw.replace(/`/g, '') + '`' : escapeText(raw);
  for (const m of marks) {
    switch (m?.type) {
      case 'bold': s = `**${s}**`; break;
      case 'italic': s = `*${s}*`; break;
      case 'strike': s = `~~${s}~~`; break;
      case 'link': s = `[${s}](${m.attrs?.href ?? ''})`; break;
      // underline / highlight / subscript / superscript / textStyle / insertion / deletion / comment:
      // sin sintaxis Markdown → se conserva el texto sin la marca.
      default: break;
    }
  }
  return s;
}

/** Texto plano de una celda de tabla (une los bloques internos en una línea). */
function cellText(cell: MdNode): string {
  return (cell.content ?? []).map((b) => serializeInline(b.content ?? [])).join(' ').replace(/\s+/g, ' ').trim();
}

function serializeTable(table: MdNode, lines: string[]): void {
  const rows = table.content ?? [];
  if (!rows.length) return;
  const grid = rows.map((row) => (row.content ?? []).map(cellText));
  const ncol = Math.max(...grid.map((r) => r.length));
  const pad = (r: string[]) => { const c = [...r]; while (c.length < ncol) c.push(''); return c; };
  lines.push('| ' + pad(grid[0]).join(' | ') + ' |');
  lines.push('| ' + pad(grid[0]).map(() => '---').join(' | ') + ' |');
  for (let r = 1; r < grid.length; r++) lines.push('| ' + pad(grid[r]).join(' | ') + ' |');
}

/** Serializa una lista (con o sin orden / de tareas), reciclando para sublistas anidadas. */
function serializeList(list: MdNode, indent: string, lines: string[]): void {
  const ordered = list.type === 'orderedList';
  const task = list.type === 'taskList';
  let i = ordered ? (list.attrs?.start ?? 1) : 1;
  for (const item of list.content ?? []) {
    const marker = ordered ? `${i}. ` : task ? (item.attrs?.checked ? '- [x] ' : '- [ ] ') : '- ';
    const blocks = item.content ?? [];
    let first = true;
    for (const b of blocks) {
      if (b.type === 'bulletList' || b.type === 'orderedList' || b.type === 'taskList') {
        serializeList(b, indent + '  ', lines);
      } else {
        const text = serializeInline(b.content ?? []);
        if (first) { lines.push(indent + marker + text); first = false; }
        else lines.push(indent + '  ' + text);
      }
    }
    if (first) lines.push(indent + marker.trimEnd()); // ítem vacío
    i++;
  }
}

/** Serializa una secuencia de bloques a líneas Markdown. */
function serializeBlocks(nodes: MdNode[] = []): string[] {
  const lines: string[] = [];
  for (const n of nodes) {
    switch (n.type) {
      case 'heading': {
        const lvl = Math.min(6, Math.max(1, n.attrs?.level ?? 1));
        lines.push('#'.repeat(lvl) + ' ' + serializeInline(n.content), '');
        break;
      }
      case 'paragraph':
        lines.push(serializeInline(n.content), '');
        break;
      case 'bulletList': case 'orderedList': case 'taskList':
        serializeList(n, '', lines); lines.push('');
        break;
      case 'blockquote': {
        const inner = serializeBlocks(n.content ?? []);
        while (inner.length && inner[inner.length - 1] === '') inner.pop();
        for (const l of inner) lines.push(l ? '> ' + l : '>');
        lines.push('');
        break;
      }
      case 'codeBlock': {
        const lang = n.attrs?.language ?? n.attrs?.lang ?? '';
        const code = (n.content ?? []).map((t) => t.text ?? '').join('');
        lines.push('```' + lang, ...code.split('\n'), '```', '');
        break;
      }
      case 'horizontalRule': case 'pageBreak': case 'columnBreak':
        lines.push('---', '');
        break;
      case 'image':
        lines.push(`![${n.attrs?.alt ?? ''}](${n.attrs?.src ?? ''})`, '');
        break;
      case 'mathBlock':
        lines.push('$$', n.attrs?.latex ?? '', '$$', '');
        break;
      case 'table':
        serializeTable(n, lines); lines.push('');
        break;
      case 'footnoteList':
        break; // las notas reales se vuelcan por el recolector (§87); este nodo no produce salida
      case 'signatureLine':
        lines.push(escapeText('________________________________'));
        if (n.attrs?.name) lines.push(`**${escapeText(String(n.attrs.name))}**`);
        if (n.attrs?.title) lines.push(escapeText(String(n.attrs.title)));
        lines.push('');
        break;
      case 'toc': {
        lines.push('## Tabla de contenido', '');
        for (const h of collectHeadings(ROOT)) lines.push('  '.repeat(Math.max(0, (h.level ?? 1) - 1)) + '- ' + escapeText(h.text));
        lines.push('');
        break;
      }
      case 'bibliography': {
        const srcs = collectSources(ROOT);
        if (srcs.length) { lines.push('## Bibliografía', ''); for (const s of srcs) lines.push('- ' + escapeText(s)); lines.push(''); }
        break;
      }
      default:
        if (n.content) for (const l of serializeBlocks(n.content)) lines.push(l);
        else if (typeof n.text === 'string') lines.push(escapeText(n.text), '');
        break;
    }
  }
  return lines;
}

/**
 * Convierte un documento Tiptap (`{ type:'doc', content:[…] }`) — o directamente un arreglo de nodos —
 * en una cadena Markdown. La salida es determinista: una línea en blanco entre bloques, sin blancos
 * triples, terminada en un único salto de línea.
 */
export function tiptapJsonToMarkdown(doc: any): string {
  FOOTNOTES = [];
  const content: MdNode[] = doc?.content ?? (Array.isArray(doc) ? doc : []);
  ROOT = content;
  let md = serializeBlocks(content).join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t\n]+$/, '');
  if (FOOTNOTES.length) md += '\n\n' + FOOTNOTES.map((t, i) => `[^${i + 1}]: ${t}`).join('\n');
  return md + '\n';
}

// ── Documento → texto plano (.txt) ────────────────────────────────────────────

/** Texto plano (sin formato) de una lista, con viñetas/números e indentación por nivel. */
function plainList(n: MdNode, depth: number, lines: string[]): void {
  const ordered = n.type === 'orderedList';
  let i = ordered ? (n.attrs?.start ?? 1) : 1;
  for (const item of n.content ?? []) {
    const blocks = item.content ?? [];
    lines.push('  '.repeat(depth) + (ordered ? `${i}. ` : '• ') + plainText(blocks[0]?.content ?? []).trim());
    for (const b of blocks.slice(1)) {
      if (b.type === 'bulletList' || b.type === 'orderedList' || b.type === 'taskList') plainList(b, depth + 1, lines);
      else lines.push('  '.repeat(depth + 1) + plainText(b.content ?? []).trim());
    }
    i++;
  }
}

/**
 * **Texto plano** del documento — «Guardar como texto sin formato» de Word. Conserva el texto y una
 * estructura mínima (saltos entre bloques, viñetas/números en listas, tabulaciones entre celdas);
 * descarta marcas y nodos decorativos. Pura y comprobable.
 */
export function tiptapJsonToPlainText(doc: any): string {
  const content: MdNode[] = doc?.content ?? (Array.isArray(doc) ? doc : []);
  const lines: string[] = [];
  const walk = (nodes: MdNode[]) => {
    for (const n of nodes ?? []) {
      switch (n.type) {
        case 'heading': case 'paragraph': lines.push(plainText(n.content), ''); break;
        case 'bulletList': case 'orderedList': case 'taskList': plainList(n, 0, lines); lines.push(''); break;
        case 'codeBlock': lines.push((n.content ?? []).map((t) => t.text ?? '').join(''), ''); break;
        case 'blockquote': walk(n.content ?? []); break;
        case 'horizontalRule': case 'pageBreak': lines.push('----------', ''); break;
        case 'table':
          for (const row of n.content ?? []) lines.push((row.content ?? []).map((c) => plainText(c.content ?? []).replace(/\s+/g, ' ').trim()).join('\t'));
          lines.push('');
          break;
        case 'footnoteList': break;
        default: if (n.content) walk(n.content); break;
      }
    }
  };
  walk(content);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

// ── Markdown → HTML (importación) ─────────────────────────────────────────────
// El editor de Docs (Tiptap) ingiere HTML al importar (igual que el `.docx` vía mammoth), así que el
// parser produce HTML que Tiptap convierte a su esquema. Es una función pura y comprobable.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convierte el contenido **en línea** de Markdown a HTML (código, imágenes, enlaces, énfasis…). */
function inlineToHtml(src: string): string {
  // 1. Aísla los tramos de código (literales) y los caracteres escapados con `\` antes de transformar.
  const codes: string[] = [];
  let s = src.replace(/`([^`]+)`/g, (_m, c) => { codes.push(`<code>${escapeHtml(c)}</code>`); return ` C${codes.length - 1} `; });
  const escs: string[] = [];
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!>~])/g, (_m, ch) => { escs.push(ch); return ` E${escs.length - 1} `; });
  s = escapeHtml(s);
  // 2. Imágenes (antes que enlaces), enlaces, negrita, cursiva, tachado.
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, alt, url, title) => `<img src="${url}" alt="${alt}"${title ? ` title="${title}"` : ''}>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, txt, href, title) => `<a href="${href}"${title ? ` title="${title}"` : ''}>${txt}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/(^|[^A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  // 3. Restaura escapes (como texto literal) y tramos de código.
  s = s.replace(/ E(\d+) /g, (_m, i) => escapeHtml(escs[Number(i)]));
  s = s.replace(/ C(\d+) /g, (_m, i) => codes[Number(i)]);
  return s;
}

const splitRow = (l: string): string[] => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

/** Tabla GFM a partir de `lines[start]` (encabezado) + separador. Devuelve el índice tras la tabla. */
function parseTable(lines: string[], start: number, out: string[]): number {
  const header = splitRow(lines[start]);
  let i = start + 2;
  out.push('<table><thead><tr>', ...header.map((h) => `<th>${inlineToHtml(h)}</th>`), '</tr></thead><tbody>');
  while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
    const cells = splitRow(lines[i]);
    out.push('<tr>', ...header.map((_h, c) => `<td>${inlineToHtml(cells[c] ?? '')}</td>`), '</tr>');
    i++;
  }
  out.push('</tbody></table>');
  return i;
}

const ITEM_RE = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;

/** Lista (viñetas / ordenada / de tareas) con anidación por indentación. Devuelve el índice tras ella. */
function parseList(lines: string[], start: number, out: string[]): number {
  const first = lines[start].match(ITEM_RE)!;
  const indent = first[1].length;
  const ordered = /\d+\./.test(first[2]);
  const taskList = !ordered && /^\[[ xX]\]\s+/.test(first[3]);
  const tag = ordered ? 'ol' : 'ul';
  out.push(`<${tag}${taskList ? ' data-type="taskList"' : ''}>`);
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(ITEM_RE);
    if (!m || m[1].length < indent) break;
    if (m[1].length > indent) { i = parseList(lines, i, out); continue; }
    let content = m[3]; let checked = false;
    if (taskList) { const tk = content.match(/^\[([ xX])\]\s+(.*)$/); if (tk) { checked = /[xX]/.test(tk[1]); content = tk[2]; } }
    i++;
    const sub: string[] = [];
    while (i < lines.length) { const sm = lines[i].match(ITEM_RE); if (sm && sm[1].length > indent) i = parseList(lines, i, sub); else break; }
    const liAttr = taskList ? ` data-type="taskItem" data-checked="${checked ? 'true' : 'false'}"` : '';
    out.push(`<li${liAttr}><p>${inlineToHtml(content)}</p>${sub.join('')}</li>`);
  }
  out.push(`</${tag}>`);
  return i;
}

/**
 * Convierte **Markdown** (GFM) a **HTML** apto para que Tiptap lo ingiera al importar. Pura y
 * comprobable. Soporta: encabezados ATX, párrafos, énfasis/enlaces/imágenes/código en línea, listas
 * con viñetas/ordenadas/de tareas (anidadas), citas, bloques de código vallados, reglas y tablas GFM.
 */
export function markdownToHtml(md: string): string {
  const lines = (md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const blank = (l: string) => /^\s*$/.test(l);
  const sepRe = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (blank(line)) { i++; continue; }
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const lang = fence[1].trim(); const buf: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inlineToHtml(h[2].trim())}</h${h[1].length}>`); i++; continue; }
    if (/^(\*\*\*|---|___)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${markdownToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && sepRe.test(lines[i + 1])) { i = parseTable(lines, i, out); continue; }
    if (ITEM_RE.test(line)) { i = parseList(lines, i, out); continue; }
    const buf: string[] = [];
    while (i < lines.length && !blank(lines[i]) && !/^(#{1,6}\s|>|```|\s*([-*+]|\d+\.)\s|(\*\*\*|---|___)\s*$)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${inlineToHtml(buf.join('\n').trim()).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('');
}
