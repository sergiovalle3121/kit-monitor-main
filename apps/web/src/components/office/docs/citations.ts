/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node } from '@tiptap/core';

/**
 * Citas y bibliografía simple.
 *   • citation     → cita en línea «(Autor, año)»; guarda también la referencia
 *     completa (`source`). Clic = saltar a la bibliografía.
 *   • bibliography → lista viva de fuentes (deduplicadas y ordenadas), como la TOC.
 */

export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() { return { inText: { default: '' }, source: { default: '' } }; },

  parseHTML() {
    return [{ tag: 'span[data-citation]', getAttrs: (el: any) => ({ inText: el.textContent || '', source: el.getAttribute('data-source') || '' }) }];
  },
  renderHTML({ node }: any) {
    return ['span', { 'data-citation': 'true', 'data-source': node.attrs.source || '', class: 'doc-citation' }, node.attrs.inText || ''];
  },
  addNodeView() {
    return ({ node }: any) => {
      const dom = document.createElement('span');
      dom.className = 'doc-citation';
      dom.setAttribute('contenteditable', 'false');
      dom.textContent = node.attrs.inText || '';
      dom.title = node.attrs.source || '';
      dom.addEventListener('click', () => {
        const el = document.querySelector('[data-bibliography]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return { dom, update: (u: any) => { if (u.type.name !== 'citation') return false; dom.textContent = u.attrs.inText || ''; dom.title = u.attrs.source || ''; return true; } };
    };
  },
  addCommands() {
    return { insertCitation: (inText: string, source: string) => ({ commands }: any) => commands.insertContent({ type: 'citation', attrs: { inText, source } }) } as any;
  },
});

/** Fuentes únicas (ordenadas) recogidas de las citas del documento. */
export function collectSources(doc: any): string[] {
  const seen = new Set<string>();
  doc.descendants((n: any) => {
    if (n.type?.name === 'citation' && n.attrs.source && !seen.has(n.attrs.source)) seen.add(n.attrs.source);
  });
  return [...seen].sort((a, b) => a.localeCompare(b, 'es'));
}

export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() { return [{ tag: 'div[data-bibliography]' }]; },
  renderHTML() { return ['div', { 'data-bibliography': 'true', class: 'doc-bibliography' }]; },

  addCommands() {
    return { insertBibliography: () => ({ commands }: any) => commands.insertContent({ type: 'bibliography' }) } as any;
  },

  addNodeView() {
    return ({ editor }: any) => {
      const dom = document.createElement('div');
      dom.className = 'doc-bibliography';
      dom.setAttribute('data-bibliography', 'true');
      dom.setAttribute('contenteditable', 'false');
      const build = () => {
        const items = collectSources(editor.state.doc);
        dom.innerHTML = '';
        const t = document.createElement('div');
        t.className = 'doc-bibliography-title';
        t.textContent = 'Bibliografía';
        dom.appendChild(t);
        if (!items.length) {
          const e = document.createElement('div');
          e.className = 'doc-bibliography-empty';
          e.textContent = 'Inserta citas para construir la bibliografía.';
          dom.appendChild(e);
          return;
        }
        items.forEach((s) => {
          const r = document.createElement('div');
          r.className = 'doc-bibliography-item';
          r.textContent = s;
          dom.appendChild(r);
        });
      };
      build();
      editor.on('update', build);
      return { dom, ignoreMutation: () => true, update: () => { build(); return true; }, destroy: () => editor.off('update', build) };
    };
  },
});
