/* eslint-disable @typescript-eslint/no-explicit-any */
/** Spec de Markdown → HTML (importación). npx tsx src/components/office/docs/markdownImport.spec.ts */
import { markdownToHtml, tiptapJsonToMarkdown } from '@/lib/office/markdown';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (a === b) passed++; else fails.push(`${m}\n     esp ${JSON.stringify(b)}\n     obt ${JSON.stringify(a)}`); };
const has = (a: string, sub: string, m: string) => { if (a.includes(sub)) passed++; else fails.push(`${m} — no contiene ${JSON.stringify(sub)} en ${JSON.stringify(a)}`); };

// Bloques básicos.
eq(markdownToHtml('# Título'), '<h1>Título</h1>', 'h1');
eq(markdownToHtml('### Sub'), '<h3>Sub</h3>', 'h3');
eq(markdownToHtml('hola mundo'), '<p>hola mundo</p>', 'párrafo');
eq(markdownToHtml('---'), '<hr>', 'regla horizontal');

// En línea (en contexto, para no filtrar espacios de los marcadores).
eq(markdownToHtml('a **b** c'), '<p>a <strong>b</strong> c</p>', 'negrita');
eq(markdownToHtml('an *i* word'), '<p>an <em>i</em> word</p>', 'cursiva');
eq(markdownToHtml('x ~~y~~ z'), '<p>x <s>y</s> z</p>', 'tachado');
eq(markdownToHtml('a `code` b'), '<p>a <code>code</code> b</p>', 'código en línea');
eq(markdownToHtml('see [t](http://u) now'), '<p>see <a href="http://u">t</a> now</p>', 'enlace');
eq(markdownToHtml('pre ![alt](x.png) post'), '<p>pre <img src="x.png" alt="alt"> post</p>', 'imagen');

// Escapado de HTML y de Markdown.
eq(markdownToHtml('a < b & c'), '<p>a &lt; b &amp; c</p>', 'escapa < y &');
eq(markdownToHtml('a\\*b'), '<p>a*b</p>', 'asterisco escapado es literal');

// Listas.
eq(markdownToHtml('- one\n- two'), '<ul><li><p>one</p></li><li><p>two</p></li></ul>', 'lista viñetas');
eq(markdownToHtml('1. a\n2. b'), '<ol><li><p>a</p></li><li><p>b</p></li></ol>', 'lista ordenada');
eq(
  markdownToHtml('- [x] done\n- [ ] todo'),
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li><li data-type="taskItem" data-checked="false"><p>todo</p></li></ul>',
  'lista de tareas',
);
eq(markdownToHtml('- one\n  - sub'), '<ul><li><p>one</p><ul><li><p>sub</p></li></ul></li></ul>', 'lista anidada');

// Cita y bloque de código.
eq(markdownToHtml('> quote'), '<blockquote><p>quote</p></blockquote>', 'cita');
eq(markdownToHtml('```js\nconst x=1;\n```'), '<pre><code class="language-js">const x=1;</code></pre>', 'bloque de código con lenguaje');
eq(markdownToHtml('```\nplano\n```'), '<pre><code>plano</code></pre>', 'bloque de código sin lenguaje');

// Tabla GFM.
eq(
  markdownToHtml('| H1 | H2 |\n| --- | --- |\n| a | b |'),
  '<table><thead><tr><th>H1</th><th>H2</th></tr></thead><tbody><tr><td>a</td><td>b</td></tr></tbody></table>',
  'tabla GFM',
);

// Dos párrafos separados por línea en blanco.
eq(markdownToHtml('uno\n\ndos'), '<p>uno</p><p>dos</p>', 'dos párrafos');

// Roundtrip: doc Tiptap → Markdown → HTML conserva la estructura clave.
{
  const docu = { type: 'doc', content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Informe' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Texto ' }, { type: 'text', text: 'fuerte', marks: [{ type: 'bold' }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'punto' }] }] }] },
  ] };
  const html = markdownToHtml(tiptapJsonToMarkdown(docu));
  has(html, '<h2>Informe</h2>', 'roundtrip conserva h2');
  has(html, '<strong>fuerte</strong>', 'roundtrip conserva negrita');
  has(html, '<ul><li><p>punto</p></li></ul>', 'roundtrip conserva lista');
}

console.log(`\nMARKDOWN IMPORT SPEC: ${passed} OK, ${fails.length} fallos`);
if (fails.length) { for (const f of fails) console.error('  ✗ ' + f); throw new Error(`${fails.length} fallos`); }
console.log('✓ Todas las aserciones de importación Markdown pasan.');
