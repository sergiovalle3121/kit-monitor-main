'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Quote, Undo, Redo } from 'lucide-react';

function Btn({ on, active, children }: { on: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={on} className={`p-2 rounded-lg transition-colors ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
      {children}
    </button>
  );
}

/** Word-like rich text editor (TipTap, MIT). */
export function DocEditor({ value, onChange }: { value: any; onChange: (json: any) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value ?? '<p></p>',
    immediatelyRender: false, // required for Next SSR
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none min-h-[60vh] focus:outline-none px-8 py-6',
      },
    },
  });

  if (!editor) return <div className="min-h-[60vh]" />;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-white/10 overflow-hidden bg-white dark:bg-[#111]">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-white/10 flex-wrap">
        <Btn on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><Bold className="w-4 h-4" /></Btn>
        <Btn on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><Italic className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
        <Btn on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}><Heading1 className="w-4 h-4" /></Btn>
        <Btn on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}><Heading2 className="w-4 h-4" /></Btn>
        <Btn on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}><List className="w-4 h-4" /></Btn>
        <Btn on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}><ListOrdered className="w-4 h-4" /></Btn>
        <Btn on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}><Quote className="w-4 h-4" /></Btn>
        <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-1" />
        <Btn on={() => editor.chain().focus().undo().run()}><Undo className="w-4 h-4" /></Btn>
        <Btn on={() => editor.chain().focus().redo().run()}><Redo className="w-4 h-4" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
