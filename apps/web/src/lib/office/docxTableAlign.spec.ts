/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Fidelidad de la alineación de columna de tabla en el export .docx:
 *   cd apps/web && npx tsx src/lib/office/docxTableAlign.spec.ts
 * La alineación de celda (cell.attrs.textAlign, p. ej. importada de una tabla Markdown `:--`/`--:`/`:-:`)
 * debe viajar al .docx como alineación de párrafo (w:jc) dentro de la celda.
 */
import * as docx from 'docx';
import JSZip from 'jszip';
import { buildDocx } from './docx';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const cell = (text: string, textAlign?: string, header = true) => ({
  type: header ? 'tableHeader' : 'tableCell',
  attrs: textAlign ? { textAlign } : {},
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const json = {
  type: 'doc', attrs: { pageSize: 'a4' },
  content: [{
    type: 'table', content: [
      { type: 'tableRow', content: [cell('Izq', 'left'), cell('Cen', 'center'), cell('Der', 'right'), cell('Def')] },
      { type: 'tableRow', content: [cell('a', undefined, false), cell('b', undefined, false), cell('c', undefined, false), cell('d', undefined, false)] },
    ],
  }],
};

(async () => {
  const doc = buildDocx(docx as any, json, 'Prueba');
  const buf: any = await (docx as any).Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')!.async('string');

  ok(/<w:tbl>/.test(xml), 'la tabla se exporta');
  // Cada alineación de cabecera debe aparecer como un párrafo justificado (w:jc).
  ok(/<w:jc w:val="center"\/>/.test(xml), 'la columna centrada exporta w:jc center');
  ok(/<w:jc w:val="right"\/>/.test(xml) || /<w:jc w:val="end"\/>/.test(xml), 'la columna derecha exporta w:jc right/end');
  // Cuenta de alineaciones explícitas: al menos centro + derecha (izquierda/def pueden omitirse por ser el valor por defecto).
  const jcs = (xml.match(/<w:jc /g) || []).length;
  ok(jcs >= 2, `hay ≥2 alineaciones explícitas en el documento (obt ${jcs})`);

  const total = passed + fails.length;
  if (fails.length) { console.error(`❌ ${passed}/${total}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
  else console.log(`✅ ${passed}/${total}`);
})().catch((e) => { console.error(e); process.exit(1); });
