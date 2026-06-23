/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Núcleo PURO de la paginación de la superficie de edición (Fase 1).
 *
 * Sin dependencias (ni TipTap ni DOM) para poder testearse en aislamiento:
 *   cd apps/web && npx tsx src/components/office/docs/pagination.spec.ts
 *
 * La extensión de TipTap que aplica esto vía decoraciones vive en
 * `paginationExtension.ts`. El contenido sigue siendo TipTap JSON puro: la
 * paginación es de render/layout (decoraciones), no modifica el documento.
 */

/** Dimensiones de página en px @96dpi (coinciden con DocEditor / TOC / docx). */
export const PAGE_DIM: Record<string, [number, number]> = {
  a4: [794, 1123],
  letter: [816, 1056],
  legal: [816, 1344],
};

export interface PageGeom {
  pageW: number;
  pageH: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  /** Hueco gris entre hojas (px). */
  gutter: number;
  /** Alto del área de contenido por página (px). */
  contentH: number;
}

/** Geometría de página a partir de `pageMeta` (atributos del documento). */
export function pageGeom(meta: any): PageGeom {
  const [dw, dh] = PAGE_DIM[meta?.pageSize as string] || PAGE_DIM.a4;
  const landscape = meta?.pageOrientation === 'landscape';
  const pageW = landscape ? dh : dw;
  const pageH = landscape ? dw : dh;
  const margin = meta?.pageMargin === 'narrow' ? 36 : meta?.pageMargin === 'wide' ? 104 : 64;
  const gutter = 22;
  return { pageW, pageH, marginX: margin, marginTop: margin, marginBottom: margin, gutter, contentH: Math.max(80, pageH - margin * 2) };
}

export interface BreakUnit {
  /** Posición natural (px) del borde superior del bloque, sin espaciadores. */
  top: number;
  /** Alto intrínseco del bloque (px). */
  height: number;
  /** Salto de página manual forzado antes de este bloque. */
  force?: boolean;
}

export interface PageBreakResult {
  index: number;
  /** Alto del espaciador a insertar antes del bloque `index`. */
  fill: number;
}

export interface PageMetric { top: number; height: number }
export interface PaginationLayout { pages: PageMetric[]; geom: PageGeom }

const approx = (a: number, b: number) => Math.abs(a - b) < 2;

/**
 * Núcleo puro de la paginación. A partir de las posiciones/alturas naturales de
 * los bloques de nivel superior calcula dónde romper y cuánto «relleno» insertar
 * para que cada página comience en el borde superior del área de contenido
 * siguiente. Devuelve los saltos (índice de bloque + alto del espaciador) y las
 * métricas de cada hoja (para dibujar los marcos).
 *
 * Es estable: las alturas son intrínsecas (independientes de los espaciadores ya
 * insertados), así que converge en una sola medición y no oscila.
 *
 * Límite (Fase 1): rompe sólo en límites de bloque de nivel superior. Un bloque
 * más alto que la página se desborda (no se parte); el texto nunca se oculta.
 */
export function computePagination(units: BreakUnit[], geom: PageGeom): { breaks: PageBreakResult[]; pages: PageMetric[] } {
  const { pageH, gutter, contentH } = geom;
  const stride = pageH + gutter;
  const breaks: PageBreakResult[] = [];
  if (!units.length) return { breaks, pages: [{ top: 0, height: pageH }] };

  let pageStartTop = units[0].top; // top natural del primer bloque de la página actual
  let cumFill = 0; // suma de rellenos ya insertados (desplazamiento acumulado)
  let pageIndex = 0;

  for (let i = 1; i < units.length; i += 1) {
    const u = units[i];
    const atStart = approx(u.top, pageStartTop);
    const forced = !!u.force && !atStart;
    const exceeds = u.top + u.height - pageStartTop > contentH + 1;
    if (forced || (exceeds && !atStart)) {
      pageIndex += 1;
      const target = pageIndex * stride; // pmY objetivo: borde superior del contenido de la página
      const min = gutter + geom.marginTop + geom.marginBottom;
      const fill = Math.max(min, target - (u.top + cumFill));
      breaks.push({ index: i, fill });
      cumFill += fill;
      pageStartTop = u.top;
    }
  }

  const last = units[units.length - 1];
  const renderedBottom = last.top + last.height + cumFill;
  const totalPages = Math.max(breaks.length + 1, Math.ceil((renderedBottom - 1) / stride) || 1);
  const pages: PageMetric[] = [];
  for (let p = 0; p < totalPages; p += 1) pages.push({ top: p * stride, height: pageH });
  return { breaks, pages };
}

/** Contexto para resolver campos de encabezado/pie. */
export interface FieldCtx { page?: number; pages?: number; title?: string; date?: string }

/** Resuelve campos de encabezado/pie: {page} {pages} {title} {date}. */
export function resolveFields(text: string, ctx: FieldCtx): string {
  if (!text) return '';
  return text.replace(/\{(page|pages|title|date)\}/g, (_m, k: string) => {
    if (k === 'page') return ctx.page != null ? String(ctx.page) : '';
    if (k === 'pages') return ctx.pages != null ? String(ctx.pages) : '';
    if (k === 'title') return ctx.title || '';
    return ctx.date || new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  });
}

/** ¿El texto usa un campo de numeración de página? */
export const hasPageField = (text: string) => /\{(page|pages)\}/.test(text || '');

/**
 * CSS de impresión nativa del navegador a partir de `pageMeta`: fija el tamaño de
 * papel y los márgenes (mm, coincidiendo con la Vista de página/Paged.js) y aplica
 * el salto de página real en los bloques marcados con `.doc-print-break`.
 *
 * Nota honesta: la impresión nativa NO soporta encabezados/pies repetidos ni
 * `counter(page)` en cajas de margen (eso es Paged Media, lo cubre la «Vista de
 * página»). Aquí garantizamos papel + márgenes + saltos correctos.
 */
export function printPageCss(meta: any): string {
  const kw: Record<string, string> = { a4: 'A4', letter: 'Letter', legal: 'Legal' };
  const size = kw[meta?.pageSize as string] || 'A4';
  const orient = meta?.pageOrientation === 'landscape' ? 'landscape' : 'portrait';
  const margin = meta?.pageMargin === 'narrow' ? '14mm' : meta?.pageMargin === 'wide' ? '30mm 26mm' : '22mm 18mm';
  return `@media print{@page{size:${size} ${orient};margin:${margin};}body:not(.preview-printing) .tiptap-page .doc-print-break{break-before:page;}}`;
}
