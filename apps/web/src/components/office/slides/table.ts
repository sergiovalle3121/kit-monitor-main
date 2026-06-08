/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tablas estructuradas: una tabla es un `Group` de Fabric con prop
 * `tableSpec = { rows, cols, cells, header, banded, accent }`. Se dibuja con
 * rect + texto (rasteriza en PDF/PNG/presentación) y se exporta como TABLA
 * NATIVA de PowerPoint usando el mismo spec. Sin dependencias nuevas.
 */
import { Group, Rect, FabricText } from 'fabric';

export interface TableSpec {
  rows: number;
  cols: number;
  cells: string[][];
  header: boolean;
  banded: boolean;
  accent?: string;
}

export const TABLE_ACCENT = '#2563eb';

export function isTable(o: any): boolean { return !!o && o.type === 'group' && !!o.tableSpec; }

export function defaultTableSpec(rows = 3, cols = 3): TableSpec {
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(r === 0 ? `Columna ${c + 1}` : '');
    cells.push(row);
  }
  return { rows, cols, cells, header: true, banded: true, accent: TABLE_ACCENT };
}

/** Normaliza la matriz de celdas al tamaño rows×cols. */
export function normalizeCells(spec: TableSpec): string[][] {
  const out: string[][] = [];
  for (let r = 0; r < spec.rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < spec.cols; c++) row.push(spec.cells?.[r]?.[c] ?? '');
    out.push(row);
  }
  return out;
}

interface Opts { left?: number; top?: number; width?: number; text?: string; font?: string }

export function buildTableGroup(spec: TableSpec, opts: Opts = {}): any {
  const accent = spec.accent || TABLE_ACCENT;
  const font = opts.font ?? 'sans-serif';
  const bodyText = opts.text ?? '#1f2937';
  const cells = normalizeCells(spec);
  const cols = Math.max(1, spec.cols), rows = Math.max(1, spec.rows);
  const totalW = opts.width ?? Math.min(840, 150 * cols);
  const cw = totalW / cols, chh = 44;
  const kids: any[] = [];

  for (let r = 0; r < rows; r++) {
    const isHeader = spec.header && r === 0;
    const banded = spec.banded && !isHeader && r % 2 === 1;
    const fill = isHeader ? accent : banded ? tint(accent, 0.10) : '#ffffff';
    for (let c = 0; c < cols; c++) {
      kids.push(new Rect({ left: c * cw, top: r * chh, width: cw, height: chh, fill, stroke: '#cbd5e1', strokeWidth: 1 }));
      const t = cells[r][c];
      if (t) kids.push(new FabricText(String(t), {
        left: c * cw + 10, top: r * chh + chh / 2, width: cw - 20, fontSize: 15,
        fill: isHeader ? '#ffffff' : bodyText, fontFamily: font, fontWeight: isHeader ? 'bold' : 'normal',
        originX: 'left', originY: 'center',
      }));
    }
  }
  const g = new Group(kids, { subTargetCheck: false } as any);
  g.set({ left: opts.left ?? 90, top: opts.top ?? 150 });
  (g as any).tableSpec = { ...spec, cells };
  g.setCoords();
  return g;
}

function tint(hex: string, a: number) {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#eef2ff';
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const mix = (x: number) => Math.round(x * a + 255 * (1 - a));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
