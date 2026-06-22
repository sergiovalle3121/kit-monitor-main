/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría del export .pptx (PptxGenJS) — sin navegador:
 *   cd apps/web && npx tsx src/lib/office/pptx.spec.ts
 *
 * `pptxArrayBuffer` arma el .pptx en memoria; aquí lo descomprimimos (es un .zip) con JSZip e
 * inspeccionamos los XML de las diapositivas y las partes (media/charts/notas) para confirmar
 * que cada objeto del editor produce una FORMA/IMAGEN/TABLA/GRÁFICO NATIVO de PowerPoint
 * (editable), no una captura.
 */
import { pptxArrayBuffer } from './pptx';
import JSZip from 'jszip';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const slides = [
  { background: '#ffffff', objects: [
    { type: 'textbox', text: 'Título principal\n• Punto uno\n• Punto dos', left: 50, top: 40, width: 600, fontSize: 24, fontWeight: 'bold', fill: '#111827', link: { type: 'url', href: 'https://example.com' } },
    { type: 'path', shape: 'star5', left: 50, top: 220, width: 100, height: 100, fill: '#f59e0b' },
    { type: 'circle', left: 200, top: 220, radius: 50, fill: '#10b981' },
    { type: 'image', src: `data:image/png;base64,${PNG_1x1}`, left: 350, top: 220, width: 80, height: 80 },
    { tableSpec: { cells: [['Mes', 'Valor'], ['Ene', '10']], header: true, banded: true, accent: '#2563eb' }, left: 50, top: 360, width: 300, height: 100 },
    { chartSpec: { type: 'bar', labels: ['Q1', 'Q2'], series: [{ name: 'Ventas', data: [10, 20] }], title: 'Ventas' }, left: 420, top: 360, width: 320, height: 200 },
    { type: 'polyline', conn: { x1: 60, y1: 180, x2: 260, y2: 180, arrow: true }, stroke: '#64748b', strokeWidth: 2 },
  ] },
  { background: '#f0f0f0', objects: [
    { type: 'textbox', text: 'Segunda diapositiva', left: 50, top: 50, width: 500, fontSize: 20, fill: '#111827' },
  ] },
];
const notes = ['Estas son las notas del orador de la diapositiva uno.', ''];

(async () => {
  const buf = await pptxArrayBuffer(slides, notes, { ratio: '16:9', footer: 'AXOS Office', showNumbers: true });
  const zip = await JSZip.loadAsync(buf as any);
  const files = Object.keys(zip.files);
  const slideFiles = files.filter((f) => /ppt\/slides\/slide\d+\.xml$/.test(f)).sort();
  const xml1 = await zip.file(slideFiles[0])!.async('string');

  ok(slideFiles.length === 2, 'genera 2 diapositivas');
  ok(/Título principal/.test(xml1), 'el texto del título está');
  ok(/b="1"/.test(xml1), 'el título sale en negrita');
  ok(/<a:buChar/.test(xml1), 'las líneas con • salen como viñetas nativas (buChar)');
  ok(/<a:hlinkClick/.test(xml1), 'el hipervínculo del texto se exporta');
  // El enlace debe tener una relación REAL (antes salía r:id="rIdundefined", enlace roto).
  ok(!/r:id="rIdundefined"/.test(xml1), 'el hipervínculo tiene una relación r:id válida (no rota)');
  const rels1 = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
  ok(/example\.com/.test(rels1), 'la relación del hipervínculo apunta a la URL');
  ok(/prst="star5"/.test(xml1), 'la estrella sale como preset nativo star5');
  ok(/prst="ellipse"/.test(xml1), 'el círculo sale como elipse nativa');
  ok(/<a:tbl>/.test(xml1), 'la tabla sale como tabla NATIVA (a:tbl)');
  ok(/Mes/.test(xml1) && /Valor/.test(xml1), 'la tabla lleva sus encabezados');
  ok(/<p:graphicFrame>/.test(xml1), 'el gráfico sale como graphicFrame (objeto nativo)');
  ok(/AXOS Office/.test(xml1), 'el pie de página está');
  ok(/1 \/ 2/.test(xml1), 'la numeración de diapositiva está');

  // Partes embebidas: imagen, gráfico nativo y notas del orador.
  ok(files.some((f) => /ppt\/media\/image[-\d]+\.(png|jpe?g|gif)$/i.test(f)), 'la imagen se embebe en ppt/media/');
  ok(files.some((f) => /ppt\/charts\/chart\d+\.xml$/.test(f)), 'el gráfico genera una parte ppt/charts/');
  const chartXml = await zip.file(files.find((f) => /ppt\/charts\/chart\d+\.xml$/.test(f))!)!.async('string');
  ok(/Ventas/.test(chartXml) && /<c:barChart>/.test(chartXml), 'el gráfico es de barras nativo con la serie Ventas');
  const notesFile = files.find((f) => /ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
  ok(!!notesFile, 'genera notas del orador');
  if (notesFile) { const nx = await zip.file(notesFile)!.async('string'); ok(/notas del orador/.test(nx), 'el texto de las notas está'); }

  const total = passed + fails.length;
  if (fails.length) {
    console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n'));
    console.error('\n--- slide1.xml (primeros 800) ---\n' + xml1.slice(0, 800));
    process.exit(1);
  } else console.log(`\n✅ pptx export: ${passed}/${total} aserciones verdes.`);
})().catch((e) => { console.error(e); process.exit(1); });
