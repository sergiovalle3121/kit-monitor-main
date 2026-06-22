/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Spec ejecutable del núcleo de paginación (puro, sin runner):
 *   cd apps/web && npx tsx src/components/office/docs/pagination.spec.ts
 */
import { computePagination, resolveFields, hasPageField, pageGeom, type BreakUnit, type PageGeom } from './pagination';

let passed = 0; const fails: string[] = [];
const eq = (a: any, b: any, msg: string) => { if (a === b) passed += 1; else fails.push(`${msg} — esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); };
const ok = (c: boolean, msg: string) => { if (c) passed += 1; else fails.push(msg); };

// Geometría de prueba: contenido de 100px por página, hueco 10, márgenes 20.
const geom: PageGeom = { pageW: 200, pageH: 140, marginX: 20, marginTop: 20, marginBottom: 20, gutter: 10, contentH: 100 };

// Bloques de 30px apilados naturalmente (sin espaciadores): tops 0,30,60,90,120...
function stack(n: number, h = 30, force: number[] = []): BreakUnit[] {
  const u: BreakUnit[] = [];
  for (let i = 0; i < n; i += 1) u.push({ top: i * h, height: h, force: force.includes(i) });
  return u;
}

// ── Sin saltos cuando todo cabe ───────────────────────────────────────────────
{
  const { breaks, pages } = computePagination(stack(3), geom); // 90px < 100
  eq(breaks.length, 0, 'cabe en una página → sin saltos');
  eq(pages.length, 1, 'una sola hoja');
}

// ── Salto automático por altura ───────────────────────────────────────────────
{
  // tops 0,30,60,90,120 — el 4º bloque (idx 3, top 90, bottom 120) excede 100.
  const { breaks, pages } = computePagination(stack(5), geom);
  eq(breaks.length, 1, 'un salto automático');
  eq(breaks[0].index, 3, 'rompe antes del bloque que excede el área de contenido');
  eq(pages.length, 2, 'dos hojas');
  // El relleno coloca el bloque 3 en el borde superior de la página 2 (pmY=150).
  // pmY renderizado = top(90) + fill ⇒ fill = 150 - 90 = 60.
  eq(Math.round(breaks[0].fill), 60, 'relleno alinea con el borde superior de la página 2');
}

// ── Salto manual forzado aunque haya espacio ─────────────────────────────────
{
  const { breaks } = computePagination(stack(3, 30, [1]), geom); // forzar antes del idx 1
  eq(breaks.length, 1, 'salto manual genera un salto');
  eq(breaks[0].index, 1, 'rompe en el bloque forzado');
}

// ── No rompe antes del primer bloque ──────────────────────────────────────────
{
  const u = stack(2, 30, [0]); // forzar en idx 0 no debe romper
  const { breaks } = computePagination(u, geom);
  eq(breaks.length, 0, 'no hay salto antes del primer bloque');
}

// ── Bloque sobredimensionado (más alto que la página) ─────────────────────────
{
  const u: BreakUnit[] = [{ top: 0, height: 30 }, { top: 30, height: 250 }, { top: 280, height: 30 }];
  const { breaks, pages } = computePagination(u, geom);
  ok(breaks.length >= 1, 'bloque enorme provoca al menos un salto');
  ok(pages.length >= 3, 'se crean hojas suficientes para cubrir el desbordamiento');
}

// ── Campos de encabezado/pie ──────────────────────────────────────────────────
{
  eq(resolveFields('Pág. {page} de {pages}', { page: 2, pages: 5 }), 'Pág. 2 de 5', 'resuelve page/pages');
  eq(resolveFields('{title}', { title: 'Informe' }), 'Informe', 'resuelve title');
  eq(resolveFields('Rev {date}', { date: '2026-06-22' }), 'Rev 2026-06-22', 'resuelve date');
  eq(resolveFields('', {}), '', 'texto vacío');
  ok(hasPageField('x {page}'), 'detecta campo page');
  ok(!hasPageField('x {title}'), 'title no es campo de página');
}

// ── Geometría desde pageMeta ──────────────────────────────────────────────────
{
  const g = pageGeom({ pageSize: 'letter', pageMargin: 'normal' });
  eq(g.pageW, 816, 'ancho carta');
  eq(g.pageH, 1056, 'alto carta');
  const land = pageGeom({ pageSize: 'a4', pageOrientation: 'landscape' });
  ok(land.pageW > land.pageH, 'horizontal invierte ancho/alto');
}

if (fails.length) { console.error(`❌ pagination.spec: ${fails.length} fallo(s)\n` + fails.map((f) => '  · ' + f).join('\n')); process.exit(1); }
else console.log(`✅ pagination.spec: ${passed} aserciones OK`);
