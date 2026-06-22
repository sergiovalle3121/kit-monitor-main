/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de la fidelidad del export .docx (imágenes + tablas + interlineado):
 *   cd apps/web && npx tsx src/lib/office/docx.spec.ts
 *
 * `buildDocx` es PURA (recibe el módulo `docx`), así que aquí la empaquetamos a un Buffer real
 * con `Packer.toBuffer`, descomprimimos el .docx (es un .zip) con JSZip e inspeccionamos el
 * `word/document.xml` y `word/media/` — la prueba de que la imagen/sombreado/interlineado SÍ
 * viajan al archivo de Word.
 */
import * as docx from 'docx';
import JSZip from 'jszip';
import { buildDocx, parseDataUrl, imageSize, targetWidth, base64ToBytes } from './docx';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// PNG 1×1 (rojo) — para comprobar decodificación + lectura de dimensiones + embebido.
const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const DATA = `data:image/png;base64,${PNG_1x1}`;

// ── Helpers puros ─────────────────────────────────────────────────────────────
const parsed = parseDataUrl(DATA);
ok(!!parsed && parsed.type === 'png', 'parseDataUrl reconoce png');
eq(imageSize(parsed!.bytes, 'png'), { w: 1, h: 1 }, 'imageSize lee PNG 1×1');
eq(targetWidth('300px', 1000), 300, 'targetWidth desde px');
eq(targetWidth('50%', 1000), 300, 'targetWidth 50% = 300 (de 600 útiles)');
eq(targetWidth(undefined, 200), 200, 'targetWidth cae al natural');
ok(base64ToBytes(PNG_1x1).byteLength > 60, 'base64ToBytes decodifica');
ok(parseDataUrl('https://x/y.png') === null, 'parseDataUrl ignora URLs no-data');

// ── Documento de prueba: interlineado + imagen + tabla con sombreado/encabezado ──
const json = {
  type: 'doc', attrs: { pageSize: 'a4' },
  content: [
    { type: 'toc' },
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Capítulo uno' }] },
    { type: 'paragraph', attrs: { lineHeight: '1.5' }, content: [{ type: 'text', text: 'Hola mundo' }] },
    { type: 'image', attrs: { src: DATA, width: '50%', align: 'center' } },
    { type: 'table', content: [
      { type: 'tableRow', content: [
        { type: 'tableHeader', attrs: { backgroundColor: '#FF0000' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cabecera' }] }] },
      ] },
      { type: 'tableRow', content: [
        { type: 'tableCell', attrs: { backgroundColor: '#00FF00' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Celda' }] }] },
      ] },
    ] },
    { type: 'orderedList', content: [
      { type: 'listItem', content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Primero' }] },
        { type: 'orderedList', content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Anidado' }] }] },
        ] },
      ] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Segundo' }] }] },
    ] },
    { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Una cita célebre.' }] }] },
    { type: 'callout', attrs: { tone: 'info' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Aviso importante.' }] }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Texto ' },
      { type: 'text', marks: [{ type: 'insertion', attrs: { author: 'Ana', date: 1700000000000 } }], text: 'añadido' },
      { type: 'text', text: ' y ' },
      { type: 'text', marks: [{ type: 'deletion', attrs: { author: 'Luis', date: 1700000000000 } }], text: 'borrado' },
    ] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Frase con ' },
      { type: 'text', marks: [{ type: 'comment', attrs: { commentId: 'c1', author: 'Marta', text: 'Revisar esto', createdAt: 1700000000000, replies: [{ author: 'Ana', text: 'De acuerdo' }] } }], text: 'parte comentada' },
      { type: 'text', text: ' final.' },
    ] },
  ],
};

(async () => {
  const doc = buildDocx(docx as any, json, 'Prueba');
  const buf: any = await (docx as any).Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')!.async('string');
  const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'));

  ok(media.length >= 1, 'la imagen se embebe en word/media/ (antes se perdía)');
  ok(/<w:drawing>/.test(xml), 'la imagen genera un <w:drawing> en el cuerpo');
  ok(/<w:shd[^>]*w:fill="FF0000"/i.test(xml), 'sombreado de cabecera rojo (#FF0000)');
  ok(/<w:shd[^>]*w:fill="00FF00"/i.test(xml), 'sombreado de celda verde (#00FF00)');
  ok(/w:line="360"/.test(xml), 'interlineado 1.5 → w:line="360"');
  ok(/<w:tbl>/.test(xml), 'la tabla se exporta');
  ok(/<w:tblBorders>/.test(xml), 'la tabla lleva bordes');
  ok(/<w:b\/>/.test(xml), 'la cabecera de tabla sale en negrita');
  ok(/Hola mundo/.test(xml), 'el texto del párrafo está presente');

  // Numeración NATIVA de Word (antes salía como texto literal "1. ").
  ok(!!zip.file('word/numbering.xml'), 'se genera word/numbering.xml');
  ok(/<w:numPr>/.test(xml), 'los párrafos de lista llevan <w:numPr> (numeración real)');
  ok(/<w:numId\b/.test(xml) && /<w:ilvl\b/.test(xml), 'numId + nivel de lista presentes');
  ok(/Primero/.test(xml) && /Anidado/.test(xml) && /Segundo/.test(xml), 'los ítems de la lista están');
  ok(!/<w:t[^>]*>\s*1\.\s/.test(xml), 'no hay prefijo "1." como texto (lo pone Word)');

  // Cita con borde izquierdo y llamada con recuadro de color (antes se aplanaban).
  ok(/<w:pBdr>/.test(xml), 'la cita/llamada lleva borde de párrafo (<w:pBdr>)');
  ok(/<w:shd[^>]*w:fill="EFF6FF"/i.test(xml), 'la llamada «info» lleva su sombreado (#EFF6FF)');
  ok(/Una cita célebre/.test(xml) && /Aviso importante/.test(xml), 'el texto de cita y llamada está');

  // Control de cambios → revisiones REALES de Word (antes salían como texto coloreado).
  ok(/<w:ins\b[^>]*w:author="Ana"/.test(xml), 'la inserción es una revisión <w:ins> de Ana');
  ok(/<w:del\b[^>]*w:author="Luis"/.test(xml), 'la eliminación es una revisión <w:del> de Luis');
  ok(/<w:delText/.test(xml), 'el texto borrado usa <w:delText>');

  // Comentarios → comentarios REALES de Word (word/comments.xml + rango en el cuerpo).
  ok(!!zip.file('word/comments.xml'), 'se genera word/comments.xml');
  ok(/<w:commentRangeStart/.test(xml) && /<w:commentRangeEnd/.test(xml), 'el cuerpo marca el rango del comentario');
  ok(/<w:commentReference/.test(xml), 'el cuerpo lleva la referencia del comentario');
  const commentsXml = await zip.file('word/comments.xml')!.async('string');
  ok(/w:author="Marta"/.test(commentsXml) && /Revisar esto/.test(commentsXml), 'el comentario es de Marta con su texto');
  ok(/De acuerdo/.test(commentsXml), 'la respuesta del hilo se incluye');

  // Tabla de contenido → campo TOC REAL de Word (páginas + clicable), no texto estático.
  ok(/<w:instrText[^>]*>\s*TOC\b/.test(xml) || /\bTOC \\o/.test(xml), 'la TOC es un campo TOC real de Word');

  const total = passed + fails.length;
  if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
  else console.log(`\n✅ docx export: ${passed}/${total} aserciones verdes.`);
})().catch((e) => { console.error(e); process.exit(1); });
