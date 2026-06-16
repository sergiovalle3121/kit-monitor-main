/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node } from '@tiptap/core';

/**
 * Notas al pie — versión mínima estable.
 *   • footnoteRef → marcador en línea (superíndice) numerado automáticamente por
 *     su orden de aparición. Guarda el texto de la nota en `attrs.content`.
 *   • footnoteList → área de notas (un nodo atómico, como la TOC) que se
 *     reconstruye en vivo listando todas las notas numeradas.
 *
 * Es «al final del documento» (estilo notas al final), no al pie de cada página
 * impresa — un sistema de paginación real de notas se difiere (ver NIGHT_LOG).
 */

const uid = () => `fn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

/** Índice (1-based) de un footnoteRef según su orden en el documento. */
function refIndex(doc: any, pos: number): number {
  let n = 0;
  let found = 0;
  doc.descendants((node: any, p: number) => {
    if (node.type?.name === 'footnoteRef') {
      n += 1;
      if (p === pos) found = n;
    }
  });
  return found || n;
}

export const FootnoteRef = Node.create({
  name: 'footnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
      content: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-footnote]', getAttrs: (el: any) => ({ id: el.getAttribute('data-footnote'), content: el.getAttribute('data-content') || '' }) }];
  },

  renderHTML({ node }: any) {
    return ['sup', { 'data-footnote': node.attrs.id || '', 'data-content': node.attrs.content || '', class: 'doc-footnote-ref' }, '★'];
  },

  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      const dom = document.createElement('sup');
      dom.className = 'doc-footnote-ref';
      dom.setAttribute('contenteditable', 'false');
      const paint = () => {
        const idx = typeof getPos === 'function' ? refIndex(editor.state.doc, getPos()) : 0;
        dom.textContent = String(idx || '?');
        dom.title = node.attrs.content || 'Nota al pie';
      };
      paint();
      const onUpd = () => paint();
      editor.on('update', onUpd);
      dom.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof getPos === 'function') {
          editor.chain().setNodeSelection(getPos()).run();
          window.dispatchEvent(new CustomEvent('doc-footnote-edit'));
        }
      });
      return { dom, update: (u: any) => { if (u.type.name !== 'footnoteRef') return false; paint(); return true; }, destroy: () => editor.off('update', onUpd) };
    };
  },

  addCommands() {
    return {
      insertFootnote:
        (content = '') =>
        ({ chain, state }: any) => {
          const hasArea = (() => { let f = false; state.doc.descendants((n: any) => { if (n.type?.name === 'footnoteList') f = true; }); return f; })();
          let ch = chain().insertContent({ type: 'footnoteRef', attrs: { id: uid(), content } });
          if (!hasArea) ch = ch.command(({ tr, dispatch }: any) => { if (dispatch) tr.insert(tr.doc.content.size, state.schema.nodes.footnoteList.create()); return true; });
          return ch.run();
        },
      updateSelectedFootnote:
        (content: string) =>
        ({ state, chain }: any) => {
          const node = (state.selection as any).node;
          if (!node || node.type.name !== 'footnoteRef') return false;
          return chain().updateAttributes('footnoteRef', { content }).run();
        },
    } as any;
  },
});

/** Recolecta el texto de todas las notas, en orden. */
export function collectFootnotes(doc: any): { idx: number; content: string }[] {
  const out: { idx: number; content: string }[] = [];
  doc.descendants((node: any) => {
    if (node.type?.name === 'footnoteRef') out.push({ idx: out.length + 1, content: node.attrs.content || '' });
  });
  return out;
}

// ───────────────────────────── Notas al final ─────────────────────────────
// Flujo independiente (numeración propia en números romanos en minúscula, i, ii,
// iii…) que se acumula en un área «Notas al final». Mismo patrón que las notas al
// pie, pero como corriente separada (como en Word).

function toRoman(n: number): string {
  if (!n || n < 1) return String(n || '');
  const map: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
  let s = '';
  let v = n;
  for (const [num, sym] of map) while (v >= num) { s += sym; v -= num; }
  return s;
}

/** Índice (1-based) de un endnoteRef según su orden en el documento. */
function endnoteIndex(doc: any, pos: number): number {
  let n = 0;
  let found = 0;
  doc.descendants((node: any, p: number) => {
    if (node.type?.name === 'endnoteRef') { n += 1; if (p === pos) found = n; }
  });
  return found || n;
}

export const EndnoteRef = Node.create({
  name: 'endnoteRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() { return { id: { default: null }, content: { default: '' } }; },

  parseHTML() {
    return [{ tag: 'sup[data-endnote]', getAttrs: (el: any) => ({ id: el.getAttribute('data-endnote'), content: el.getAttribute('data-content') || '' }) }];
  },

  renderHTML({ node }: any) {
    return ['sup', { 'data-endnote': node.attrs.id || '', 'data-content': node.attrs.content || '', class: 'doc-endnote-ref' }, '◆'];
  },

  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      const dom = document.createElement('sup');
      dom.className = 'doc-endnote-ref';
      dom.setAttribute('contenteditable', 'false');
      const paint = () => {
        const idx = typeof getPos === 'function' ? endnoteIndex(editor.state.doc, getPos()) : 0;
        dom.textContent = toRoman(idx) || '?';
        dom.title = node.attrs.content || 'Nota al final';
      };
      paint();
      const onUpd = () => paint();
      editor.on('update', onUpd);
      dom.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof getPos === 'function') {
          editor.chain().setNodeSelection(getPos()).run();
          window.dispatchEvent(new CustomEvent('doc-endnote-edit'));
        }
      });
      return { dom, update: (u: any) => { if (u.type.name !== 'endnoteRef') return false; paint(); return true; }, destroy: () => editor.off('update', onUpd) };
    };
  },

  addCommands() {
    return {
      insertEndnote:
        (content = '') =>
        ({ chain, state }: any) => {
          const hasArea = (() => { let f = false; state.doc.descendants((n: any) => { if (n.type?.name === 'endnoteList') f = true; }); return f; })();
          let ch = chain().insertContent({ type: 'endnoteRef', attrs: { id: `en_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`, content } });
          if (!hasArea) ch = ch.command(({ tr, dispatch }: any) => { if (dispatch) tr.insert(tr.doc.content.size, state.schema.nodes.endnoteList.create()); return true; });
          return ch.run();
        },
      updateSelectedEndnote:
        (content: string) =>
        ({ state, chain }: any) => {
          const node = (state.selection as any).node;
          if (!node || node.type.name !== 'endnoteRef') return false;
          return chain().updateAttributes('endnoteRef', { content }).run();
        },
    } as any;
  },
});

/** Recolecta el texto de todas las notas al final, en orden. */
export function collectEndnotes(doc: any): { idx: number; content: string }[] {
  const out: { idx: number; content: string }[] = [];
  doc.descendants((node: any) => {
    if (node.type?.name === 'endnoteRef') out.push({ idx: out.length + 1, content: node.attrs.content || '' });
  });
  return out;
}

export const EndnoteList = Node.create({
  name: 'endnoteList',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() { return [{ tag: 'div[data-endnote-list]' }]; },
  renderHTML() { return ['div', { 'data-endnote-list': 'true', class: 'doc-endnote-list' }]; },

  addCommands() {
    return { insertEndnoteList: () => ({ commands }: any) => commands.insertContent({ type: 'endnoteList' }) } as any;
  },

  addNodeView() {
    return ({ editor }: any) => {
      const dom = document.createElement('div');
      dom.className = 'doc-endnote-list';
      dom.setAttribute('contenteditable', 'false');
      const build = () => {
        const items = collectEndnotes(editor.state.doc);
        dom.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'doc-footnote-title';
        title.textContent = 'Notas al final';
        dom.appendChild(title);
        if (!items.length) {
          const e = document.createElement('div');
          e.className = 'doc-footnote-empty';
          e.textContent = 'Inserta una nota al final para verla aquí.';
          dom.appendChild(e);
          return;
        }
        items.forEach((it) => {
          const row = document.createElement('div');
          row.className = 'doc-footnote-item';
          const num = document.createElement('span');
          num.className = 'doc-footnote-num';
          num.textContent = `${toRoman(it.idx)}.`;
          const txt = document.createElement('span');
          txt.textContent = ' ' + (it.content || '(vacía)');
          row.appendChild(num);
          row.appendChild(txt);
          dom.appendChild(row);
        });
      };
      build();
      editor.on('update', build);
      return { dom, ignoreMutation: () => true, update: () => { build(); return true; }, destroy: () => editor.off('update', build) };
    };
  },
});

export const FootnoteList = Node.create({
  name: 'footnoteList',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() { return [{ tag: 'div[data-footnote-list]' }]; },
  renderHTML() { return ['div', { 'data-footnote-list': 'true', class: 'doc-footnote-list' }]; },

  addCommands() {
    return { insertFootnoteList: () => ({ commands }: any) => commands.insertContent({ type: 'footnoteList' }) } as any;
  },

  addNodeView() {
    return ({ editor }: any) => {
      const dom = document.createElement('div');
      dom.className = 'doc-footnote-list';
      dom.setAttribute('contenteditable', 'false');
      const build = () => {
        const items = collectFootnotes(editor.state.doc);
        dom.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'doc-footnote-title';
        title.textContent = 'Notas al pie';
        dom.appendChild(title);
        if (!items.length) {
          const e = document.createElement('div');
          e.className = 'doc-footnote-empty';
          e.textContent = 'Inserta una nota al pie para verla aquí.';
          dom.appendChild(e);
          return;
        }
        items.forEach((it) => {
          const row = document.createElement('div');
          row.className = 'doc-footnote-item';
          const num = document.createElement('span');
          num.className = 'doc-footnote-num';
          num.textContent = `${it.idx}.`;
          const txt = document.createElement('span');
          txt.textContent = ' ' + (it.content || '(vacía)');
          row.appendChild(num);
          row.appendChild(txt);
          dom.appendChild(row);
        });
      };
      build();
      editor.on('update', build);
      return { dom, ignoreMutation: () => true, update: () => { build(); return true; }, destroy: () => editor.off('update', build) };
    };
  },
});
