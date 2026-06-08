/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node } from '@tiptap/core';

/**
 * Línea de firma — bloque con una línea horizontal y una etiqueta (nombre /
 * cargo) debajo, estilo Word. Atómico; los datos viven en atributos.
 */
export const SignatureLine = Node.create({
  name: 'signatureLine',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { name: { default: '' }, title: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-signature]', getAttrs: (el: any) => ({ name: el.getAttribute('data-name') || '', title: el.getAttribute('data-title') || '' }) }];
  },

  renderHTML({ node }: any) {
    return ['div', { 'data-signature': 'true', 'data-name': node.attrs.name || '', 'data-title': node.attrs.title || '', class: 'doc-signature' },
      ['div', { class: 'doc-signature-line' }],
      ['div', { class: 'doc-signature-name' }, node.attrs.name || ''],
      ['div', { class: 'doc-signature-title' }, node.attrs.title || ''],
    ];
  },

  addNodeView() {
    return ({ node }: any) => {
      const dom = document.createElement('div');
      dom.className = 'doc-signature';
      dom.setAttribute('contenteditable', 'false');
      const render = (n: any) => {
        dom.innerHTML = '';
        const line = document.createElement('div'); line.className = 'doc-signature-line'; dom.appendChild(line);
        const name = document.createElement('div'); name.className = 'doc-signature-name'; name.textContent = n.attrs.name || ''; dom.appendChild(name);
        const title = document.createElement('div'); title.className = 'doc-signature-title'; title.textContent = n.attrs.title || ''; dom.appendChild(title);
      };
      render(node);
      return { dom, update: (u: any) => { if (u.type.name !== 'signatureLine') return false; render(u); return true; } };
    };
  },

  addCommands() {
    return {
      insertSignatureLine: (name = '', title = '') => ({ commands }: any) => commands.insertContent({ type: 'signatureLine', attrs: { name, title } }),
    } as any;
  },
});
