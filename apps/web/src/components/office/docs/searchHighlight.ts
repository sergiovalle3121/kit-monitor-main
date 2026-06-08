/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Resaltado en vivo de todas las coincidencias de «Buscar y reemplazar»
 * (decoraciones de ProseMirror). El panel de búsqueda empuja las coincidencias
 * vía el comando `setSearchMatches`; la coincidencia activa se pinta distinto.
 *
 * Las decoraciones se remapean en cada transacción para sobrevivir a las
 * ediciones (p. ej. tras reemplazar), evitando estados obsoletos.
 */
export interface SearchRange { from: number; to: number }

export const searchHighlightKey = new PluginKey('docSearchHighlight');

interface HLState { deco: DecorationSet; active: number; ranges: SearchRange[] }

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addCommands() {
    return {
      setSearchMatches:
        (ranges: SearchRange[], active = 0) =>
        ({ state, dispatch }: any) => {
          if (dispatch) dispatch(state.tr.setMeta(searchHighlightKey, { ranges, active }));
          return true;
        },
      clearSearchMatches:
        () =>
        ({ state, dispatch }: any) => {
          if (dispatch) dispatch(state.tr.setMeta(searchHighlightKey, { ranges: [], active: 0 }));
          return true;
        },
    } as any;
  },

  addProseMirrorPlugins() {
    const build = (doc: any, ranges: SearchRange[], active: number): DecorationSet => {
      if (!ranges.length) return DecorationSet.empty;
      const decos = ranges
        .filter((r) => r.from < r.to && r.to <= doc.content.size + 1)
        .map((r, i) =>
          Decoration.inline(r.from, r.to, {
            class: i === active ? 'doc-search-hit doc-search-hit-active' : 'doc-search-hit',
          }),
        );
      return DecorationSet.create(doc, decos);
    };

    return [
      new Plugin<HLState>({
        key: searchHighlightKey,
        state: {
          init: () => ({ deco: DecorationSet.empty, active: 0, ranges: [] }),
          apply(tr, value) {
            const meta = tr.getMeta(searchHighlightKey);
            if (meta) {
              return { ranges: meta.ranges, active: meta.active, deco: build(tr.doc, meta.ranges, meta.active) };
            }
            if (tr.docChanged && value.ranges.length) {
              // Remapea las coincidencias para que sigan válidas tras editar.
              const mapped = value.ranges
                .map((r) => ({ from: tr.mapping.map(r.from), to: tr.mapping.map(r.to) }))
                .filter((r) => r.from < r.to);
              return { ranges: mapped, active: value.active, deco: build(tr.doc, mapped, value.active) };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            return (this as any).getState(state)?.deco ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
