/* eslint-disable @typescript-eslint/no-explicit-any */
import { Mark, Extension, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Control de cambios / modo sugerencias — versión mínima ESTABLE.
 *
 * Qué hace (estable, sin interceptar todo el motor):
 *   • Marcas `insertion` / `deletion` / `formatChange` (con autor + fecha) que se pintan como
 *     subrayado verde / tachado rojo.
 *   • «Modo sugerencias»: el texto que se ESCRIBE se marca como inserción
 *     automáticamente (vía `handleTextInput`, robusto y acotado).
 *   • «Proponer eliminación»: marca la selección como borrado propuesto sin
 *     quitar el texto.
 *   • «Marcar cambio de formato»: ancla una sugerencia de formato con
 *     metadatos before/after para que la revisión pueda aceptarla o quitarla.
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

export const FormatChangeMark = Mark.create({
  name: 'formatChange',
  inclusive: false,
  addAttributes() {
    return {
      author: { default: '' },
      date: { default: null },
      before: { default: null },
      after: { default: null },
      property: { default: 'formatting' },
    };
  },
  parseHTML() { return [{ tag: 'span[data-format-change]' }]; },
  renderHTML({ HTMLAttributes }: any) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-format-change': 'true', class: 'doc-format-change' }), 0];
  },
});

export type ChangeType = 'insertion' | 'deletion' | 'formatChange';
export interface ChangeRange { type: ChangeType; from: number; to: number; author: string; date: number | null; before?: string | null; after?: string | null; property?: string | null }

/** Rangos contiguos que llevan una marca dada. */
function markRanges(doc: any, markName: ChangeType): ChangeRange[] {
  const ranges: ChangeRange[] = [];
  let cur: ChangeRange | null = null;
  doc.descendants((node: any, pos: number) => {
    const m = node.isText ? node.marks.find((mk: any) => mk.type.name === markName) : null;
    if (m) {
      if (cur) cur.to = pos + node.nodeSize;
      else cur = { type: markName, from: pos, to: pos + node.nodeSize, author: m.attrs.author || '', date: m.attrs.date ?? null, before: m.attrs.before ?? null, after: m.attrs.after ?? null, property: m.attrs.property ?? null };
    } else if (cur) { ranges.push(cur); cur = null; }
  });
  if (cur) ranges.push(cur);
  return ranges;
}

/** Todos los cambios del documento, ordenados por posición. */
export function collectChanges(doc: any): ChangeRange[] {
  return [...markRanges(doc, 'insertion'), ...markRanges(doc, 'deletion'), ...markRanges(doc, 'formatChange')].sort((a, b) => a.from - b.from);
}

/** Autores distintos presentes en los cambios (orden de aparición). */
export function changeAuthors(doc: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of collectChanges(doc)) { const a = c.author || ''; if (!seen.has(a)) { seen.add(a); out.push(a); } }
  return out;
}

/** Resuelve (acepta/rechaza) un conjunto de cambios en una sola transacción. */
function resolveChanges(state: any, changes: ChangeRange[], accept: boolean): any {
  const ordered = [...changes].sort((a, b) => b.from - a.from);
  const tr = state.tr;
  const insType = state.schema.marks.insertion;
  const delType = state.schema.marks.deletion;
  const fmtType = state.schema.marks.formatChange;
  for (const ch of ordered) {
    const from = tr.mapping.map(ch.from);
    const to = tr.mapping.map(ch.to);
    if (accept) {
      if (ch.type === 'deletion') tr.delete(from, to);
      else if (ch.type === 'formatChange') tr.removeMark(from, to, fmtType);
      else tr.removeMark(from, to, insType);
    } else if (ch.type === 'insertion') tr.delete(from, to);
    else if (ch.type === 'formatChange') tr.removeMark(from, to, fmtType);
    else tr.removeMark(from, to, delType);
  }
  tr.setMeta('trackSkip', true);
  return tr;
}

/** ¿Un nodo (o su descendencia) contiene texto con marcas de cambio? */
function nodeHasChange(node: any): boolean {
  let found = false;
  const test = (n: any) => n.isText && n.marks.some((m: any) => m.type.name === 'insertion' || m.type.name === 'deletion' || m.type.name === 'formatChange');
  if (test(node)) return true;
  node.descendants?.((child: any) => { if (!found && test(child)) found = true; });
  return found;
}

/**
 * Decoración de «barra de cambio»: marca cada bloque de primer nivel que
 * contiene inserciones/eliminaciones para pintar una línea en el margen (como
 * Word). El CSS la muestra sólo en los modos «Todas las marcas» / «Sencillo».
 */
function changeBarPlugin() {
  return new Plugin({
    props: {
      decorations(state: any) {
        const decos: any[] = [];
        state.doc.forEach((node: any, offset: number) => {
          if (node.isBlock && nodeHasChange(node)) {
            decos.push(Decoration.node(offset, offset + node.nodeSize, { class: 'doc-change-bar' }));
          }
        });
        return decos.length ? DecorationSet.create(state.doc, decos) : DecorationSet.empty;
      },
    },
  });
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
      changeBarPlugin(),
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
      markFormattingChange: (property = 'formatting', before: string | null = null, after = 'Formato propuesto') => ({ state, chain }: any) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        return chain().setMark('formatChange', { author, date: Date.now(), property, before, after }).run();
      },

      acceptAllChanges: () => ({ state, dispatch }: any) => {
        const changes = collectChanges(state.doc);
        if (!changes.length) return false;
        if (dispatch) dispatch(resolveChanges(state, changes, true));
        return true;
      },
      rejectAllChanges: () => ({ state, dispatch }: any) => {
        const changes = collectChanges(state.doc);
        if (!changes.length) return false;
        if (dispatch) dispatch(resolveChanges(state, changes, false));
        return true;
      },
      acceptChangesByAuthor: (author: string) => ({ state, dispatch }: any) => {
        const changes = collectChanges(state.doc).filter((c) => (c.author || '') === author);
        if (!changes.length) return false;
        if (dispatch) dispatch(resolveChanges(state, changes, true));
        return true;
      },
      rejectChangesByAuthor: (author: string) => ({ state, dispatch }: any) => {
        const changes = collectChanges(state.doc).filter((c) => (c.author || '') === author);
        if (!changes.length) return false;
        if (dispatch) dispatch(resolveChanges(state, changes, false));
        return true;
      },

      acceptChange: (from: number, to: number, type: ChangeType) => ({ state, dispatch }: any) => {
        const tr = state.tr;
        if (type === 'deletion') tr.delete(from, to);
        else if (type === 'formatChange') tr.removeMark(from, to, state.schema.marks.formatChange);
        else tr.removeMark(from, to, state.schema.marks.insertion);
        tr.setMeta('trackSkip', true);
        if (dispatch) dispatch(tr);
        return true;
      },
      rejectChange: (from: number, to: number, type: ChangeType) => ({ state, dispatch }: any) => {
        const tr = state.tr;
        if (type === 'insertion') tr.delete(from, to);
        else if (type === 'formatChange') tr.removeMark(from, to, state.schema.marks.formatChange);
        else tr.removeMark(from, to, state.schema.marks.deletion);
        tr.setMeta('trackSkip', true);
        if (dispatch) dispatch(tr);
        return true;
      },
    } as any;
  },
});
