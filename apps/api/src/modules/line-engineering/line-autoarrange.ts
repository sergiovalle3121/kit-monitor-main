/**
 * Pure, side-effect-free auto-layout for the 2D plan (Fase 12).
 *
 * Packs stations into the footprint in routing order, wrapping into rows. By
 * default the rows SERPENTINE (left→right, then right→left, …) so material
 * flows continuously from the end of one row into the start of the next — the
 * shortest, least-tangled path, which pairs with the flow & validation tools.
 *
 * It only SUGGESTS positions; persisting is the caller's choice (the editor
 * applies the result and the engineer reviews before saving). Kept pure so the
 * packing rules can be unit-tested without a database or a canvas.
 */

export interface ArrangeStation {
  id: string;
  sequence: number;
  w: number | null;
  h: number | null;
}

export interface ArrangeFootprint {
  footprintW: number;
  footprintH: number;
  gridSize: number;
}

export interface ArrangeOptions {
  margin?: number;
  gap?: number;
  serpentine?: boolean;
}

export interface ArrangedPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export function autoArrange(
  stations: ArrangeStation[],
  footprint: ArrangeFootprint,
  opts: ArrangeOptions = {},
): ArrangedPosition[] {
  const sorted = [...(stations ?? [])].sort((a, b) => a.sequence - b.sequence);
  const fpW = Number(footprint.footprintW) || 0;
  const fpH = Number(footprint.footprintH) || 0;
  const gridSize =
    Number(footprint.gridSize) > 0 ? Number(footprint.gridSize) : 100;
  const defW = Math.max(1, Math.round(fpW * 0.06));
  const defH = Math.max(1, Math.round(fpH * 0.08));
  const margin = opts.margin ?? Math.max(gridSize, Math.round(fpW * 0.02));
  const gap = opts.gap ?? Math.max(gridSize, Math.round(fpW * 0.015));
  const serpentine = opts.serpentine ?? true;
  const usableW = Math.max(1, fpW - 2 * margin);
  const snap = (v: number) => Math.round(v / gridSize) * gridSize;

  // Pass 1: greedily pack stations into rows by width.
  type Item = { id: string; w: number; h: number; x0: number };
  type Row = { items: Item[]; width: number; height: number };
  const rows: Row[] = [];
  let cur: Row = { items: [], width: 0, height: 0 };
  for (const s of sorted) {
    const w = Number(s.w) > 0 ? Number(s.w) : defW;
    const h = Number(s.h) > 0 ? Number(s.h) : defH;
    const advance = cur.items.length ? gap + w : w;
    if (cur.items.length && cur.width + advance > usableW) {
      rows.push(cur);
      cur = { items: [], width: 0, height: 0 };
    }
    const x0 = cur.items.length ? cur.width + gap : 0;
    cur.items.push({ id: s.id, w, h, x0 });
    cur.width = x0 + w;
    cur.height = Math.max(cur.height, h);
  }
  if (cur.items.length) rows.push(cur);

  // Pass 2: stack rows from the top; mirror odd rows for a serpentine flow.
  const out: ArrangedPosition[] = [];
  let y = margin;
  rows.forEach((row, ri) => {
    const reverse = serpentine && ri % 2 === 1;
    for (const it of row.items) {
      const localX = reverse ? row.width - it.x0 - it.w : it.x0;
      out.push({
        id: it.id,
        x: snap(margin + localX),
        y: snap(y),
        w: it.w,
        h: it.h,
        rotation: 0,
      });
    }
    y += row.height + gap;
  });
  return out;
}
