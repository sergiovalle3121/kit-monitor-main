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

/** Texto de una secuencia de nodos en línea, aplicando marcas. */
function serializeInline(nodes: MdNode[] = []): string {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'hardBreak') { out += '  \n'; continue; }
    if (n.type === 'image') { out += `![${n.attrs?.alt ?? ''}](${n.attrs?.src ?? ''})`; continue; }
    if (n.type === 'mathInline') { out += `$${n.attrs?.latex ?? ''}$`; continue; }
    if (n.type === 'footnoteRef') { out += `[^${n.attrs?.id ?? n.attrs?.number ?? ''}]`; continue; }
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
  const content: MdNode[] = doc?.content ?? (Array.isArray(doc) ? doc : []);
  const md = serializeBlocks(content).join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t\n]+$/, '');
  return md + '\n';
}
