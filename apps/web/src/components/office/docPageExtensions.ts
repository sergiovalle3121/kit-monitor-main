/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node, Extension, mergeAttributes } from '@tiptap/core';

/** Formatos de numeración de página por sección (estilo Word). */
export const PAGE_NUMBER_FORMATS: Record<string, string> = {
  decimal: '1, 2, 3',
  lowerRoman: 'i, ii, iii',
  upperRoman: 'I, II, III',
  lowerAlpha: 'a, b, c',
  upperAlpha: 'A, B, C',
};
/** Estilo CSS de `counter()` por formato (para la vista paginada). */
export const PAGE_FORMAT_CSS: Record<string, string> = {
  decimal: 'decimal', lowerRoman: 'lower-roman', upperRoman: 'upper-roman', lowerAlpha: 'lower-alpha', upperAlpha: 'upper-alpha',
};

/** Manual page break: a block atom that forces a new page when printing. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() { return [{ tag: 'div[data-page-break]' }]; },
  renderHTML() { return ['div', mergeAttributes({ 'data-page-break': 'true', class: 'page-break' })]; },
  addCommands() {
    return { setPageBreak: () => ({ commands }: any) => commands.insertContent({ type: this.name }) } as any;
  },
});

/**
 * Salto de sección (estilo Word). Cada salto inicia una nueva sección cuyos
 * ajustes (encabezado/pie, numeración, columnas, orientación) se guardan en el
 * propio nodo. La sección 0 (antes del primer salto) usa el `pageMeta` del
 * documento. `breakType`: `nextPage` (empieza en página nueva) o `continuous`.
 */
export const SectionBreak = Node.create({
  name: 'sectionBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      breakType: { default: 'nextPage' },        // nextPage | continuous
      header: { default: '' },
      footer: { default: '' },
      pageNumbers: { default: false },
      pageNumberStart: { default: null },          // null = continúa la numeración
      pageNumberFormat: { default: 'decimal' },    // decimal | lower/upperRoman | lower/upperAlpha
      columns: { default: 0 },                     // 0 = hereda; 1 | 2 | 3
      orientation: { default: '' },                // '' hereda | portrait | landscape
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-section-break]',
      getAttrs: (el: any) => ({
        breakType: el.getAttribute('data-section-break') || 'nextPage',
        header: el.getAttribute('data-header') || '',
        footer: el.getAttribute('data-footer') || '',
        pageNumbers: el.getAttribute('data-page-numbers') === 'true',
        pageNumberStart: el.getAttribute('data-page-start') ? Number(el.getAttribute('data-page-start')) : null,
        pageNumberFormat: el.getAttribute('data-page-format') || 'decimal',
        columns: Number(el.getAttribute('data-columns')) || 0,
        orientation: el.getAttribute('data-orientation') || '',
      }),
    }];
  },

  renderHTML({ node }: any) {
    const a = node.attrs;
    return ['div', mergeAttributes({
      'data-section-break': a.breakType || 'nextPage',
      'data-header': a.header || '', 'data-footer': a.footer || '',
      'data-page-numbers': a.pageNumbers ? 'true' : 'false',
      'data-page-start': a.pageNumberStart != null ? String(a.pageNumberStart) : '',
      'data-page-format': a.pageNumberFormat || 'decimal',
      'data-columns': String(a.columns || 0), 'data-orientation': a.orientation || '',
      class: 'doc-section-break',
    })];
  },

  addNodeView() {
    return ({ node, editor, getPos }: any) => {
      let current = node;
      const dom = document.createElement('div');
      dom.className = 'doc-section-break';
      dom.setAttribute('contenteditable', 'false');
      const paint = () => {
        const a = current.attrs;
        dom.dataset.break = a.breakType;
        const chips: string[] = [];
        chips.push(a.breakType === 'continuous' ? 'Continuo' : 'Página siguiente');
        if (a.orientation) chips.push(a.orientation === 'landscape' ? 'Horizontal' : 'Vertical');
        if (a.columns) chips.push(`${a.columns} col.`);
        if (a.pageNumbers && a.pageNumberStart != null) chips.push(`Nº pág. desde ${a.pageNumberStart}`);
        if (a.header) chips.push('Encabezado propio');
        if (a.footer) chips.push('Pie propio');
        dom.innerHTML = '';
        const label = document.createElement('span');
        label.className = 'doc-section-break-label';
        label.textContent = `Salto de sección · ${chips.join(' · ')}`;
        const edit = document.createElement('button');
        edit.className = 'doc-section-break-edit';
        edit.textContent = 'Configurar';
        edit.addEventListener('mousedown', (e) => {
          e.preventDefault();
          if (typeof getPos === 'function') {
            editor.chain().setNodeSelection(getPos()).run();
            window.dispatchEvent(new CustomEvent('doc-section-edit'));
          }
        });
        dom.append(label, edit);
      };
      paint();
      return { dom, update: (u: any) => { if (u.type.name !== 'sectionBreak') return false; current = u; paint(); return true; } };
    };
  },

  addCommands() {
    return {
      insertSectionBreak: (attrs: Record<string, any> = {}) => ({ commands }: any) =>
        commands.insertContent({ type: this.name, attrs: { breakType: 'nextPage', ...attrs } }),
      updateSectionBreak: (attrs: Record<string, any>) => ({ state, dispatch, tr }: any) => {
        const sel: any = state.selection;
        const node = sel.node;
        if (!node || node.type.name !== 'sectionBreak') return false;
        if (dispatch) { for (const [k, v] of Object.entries(attrs)) tr.setNodeAttribute(sel.from, k, v); dispatch(tr); }
        return true;
      },
    } as any;
  },
});

