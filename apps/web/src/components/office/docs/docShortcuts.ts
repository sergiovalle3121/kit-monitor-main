/* eslint-disable @typescript-eslint/no-explicit-any */
import { Extension } from '@tiptap/core';

/**
 * Atajos de teclado «tipo Word» para estilos de párrafo. Los de formato básico
 * (Ctrl+B/I/U, Ctrl+Z/Y, Ctrl+F) ya los aportan StarterKit / DocEditor; aquí se
 * añaden los de estilos, evitando combinaciones que el navegador captura
 * (p. ej. Ctrl+Shift+N abre incógnito).
 */
export const DocShortcuts = Extension.create({
  name: 'docShortcuts',
  addKeyboardShortcuts() {
    const ed = () => this.editor.chain().focus();
    return {
      'Mod-Alt-0': () => ed().setParagraph().updateAttributes('paragraph', { styleName: '' }).run(),
      'Mod-Alt-1': () => ed().setHeading({ level: 1 }).run(),
      'Mod-Alt-2': () => ed().setHeading({ level: 2 }).run(),
      'Mod-Alt-3': () => ed().setHeading({ level: 3 }).run(),
      'Mod-Alt-4': () => ed().setHeading({ level: 4 }).run(),
      'Mod-Shift-7': () => (ed() as any).toggleOrderedList().run(),
      'Mod-Shift-8': () => (ed() as any).toggleBulletList().run(),
    };
  },
});
