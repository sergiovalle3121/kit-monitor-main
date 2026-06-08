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
    } as any;
  },
});
