/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension, Node } from '@tiptap/core';

/**
 * Extensiones de profundidad «tipo Word» para el editor de documentos (TipTap,
 * MIT). Todas guardan su estado dentro del JSON del documento (atributos), así
 * que viajan con el contenido y no requieren almacén aparte.
 */

const MAX_INDENT = 10;
const INDENT_PX = 36; // ~0.5" por nivel, como Word

/** Sangría de párrafo / encabezado (margin-left por niveles). */
export const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el: HTMLElement) => {
            const m = parseInt(el.style.marginLeft || '0', 10);
            return m ? Math.min(MAX_INDENT, Math.round(m / INDENT_PX)) : 0;
          },
          renderHTML: (attrs: any) => (attrs.indent ? { style: `margin-left:${attrs.indent * INDENT_PX}px` } : {}),
        },
      },
    }];
  },
  addCommands() {
    const shift = (dir: number) => () => ({ state, dispatch, tr }: any) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        if (node.type.name === 'paragraph' || node.type.name === 'heading') {
          const cur = node.attrs.indent || 0;
          const next = Math.max(0, Math.min(MAX_INDENT, cur + dir));
          if (next !== cur) { tr.setNodeAttribute(pos, 'indent', next); changed = true; }
        }
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
    return { indentMore: shift(1), indentLess: shift(-1) } as any;
  },
});

/** Estilo con nombre (Título / Subtítulo) sobre párrafo o encabezado, para la
 *  galería de estilos. Se renderiza como clase CSS + data-attr (viaja en el JSON
 *  y se mapea en el export .docx). */
export const NamedStyle = Extension.create({
  name: 'namedStyle',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        styleName: {
          default: '',
          parseHTML: (el: HTMLElement) => el.getAttribute('data-style') || '',
          renderHTML: (attrs: any) => (attrs.styleName ? { 'data-style': attrs.styleName, class: `doc-style-${attrs.styleName}` } : {}),
        },
      },
    }];
  },
});

/** Recolecta los encabezados del documento (para índice / esquema). */
export function collectHeadings(doc: any): { level: number; text: string; pos: number }[] {
  const out: { level: number; text: string; pos: number }[] = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading') out.push({ level: node.attrs.level ?? 1, text: node.textContent || '(sin título)', pos });
  });
  return out;
}

/**
 * Tabla de contenido **viva**: nodo atómico con NodeView que se reconstruye en
 * cada cambio del documento a partir de los encabezados. Clic = saltar al título.
 */
export const Toc = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() { return [{ tag: 'div[data-toc]' }]; },
  renderHTML() { return ['div', { 'data-toc': 'true', class: 'doc-toc' }, 'Tabla de contenido']; },

  addCommands() {
    return { insertToc: () => ({ commands }: any) => commands.insertContent({ type: this.name }) } as any;
  },

  addNodeView() {
    return ({ editor }: any) => {
      const dom = document.createElement('div');
      dom.className = 'doc-toc';
      dom.setAttribute('contenteditable', 'false');

      const build = () => {
        const items = collectHeadings(editor.state.doc);
        dom.innerHTML = '';
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.textContent = 'Tabla de contenido';
        dom.appendChild(title);
        if (!items.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = 'Aplica estilos «Título 1-3» para generar el índice.';
          dom.appendChild(empty);
          return;
        }
        items.forEach((it) => {
          const a = document.createElement('a');
          a.className = 'doc-toc-item';
          a.style.paddingLeft = `${(it.level - 1) * 18}px`;
          a.textContent = it.text;
          a.addEventListener('mousedown', (e) => {
            e.preventDefault();
            editor.chain().focus().setTextSelection(it.pos + 1).scrollIntoView().run();
          });
          dom.appendChild(a);
        });
      };

      build();
      editor.on('update', build);
      return {
        dom,
        ignoreMutation: () => true,
        update: () => { build(); return true; },
        destroy: () => { editor.off('update', build); },
      };
    };
  },
});
