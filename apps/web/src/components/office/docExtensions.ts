/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension, Node } from '@tiptap/core';

/**
 * Extensiones de profundidad «tipo Word» para el editor de documentos (TipTap,
 * MIT). Todas guardan su estado dentro del JSON del documento (atributos), así
 * que viajan con el contenido y no requieren almacén aparte.
 */

const MAX_INDENT = 10;
const INDENT_PX = 36; // ~0.5" por nivel, como Word

/** Sangría de párrafo / encabezado (margin-left por niveles). */
export const Indent = Extension.create({
  name: 'indent',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el: HTMLElement) => {
            const m = parseInt(el.style.marginLeft || '0', 10);
            return m ? Math.min(MAX_INDENT, Math.round(m / INDENT_PX)) : 0;
          },
          renderHTML: (attrs: any) => (attrs.indent ? { style: `margin-left:${attrs.indent * INDENT_PX}px` } : {}),
        },
      },
    }];
  },
  addCommands() {
    const shift = (dir: number) => () => ({ state, dispatch, tr }: any) => {
      const { from, to } = state.selection;
      let changed = false;
      state.doc.nodesBetween(from, to, (node: any, pos: number) => {
        if (node.type.name === 'paragraph' || node.type.name === 'heading') {
          const cur = node.attrs.indent || 0;
          const next = Math.max(0, Math.min(MAX_INDENT, cur + dir));
          if (next !== cur) { tr.setNodeAttribute(pos, 'indent', next); changed = true; }
        }
      });
      if (changed && dispatch) dispatch(tr);
      return changed;
    };
    return { indentMore: shift(1), indentLess: shift(-1) } as any;
  },
});

/** Estilo con nombre (Título / Subtítulo) sobre párrafo o encabezado, para la
 *  galería de estilos. Se renderiza como clase CSS + data-attr (viaja en el JSON
 *  y se mapea en el export .docx). */
export const NamedStyle = Extension.create({
  name: 'namedStyle',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        styleName: {
          default: '',
          parseHTML: (el: HTMLElement) => el.getAttribute('data-style') || '',
          renderHTML: (attrs: any) => (attrs.styleName ? { 'data-style': attrs.styleName, class: `doc-style-${attrs.styleName}` } : {}),
        },
        // Nivel de esquema (Word): un párrafo con nivel 1-3 aparece en la TOC aunque
        // no sea un encabezado («Agregar al índice»).
        outlineLevel: {
          default: 0,
          parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-outline-level')) || 0,
          renderHTML: (attrs: any) => (attrs.outlineLevel ? { 'data-outline-level': attrs.outlineLevel } : {}),
        },
      },
    }];
  },
});

/** Recolecta los encabezados del documento (y párrafos con nivel de esquema) para
 *  el índice / esquema. Se preserva el orden del documento. */
export function collectHeadings(doc: any): { level: number; text: string; pos: number }[] {
  const out: { level: number; text: string; pos: number }[] = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading') out.push({ level: node.attrs.level ?? 1, text: node.textContent || '(sin título)', pos });
    else if (node.type.name === 'paragraph' && node.attrs?.outlineLevel) out.push({ level: node.attrs.outlineLevel, text: node.textContent || '(sin título)', pos });
  });
  return out;
}

/** Dimensiones de la página (px) para estimar el número de página de cada título. */
const TOC_DIM: Record<string, [number, number]> = { a4: [794, 1123], letter: [816, 1056], legal: [816, 1344] };
function printableHeight(meta: any): number {
  const [w, h] = TOC_DIM[meta?.pageSize as string] || TOC_DIM.a4;
  const tall = meta?.pageOrientation === 'landscape' ? w : h;
  const pad = meta?.pageMargin === 'narrow' ? 36 : meta?.pageMargin === 'wide' ? 104 : 64;
  return Math.max(240, tall - pad * 2);
}

