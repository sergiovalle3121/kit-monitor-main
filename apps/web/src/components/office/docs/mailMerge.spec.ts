/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Auditoría de Combinar correspondencia (Mail Merge) — PURA:
 *   cd apps/web && npx tsx src/components/office/docs/mailMerge.spec.ts
 */
import { parseDelimited, findMergeFields, mergeDoc, mailMergeDocs } from './mailMerge';

let passed = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };

// ── parseDelimited ────────────────────────────────────────────────────────────
{
  const { headers, rows } = parseDelimited('nombre,ciudad\nAna,Madrid\nLuis,"Vigo, ES"');
  eq(headers, ['nombre', 'ciudad'], 'CSV: cabeceras');
  eq(rows.length, 2, 'CSV: 2 filas');
  eq(rows[1].ciudad, 'Vigo, ES', 'CSV: respeta comas entre comillas');
  eq(parseDelimited('a\tb\n1\t2').headers, ['a', 'b'], 'TSV: detecta tabulador');
  eq(parseDelimited('x\n"di ""hola"""').rows[0].x, 'di "hola"', 'CSV: comillas escapadas');
  eq(parseDelimited('').rows.length, 0, 'CSV vacío → 0 filas');
}

// ── findMergeFields ───────────────────────────────────────────────────────────
const tmpl = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Estimado/a {{nombre}} de {{ciudad}},' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Su saldo es {{saldo}}. Gracias, {{nombre}}.' }] },
  ],
};
eq(findMergeFields(tmpl), ['nombre', 'ciudad', 'saldo'], 'campos únicos en orden de aparición');

// ── mergeDoc ──────────────────────────────────────────────────────────────────
{
  const merged = mergeDoc(tmpl, { nombre: 'Ana', ciudad: 'Madrid', saldo: '€1.234' });
  eq(merged.content[0].content[0].text, 'Estimado/a Ana de Madrid,', 'sustituye varios campos en un texto');
  eq(merged.content[1].content[0].text, 'Su saldo es €1.234. Gracias, Ana.', 'repite un campo');
  // No muta la plantilla original.
  eq(tmpl.content[0].content[0].text, 'Estimado/a {{nombre}} de {{ciudad}},', 'no muta la plantilla');
  // Campo ausente → se deja el marcador.
  eq(mergeDoc(tmpl, { nombre: 'X' }).content[1].content[0].text, 'Su saldo es {{saldo}}. Gracias, X.', 'campo ausente conserva el marcador');
}

// ── mailMergeDocs (combinado con saltos de página) ───────────────────────────
{
  const rows = [
    { nombre: 'Ana', ciudad: 'Madrid', saldo: '10' },
    { nombre: 'Luis', ciudad: 'Vigo', saldo: '20' },
  ];
  const out = mailMergeDocs(tmpl, rows);
  // 2 registros × 2 párrafos + 1 salto de página entre ellos = 5 bloques.
  eq(out.content.length, 5, 'combinado: 2 registros + 1 salto = 5 bloques');
  eq(out.content[2].type, 'pageBreak', 'salto de página entre registros');
  eq(out.content[0].content[0].text, 'Estimado/a Ana de Madrid,', 'primer registro');
  eq(out.content[3].content[0].text, 'Estimado/a Luis de Vigo,', 'segundo registro');
  ok(!JSON.stringify(out).includes('{{'), 'no quedan marcadores sin combinar');
}

const total = passed + fails.length;
if (fails.length) { console.error(`\n❌ ${fails.length}/${total} fallos:\n` + fails.map((f) => '   • ' + f).join('\n')); process.exit(1); }
else console.log(`\n✅ mailMerge: ${passed}/${total} aserciones verdes.`);
