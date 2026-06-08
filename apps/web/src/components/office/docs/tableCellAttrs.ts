/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';

/**
 * Atributos extra para celdas de tabla «tipo Word»: sombreado (color de fondo) y
 * alineación vertical. Se añaden como atributos globales sobre `tableCell` y
 * `tableHeader` (de `@tiptap/extension-table`) para que `setCellAttribute` los
 * pueda fijar y viajen en el JSON / HTML del documento.
 */
export const TableCellAttrs = Extension.create({
  name: 'tableCellAttrs',

  addGlobalAttributes() {
    return [
      {
        types: ['tableCell', 'tableHeader'],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.backgroundColor || el.getAttribute('data-bg') || null,
            renderHTML: (attrs: any) => {
              if (!attrs.backgroundColor) return {};
              return { style: `background-color:${attrs.backgroundColor}`, 'data-bg': attrs.backgroundColor };
            },
          },
          verticalAlign: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.verticalAlign || null,
            renderHTML: (attrs: any) => (attrs.verticalAlign ? { style: `vertical-align:${attrs.verticalAlign}` } : {}),
          },
        },
      },
    ];
  },
});