/**
 * Tabla de contenido **viva**: nodo atómico con NodeView que se reconstruye en
 * cada cambio del documento a partir de los encabezados. Clic = saltar al título.
 * Atributos: `maxLevel` (1-6, profundidad mostrada) y `rev` (forzar refresco).
 * Muestra un número de página **estimado** (medido del DOM) con puntos guía.
 */
export const Toc = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      maxLevel: { default: 3, parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-max-level')) || 3, renderHTML: (a: any) => ({ 'data-max-level': a.maxLevel || 3 }) },
      rev: { default: 0 },
    };
  },

  parseHTML() { return [{ tag: 'div[data-toc]' }]; },
  renderHTML({ HTMLAttributes }: any) { return ['div', { ...HTMLAttributes, 'data-toc': 'true', class: 'doc-toc' }, 'Tabla de contenido']; },

  addCommands() {
    return {
      insertToc: (maxLevel = 3) => ({ commands }: any) => commands.insertContent({ type: this.name, attrs: { maxLevel } }),
      // Word: «Actualizar tabla». Como es viva ya se refresca sola; esto fuerza un
      // refresco (y la re-medición de páginas) incrementando `rev` en cada TOC.
      updateToc: () => ({ state, dispatch, tr }: any) => {
        let changed = false;
        state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'toc') { tr.setNodeAttribute(pos, 'rev', (node.attrs.rev || 0) + 1); changed = true; }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },
      setTocLevels: (maxLevel: number) => ({ state, dispatch, tr }: any) => {
        let changed = false;
        state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'toc') { tr.setNodeAttribute(pos, 'maxLevel', maxLevel); changed = true; }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },
    } as any;
  },

  addNodeView() {
    return ({ editor, node }: any) => {
      const dom = document.createElement('div');
      dom.className = 'doc-toc';
      dom.setAttribute('contenteditable', 'false');
      let raf = 0;
      let rows: { el: HTMLElement; pageEl: HTMLElement; pos: number }[] = [];
      let maxLevel = node.attrs.maxLevel || 3;

      // Mide (en una rAF, evitando reflows por tecla) el número de página estimado.
      const measure = () => {
        const meta = editor.state.doc.attrs || {};
        const pageH = printableHeight(meta);
        const pageEl = editor.view.dom.closest('[class*="doc-track-"]') as HTMLElement | null;
        const zoom = pageEl && pageEl.style.zoom ? parseFloat(pageEl.style.zoom) || 1 : 1;
        const rootTop = editor.view.dom.getBoundingClientRect().top;
        for (const r of rows) {
          try {
            const el = editor.view.nodeDOM(r.pos) as HTMLElement | null;
            if (!el || !el.getBoundingClientRect) { r.pageEl.textContent = ''; continue; }
            const offset = (el.getBoundingClientRect().top - rootTop) / zoom;
            r.pageEl.textContent = String(Math.max(1, Math.floor(offset / pageH) + 1));
          } catch { r.pageEl.textContent = ''; }
        }
      };

      const build = () => {
        const items = collectHeadings(editor.state.doc).filter((it) => it.level <= maxLevel);
        dom.innerHTML = '';
        rows = [];
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.textContent = 'Tabla de contenido';
        dom.appendChild(title);
        if (!items.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = `Aplica estilos «Título 1-${maxLevel}» para generar el índice.`;
          dom.appendChild(empty);
          return;
        }
        items.forEach((it) => {
          const a = document.createElement('a');
          a.className = 'doc-toc-item';
          a.style.paddingLeft = `${(it.level - 1) * 18}px`;
          const text = document.createElement('span');
          text.className = 'doc-toc-text';
          text.textContent = it.text;
          const dots = document.createElement('span');
          dots.className = 'doc-toc-dots';
          const page = document.createElement('span');
          page.className = 'doc-toc-page';
          a.append(text, dots, page);
          a.addEventListener('mousedown', (e) => {
            e.preventDefault();
            editor.chain().focus().setTextSelection(it.pos + 1).scrollIntoView().run();
          });
          dom.appendChild(a);
          rows.push({ el: a, pageEl: page, pos: it.pos });
        });
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(measure);
      };

      build();
      editor.on('update', build);
      return {
        dom,
        ignoreMutation: () => true,
        update: (updated: any) => {
          if (updated.type.name !== 'toc') return false;
          maxLevel = updated.attrs.maxLevel || 3;
          build();
          return true;
        },
        destroy: () => { cancelAnimationFrame(raf); editor.off('update', build); },
      };
    };
  },
});

