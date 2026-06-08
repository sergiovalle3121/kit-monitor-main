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

// Image with width + alignment (text-wrap) attributes.
const DocImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.style.width || null,
        renderHTML: (attrs: any) => (attrs.width ? { style: `width:${attrs.width}` } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs: any) => ({ 'data-align': attrs.align || 'center' }),
      },
    };
  },
});
import { TextStyleKit } from '@tiptap/extension-text-style';
import { TableKit } from '@tiptap/extension-table';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { CharacterCount } from '@tiptap/extension-character-count';
import {
  Bold, Italic, Underline, Strikethrough, Code,
  List, ListOrdered, ListChecks, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Highlighter, Link2, Undo, Redo, Minus, Search, SeparatorHorizontal,
  Subscript as SubIcon, Superscript as SupIcon, RemoveFormatting, Code2, Calendar, Smile, Baseline, FileText,
  PaintRoller, IndentIncrease, IndentDecrease, ListTree, Accessibility,
} from 'lucide-react';
import { DocFindReplace } from './DocFindReplace';
import { DocOutline } from './DocOutline';
import { DocComments } from './DocComments';
import { DocPageView } from './DocPageView';
import { DocTableMenu } from './DocTableMenu';
import { DocStyleGallery } from './DocStyleGallery';
import { DocSymbolPicker } from './DocSymbolPicker';
import { DocPageSetup } from './DocPageSetup';
import { CommentMark } from './commentMark';
import { PageBreak, PageMeta } from './docPageExtensions';
import { Indent, Toc, NamedStyle } from './docExtensions';
import { ListNumbering } from './docs/listNumbering';
import { TableCellAttrs } from './docs/tableCellAttrs';
import { SearchHighlight } from './docs/searchHighlight';
import { MathInline, MathBlock, MathCommands } from './docs/mathExtension';
import { FootnoteRef, FootnoteList } from './docs/footnotes';
import { DropCap, Callout, ColumnBreak, Bookmark, CrossRef } from './docs/insertNodes';
import { InsertionMark, DeletionMark, TrackChanges } from './docs/trackChanges';
import { FocusLine } from './docs/focusLine';
import { SignatureLine } from './docs/signatureLine';
import { Citation, Bibliography } from './docs/citations';
import { DocCitations } from './docs/DocCitations';
import { DocHeaderFooter } from './docs/DocHeaderFooter';
import { DocTableInsert } from './docs/DocTableInsert';
import { DocImageInsert } from './docs/DocImageInsert';
import { DocShortcuts } from './docs/docShortcuts';
import { ParagraphFormat } from './docs/paragraphFormat';
import { DocParagraphMenu } from './docs/DocParagraphMenu';
import { ChangeCase } from './docs/changeCase';
import { DocChangeCase } from './docs/DocChangeCase';
import { DocEquation } from './docs/DocEquation';
import { DocListMenu } from './docs/DocListMenu';
import { DocViewTools } from './docs/DocViewTools';
import { DocFootnotes } from './docs/DocFootnotes';
import { DocInsertExtras } from './docs/DocInsertExtras';
import { DocTrackChanges } from './docs/DocTrackChanges';
import { DocWordCount } from './docs/DocWordCount';
import { DocTemplates } from './docs/DocTemplates';
import {
  OfficeRibbon, RibbonTab, RibbonGroup, RibbonSeparator,
  RibbonButton, RibbonSelect, RibbonColorButton,
} from './ribbon';
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


