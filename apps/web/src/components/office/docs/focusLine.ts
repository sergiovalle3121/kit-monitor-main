/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * «Modo enfoque»: resalta el bloque (párrafo / encabezado) que contiene el
 * cursor y atenúa el resto. Se activa/desactiva por bandera en el storage; usa
 * una decoración de nodo recalculada en cada cambio de selección (estable).
 */
export const FocusLine = Extension.create({
  name: 'focusLine',
  addStorage() { return { enabled: false }; },

  addCommands() {
    return {
      setFocusLine: (on: boolean) => ({ editor }: any) => {
        editor.storage.focusLine.enabled = !!on;
        // Fuerza un redibujado de decoraciones.
        editor.view.dispatch(editor.state.tr.setMeta('focusLineToggle', Date.now()));
        return true;
      },
    } as any;
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        props: {
          decorations(state) {
            if (!storage.enabled) return null;
            const { $head } = state.selection as any;
            const d = $head.depth;
            if (d < 1) return null;
            try {
              const from = $head.before(d);
              const to = $head.after(d);
              return DecorationSet.create(state.doc, [Decoration.node(from, to, { class: 'doc-focus-line' })]);
            } catch {
              return null;
            }
          },
        },
      }),
    ];
  },
});
