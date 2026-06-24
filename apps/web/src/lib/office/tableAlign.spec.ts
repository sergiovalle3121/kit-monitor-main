/** Alineación de tablas en Markdown (roundtrip). npx tsx src/lib/office/tableAlign.spec.ts */
import { markdownToHtml, tiptapJsonToMarkdown } from './markdown';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

// ── IMPORT: la fila separadora :--/--:/:-: se traduce a text-align en th/td ──
const md = ['| Izq | Cen | Der | Def |', '| :-- | :-: | --: | --- |', '| 1 | 2 | 3 | 4 |'].join('\n');
const html = markdownToHtml(md);
ok(/<th style="text-align:left">Izq<\/th>/.test(html), 'cabecera izquierda');
ok(/<th style="text-align:center">Cen<\/th>/.test(html), 'cabecera centro');
ok(/<th style="text-align:right">Der<\/th>/.test(html), 'cabecera derecha');
ok(/<th>Def<\/th>/.test(html), 'cabecera sin alineación (sin style)');
ok(/<td style="text-align:left">1<\/td>/.test(html), 'celda de cuerpo hereda alineación de columna');
ok(/<td style="text-align:right">3<\/td>/.test(html), 'celda derecha en cuerpo');
ok(/<td>4<\/td>/.test(html), 'celda sin alineación');

// ── EXPORT: la alineación de la celda (attrs.textAlign) se emite como :--/--:/:-: ──
const cell = (text: string, textAlign?: string) => ({
  type: 'tableHeader', attrs: textAlign ? { textAlign } : {},
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
const bodyCell = (text: string) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const doc = { type: 'doc', content: [{
  type: 'table', content: [
    { type: 'tableRow', content: [cell('Izq', 'left'), cell('Cen', 'center'), cell('Der', 'right'), cell('Def')] },
    { type: 'tableRow', content: [bodyCell('1'), bodyCell('2'), bodyCell('3'), bodyCell('4')] },
  ],
}] };
const out = tiptapJsonToMarkdown(doc);
const delimLine = out.split('\n').find((l) => /^\|[\s:|-]+\|$/.test(l)) || '';
ok(delimLine.includes(':---'), 'export emite alineación izquierda :---');
ok(delimLine.includes(':---:'), 'export emite alineación centro :---:');
ok(delimLine.includes('---:'), 'export emite alineación derecha ---:');
ok(/\|\s*---\s*\|/.test(delimLine), 'export deja --- para columna sin alineación');

// ── Roundtrip: import → (modelo) → export conserva la alineación ──
// Simula el modelo tras importar: cabecera con textAlign tomado del HTML.
const roundtripDoc = { type: 'doc', content: [{
  type: 'table', content: [
    { type: 'tableRow', content: [cell('A', 'right'), cell('B', 'center')] },
    { type: 'tableRow', content: [bodyCell('1'), bodyCell('2')] },
  ],
}] };
const rt = tiptapJsonToMarkdown(roundtripDoc);
const rtDelim = rt.split('\n').find((l) => /^\|[\s:|-]+\|$/.test(l)) || '';
ok(rtDelim.includes('---:') && rtDelim.includes(':---:'), 'roundtrip conserva derecha+centro');

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
