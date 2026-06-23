/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de la serialización Tiptap → Markdown. npx tsx src/components/office/docs/markdown.spec.ts */
import { tiptapJsonToMarkdown } from '@/lib/office/markdown';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m}\n     esp ${JSON.stringify(b)}\n     obt ${JSON.stringify(a)}`); };
const doc = (...content: any[]) => ({ type: 'doc', content });
const p = (...content: any[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: any[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const li = (...content: any[]) => ({ type: 'listItem', content });

// Encabezados.
eq(tiptapJsonToMarkdown(doc({ type: 'heading', attrs: { level: 1 }, content: [t('Título')] })), '# Título\n', 'heading 1');
eq(tiptapJsonToMarkdown(doc({ type: 'heading', attrs: { level: 3 }, content: [t('Sub')] })), '### Sub\n', 'heading 3');

// Énfasis y enlaces.
eq(tiptapJsonToMarkdown(doc(p(t('a'), t('b', [{ type: 'bold' }])))), 'a**b**\n', 'negrita');
eq(tiptapJsonToMarkdown(doc(p(t('x', [{ type: 'italic' }])))), '*x*\n', 'cursiva');
eq(tiptapJsonToMarkdown(doc(p(t('x', [{ type: 'strike' }])))), '~~x~~\n', 'tachado');
eq(tiptapJsonToMarkdown(doc(p(t('c', [{ type: 'code' }])))), '`c`\n', 'código en línea');
eq(tiptapJsonToMarkdown(doc(p(t('link', [{ type: 'link', attrs: { href: 'http://e.com' } }])))), '[link](http://e.com)\n', 'enlace');
// Marca sin equivalente (subrayado) → conserva el texto.
eq(tiptapJsonToMarkdown(doc(p(t('u', [{ type: 'underline' }])))), 'u\n', 'subrayado degrada a texto');

// Escapado de caracteres especiales.
eq(tiptapJsonToMarkdown(doc(p(t('a*b_c`d[e]')))), 'a\\*b\\_c\\`d\\[e\\]\n', 'escapa * _ ` [ ]');

// Salto de línea forzado.
eq(tiptapJsonToMarkdown(doc(p(t('a'), { type: 'hardBreak' }, t('b')))), 'a  \nb\n', 'hardBreak');

// Listas con viñetas (anidadas).
eq(tiptapJsonToMarkdown(doc({ type: 'bulletList', content: [li(p(t('one'))), li(p(t('two')))] })), '- one\n- two\n', 'lista viñetas');
eq(
  tiptapJsonToMarkdown(doc({ type: 'bulletList', content: [li(p(t('one')), { type: 'bulletList', content: [li(p(t('sub')))] })] })),
  '- one\n  - sub\n', 'lista anidada',
);

// Lista ordenada con inicio.
eq(tiptapJsonToMarkdown(doc({ type: 'orderedList', attrs: { start: 3 }, content: [li(p(t('a'))), li(p(t('b')))] })), '3. a\n4. b\n', 'ordenada start=3');

// Lista de tareas.
eq(
  tiptapJsonToMarkdown(doc({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('done'))] }, { type: 'taskItem', attrs: { checked: false }, content: [p(t('todo'))] }] })),
  '- [x] done\n- [ ] todo\n', 'lista de tareas',
);

// Cita.
eq(tiptapJsonToMarkdown(doc({ type: 'blockquote', content: [p(t('quote'))] })), '> quote\n', 'cita');

// Bloque de código con lenguaje.
eq(tiptapJsonToMarkdown(doc({ type: 'codeBlock', attrs: { language: 'js' }, content: [t('const x=1;\nconst y=2;')] })), '```js\nconst x=1;\nconst y=2;\n```\n', 'bloque de código');

// Regla horizontal e imagen.
eq(tiptapJsonToMarkdown(doc({ type: 'horizontalRule' })), '---\n', 'regla horizontal');
eq(tiptapJsonToMarkdown(doc({ type: 'image', attrs: { src: 'a.png', alt: 'pic' } })), '![pic](a.png)\n', 'imagen de bloque');

// Tabla GFM.
{
  const th = (s: string) => ({ type: 'tableHeader', content: [p(t(s))] });
  const td = (s: string) => ({ type: 'tableCell', content: [p(t(s))] });
  const table = { type: 'table', content: [
    { type: 'tableRow', content: [th('H1'), th('H2')] },
    { type: 'tableRow', content: [td('a'), td('b')] },
  ] };
  eq(tiptapJsonToMarkdown(doc(table)), '| H1 | H2 |\n| --- | --- |\n| a | b |\n', 'tabla GFM');
}

// Varios bloques: una línea en blanco entre ellos, sin blancos triples.
eq(tiptapJsonToMarkdown(doc(p(t('uno')), p(t('dos')))), 'uno\n\ndos\n', 'dos párrafos separados por blanco');

// Documento vacío.
eq(tiptapJsonToMarkdown(doc()), '\n', 'documento vacío → solo salto final');

// Notas al pie: ref numerada en línea + bloque de definiciones al final.
const fn = (content: string) => ({ type: 'footnoteRef', attrs: { content } });
eq(tiptapJsonToMarkdown(doc(p(t('Texto'), fn('una nota')))), 'Texto[^1]\n\n[^1]: una nota\n', 'nota al pie única');
eq(
  tiptapJsonToMarkdown(doc(p(t('A'), fn('uno')), p(t('B'), fn('dos')))),
  'A[^1]\n\nB[^2]\n\n[^1]: uno\n[^2]: dos\n', 'dos notas numeradas en orden',
);

console.log(`\nMARKDOWN SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de Markdown pasan.');
