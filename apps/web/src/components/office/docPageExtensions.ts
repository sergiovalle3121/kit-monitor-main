/* eslint-disable @typescript-eslint/no-explicit-any */
import { Node, Extension, mergeAttributes } from '@tiptap/core';

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
