/**
 * CIDE chat cards — turn a tool's structured output into a small, typed visual
 * the chat widget renders inline (a KPI, a sparkline, or mini bars). This is
 * deterministic and server-side: the model picks tools, but the *card* is built
 * from the real tool result, so the chat shows trustworthy visuals without
 * relying on the model to format data. Cards are ephemeral (live turn only).
 */

export type CideCard =
  | { type: 'metric'; title: string; value: number; unit?: string | null }
  | {
      type: 'line';
      title: string;
      series: { x: string; y: number }[];
      projection?: { x: string; y: number }[];
    }
  | { type: 'bars'; title: string; bars: { label: string; value: number }[] }
  | {
      type: 'actions';
      title: string;
      items: { title: string; severity: string }[];
    };

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Map [{date,count}] → [{x,y}] defensively. */
function toSeries(v: unknown): { x: string; y: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { x: string; y: number }[] = [];
  for (const row of v) {
    const r = asObj(row);
    const y = r ? num(r.count) : null;
    const x = r && typeof r.date === 'string' ? r.date : null;
    if (x !== null && y !== null) out.push({ x, y });
  }
  return out;
}

/** Map a {label:count} record → top-N bars, sorted desc. */
function toBars(v: unknown, top = 7): { label: string; value: number }[] {
  const r = asObj(v);
  if (!r) return [];
  return Object.entries(r)
    .map(([label, value]) => ({ label, value: num(value) ?? 0 }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, top);
}

/** Build a card for a tool result, or null if the tool isn't card-worthy. */
export function buildCard(tool: string, out: unknown): CideCard | null {
  // Autopilot returns an array of proposals → an "actions" card.
  if (tool === 'autopilot_proposals') {
    if (!Array.isArray(out) || out.length === 0) return null;
    const items = out
      .map((p) => {
        const r = asObj(p);
        return {
          title: r && typeof r.title === 'string' ? r.title : 'Acción',
          severity: r && typeof r.severity === 'string' ? r.severity : 'medium',
        };
      })
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
      )
      .slice(0, 5);
    return { type: 'actions', title: 'Acciones recomendadas', items };
  }

  const o = asObj(out);
  if (!o || 'error' in o) return null;

  switch (tool) {
    case 'analyze_trend': {
      const series = toSeries(o.series);
      return series.length >= 2
        ? { type: 'line', title: 'Tendencia de actividad', series }
        : null;
    }
    case 'simulate_projection': {
      const series = toSeries(o.history);
      const rawProj = toSeries(o.projection);
      if (series.length < 2) return null;
      // Connect the projection to the last real point so the dashed line joins.
      const projection = rawProj.length
        ? [series[series.length - 1], ...rawProj]
        : undefined;
      return { type: 'line', title: 'Proyección what-if', series, projection };
    }
    case 'object_insight': {
      const trend = asObj(o.trend);
      const series = trend ? toSeries(trend.series) : [];
      const name = (asObj(o.object)?.name as string) || 'Objeto';
      return series.length >= 2
        ? { type: 'line', title: `Actividad · ${name}`, series }
        : null;
    }
    case 'metric_value': {
      const value = num(o.value);
      if (value === null) return null;
      return {
        type: 'metric',
        title: typeof o.name === 'string' ? o.name : 'Métrica',
        value,
        unit: typeof o.unit === 'string' ? o.unit : null,
      };
    }
    case 'inventory_valuation': {
      const value = num(o.totalValue);
      return value === null
        ? null
        : { type: 'metric', title: 'Valor de inventario', value, unit: 'USD' };
    }
    case 'operations_pulse': {
      const bars = toBars(o.byDomain);
      return bars.length
        ? { type: 'bars', title: 'Actividad por dominio', bars }
        : null;
    }
    default:
      return null;
  }
}

/** Collect cards from executed tools, de-duplicated by title and capped. */
export function collectCards(
  pairs: { tool: string; out: unknown }[],
  max = 3,
): CideCard[] {
  const cards: CideCard[] = [];
  const seen = new Set<string>();
  for (const { tool, out } of pairs) {
    const card = buildCard(tool, out);
    if (!card) continue;
    const key = `${card.type}:${card.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push(card);
    if (cards.length >= max) break;
  }
  return cards;
}
