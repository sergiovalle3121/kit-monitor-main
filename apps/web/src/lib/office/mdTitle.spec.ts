/* eslint-disable @typescript-eslint/no-explicit-any */
/** Títulos de enlace/imagen en Markdown (roundtrip). npx tsx src/lib/office/mdTitle.spec.ts */
import { tiptapJsonToMarkdown, markdownToHtml } from './markdown';
let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const para = (content: any[]) => ({ type: 'paragraph', content });
const img = (attrs: any) => ({ type: 'image', attrs });
const linkText = (text: string, attrs: any) => ({ type: 'text', text, marks: [{ type: 'link', attrs }] });

// EXPORT: imagen y enlace con título emiten ` "título"`.
const doc: any = { type: 'doc', content: [
  para([{ type: 'text', text: 'ir ' }, linkText('aquí', { href: 'https://x.com', title: 'Sitio X' })]),
  para([img({ src: 'a.png', alt: 'A', title: 'Foto' })]),
] };
const md = tiptapJsonToMarkdown(doc);
ok(md.includes('[aquí](https://x.com "Sitio X")'), 'enlace con título');
ok(md.includes('![A](a.png "Foto")'), 'imagen con título');

// Sin título: sin sufijo (sin regresión).
const doc2: any = { type: 'doc', content: [para([img({ src: 'b.png', alt: 'B' })])] };
ok(tiptapJsonToMarkdown(doc2).includes('![B](b.png)'), 'imagen sin título sin sufijo');

// ROUNDTRIP: import del export conserva el título en el HTML.
const html = markdownToHtml('[aquí](https://x.com "Sitio X") y ![A](a.png "Foto")');
ok(/title="Sitio X"/.test(html), 'import conserva título de enlace');
ok(/title="Foto"/.test(html), 'import conserva título de imagen');

// Comillas en el título se escapan.
const doc3: any = { type: 'doc', content: [para([img({ src: 'c.png', alt: 'C', title: 'di "hola"' })])] };
const md3 = tiptapJsonToMarkdown(doc3);
ok(md3.includes('![C](c.png "di \\"hola\\"")'), 'comillas escapadas en el título');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
