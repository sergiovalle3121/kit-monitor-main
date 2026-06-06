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
  Bold, Italic, Underline, Strikethrough, Code,
  List, ListOrdered, ListChecks, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Link2, Image as ImageIcon, Table as TableIcon, Undo, Redo, Minus, Search,
} from 'lucide-react';
import { DocFindReplace } from './DocFindReplace';
import '@/styles/tiptap.css';

const FONTS = [
  { label: 'Predeterminada', value: '' },
  { label: 'Sans Serif', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: 'ui-monospace, "Courier New", monospace' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];
const SIZES = ['10', '11', '12', '13', '14', '16', '18', '20', '24', '28', '32', '40', '48', '60', '72'];
const LINE_HEIGHTS = [
  { label: 'Interlineado', value: '' },
  { label: 'Sencillo', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: 'Doble', value: '2' },
];

function Btn({ on, active, title, children }: { on: () => void; active?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button title={title} onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={`p-2 rounded-lg transition-colors ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
      {children}
    </button>
  );
}
function Sel({ value, onChange, title, style, children }: { value: string; onChange: (v: string) => void; title?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <select title={title} value={value} onChange={(e) => onChange(e.target.value)} style={style}
      className="h-8 text-xs rounded-lg bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 border border-transparent focus:border-gray-200 dark:focus:border-white/10 px-1.5 outline-none cursor-pointer text-gray-700 dark:text-gray-200">
      {children}
    </select>
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
      TextStyleKit.configure({ lineHeight: { types: ['heading', 'paragraph'] } } as any),
      TableKit.configure({ table: { resizable: true } }),
    ],
    content: value ?? '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  const [showFind, setShowFind] = React.useState(false);

  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);

  // Ctrl/Cmd+F opens in-document find & replace (like Google Docs).
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowFind(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  if (!editor) return <div className="h-full" />;

  const c = () => editor.chain().focus();
  const addLink = () => { const url = window.prompt('URL del enlace'); if (url) c().extendMarkRange('link').setLink({ href: url }).run(); };
  const addImage = () => { const url = window.prompt('URL de la imagen'); if (url) (c() as any).setImage({ src: url }).run(); };

  const ts = editor.getAttributes('textStyle');
  const curFont = ts.fontFamily ?? '';
  const curSize = String(ts.fontSize ?? '').replace('px', '');
  const curLH = String(editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight ?? '');
  const curStyle = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';

  const setStyle = (v: string) => {
    if (v === 'p') c().setParagraph().run();
    else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
  };
  const setFont = (v: string) => (v ? (c() as any).setFontFamily(v).run() : (c() as any).unsetFontFamily().run());
  const setSize = (v: string) => (v ? (c() as any).setFontSize(`${v}px`).run() : (c() as any).unsetFontSize().run());
  const setLH = (v: string) => (v ? (c() as any).setLineHeight(v).run() : (c() as any).unsetLineHeight().run());

  return (
    <div className="flex flex-col h-full">
      {!readOnly && (
      <div className="bg-white/90 dark:bg-[#111]/90 backdrop-blur border-b border-gray-100 dark:border-white/10 px-3 py-1.5 flex items-center gap-0.5 flex-wrap flex-shrink-0">
        <Btn on={() => c().undo().run()} title="Deshacer"><Undo className="w-4 h-4" /></Btn>
        <Btn on={() => c().redo().run()} title="Rehacer"><Redo className="w-4 h-4" /></Btn>
        <Sep />
        <Sel value={curStyle} onChange={setStyle} title="Estilo de párrafo" style={{ width: 104 }}>
          <option value="p">Normal</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </Sel>
        <Sel value={curFont} onChange={setFont} title="Fuente" style={{ width: 116 }}>
          {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
        </Sel>
        <Sel value={curSize} onChange={setSize} title="Tamaño de fuente" style={{ width: 60 }}>
          <option value="">--</option>
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Sel>
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
        <Sel value={curLH} onChange={setLH} title="Interlineado" style={{ width: 96 }}>
          {LINE_HEIGHTS.map((l) => <option key={l.label} value={l.value}>{l.label}</option>)}
        </Sel>
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
        <Sep />
        <Btn on={() => setShowFind(true)} title="Buscar y reemplazar (Ctrl+F)"><Search className="w-4 h-4" /></Btn>
      </div>
      )}

      {showFind && !readOnly && <DocFindReplace editor={editor} onClose={() => setShowFind(false)} />}

      <div className="tiptap-page flex-1 min-h-0 overflow-auto bg-gray-100 dark:bg-[#0b0b0b] py-8 px-3">
        <div className="mx-auto bg-white dark:bg-[#1a1a1a] shadow-xl rounded-sm w-full max-w-[820px] min-h-[1040px] px-12 md:px-16 py-14 text-black dark:text-gray-100">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
