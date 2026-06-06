'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TableKit } from '@tiptap/extension-table';
import {
  Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Link2, Image as ImageIcon, Table as TableIcon, Undo, Redo, Minus, Pilcrow,
} from 'lucide-react';
import '@/styles/tiptap.css';

function Btn({ on, active, title, children }: { on: () => void; active?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button title={title} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={`p-2 rounded-lg transition-colors ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
      {children}
    </button>
  );
}
function Sep() { return <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />; }

/** Word-like rich text editor (TipTap + MIT extensions). */
export function DocEditor({ value, onChange, readOnly }: { value: any; onChange: (json: any) => void; readOnly?: boolean }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
      TextStyleKit,
      TableKit.configure({ table: { resizable: true } }),
    ],
    content: value ?? '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);

  if (!editor) return <div className="h-full" />;

  const c = () => editor.chain().focus();
  const addLink = () => { const url = window.prompt('URL del enlace'); if (url) c().extendMarkRange('link').setLink({ href: url }).run(); };
  const addImage = () => { const url = window.prompt('URL de la imagen'); if (url) (c() as any).setImage({ src: url }).run(); };

  return (
    <div className="flex flex-col h-full">
      {!readOnly && (
      <div className="bg-white/90 dark:bg-[#111]/90 backdrop-blur border-b border-gray-100 dark:border-white/10 px-3 py-1.5 flex items-center gap-0.5 flex-wrap flex-shrink-0">
        <Btn on={() => c().undo().run()} title="Deshacer"><Undo className="w-4 h-4" /></Btn>
        <Btn on={() => c().redo().run()} title="Rehacer"><Redo className="w-4 h-4" /></Btn>
        <Sep />
        <Btn on={() => c().setParagraph().run()} active={editor.isActive('paragraph')} title="Texto"><Pilcrow className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1"><Heading1 className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2"><Heading2 className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3"><Heading3 className="w-4 h-4" /></Btn>
        <Sep />
        <Btn on={() => c().toggleBold().run()} active={editor.isActive('bold')} title="Negrita"><Bold className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva"><Italic className="w-4 h-4" /></Btn>
        <Btn on={() => (c() as any).toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado"><Underline className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado"><Strikethrough className="w-4 h-4" /></Btn>
        <Btn on={() => (c() as any).toggleHighlight().run()} active={editor.isActive('highlight')} title="Resaltar"><Highlighter className="w-4 h-4" /></Btn>
        <label title="Color de texto" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer flex items-center">
          <span className="w-4 h-4 rounded-sm border border-gray-300" style={{ background: 'linear-gradient(135deg,#ef4444,#3b82f6)' }} />
          <input type="color" onChange={(e) => (c() as any).setColor(e.target.value).run()} className="w-0 h-0 opacity-0 absolute" />
        </label>
        <Sep />
        <Btn on={() => c().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Izquierda"><AlignLeft className="w-4 h-4" /></Btn>
        <Btn on={() => c().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrar"><AlignCenter className="w-4 h-4" /></Btn>
        <Btn on={() => c().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Derecha"><AlignRight className="w-4 h-4" /></Btn>
        <Btn on={() => c().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar"><AlignJustify className="w-4 h-4" /></Btn>
        <Sep />
        <Btn on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Viñetas"><List className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numerada"><ListOrdered className="w-4 h-4" /></Btn>
        <Btn on={() => (c() as any).toggleTaskList().run()} active={editor.isActive('taskList')} title="Lista de tareas"><ListChecks className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Cita"><Quote className="w-4 h-4" /></Btn>
        <Btn on={() => c().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Código"><Code className="w-4 h-4" /></Btn>
        <Sep />
        <Btn on={addLink} active={editor.isActive('link')} title="Enlace"><Link2 className="w-4 h-4" /></Btn>
        <Btn on={addImage} title="Imagen"><ImageIcon className="w-4 h-4" /></Btn>
        <Btn on={() => (c() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Tabla"><TableIcon className="w-4 h-4" /></Btn>
        <Btn on={() => c().setHorizontalRule().run()} title="Separador"><Minus className="w-4 h-4" /></Btn>
      </div>
      )}

      <div className="tiptap-page flex-1 min-h-0 overflow-auto bg-gray-100 dark:bg-[#0b0b0b] py-8 px-3">
        <div className="mx-auto bg-white dark:bg-[#1a1a1a] shadow-xl rounded-sm w-full max-w-[820px] min-h-[1040px] px-12 md:px-16 py-14 text-black dark:text-gray-100">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
