/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node } from '@tiptap/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Ecuaciones LaTeX con KaTeX (MIT). Dos nodos atómicos:
 *   • mathInline → ecuación en línea (dentro de un párrafo)
 *   • mathBlock  → ecuación en bloque (centrada, displayMode)
 *
 * El LaTeX se guarda en `attrs.latex` (viaja en el JSON). El render en pantalla
 * usa un NodeView; `renderHTML` produce KaTeX ya renderizado para que la vista de
 * impresión (`getHTML`) y la copia conserven la ecuación.
 */

function renderInto(el: HTMLElement, latex: string, display: boolean) {
  const src = latex || '';
  if (!src.trim()) {
    el.classList.add('doc-math-empty');
    el.textContent = display ? 'Ecuación (doble clic para editar)' : 'fx';
    return;
  }
  el.classList.remove('doc-math-empty');
  try {
    katex.render(src, el, { throwOnError: false, displayMode: display, output: 'htmlAndMathml' });
  } catch {
    el.textContent = src;
  }
}

function makeMathNode(name: string, display: boolean) {
  const tag = display ? 'div' : 'span';
  return Node.create({
    name,
    group: display ? 'block' : 'inline',
    inline: !display,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
      return { latex: { default: '' } };
    },

    parseHTML() {
      return [{ tag: `${tag}[data-latex]`, getAttrs: (el: any) => ({ latex: el.getAttribute('data-latex') || '' }) }];
    },

    renderHTML({ node }: any) {
      const latex = node.attrs.latex || '';
      const cls = display ? 'doc-math-block' : 'doc-math-inline';
      if (typeof document !== 'undefined' && latex.trim()) {
        try {
          const wrap = document.createElement(tag);
          wrap.setAttribute('data-latex', latex);
          wrap.className = cls;
          wrap.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: display });
          return wrap;
        } catch { /* cae al spec simple */ }
      }
      return [tag, { 'data-latex': latex, class: cls }, latex];
    },

    addNodeView() {
      return ({ node, editor, getPos }: any) => {
        const dom = document.createElement(tag);
        dom.className = display ? 'doc-math-block' : 'doc-math-inline';
        dom.setAttribute('contenteditable', 'false');
        renderInto(dom, node.attrs.latex, display);
        dom.addEventListener('dblclick', (e) => {
          e.preventDefault();
          if (typeof getPos === 'function') {
            editor.chain().setNodeSelection(getPos()).run();
            window.dispatchEvent(new CustomEvent('doc-math-edit'));
          }
        });
        return {
          dom,
          update: (updated: any) => {
            if (updated.type.name !== name) return false;
            renderInto(dom, updated.attrs.latex, display);
            return true;
          },
        };
      };
    },

    addCommands() {
      return {
        [display ? 'insertMathBlock' : 'insertMathInline']:
          (latex = '') =>
          ({ chain }: any) =>
            chain()
              .insertContent(display ? { type: name, attrs: { latex } } : { type: name, attrs: { latex } })
              .run(),
      } as any;
    },
  });
}

export const MathInline = makeMathNode('mathInline', false);
export const MathBlock = makeMathNode('mathBlock', true);

/** Comando compartido: actualiza el LaTeX del nodo de ecuación seleccionado. */
import { Extension } from '@tiptap/core';
export const MathCommands = Extension.create({
  name: 'mathCommands',
  addCommands() {
    return {
      updateSelectedMath:
        (latex: string) =>
        ({ state, chain }: any) => {
          const node = (state.selection as any).node;
          if (!node || (node.type.name !== 'mathInline' && node.type.name !== 'mathBlock')) return false;
          return chain().updateAttributes(node.type.name, { latex }).run();
        },
    } as any;
  },
});
