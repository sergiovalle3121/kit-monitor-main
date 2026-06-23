/* eslint-disable @typescript-eslint/no-explicit-any */
/** Segmentaciones (slicers) + escala de tiempo. npx tsx src/components/office/sheets/slicer.spec.ts */
import { slicerValues, applySlicers, makeSlicer, makeTimeline } from './slicer';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) === JSON.stringify(b)) passed++; else fails.push(`${m} — esp ${JSON.stringify(b)}, obt ${JSON.stringify(a)}`); };
const ok = (c: boolean, m: string) => { if (c) passed++; else fails.push(m); };

const cell = (v: any) => ({ v, m: String(v ?? ''), ct: { fa: 'General', t: typeof v === 'number' ? 'n' : 's' } });
// Tabla A1:B5: col 0 = Región, col 1 = Importe.
const make = () => ({
  config: {},
  celldata: [
    { r: 0, c: 0, v: cell('Región') }, { r: 0, c: 1, v: cell('Importe') },
    { r: 1, c: 0, v: cell('Norte') }, { r: 1, c: 1, v: cell(10) },
    { r: 2, c: 0, v: cell('Sur') }, { r: 2, c: 1, v: cell(20) },
    { r: 3, c: 0, v: cell('Norte') }, { r: 3, c: 1, v: cell(30) },
    { r: 4, c: 0, v: cell('Este') }, { r: 4, c: 1, v: cell(40) },
  ] as any[],
});

// ── Valores distintos (botones) ──
eq(slicerValues(make(), 'A1:B5', 0), ['Este', 'Norte', 'Sur'], 'valores distintos ordenados');
eq(slicerValues(make(), 'A1:B5', 1), ['10', '20', '30', '40'], 'columna numérica ordenada');

// ── Aplicar un slicer (Región = Norte) ──
{ const s = make() as any; const sl = makeSlicer('A1:B5', 0, 'Región'); sl.selected = ['Norte']; s.slicers = [sl];
  const n = applySlicers(s);
  eq(n, 2, 'oculta las 2 filas no-Norte (Sur, Este)');
  eq(s.config.rowhidden, { 2: 0, 4: 0 }, 'oculta filas 2 (Sur) y 4 (Este)'); }

// ── Selección vacía oculta todo; null muestra todo ──
{ const s = make() as any; const sl = makeSlicer('A1:B5', 0, 'Región'); sl.selected = []; s.slicers = [sl];
  eq(applySlicers(s), 4, 'selección vacía oculta las 4 filas de datos'); }
{ const s = make() as any; s.slicers = [makeSlicer('A1:B5', 0, 'Región')]; // selected null
  eq(applySlicers(s), 0, 'selección «todos» no oculta nada');
  ok(s.config.rowhidden === undefined, 'sin filas ocultas → sin rowhidden'); }

// ── Dos slicers se combinan con Y ──
{ const s = make() as any;
  const a = makeSlicer('A1:B5', 0, 'Región'); a.selected = ['Norte'];
  const b = makeSlicer('A1:B5', 1, 'Importe'); b.selected = ['30'];
  s.slicers = [a, b];
  eq(applySlicers(s), 3, 'Norte Y 30 → solo la fila 3 visible (3 ocultas)');
  eq(s.config.rowhidden, { 1: 0, 2: 0, 4: 0 }, 'visibles solo la fila 3'); }

// ── Escala de tiempo (rango de fechas) ──
{ const s: any = { config: {}, celldata: [
    { r: 0, c: 0, v: cell('Fecha') },
    { r: 1, c: 0, v: cell('2024-01-15') }, { r: 2, c: 0, v: cell('2024-03-10') }, { r: 3, c: 0, v: cell('2024-06-01') },
  ] };
  const t = makeTimeline('A1:A4', 0, 'Fecha'); t.from = '2024-02-01'; t.to = '2024-04-01';
  s.timelines = [t];
  eq(applySlicers(s), 2, 'fuera del rango de fechas → 2 ocultas');
  eq(s.config.rowhidden, { 1: 0, 3: 0 }, 'solo marzo visible'); }

if (fails.length) { console.log(`❌ ${passed}/${passed + fails.length}`); for (const f of fails) console.log('  - ' + f); process.exit(1); }
else console.log(`✅ ${passed}/${passed}`);