/** Recolecta los párrafos con estilo «Leyenda» (figuras/tablas), en orden. */
export function collectCaptions(doc: any): { text: string; pos: number }[] {
  const out: { text: string; pos: number }[] = [];
  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'paragraph' && node.attrs?.styleName === 'caption') {
      out.push({ text: node.textContent || '(sin leyenda)', pos });
    }
  });
  return out;
}

/**
 * Tabla de ilustraciones **viva**: nodo atómico que lista los párrafos con estilo
 * «Leyenda» con número correlativo, puntos guía y nº de página estimado.
 */
export const TableOfFigures = Node.create({
  name: 'tableOfFigures',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() { return [{ tag: 'div[data-tof]' }]; },
  renderHTML() { return ['div', { 'data-tof': 'true', class: 'doc-toc doc-tof' }, 'Tabla de ilustraciones']; },

  addCommands() {
    return { insertTableOfFigures: () => ({ commands }: any) => commands.insertContent({ type: this.name }) } as any;
  },

  addNodeView() {
    return ({ editor }: any) => {
      const dom = document.createElement('div');
      dom.className = 'doc-toc doc-tof';
      dom.setAttribute('contenteditable', 'false');
      let raf = 0;
      let rows: { pageEl: HTMLElement; pos: number }[] = [];

      const measure = () => {
        const meta = editor.state.doc.attrs || {};
        const pageH = printableHeight(meta);
        const pageEl = editor.view.dom.closest('[class*="doc-track-"]') as HTMLElement | null;
        const zoom = pageEl && pageEl.style.zoom ? parseFloat(pageEl.style.zoom) || 1 : 1;
        const rootTop = editor.view.dom.getBoundingClientRect().top;
        for (const r of rows) {
          try {
            const el = editor.view.nodeDOM(r.pos) as HTMLElement | null;
            if (!el || !el.getBoundingClientRect) { r.pageEl.textContent = ''; continue; }
            const offset = (el.getBoundingClientRect().top - rootTop) / zoom;
            r.pageEl.textContent = String(Math.max(1, Math.floor(offset / pageH) + 1));
          } catch { r.pageEl.textContent = ''; }
        }
      };

      const build = () => {
        const items = collectCaptions(editor.state.doc);
        dom.innerHTML = '';
        rows = [];
        const title = document.createElement('div');
        title.className = 'doc-toc-title';
        title.textContent = 'Tabla de ilustraciones';
        dom.appendChild(title);
        if (!items.length) {
          const empty = document.createElement('div');
          empty.className = 'doc-toc-empty';
          empty.textContent = 'Aplica el estilo «Leyenda» a los pies de figura/tabla para generarla.';
          dom.appendChild(empty);
          return;
        }
        items.forEach((it, i) => {
          const a = document.createElement('a');
          a.className = 'doc-toc-item';
          const text = document.createElement('span');
          text.className = 'doc-toc-text';
          text.textContent = `${i + 1}. ${it.text}`;
          const dots = document.createElement('span');
          dots.className = 'doc-toc-dots';
          const page = document.createElement('span');
          page.className = 'doc-toc-page';
          a.append(text, dots, page);
          a.addEventListener('mousedown', (e) => { e.preventDefault(); editor.chain().focus().setTextSelection(it.pos + 1).scrollIntoView().run(); });
          dom.appendChild(a);
          rows.push({ pageEl: page, pos: it.pos });
        });
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(measure);
      };

      build();
      editor.on('update', build);
      return { dom, ignoreMutation: () => true, update: () => { build(); return true; }, destroy: () => { cancelAnimationFrame(raf); editor.off('update', build); } };
    };
  },
});
