/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mark, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/**
 * Control de cambios / modo sugerencias — versión mínima ESTABLE.
 *
 * Qué hace (estable, sin interceptar todo el motor):
 *   • Marcas `insertion` / `deletion` (con autor + fecha) que se pintan como
 *     subrayado verde / tachado rojo.
 *   • «Modo sugerencias»: el texto que se ESCRIBE se marca como inserción
 *     automáticamente (vía `handleTextInput`, robusto y acotado).
 *   • «Proponer eliminación»: marca la selección como borrado propuesto sin
 *     quitar el texto.
 *   • Aceptar / rechazar (todo o el cambio actual): aceptar quita el texto
 *     borrado y desmarca inserciones; rechazar quita el texto insertado y
 *     desmarca borrados.
 *
 * Se DIFIERE (ver NIGHT_LOG): captura automática de pegar / IME / borrados como
 * sugerencia (requiere interceptar cada paso del motor — subsistema de
 * especialista que no se entrega sin pruebas en navegador).
 */

export const InsertionMark = Mark.create({
  name: 'insertion',
  inclusive: false,
  addAttributes() { return { author: { default: '' }, date: { default: null } }; },
  parseHTML() { return [{ tag: 'span[data-ins]' }]; },
  renderHTML({ HTMLAttributes }: any) { return ['span', mergeAttributes(HTMLAttributes, { 'data-ins': 'true', class: 'doc-ins' }), 0]; },
});

export const DeletionMark = Mark.create({
  name: 'deletion',
  inclusive: false,
  addAttributes() { return { author: { default: '' }, date: { default: null } }; },
  parseHTML() { return [{ tag: 'span[data-del]' }]; },
  renderHTML({ HTMLAttributes }: any) { return ['span', mergeAttributes(HTMLAttributes, { 'data-del': 'true', class: 'doc-del' }), 0]; },
});

export interface ChangeRange { type: 'insertion' | 'deletion'; from: number; to: number; author: string; date: number | null }

/** Rangos contiguos que llevan una marca dada. */
function markRanges(doc: any, markName: string): ChangeRange[] {
  const ranges: ChangeRange[] = [];
  let cur: ChangeRange | null = null;
  doc.descendants((node: any, pos: number) => {
    const m = node.isText ? node.marks.find((mk: any) => mk.type.name === markName) : null;
    if (m) {
      if (cur) cur.to = pos + node.nodeSize;
      else cur = { type: markName as any, from: pos, to: pos + node.nodeSize, author: m.attrs.author || '', date: m.attrs.date ?? null };
    } else if (cur) { ranges.push(cur); cur = null; }
  });
  if (cur) ranges.push(cur);
  return ranges;
}

/** Todos los cambios del documento, ordenados por posición. */
export function collectChanges(doc: any): ChangeRange[] {
  return [...markRanges(doc, 'insertion'), ...markRanges(doc, 'deletion')].sort((a, b) => a.from - b.from);
}

export const TrackChanges = Extension.create({
  name: 'trackChanges',
  addOptions() { return { author: '' }; },
  addStorage() { return { suggesting: false }; },

  addProseMirrorPlugins() {
    const storage = this.storage;
    const options = this.options;
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to, text) {
            if (!storage.suggesting) return false;
            const mark = view.state.schema.marks.insertion;
            if (!mark) return false;
            const tr = view.state.tr.insertText(text, from, to);
            tr.addMark(from, from + text.length, mark.create({ author: options.author, date: Date.now() }));
            tr.setMeta('trackSkip', true);
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },

  addCommands() {
    const author = this.options.author || '';
    return {
      setSuggesting: (on: boolean) => ({ editor }: any) => { editor.storage.trackChanges.suggesting = !!on; return true; },

      markInsertion: () => ({ state, chain }: any) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        return chain().setMark('insertion', { author, date: Date.now() }).run();
      },
      proposeDeletion: () => ({ state, chain }: any) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        return chain().setMark('deletion', { author, date: Date.now() }).run();
      },

      acceptAllChanges: () => ({ state, dispatch }: any) => {
        const changes = collectChanges(state.doc).sort((a, b) => b.from - a.from);
        if (!changes.length) return false;
        const tr = state.tr;
        const insType = state.schema.marks.insertion;
        for (const ch of changes) {
          if (ch.type === 'deletion') tr.delete(tr.mapping.map(ch.from), tr.mapping.map(ch.to));
          else tr.removeMark(tr.mapping.map(ch.from), tr.mapping.map(ch.to), insType);
        }
        tr.setMeta('trackSkip', true);
        if (dispatch) dispatch(tr);
        return true;
      },
      rejectAllChanges: () => ({ state, dispatch }: any) => {
        const changes = collectChanges(state.doc).sort((a, b) => b.from - a.from);
        if (!changes.length) return false;
        const tr = state.tr;
        const delType = state.schema.marks.deletion;
        for (const ch of changes) {
          if (ch.type === 'insertion') tr.delete(tr.mapping.map(ch.from), tr.mapping.map(ch.to));
          else tr.removeMark(tr.mapping.map(ch.from), tr.mapping.map(ch.to), delType);
        }
        tr.setMeta('trackSkip', true);
        if (dispatch) dispatch(tr);
        return true;
      },

      acceptChange: (from: number, to: number, type: 'insertion' | 'deletion') => ({ state, dispatch }: any) => {
        const tr = state.tr;
        if (type === 'deletion') tr.delete(from, to);
        else tr.removeMark(from, to, state.schema.marks.insertion);
        tr.setMeta('trackSkip', true);
        if (dispatch) dispatch(tr);
        return true;
      },
      rejectChange: (from: number, to: number, type: 'insertion' | 'deletion') => ({ state, dispatch }: any) => {
        const tr = state.tr;
        if (type === 'insertion') tr.delete(from, to);
        else tr.removeMark(from, to, state.schema.marks.deletion);
        tr.setMeta('trackSkip', true);
        if (dispatch) dispatch(tr);
        return true;
      },
    } as any;
  },
});
