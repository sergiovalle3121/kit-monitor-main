/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';

export type CaseMode = 'upper' | 'lower' | 'title' | 'sentence' | 'toggle';

function applyCase(t: string, mode: CaseMode): string {
  switch (mode) {
    case 'upper': return t.toUpperCase();
    case 'lower': return t.toLowerCase();
    case 'title': return t.toLowerCase().replace(/(^|[\s(¿¡"“'])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
    case 'sentence': return t.toLowerCase().replace(/(^\s*\p{L}|[.!?]\s+\p{L})/gu, (c) => c.toUpperCase());
    case 'toggle': return [...t].map((c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('');
    default: return t;
  }
}

/**
 * «Cambiar mayúsculas/minúsculas» (estilo Word). Transforma el texto de la
 * selección preservando las marcas (negrita, color…) reemplazando cada nodo de
 * texto por su versión convertida. Sólo reemplaza si la longitud no cambia, para
 * no invalidar posiciones (evita corrupción con casos unicode raros como ß→SS).
 */
export const ChangeCase = Extension.create({
  name: 'changeCase',
  addCommands() {
    return {
      changeCase:
        (mode: CaseMode) =>
        ({ state, dispatch }: any) => {
          const { from, to } = state.selection;
          if (from === to) return false;
          const tr = state.tr;
          let changed = false;
          state.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (!node.isText || !node.text) return;
            const start = Math.max(pos, from);
            const end = Math.min(pos + node.nodeSize, to);
            const slice = node.text.slice(start - pos, end - pos);
            const cased = applyCase(slice, mode);
            if (cased !== slice && cased.length === slice.length) {
              tr.replaceWith(start, end, state.schema.text(cased, node.marks));
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    } as any;
  },
});