export interface SectionMeta {
  header: string; footer: string; pageNumbers: boolean;
  pageNumberStart: number | null; pageNumberFormat: string;
  columns: number; orientation: string;
}

/** Ajustes efectivos de la sección que gobierna una posición (salto previo más
 *  cercano; si no hay, el `pageMeta` del documento). */
export function effectiveSection(state: any, pos: number): { index: number; meta: SectionMeta } {
  const docAttrs: any = state.doc.attrs || {};
  let index = 0;
  let governing: any = null;
  let count = 0;
  state.doc.descendants((node: any, p: number) => {
    if (node.type.name === 'sectionBreak') {
      count += 1;
      if (p < pos) { governing = node; index = count; }
    }
  });
  if (!governing) {
    return {
      index: 0,
      meta: {
        header: docAttrs.pageHeader || '', footer: docAttrs.pageFooter || '',
        pageNumbers: !!docAttrs.pageNumbers, pageNumberStart: null, pageNumberFormat: 'decimal',
        columns: Number(docAttrs.pageColumns || 1), orientation: docAttrs.pageOrientation || 'portrait',
      },
    };
  }
  const a = governing.attrs;
  return {
    index,
    meta: {
      header: a.header || docAttrs.pageHeader || '', footer: a.footer || docAttrs.pageFooter || '',
      pageNumbers: !!a.pageNumbers, pageNumberStart: a.pageNumberStart, pageNumberFormat: a.pageNumberFormat || 'decimal',
      columns: a.columns || Number(docAttrs.pageColumns || 1), orientation: a.orientation || docAttrs.pageOrientation || 'portrait',
    },
  };
}

/**
 * Page metadata (header / footer / page numbers) stored as attributes on the
 * document node, so it travels inside the TipTap JSON — no schema change.
 */
export const PageMeta = Extension.create({
  name: 'pageMeta',
  addGlobalAttributes() {
    return [{
      types: ['doc'],
      attributes: {
        pageHeader: { default: '' },
        pageFooter: { default: '' },
        pageNumbers: { default: false },
        pageOrientation: { default: 'portrait' }, // portrait | landscape
        pageSize: { default: 'a4' },              // a4 | letter | legal
        pageMargin: { default: 'normal' },        // normal | narrow | wide
        pageColumns: { default: 1 },              // 1 | 2 | 3
        pageColumnRule: { default: false },       // línea entre columnas
        pageWatermark: { default: '' },
        pageBorder: { default: '' },              // '' | thin | thick | double
        pageLineNumbers: { default: false },      // numeración de líneas (aprox. por párrafo)
        pageFirstDifferent: { default: false },   // primera página con encabezado/pie distinto
      },
    }];
  },
  addCommands() {
    return {
      setPageMeta: (attrs: Record<string, any>) => ({ tr, dispatch }: any) => {
        if (dispatch) {
          for (const [k, v] of Object.entries(attrs)) tr.setDocAttribute(k, v);
        }
        return true;
      },
    } as any;
  },
});
