/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Consolidar datos (Data → Consolidate de Excel): combina varios rangos en una sola tabla,
 * agregando con SUM/AVERAGE/COUNT/MAX/MIN. Dos modos: por POSICIÓN (misma forma, celda a celda)
 * o por CATEGORÍA (alinea por etiquetas de fila/columna, uniendo las que difieren). Puro → testeable.
 */
export type ConsAgg = 'sum' | 'average' | 'count' | 'max' | 'min';

const toNum = (v: any): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return null;
};
function aggregate(vals: number[], agg: ConsAgg): number {
  if (agg === 'count') return vals.length;
  if (!vals.length) return 0;
  switch (agg) {
    case 'sum': return vals.reduce((a, b) => a + b, 0);
    case 'average': return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'max': return Math.max(...vals);
    case 'min': return Math.min(...vals);
  }
}

/** Por POSICIÓN: rangos de la misma forma; cada celda = agregado de esa posición en todos. */
export function consolidateByPosition(tables: any[][][], agg: ConsAgg): any[][] {
  const rows = Math.max(0, ...tables.map((t) => t.length));
  const cols = Math.max(0, ...tables.map((t) => t.reduce((m, r) => Math.max(m, r.length), 0)));
  const out: any[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: any[] = [];
    for (let c = 0; c < cols; c++) {
      const vals: number[] = [];
      for (const t of tables) { const n = toNum(t[r]?.[c]); if (n !== null) vals.push(n); }
      row.push(vals.length || agg === 'count' ? round(aggregate(vals, agg)) : '');
    }
    out.push(row);
  }
  return out;
}

/**
 * Por CATEGORÍA: cada tabla tiene fila 0 = cabeceras (con esquina) y columna 0 = etiquetas de
 * fila. Se unen las etiquetas de fila y de columna (en orden de aparición) y cada celda agrega
 * los valores que coinciden en etiqueta+cabecera a través de las tablas.
 */
export function consolidateByCategory(tables: any[][][], agg: ConsAgg): any[][] {
  const headers: string[] = [];
  const rowLabels: string[] = [];
  const cells = new Map<string, number[]>(); // `${rowLabel}${header}` → valores
  for (const t of tables) {
    const hdr = (t[0] ?? []).slice(1).map((h) => String(h ?? ''));
    hdr.forEach((h) => { if (h !== '' && !headers.includes(h)) headers.push(h); });
    for (let r = 1; r < t.length; r++) {
      const label = String(t[r]?.[0] ?? '');
      if (label === '') continue;
      if (!rowLabels.includes(label)) rowLabels.push(label);
      for (let c = 1; c < (t[r]?.length ?? 0); c++) {
        const h = hdr[c - 1]; if (h == null || h === '') continue;
        const n = toNum(t[r][c]); if (n === null) continue;
        const k = `${label}${h}`;
        (cells.get(k) ?? cells.set(k, []).get(k)!).push(n);
      }
    }
  }
  const out: any[][] = [['', ...headers]];
  for (const label of rowLabels) {
    const row: any[] = [label];
    for (const h of headers) { const vals = cells.get(`${label}${h}`) ?? []; row.push(vals.length || agg === 'count' ? round(aggregate(vals, agg)) : ''); }
    out.push(row);
  }
  return out;
}

function round(x: number): number { return Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : +x.toFixed(8); }
