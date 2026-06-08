/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node, Extension } from '@tiptap/core';

/**
 * Elementos de inserción «tipo Word»:
 *   • DropCap      → letra capital (atributo de párrafo, CSS ::first-letter)
 *   • Callout      → cuadro de texto / llamada (nodo que envuelve bloques)
 *   • ColumnBreak  → salto de columna
 *   • Bookmark     → marcador (ancla con nombre)
 *   • CrossRef     → referencia cruzada a un marcador (clic = navegar)
 */

// ── Letra capital ────────────────────────────────────────────────────────────
export const DropCap = Extension.create({
  name: 'dropCap',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        dropCap: {
          default: false,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-dropcap') === 'true',
          renderHTML: (attrs: any) => (attrs.dropCap ? { 'data-dropcap': 'true', class: 'doc-dropcap' } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      toggleDropCap: () => ({ editor, chain }: any) => {
        const cur = editor.getAttributes('paragraph').dropCap;
        return chain().updateAttributes('paragraph', { dropCap: !cur }).run();
      },
    } as any;
  },
});

// ── Cuadro de texto / llamada ────────────────────────────────────────────────
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: 'neutral',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-tone') || 'neutral',
        renderHTML: (attrs: any) => ({ 'data-tone': attrs.tone || 'neutral' }),
      },
    };
  },
  parseHTML() { return [{ tag: 'div[data-callout]' }]; },
  renderHTML({ HTMLAttributes }: any) { return ['div', { ...HTMLAttributes, 'data-callout': 'true', class: 'doc-callout' }, 0]; },
  addCommands() {
    return {
      toggleCallout: (tone = 'neutral') => ({ editor, commands }: any) =>
        editor.isActive('callout') ? commands.lift('callout') : commands.wrapIn('callout', { tone }),
      setCalloutTone: (tone: string) => ({ chain }: any) => chain().updateAttributes('callout', { tone }).run(),
    } as any;
  },
});

// ── Salto de columna ─────────────────────────────────────────────────────────
export const ColumnBreak = Node.create({
  name: 'columnBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() { return [{ tag: 'div[data-column-break]' }]; },
  renderHTML() { return ['div', { 'data-column-break': 'true', class: 'doc-column-break' }]; },
  addCommands() {
    return { setColumnBreak: () => ({ commands }: any) => commands.insertContent({ type: 'columnBreak' }) } as any;
  },
});

// ── Marcador (bookmark) ──────────────────────────────────────────────────────
export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() { return { name: { default: '' } }; },
  parseHTML() { return [{ tag: 'a[data-bookmark]', getAttrs: (el: any) => ({ name: el.getAttribute('data-bookmark') || '' }) }]; },
  renderHTML({ node }: any) { return ['a', { 'data-bookmark': node.attrs.name || '', id: `bm-${node.attrs.name || ''}`, class: 'doc-bookmark' }]; },
  addNodeView() {
    return ({ node }: any) => {
      const dom = document.createElement('a');
      dom.className = 'doc-bookmark';
      dom.setAttribute('contenteditable', 'false');
      dom.id = `bm-${node.attrs.name || ''}`;
      dom.title = `Marcador: ${node.attrs.name || ''}`;
      return { dom };
    };
  },
  addCommands() {
    return { insertBookmark: (name: string) => ({ commands }: any) => commands.insertContent({ type: 'bookmark', attrs: { name } }) } as any;
  },
});

// ── Referencia cruzada ───────────────────────────────────────────────────────
export const CrossRef = Node.create({
  name: 'crossRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() { return { target: { default: '' }, label: { default: '' } }; },
  parseHTML() { return [{ tag: 'a[data-xref]', getAttrs: (el: any) => ({ target: el.getAttribute('data-xref') || '', label: el.textContent || '' }) }]; },
  renderHTML({ node }: any) { return ['a', { 'data-xref': node.attrs.target || '', class: 'doc-xref' }, node.attrs.label || node.attrs.target || 'referencia']; },
  addNodeView() {
    return ({ node }: any) => {
      const dom = document.createElement('a');
      dom.className = 'doc-xref';
      dom.setAttribute('contenteditable', 'false');
      dom.textContent = node.attrs.label || node.attrs.target || 'referencia';
      dom.title = `Ir a «${node.attrs.target}»`;
      dom.addEventListener('click', (e) => {
        e.preventDefault();
        const el = document.getElementById(`bm-${node.attrs.target}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return { dom };
    };
  },
  addCommands() {
    return { insertCrossRef: (target: string, label?: string) => ({ commands }: any) => commands.insertContent({ type: 'crossRef', attrs: { target, label: label || target } }) } as any;
  },
});
