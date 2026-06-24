/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Exportación de un rango de la hoja a **tabla Markdown** (GFM). Útil para pegar datos en READMEs,
 * issues, PRs o documentos Markdown. Funciones **puras** (la lectura del rango sólo recorre el
 * `celldata` ya en memoria), así que se prueban de forma aislada.
 */
import { parseRange } from './charts';

/** Valor **mostrado** de una celda (`m` si existe; si no, el valor crudo). */
function dispOf(cd: any): string {
  const v = cd?.v;
  if (v == null) return '';
  if (typeof v === 'object') { const x = v.m ?? v.v; return x == null ? '' : String(x); }
  return String(v);
}

/** Matriz de cadenas (valores mostrados) del rango `A1:C5`. Las celdas vacías → `''`. */
export function rangeValues(sheet: any, range: string): string[][] {
  const rng = parseRange(range); if (!rng || !sheet) return [];
  const map = new Map<string, any>();
  for (const cd of sheet.celldata ?? []) map.set(`${cd.r}_${cd.c}`, cd);
  const out: string[][] = [];
  for (let r = rng.r1; r <= rng.r2; r++) {
    const row: string[] = [];
    for (let c = rng.c1; c <= rng.c2; c++) { const cd = map.get(`${r}_${c}`); row.push(cd ? dispOf(cd) : ''); }
    out.push(row);
  }
  return out;
}

/** Escapa una celda para Markdown: `\`, `|` y colapsa saltos de línea a un espacio. */
const escCell = (s: string): string => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();

/**
 * Convierte una matriz de cadenas en una **tabla Markdown GFM**. Por defecto la primera fila es el
 * encabezado; con `header: false` se emite un encabezado vacío (GFM exige fila de cabecera). Rellena
 * las filas cortas para que todas tengan el mismo número de columnas.
 */
export function gridToMarkdownTable(rows: string[][], opts: { header?: boolean } = {}): string {
  if (!rows.length) return '';
  const header = opts.header !== false;
  const ncol = rows.reduce((m, r) => Math.max(m, r.length), 0) || 1;
  const pad = (r: string[]) => { const c = r.map(escCell); while (c.length < ncol) c.push(''); return c; };
  const sep = '| ' + Array(ncol).fill('---').join(' | ') + ' |';
  const lines: string[] = [];
  if (header) {
    lines.push('| ' + pad(rows[0]).join(' | ') + ' |', sep);
    for (let i = 1; i < rows.length; i++) lines.push('| ' + pad(rows[i]).join(' | ') + ' |');
  } else {
    lines.push('| ' + Array(ncol).fill('').join(' | ') + ' |', sep);
    for (const r of rows) lines.push('| ' + pad(r).join(' | ') + ' |');
  }
  return lines.join('\n');
}

/** Atajo: rango de la hoja → tabla Markdown. */
export function rangeToMarkdown(sheet: any, range: string, opts?: { header?: boolean }): string {
  return gridToMarkdownTable(rangeValues(sheet, range), opts);
}
