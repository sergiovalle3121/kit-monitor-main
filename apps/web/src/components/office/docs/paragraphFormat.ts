/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';

/**
 * Formato de párrafo «tipo Word»: espaciado antes/después y sangría de primera
 * línea. Se guardan como atributos (estilo inline) sobre párrafos y encabezados.
 */
export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          spaceBefore: {
            default: 0,
            parseHTML: (el: HTMLElement) => parseInt(el.style.marginTop || '0', 10) || 0,
            renderHTML: (attrs: any) => (attrs.spaceBefore ? { style: `margin-top:${attrs.spaceBefore}px` } : {}),
          },
          spaceAfter: {
            default: 0,
            parseHTML: (el: HTMLElement) => parseInt(el.style.marginBottom || '0', 10) || 0,
            renderHTML: (attrs: any) => (attrs.spaceAfter ? { style: `margin-bottom:${attrs.spaceAfter}px` } : {}),
          },
          firstLineIndent: {
            default: false,
            parseHTML: (el: HTMLElement) => (parseInt(el.style.textIndent || '0', 10) || 0) > 0,
            renderHTML: (attrs: any) => (attrs.firstLineIndent ? { style: 'text-indent:2.2em' } : {}),
          },
          // Saltos de línea y de página (Word): aplican en impresión / vista paginada.
          keepNext: {
            default: false,
            parseHTML: (el: HTMLElement) => el.style.breakAfter === 'avoid' || (el.style as any).pageBreakAfter === 'avoid',
            renderHTML: (attrs: any) => (attrs.keepNext ? { style: 'break-after:avoid', 'data-keep-next': 'true' } : {}),
          },
          keepLines: {
            default: false,
            parseHTML: (el: HTMLElement) => el.style.breakInside === 'avoid' || (el.style as any).pageBreakInside === 'avoid',
            renderHTML: (attrs: any) => (attrs.keepLines ? { style: 'break-inside:avoid', 'data-keep-lines': 'true' } : {}),
          },
          pageBreakBefore: {
            default: false,
            parseHTML: (el: HTMLElement) => el.style.breakBefore === 'page' || (el.style as any).pageBreakBefore === 'always',
            renderHTML: (attrs: any) => (attrs.pageBreakBefore ? { style: 'break-before:page', 'data-break-before': 'true' } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    const target = (editor: any) => (editor.isActive('heading') ? 'heading' : 'paragraph');
    return {
      setParagraphSpacing:
        (before: number | null, after: number | null) =>
        ({ editor, chain }: any) => {
          const u: any = {};
          if (before != null) u.spaceBefore = before;
          if (after != null) u.spaceAfter = after;
          return chain().updateAttributes(target(editor), u).run();
        },
      toggleFirstLineIndent:
        () =>
        ({ editor, chain }: any) => {
          const t = target(editor);
          return chain().updateAttributes(t, { firstLineIndent: !editor.getAttributes(t).firstLineIndent }).run();
        },
      toggleKeepNext: () => ({ editor, chain }: any) => { const t = target(editor); return chain().updateAttributes(t, { keepNext: !editor.getAttributes(t).keepNext }).run(); },
      toggleKeepLines: () => ({ editor, chain }: any) => { const t = target(editor); return chain().updateAttributes(t, { keepLines: !editor.getAttributes(t).keepLines }).run(); },
      togglePageBreakBefore: () => ({ editor, chain }: any) => { const t = target(editor); return chain().updateAttributes(t, { pageBreakBefore: !editor.getAttributes(t).pageBreakBefore }).run(); },
    } as any;
  },
});
