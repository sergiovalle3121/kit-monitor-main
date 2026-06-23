/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Round-trip .docx (export → import) verificado de extremo a extremo, sin navegador:
 *   cd apps/web && npx tsx src/lib/office/docxRoundtrip.spec.ts
 *
 * `buildDocx` (TipTap JSON → Document) e `importDocxBuffer` (mammoth → HTML) corren ambos en
 * Node, así que empaquetamos un .docx real y lo re-importamos: comprobamos que títulos,
 * negrita/cursiva, listas, tabla e IMAGEN sobreviven al viaje completo.
 */
import * as docx from 'docx';
import { buildDocx, importDocxBuffer } from './docx';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const json = {
  type: 'doc', attrs: {},
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Título principal' }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subsección' }] },
    { type: 'paragraph', content: [
      { type: 'text', marks: [{ type: 'bold' }], text: 'Negrita' },
      { type: 'text', text: ' y ' },
      { type: 'text', marks: [{ type: 'italic' }], text: 'cursiva' },
    ] },
    { type: 'bulletList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Uno' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dos' }] }] },
    ] },
    { type: 'orderedList', content: [
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Primero' }] }] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] }] },
    ] },
    { type: 'image', attrs: { src: `data:image/png;base64,${PNG_1x1}`, width: '50%' } },
    { type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Columna A' }] }] },
        { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Columna B' }] }] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'celda-a' }] }] },
        { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'celda-b' }] }] },
      ] },
    ] },
  ],
};

(async () => {
  const doc = buildDocx(docx as any, json, 'RoundTrip');
  const buf: any = await (docx as any).Packer.toBuffer(doc);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const html = await importDocxBuffer(ab);

  ok(/<h1>[^<]*Título principal/.test(html), 'el título (h1) sobrevive');
  ok(/<h2>[^<]*Subsección/.test(html), 'el subtítulo (h2) sobrevive');
  ok(/<strong>\s*Negrita\s*<\/strong>/.test(html), 'la negrita sobrevive');
  ok(/<em>\s*cursiva\s*<\/em>/.test(html), 'la cursiva sobrevive');
  // El texto de los ítems se conserva (la estructura ul/ol del export se verifica en docx.spec
  // vía <w:numPr>; mammoth aplana la numeración de la librería `docx`, no es pérdida de contenido).
  ok(/Uno[\s\S]*Dos/.test(html), 'el texto de las viñetas se conserva');
  ok(/Primero[\s\S]*Segundo/.test(html), 'el texto de la lista numerada se conserva');
  ok(/<table>[\s\S]*Columna A[\s\S]*Columna B[\s\S]*celda-a[\s\S]*celda-b[\s\S]*<\/table>/.test(html), 'la tabla y sus celdas sobreviven');
  ok(/<img[^>]+src="data:image\/png;base64,/.test(html), 'la imagen embebida sobrevive (data URL) — valida el export de imágenes');

  const total = passed + fails.length;
  if (fails.length) {
    console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n'));
    console.error('\n--- HTML importado (primeros 600) ---\n' + html.slice(0, 600));
    process.exit(1);
  } else console.log(`\n✅ docx round-trip: ${passed}/${total} aserciones verdes.`);
})().catch((e) => { console.error(e); process.exit(1); });
