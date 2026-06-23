/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Extensión Tiptap para la **tipografía inteligente** (Autoformato de Word). La lógica pura vive en
 * `lib/office/typography.ts`; aquí se añade el comando `applyTypography(opts?)`, que la aplica al
 * texto de la selección (o a todo el documento si no hay selección) **preservando las marcas** y
 * **sin tocar el código** (bloques ni `code` en línea, donde la puntuación recta es significativa).
 * Como las sustituciones cambian la longitud, se aplican **de derecha a izquierda** para no
 * invalidar posiciones.
 */
import { Extension } from '@tiptap/core';
import { smartTypography, type TypographyOpts } from '@/lib/office/typography';

export const SmartTypography = Extension.create({
  name: 'smartTypography',
  addCommands() {
    return {
      applyTypography:
        (opts?: TypographyOpts) =>
        ({ state, dispatch }: any) => {
          const sel = state.selection;
          const from = sel.empty ? 0 : sel.from;
          const to = sel.empty ? state.doc.content.size : sel.to;
          const repls: { start: number; end: number; text: string; marks: any }[] = [];
          state.doc.nodesBetween(from, to, (node: any, pos: number, parent: any) => {
            if (!node.isText || !node.text) return;
            if (parent?.type?.name === 'codeBlock') return;            // no en bloques de código
            if (node.marks?.some((m: any) => m.type.name === 'code')) return; // ni en `code` en línea
            const start = Math.max(pos, from);
            const end = Math.min(pos + node.nodeSize, to);
            const slice = node.text.slice(start - pos, end - pos);
            const out = smartTypography(slice, opts);
            if (out !== slice && out.length) repls.push({ start, end, text: out, marks: node.marks });
          });
          if (!repls.length) return false;
          const tr = state.tr;
          repls.sort((a, b) => b.start - a.start); // derecha → izquierda
          for (const r of repls) tr.replaceWith(r.start, r.end, state.schema.text(r.text, r.marks));
          if (dispatch) dispatch(tr);
          return true;
        },
    } as any;
  },
});
