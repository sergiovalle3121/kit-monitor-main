/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { computePagination, pageGeom, type BreakUnit, type PaginationLayout } from './pagination';

/**
 * Extensión de TipTap que pagina la superficie de edición (Fase 1) aplicando el
 * núcleo puro de `pagination.ts` mediante DECORACIONES de ProseMirror:
 *  · Widgets espaciadores entre bloques que empujan cada página al borde superior
 *    del área de contenido de una hoja discreta (Carta / A4 / Oficio).
 *  · Decoración de nodo `doc-print-break` para el salto real en impresión nativa.
 *
 * No modifica el documento (el contenido sigue siendo TipTap JSON puro). La
 * geometría sale de `pageMeta` (DocPageSetup). Se mide en rAF y se publica el
 * layout (hojas + geometría) por `editor.storage.docPagination.onLayout`, que
 * DocEditor usa para dibujar los marcos de página (encabezado/pie/numeración).
 */

export const paginationKey = new PluginKey('docPagination');

interface PgState { deco: DecorationSet; sig: string; spacers: { index: number; fill: number }[] }

/** Vista del plugin: mide en rAF y publica el layout (espaciadores + métricas). */
class PaginationView {
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private lastDoc: any = null;
  private lastKey = '';
  private force = true; // primera medición siempre corre

  constructor(private view: any, private editor: any) {
    this.schedule();
    try {
      this.ro = new ResizeObserver(() => this.schedule(true));
      this.ro.observe(view.dom);
    } catch { /* sin ResizeObserver nos apoyamos en update() */ }
    view.dom.addEventListener('load', this.onLoad, true); // re-medir al cargar imágenes
  }

  private onLoad = () => this.schedule(true);
  update() { this.schedule(false); }
  // `force` salta el atajo de «sin cambios» (reflujos de imágenes/redimensionado).
  private schedule(force = true) {
    if (force) this.force = true;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => { try { this.measure(); } catch { /* nunca romper el editor por una medición */ } });
  }

  private publish(layout: PaginationLayout) {
    const cb = this.editor?.storage?.docPagination?.onLayout;
    if (typeof cb === 'function') cb(layout);
  }

  private measure() {
    const view = this.view;
    const storage = this.editor?.storage?.docPagination || {};
    const meta: any = view.state.doc.attrs || {};
    const geom = pageGeom(meta);
    const enabled = !!storage.enabled;

    // Atajo: si ni el documento ni la geometría cambiaron, no remedimos (evita
    // trabajo en cada cambio de selección). `force` lo salta tras reflujos.
    const key = `${enabled}|${meta.pageSize}|${meta.pageOrientation}|${meta.pageMargin}|${storage.nonce || 0}`;
    if (!this.force && view.state.doc === this.lastDoc && key === this.lastKey) return;
    this.force = false;
    this.lastDoc = view.state.doc;
    this.lastKey = key;

    if (!enabled) {
      this.publish({ pages: [{ top: 0, height: geom.pageH }], geom });
      this.clear();
      return;
    }

    const prev = (paginationKey.getState(view.state) as PgState | undefined)?.spacers || [];
    const prevMap = new Map(prev.map((s) => [s.index, s.fill]));
    const rootRect = view.dom.getBoundingClientRect();
    const zoomEl = view.dom.closest('.doc-paginated') as HTMLElement | null;
    const zoom = zoomEl && zoomEl.style.zoom ? parseFloat(zoomEl.style.zoom) || 1 : 1;

    const units: BreakUnit[] = [];
    const positions: number[] = [];
    let cum = 0;
    const doc = view.state.doc;
    doc.forEach((node: any, offset: number, index: number) => {
      const dom = view.nodeDOM(offset) as HTMLElement | null;
      let top = cum;
      let height = 0;
      if (dom && typeof dom.getBoundingClientRect === 'function') {
        if (prevMap.has(index)) cum += prevMap.get(index) as number; // el espaciador precede al bloque
        const r = dom.getBoundingClientRect();
        top = (r.top - rootRect.top) / zoom - cum;
        height = dom.offsetHeight;
      }
      positions.push(offset);
      units.push({ top, height, force: node.type.name === 'pageBreak' });
    });

    const { breaks, pages } = computePagination(units, geom);
    this.publish({ pages, geom });

    const newSig = breaks.map((b) => `${b.index}:${Math.round(b.fill)}`).join('|');
    const cur = paginationKey.getState(view.state) as PgState | undefined;
    if (newSig === (cur?.sig ?? '')) return;

    const decos: any[] = [];
    for (const b of breaks) {
      const pos = positions[b.index];
      const node = doc.child(b.index);
      const spacer = document.createElement('div');
      spacer.className = 'doc-pg-spacer';
      spacer.setAttribute('contenteditable', 'false');
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.height = `${Math.round(b.fill)}px`;
      decos.push(Decoration.widget(pos, spacer, { side: -1, key: `pg-${b.index}-${Math.round(b.fill)}`, ignoreSelection: true } as any));
      decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'doc-print-break' }));
    }
    const deco = DecorationSet.create(doc, decos);
    view.dispatch(view.state.tr.setMeta(paginationKey, { deco, sig: newSig, spacers: breaks }));
  }

  private clear() {
    const cur = paginationKey.getState(this.view.state) as PgState | undefined;
    if (cur && cur.sig !== '') {
      this.view.dispatch(this.view.state.tr.setMeta(paginationKey, { deco: DecorationSet.empty, sig: '', spacers: [] }));
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.view.dom.removeEventListener('load', this.onLoad, true);
  }
}

export const Pagination = Extension.create({
  name: 'docPagination',

  addStorage() {
    return { enabled: false, title: '', nonce: 0, onLayout: null as null | ((l: PaginationLayout) => void) };
  },

  addCommands() {
    return {
      // Activa/desactiva la vista paginada y fija el título (para el campo
      // {title}); fuerza una re-medición. Lo invoca DocEditor desde un efecto.
      configurePagination: (enabled: boolean, title: string) => ({ editor, state, dispatch }: any) => {
        editor.storage.docPagination.enabled = !!enabled;
        editor.storage.docPagination.title = title || '';
        editor.storage.docPagination.nonce = (editor.storage.docPagination.nonce || 0) + 1;
        if (dispatch) dispatch(state.tr.setMeta(paginationKey, { ping: Date.now() }));
        return true;
      },
      // Registra el «sink» del layout (función que recibe hojas + geometría).
      setPaginationSink: (fn: ((l: PaginationLayout) => void) | null) => ({ editor }: any) => {
        editor.storage.docPagination.onLayout = fn;
        return true;
      },
    } as any;
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin<PgState>({
        key: paginationKey,
        state: {
          init: () => ({ deco: DecorationSet.empty, sig: '', spacers: [] }),
          apply(tr, value) {
            const meta = tr.getMeta(paginationKey);
            if (meta && meta.deco) return { deco: meta.deco, sig: meta.sig, spacers: meta.spacers };
            if (tr.docChanged) return { ...value, deco: value.deco.map(tr.mapping, tr.doc) };
            return value;
          },
        },
        props: {
          decorations(state) { return (paginationKey.getState(state) as PgState | undefined)?.deco ?? DecorationSet.empty; },
        },
        view: (editorView) => new PaginationView(editorView, editor),
      }),
    ];
  },
});
