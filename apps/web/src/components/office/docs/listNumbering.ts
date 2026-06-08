/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';

/**
 * Numeración multinivel «tipo Word» para listas ordenadas y con viñetas.
 *
 * Guarda un esquema (`listScheme`) como clase CSS en el nodo de lista, de modo
 * que viaja dentro del JSON del documento. Los esquemas se resuelven con
 * `counters()` / `list-style` en `tiptap.css` (ver `.doc-mlist`, `.doc-outline`).
 *
 *   • decimal  → 1, 2, 3 (nativo)
 *   • legal    → 1, 1.1, 1.1.1 (numeración multinivel real, con counters CSS)
 *   • outline  → I, A, 1, a (esquema por nivel)
 *   • bullet variantes (disco / círculo / cuadro) por nivel para viñetas
 *
 * También expone comandos para reiniciar / continuar la numeración (atributo
 * `start` nativo de la lista ordenada).
 */

export type ListScheme = '' | 'doc-mlist' | 'doc-outline';

export const ListNumbering = Extension.create({
  name: 'listNumbering',

  addGlobalAttributes() {
    return [
      {
        types: ['orderedList', 'bulletList'],
        attributes: {
          listScheme: {
            default: '',
            parseHTML: (el: HTMLElement) => el.getAttribute('data-list-scheme') || '',
            renderHTML: (attrs: any) =>
              attrs.listScheme ? { 'data-list-scheme': attrs.listScheme, class: attrs.listScheme } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    const activeListType = (editor: any): 'orderedList' | 'bulletList' | null =>
      editor.isActive('orderedList') ? 'orderedList' : editor.isActive('bulletList') ? 'bulletList' : null;

    return {
      /** Aplica un esquema multinivel a la lista que contiene la selección. */
      setListScheme:
        (scheme: ListScheme) =>
        ({ editor, chain }: any) => {
          const type = activeListType(editor);
          if (!type) return false;
          return chain().updateAttributes(type, { listScheme: scheme }).run();
        },
      /** Reinicia (o fija) la numeración de la lista ordenada actual. */
      restartNumbering:
        (start = 1) =>
        ({ editor, chain }: any) => {
          if (!editor.isActive('orderedList')) return false;
          return chain().updateAttributes('orderedList', { start }).run();
        },
    } as any;
  },
});