const EMOJIS = ['😀', '😁', '😂', '😍', '🤔', '👍', '👎', '🙏', '🎉', '🚀', '🔥', '⭐', '✅', '❌', '⚠️', '💡', '📌', '📈', '📉', '💰', '🟢', '🟡', '🔴', '➡️'];
function EmojiBtn({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span className="relative">
      <button title="Emoji" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300"><Smile className="w-4 h-4" /></button>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span className="absolute left-0 mt-1 z-20 grid grid-cols-6 gap-0.5 p-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-xl w-56">
            {EMOJIS.map((e) => (
              <button key={e} onMouseDown={(ev) => ev.preventDefault()} onClick={() => { onPick(e); setOpen(false); }} className="text-lg p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">{e}</button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

/** Word-like rich text editor (TipTap + MIT extensions). */
export function DocEditor({ value, onChange, readOnly, author, onStats, fileActions }: { value: any; onChange: (json: any) => void; readOnly?: boolean; author?: string; onStats?: (s: { words: number; chars: number }) => void; fileActions?: React.ReactNode }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      DocImage.configure({ inline: false }),
      TextStyleKit.configure({ lineHeight: { types: ['heading', 'paragraph'] } } as any),
      TableKit.configure({ table: { resizable: true } }),
      Subscript,
      Superscript,
      CharacterCount.configure({}),
      CommentMark,
      PageBreak,
      PageMeta,
      Indent,
      NamedStyle,
      Toc,
      ListNumbering,
      TableCellAttrs,
      SearchHighlight,
      MathInline,
      MathBlock,
      MathCommands,
      FootnoteRef,
      FootnoteList,
      DropCap,
      Callout,
      ColumnBreak,
      Bookmark,
      CrossRef,
      InsertionMark,
      DeletionMark,
      TrackChanges.configure({ author: author ?? '' }),
      FocusLine,
      SignatureLine,
      Citation,
      Bibliography,
      ParagraphFormat,
      ChangeCase,
      DocShortcuts,
    ],
    content: value ?? '<p></p>',
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
      onStats?.({ words: editor.storage.characterCount.words(), chars: editor.storage.characterCount.characters() });
    },
  });

  useEffect(() => {
    if (editor && onStats) onStats({ words: editor.storage.characterCount.words(), chars: editor.storage.characterCount.characters() });
  }, [editor, onStats]);

  const [showFind, setShowFind] = React.useState(false);
  // Estado de la pestaña «Vista» (zoom, marcas de formato, modos) y de control de cambios.
  const [zoom, setZoom] = React.useState(1);
  const [showMarks, setShowMarks] = React.useState(false);
  const [focusMode, setFocusMode] = React.useState(false);
  const [readingMode, setReadingMode] = React.useState(false);
  const [showRuler, setShowRuler] = React.useState(false);
  const [spellcheck, setSpellcheck] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);
  // Copiar formato (format painter): guarda el formato capturado; se aplica a la
  // siguiente selección no vacía (al soltar el ratón en el editor).
  const [painter, setPainter] = React.useState<Record<string, any> | null>(null);
  const painterRef = React.useRef<Record<string, any> | null>(null);
  useEffect(() => { painterRef.current = painter; }, [painter]);

  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);

  // Revisión ortográfica nativa del navegador (conmutable desde «Vista»).
  useEffect(() => { if (editor) editor.view.dom.setAttribute('spellcheck', spellcheck ? 'true' : 'false'); }, [editor, spellcheck]);
  // Modo sugerencias (control de cambios): el texto escrito se marca como inserción.
  useEffect(() => { if (editor) (editor.commands as any).setSuggesting(suggesting); }, [editor, suggesting]);
  // El modo lectura desactiva la edición sin perder el contenido.
  useEffect(() => { if (editor) editor.setEditable(!readOnly && !readingMode); }, [editor, readOnly, readingMode]);
  // Modo enfoque: resalta la línea activa.
  useEffect(() => { if (editor) (editor.commands as any).setFocusLine(focusMode); }, [editor, focusMode]);

  // Ctrl/Cmd+F opens in-document find & replace (like Google Docs).
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); setShowFind(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  // Format painter: al soltar el ratón sobre el editor con formato capturado y
  // una selección, lo aplica y se desactiva.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onUp = () => {
      const p = painterRef.current;
      if (!p) return;
      const { from, to, empty } = editor.state.selection;
      if (empty) return;
      let ch: any = editor.chain().focus().setTextSelection({ from, to })
        .unsetBold().unsetItalic().unsetStrike();
      ch = ch.unsetUnderline().unsetHighlight().unsetColor().unsetFontFamily().unsetFontSize();
      if (p.bold) ch = ch.setBold();
      if (p.italic) ch = ch.setItalic();
      if (p.underline) ch = ch.setUnderline();
      if (p.strike) ch = ch.setStrike();
      if (p.color) ch = ch.setColor(p.color);
      if (p.fontFamily) ch = ch.setFontFamily(p.fontFamily);
      if (p.fontSize) ch = ch.setFontSize(p.fontSize);
      if (p.highlight) ch = ch.setHighlight({ color: p.highlight });
      ch.run();
      setPainter(null);
    };
    dom.addEventListener('mouseup', onUp);
    return () => dom.removeEventListener('mouseup', onUp);
  }, [editor]);

  if (!editor) return <div className="h-full" />;

  const c = () => editor.chain().focus();
  const addLink = () => { const url = window.prompt('URL del enlace'); if (url) c().extendMarkRange('link').setLink({ href: url }).run(); };
  const toggleLink = () => { if (editor.isActive('link')) c().extendMarkRange('link').unsetLink().run(); else addLink(); };

  const ts = editor.getAttributes('textStyle');
  const curFont = ts.fontFamily ?? '';
  const curColor = ts.color ?? '';
  const curHighlight = editor.getAttributes('highlight').color ?? '';
  const curSize = String(ts.fontSize ?? '').replace('px', '');
  const curLH = String(editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight ?? '');
  const curHeadingLevel = ([1, 2, 3, 4, 5, 6] as const).find((l) => editor.isActive('heading', { level: l }));
  const curStyle = curHeadingLevel ? `h${curHeadingLevel}` : 'p';

  const setStyle = (v: string) => {
    if (v === 'p') c().setParagraph().run();
    else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  };
  const setFont = (v: string) => (v ? (c() as any).setFontFamily(v).run() : (c() as any).unsetFontFamily().run());
  const setSize = (v: string) => (v ? (c() as any).setFontSize(`${v}px`).run() : (c() as any).unsetFontSize().run());
  const setLH = (v: string) => (v ? (c() as any).setLineHeight(v).run() : (c() as any).unsetLineHeight().run());

  // Copiar formato: captura el formato de la selección actual (o lo desactiva).
  const captureFormat = () => {
    if (painter) { setPainter(null); return; }
    const a = editor.getAttributes('textStyle');
    setPainter({
      color: a.color ?? null, fontFamily: a.fontFamily ?? null, fontSize: a.fontSize ?? null,
      bold: editor.isActive('bold'), italic: editor.isActive('italic'),
      underline: editor.isActive('underline'), strike: editor.isActive('strike'),
      highlight: editor.getAttributes('highlight').color ?? null,
    });
  };
  // Sangría: en listas promueve/degrada el nivel (multinivel); fuera, margen.
  const indentMore = () => {
    if (editor.isActive('listItem')) c().sinkListItem('listItem').run();
    else if (editor.isActive('taskItem')) (c() as any).sinkListItem('taskItem').run();
    else (c() as any).indentMore().run();
  };
  const indentLess = () => {
    if (editor.isActive('listItem')) c().liftListItem('listItem').run();
    else if (editor.isActive('taskItem')) (c() as any).liftListItem('taskItem').run();
    else (c() as any).indentLess().run();
  };

  // Diseño de página (pageMeta) → dimensiones/relleno/columnas/marca de agua.
  const meta: any = editor.state.doc.attrs || {};
  const pgOrient = meta.pageOrientation || 'portrait';
  const pgSize = meta.pageSize || 'a4';
  const pgMargin = meta.pageMargin || 'normal';
  const pgColumns = Number(meta.pageColumns || 1);
  const pgWatermark = meta.pageWatermark || '';
  const pgBorder = meta.pageBorder || '';
  const pgLineNumbers = !!meta.pageLineNumbers;
  const pgHeader = meta.pageHeader || '';
  const pgFooter = meta.pageFooter || '';
  const pgNumbers = !!meta.pageNumbers;
  const DIM: Record<string, [number, number]> = { a4: [794, 1123], letter: [816, 1056], legal: [816, 1344] };
  const [dimW, dimH] = DIM[pgSize] || DIM.a4;
  const pageW = pgOrient === 'landscape' ? dimH : dimW;
  const pageMinH = pgOrient === 'landscape' ? dimW : dimH;
  const pagePad = pgMargin === 'narrow' ? 36 : pgMargin === 'wide' ? 104 : 64;

  const styleOptions = [
    { label: 'Normal', value: 'p' },
    { label: 'Título 1', value: 'h1' },
    { label: 'Título 2', value: 'h2' },
    { label: 'Título 3', value: 'h3' },
    { label: 'Título 4', value: 'h4' },
    { label: 'Título 5', value: 'h5' },
    { label: 'Título 6', value: 'h6' },
  ];
  const fontOptions = FONTS.map((f) => ({ label: f.label, value: f.value, style: (f.value ? { fontFamily: f.value } : undefined) as React.CSSProperties | undefined }));
  const sizeOptions = [{ label: '--', value: '' }, ...SIZES.map((s) => ({ label: s, value: s }))];
  const lhOptions = LINE_HEIGHTS.map((l) => ({ label: l.label, value: l.value }));
  const imgAlign = editor.getAttributes('image').align;
  const imgWidth = editor.getAttributes('image').width;

  return (
    <div className="flex flex-col h-full">
      <OfficeRibbon storageKey="ribbon:doc">
          {fileActions != null && (
            <RibbonTab id="file" label="Archivo" icon={FileText}>
              <RibbonGroup label="Documento">{fileActions}</RibbonGroup>
            </RibbonTab>
          )}

          {!readOnly && (
          <RibbonTab id="home" label="Inicio">
            <RibbonGroup label="Deshacer">
              <RibbonButton icon={Undo} label="Deshacer" shortcut="Ctrl+Z" onClick={() => c().undo().run()} />
              <RibbonButton icon={Redo} label="Rehacer" shortcut="Ctrl+Y" onClick={() => c().redo().run()} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Portapapeles">
              <RibbonButton icon={PaintRoller} label="Copiar formato" active={!!painter} onClick={captureFormat} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Estilos">
              <DocStyleGallery editor={editor} />
              <RibbonSelect title="Estilo de párrafo" value={curStyle} onChange={setStyle} width={116} options={styleOptions} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Fuente">
              <RibbonSelect title="Fuente" value={curFont} onChange={setFont} width={132} options={fontOptions} />
              <RibbonSelect title="Tamaño de fuente" value={curSize} onChange={setSize} width={58} options={sizeOptions} />
              <RibbonButton icon={Bold} label="Negrita" shortcut="Ctrl+B" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()} />
              <RibbonButton icon={Italic} label="Cursiva" shortcut="Ctrl+I" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()} />
              <RibbonButton icon={Underline} label="Subrayado" shortcut="Ctrl+U" active={editor.isActive('underline')} onClick={() => (c() as any).toggleUnderline().run()} />
              <RibbonButton icon={Strikethrough} label="Tachado" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()} />
              <RibbonColorButton icon={Baseline} title="Color de texto" value={curColor} onChange={(col) => (c() as any).setColor(col).run()} onClear={() => (c() as any).unsetColor().run()} clearLabel="Automático" />
              <RibbonColorButton icon={Highlighter} title="Color de resaltado" value={curHighlight} onChange={(col) => (c() as any).setHighlight({ color: col }).run()} onClear={() => (c() as any).unsetHighlight().run()} clearLabel="Sin resaltado" />
              <RibbonButton icon={SubIcon} label="Subíndice" active={editor.isActive('subscript')} onClick={() => (c() as any).toggleSubscript().run()} />
              <RibbonButton icon={SupIcon} label="Superíndice" active={editor.isActive('superscript')} onClick={() => (c() as any).toggleSuperscript().run()} />
              <RibbonButton icon={RemoveFormatting} label="Limpiar formato" onClick={() => c().unsetAllMarks().clearNodes().run()} />
              <DocChangeCase editor={editor} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Párrafo">
              <RibbonButton icon={List} label="Viñetas" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()} />
              <RibbonButton icon={ListOrdered} label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()} />
              <RibbonButton icon={ListChecks} label="Lista de tareas" active={editor.isActive('taskList')} onClick={() => (c() as any).toggleTaskList().run()} />
              <DocListMenu editor={editor} />
              <RibbonButton icon={Quote} label="Cita" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()} />
              <RibbonButton icon={AlignLeft} label="Alinear a la izquierda" active={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()} />
              <RibbonButton icon={AlignCenter} label="Centrar" active={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()} />
              <RibbonButton icon={AlignRight} label="Alinear a la derecha" active={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()} />
              <RibbonButton icon={AlignJustify} label="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => c().setTextAlign('justify').run()} />
              <RibbonButton icon={IndentDecrease} label="Disminuir sangría" onClick={indentLess} />
              <RibbonButton icon={IndentIncrease} label="Aumentar sangría" onClick={indentMore} />
              <RibbonSelect title="Interlineado" value={curLH} onChange={setLH} width={92} options={lhOptions} />
              <DocParagraphMenu editor={editor} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Edición">
              <RibbonButton icon={Search} label="Buscar y reemplazar" shortcut="Ctrl+F" onClick={() => setShowFind(true)} />
            </RibbonGroup>
          </RibbonTab>
          )}

          {!readOnly && (
          <RibbonTab id="insert" label="Insertar">
            <RibbonGroup label="Plantillas">
              <DocTemplates editor={editor} notifyChange={() => onChange(editor.getJSON())} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Tablas">
              <DocTableInsert editor={editor} />
              {editor.isActive('table') && <DocTableMenu editor={editor} />}
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Ilustraciones">
              <DocImageInsert editor={editor} />
              {editor.isActive('image') && (
                <>
                  <RibbonButton icon={AlignLeft} label="Imagen a la izquierda" active={imgAlign === 'left'} onClick={() => (c() as any).updateAttributes('image', { align: 'left' }).run()} />
                  <RibbonButton icon={AlignCenter} label="Imagen centrada" active={imgAlign === 'center'} onClick={() => (c() as any).updateAttributes('image', { align: 'center' }).run()} />
                  <RibbonButton icon={AlignRight} label="Imagen a la derecha" active={imgAlign === 'right'} onClick={() => (c() as any).updateAttributes('image', { align: 'right' }).run()} />
                  {['25%', '50%', '75%', '100%'].map((w) => (
                    <RibbonButton key={w} label={w} hideLabel={false} active={imgWidth === w} onClick={() => (c() as any).updateAttributes('image', { width: w }).run()} />
                  ))}
                  <RibbonButton icon={Accessibility} label="Texto alternativo" onClick={() => {
                    const cur = editor.getAttributes('image').alt || '';
                    const v = window.prompt('Texto alternativo (accesibilidad)', cur);
                    if (v !== null) (c() as any).updateAttributes('image', { alt: v }).run();
                  }} />
                </>
              )}
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Vínculos">
              <RibbonButton icon={Link2} label={editor.isActive('link') ? 'Quitar enlace' : 'Enlace'} active={editor.isActive('link')} onClick={toggleLink} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Símbolos">
              <RibbonButton icon={Calendar} label="Insertar fecha" onClick={() => c().insertContent(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })).run()} />
              <EmojiBtn onPick={(e) => c().insertContent(e).run()} />
              <DocSymbolPicker editor={editor} />
              <RibbonButton icon={Minus} label="Separador" onClick={() => c().setHorizontalRule().run()} />
              <RibbonButton icon={SeparatorHorizontal} label="Salto de página" onClick={() => (c() as any).setPageBreak().run()} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Ecuaciones">
              <DocEquation editor={editor} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Código">
              <RibbonButton icon={Code2} label="Código en línea" active={editor.isActive('code')} onClick={() => (c() as any).toggleCode().run()} />
              <RibbonButton icon={Code} label="Bloque de código" active={editor.isActive('codeBlock')} onClick={() => c().toggleCodeBlock().run()} />
            </RibbonGroup>
            <RibbonSeparator />
            <DocInsertExtras editor={editor} />
          </RibbonTab>
          )}

          {!readOnly && (
          <RibbonTab id="layout" label="Disposición">
            <DocPageSetup editor={editor} />
            <RibbonSeparator />
            <DocHeaderFooter editor={editor} />
          </RibbonTab>
          )}

          {!readOnly && (
          <RibbonTab id="references" label="Referencias">
            <RibbonGroup label="Tabla de contenido">
              <RibbonButton icon={ListTree} label="Insertar tabla de contenido" hideLabel={false} onClick={() => (c() as any).insertToc().run()} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Notas al pie">
              <DocFootnotes editor={editor} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Citas y bibliografía">
              <DocCitations editor={editor} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Navegación">
              <DocOutline editor={editor} />
            </RibbonGroup>
          </RibbonTab>
          )}

          {!readOnly && (
          <RibbonTab id="review" label="Revisar">
            <RibbonGroup label="Revisión">
              <DocWordCount editor={editor} />
            </RibbonGroup>
            <RibbonSeparator />
            <RibbonGroup label="Comentarios">
              <DocComments editor={editor} author={author ?? ''} />
            </RibbonGroup>
            <RibbonSeparator />
            <DocTrackChanges editor={editor} suggesting={suggesting} setSuggesting={setSuggesting} />
            <RibbonSeparator />
            <RibbonGroup label="Edición">
              <RibbonButton icon={Search} label="Buscar y reemplazar" shortcut="Ctrl+F" onClick={() => setShowFind(true)} />
            </RibbonGroup>
          </RibbonTab>
          )}

          <RibbonTab id="view" label="Vista">
            <DocViewTools
              showMarks={showMarks} setShowMarks={setShowMarks}
              focusMode={focusMode} setFocusMode={setFocusMode}
              readingMode={readingMode} setReadingMode={setReadingMode}
              showRuler={showRuler} setShowRuler={setShowRuler}
              zoom={zoom} setZoom={setZoom}
              spellcheck={spellcheck} setSpellcheck={setSpellcheck}
            />
            <RibbonSeparator />
            <RibbonGroup label="Documento">
              <DocOutline editor={editor} />
              <DocPageView editor={editor} />
            </RibbonGroup>
          </RibbonTab>
      </OfficeRibbon>

      {showFind && !readOnly && <DocFindReplace editor={editor} onClose={() => setShowFind(false)} />}

      <div className={`tiptap-page flex-1 min-h-0 overflow-auto bg-gray-100 dark:bg-[#0b0b0b] py-8 px-3 ${readingMode ? 'doc-reading-bg' : ''}`}>
        {showRuler && !readingMode && (
          <div className="doc-ruler mx-auto mb-2" style={{ width: pageW, maxWidth: '100%' }} aria-hidden>
            <div className="doc-ruler-margins" style={{ left: pagePad, right: pagePad }} />
          </div>
        )}
        <div
          className={`mx-auto bg-white dark:bg-[#1a1a1a] shadow-xl rounded-sm w-full text-black dark:text-gray-100 relative overflow-hidden ${pgColumns === 2 ? 'doc-cols-2' : pgColumns === 3 ? 'doc-cols-3' : ''} ${showMarks ? 'doc-show-marks' : ''} ${focusMode ? 'doc-focus' : ''} ${readingMode ? 'doc-reading' : ''} ${pgBorder ? `doc-border-${pgBorder}` : ''} ${pgLineNumbers ? 'doc-line-numbers' : ''}`}
          style={{ width: readingMode ? 760 : pageW, maxWidth: '100%', minHeight: readingMode ? undefined : pageMinH, padding: readingMode ? 56 : pagePad, zoom }}
        >
          {pgWatermark && <div className="doc-watermark" aria-hidden>{pgWatermark}</div>}
          {!readingMode && pgHeader && <div className="doc-page-header" aria-hidden style={{ left: pagePad, right: pagePad }}>{pgHeader}</div>}
          <div className="relative z-[1]">
            <EditorContent editor={editor} />
          </div>
          {!readingMode && (pgFooter || pgNumbers) && (
            <div className="doc-page-footer" aria-hidden style={{ left: pagePad, right: pagePad }}>
              <span className="truncate">{pgFooter}</span>
              {pgNumbers && <span className="doc-page-num">Página 1</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
