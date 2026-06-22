import { Injectable } from '@nestjs/common';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import {
  SemanticPrincipal,
  SemanticService,
} from '../semantic/semantic.service';

/** A point in a daily time series. */
export interface TrendPoint {
  date: string;
  count: number;
}

export interface LedgerTrend {
  series: TrendPoint[];
  total: number;
  window: { days: number };
  recent7: number;
  prior7: number;
  deltaPct: number | null;
  narrative: string;
}

export interface DomainBreakdown {
  buckets: { domain: string; count: number }[];
  total: number;
  window: { sinceHours: number };
  narrative: string;
}

/**
 * Conversational-analytics layer: turns the raw Event Ledger into chartable,
 * narrated insights (trend over time, breakdown by domain) that both the
 * Intelligence Center UI and CIDE consume. Narratives are **deterministic** (no
 * LLM), so the same numbers read consistently in the dashboard and in chat; CIDE
 * elaborates on top of them.
 */
/** A forward projection of a daily series, with an optional what-if lever. */
export interface ProjectionBand {
  date: string;
  p10: number;
  p50: number;
  p90: number;
}
export interface Projection {
  history: TrendPoint[];
  projection: { date: string; count: number; projected: true }[];
  bands: ProjectionBand[];
  simulations: number;
  slopePerDay: number;
  horizonDays: number;
  adjustmentPct: number;
  todayRate: number;
  endRate: number;
  narrative: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly ledger: EventLedgerService,
    private readonly semantic: SemanticService,
  ) {}

  /** Daily activity trend with a week-over-week delta and a one-line narrative. */
  async ledgerTrend(opts: {
    days?: number;
    domain?: string;
    line?: string;
  }): Promise<LedgerTrend> {
    const { series, total, window } = await this.ledger.dailyActivity(opts);
    const n = series.length;
    const sum = (from: number, to: number) =>
      series.slice(Math.max(0, from), Math.max(0, to)).reduce((s, p) => s + p.count, 0);
    const recent7 = sum(n - 7, n);
    const prior7 = sum(n - 14, n - 7);
    const deltaPct =
      prior7 > 0 ? Math.round(((recent7 - prior7) / prior7) * 100) : null;

    const scope = opts.domain ? ` en ${opts.domain}` : '';
    let narrative: string;
    if (n >= 14 && deltaPct !== null) {
      const dir = deltaPct > 0 ? 'subió' : deltaPct < 0 ? 'bajó' : 'se mantuvo';
      narrative = `La actividad${scope} ${dir} ${Math.abs(deltaPct)}% en los últimos 7 días (${recent7} vs ${prior7} de la semana previa). ${total} eventos en ${window.days} días.`;
    } else {
      narrative = `${total} eventos${scope} en los últimos ${window.days} días.`;
    }

    return { series, total, window, recent7, prior7, deltaPct, narrative };
  }

  /** Activity broken down by domain over a window, with a leading-domain narrative. */
  async domainBreakdown(opts: { sinceHours?: number }): Promise<DomainBreakdown> {
    const pulse = await this.ledger.summarizeActivity({
      sinceHours: opts.sinceHours,
    });
    const buckets = Object.entries(pulse.byDomain)
      .map(([domain, count]) => ({ domain, count: count as number }))
      .sort((a, b) => b.count - a.count);
    const top = buckets[0];
    const narrative = top
      ? `En las últimas ${pulse.window.sinceHours} h, el dominio más activo fue ${top.domain} (${top.count} de ${pulse.totalEvents} eventos).`
      : `Sin actividad registrada en las últimas ${pulse.window.sinceHours} h.`;
    return {
      buckets,
      total: pulse.totalEvents,
      window: { sinceHours: pulse.window.sinceHours },
      narrative,
    };
  }

  /**
   * Object-centric drill-down (the Palantir "object explorer"): given an
   * ontology object, compose its real activity (pulse + trend over its domain),
   * its related metrics (RBAC-gated values), graph neighbors (links) and a
   * sample of recent instances from the ledger.
   */
  async objectInsight(
    principal: SemanticPrincipal,
    objectKey: string,
    tenantId?: string,
  ) {
    const obj = await this.semantic.getObject(objectKey, tenantId);
    if (!obj) return { error: 'Objeto no encontrado' };
    const domain = obj.domain ?? undefined;

    const [pulse, trend, links, metricDefs] = await Promise.all([
      this.ledger.summarizeActivity({ domain, sinceHours: 168 }),
      this.ledgerTrend({ domain, days: 14 }),
      this.semantic.linksFor(objectKey, tenantId),
      domain
        ? this.semantic.metricsForDomain(domain, tenantId)
        : Promise.resolve([]),
    ]);

    const metrics = await Promise.all(
      metricDefs.map((m) =>
        this.semantic.resolveMetric(principal, m.key, tenantId),
      ),
    );

    // Recent instances: distinct ledger references for this object's domain.
    const refCounts = new Map<string, number>();
    for (const e of pulse.recent) {
      const ref = e.ref as string | null;
      if (ref) refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1);
    }
    const entities = [...refCounts.entries()]
      .map(([ref, count]) => ({ ref, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      object: obj,
      domain: domain ?? null,
      pulse: {
        total: pulse.totalEvents,
        byAction: pulse.byAction,
        byLine: pulse.byLine,
        window: pulse.window,
      },
      trend,
      metrics,
      links,
      entities,
    };
  }

  /**
   * What-if projection: fit a simple linear trend to recent daily activity and
   * project it forward, optionally applying a hypothetical adjustment (the
   * "what-if" lever). Honest and transparent — the user owns the lever, we show
   * the math. Reusable for any future daily-series KPI.
   */
  async project(opts: {
    domain?: string;
    days?: number;
    horizonDays?: number;
    adjustmentPct?: number;
  }): Promise<Projection> {
    const days = clamp(opts.days ?? 21, 7, 90);
    const horizon = clamp(opts.horizonDays ?? 7, 1, 30);
    const adj = clamp(opts.adjustmentPct ?? 0, -100, 200);
    const { series } = await this.ledger.dailyActivity({
      domain: opts.domain,
      days,
    });

    // Least-squares linear fit on index → count.
    const n = series.length;
    const meanX = (n - 1) / 2;
    const meanY = series.reduce((s, p) => s + p.count, 0) / (n || 1);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - meanX) * (series[i].count - meanY);
      den += (i - meanX) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    const intercept = meanY - slope * meanX;
    const factor = 1 + adj / 100;

    const lastDate = n > 0 ? new Date(series[n - 1].date) : new Date();
    const projection = [] as { date: string; count: number; projected: true }[];
    for (let h = 1; h <= horizon; h++) {
      const base = Math.max(0, intercept + slope * (n - 1 + h));
      const d = new Date(lastDate.getTime() + h * 86_400_000);
      projection.push({
        date: d.toISOString().slice(0, 10),
        count: Math.round(base * factor),
        projected: true,
      });
    }

    const todayRate = Math.round(Math.max(0, intercept + slope * (n - 1)));
    const endRate = projection.length
      ? projection[projection.length - 1].count
      : todayRate;

    // ── Monte Carlo: bootstrap the daily deltas to get P10/P50/P90 bands. ──
    // The decision-intelligence MonteCarloService is plan-scenario specific
    // (needs a PlanScenario); here we run a self-contained simulation on the
    // real activity series so the what-if shows honest uncertainty, not a single
    // line. The lever (`adj`) shifts the drift; historical noise is preserved.
    const SIMS = 300;
    const deltas: number[] = [];
    for (let i = 1; i < n; i++) deltas.push(series[i].count - series[i - 1].count);
    const muDelta =
      deltas.length > 0 ? deltas.reduce((s, d) => s + d, 0) / deltas.length : 0;
    const lastActual = n > 0 ? series[n - 1].count : 0;
    const drift = slope * factor;

    // paths[h][sim] = simulated value at horizon day h.
    const paths: number[][] = Array.from({ length: horizon }, () => []);
    for (let sim = 0; sim < SIMS; sim++) {
      let value = lastActual;
      for (let h = 0; h < horizon; h++) {
        const noise =
          deltas.length > 0
            ? deltas[Math.floor(Math.random() * deltas.length)] - muDelta
            : 0;
        value = Math.max(0, value + noise + drift);
        paths[h].push(value);
      }
    }
    const pct = (sorted: number[], p: number): number => {
      if (sorted.length === 0) return 0;
      const idx = clamp(Math.round((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
      return Math.round(sorted[idx]);
    };
    const bands: ProjectionBand[] = paths.map((vals, h) => {
      const sorted = [...vals].sort((a, b) => a - b);
      return {
        date: projection[h]?.date ?? '',
        p10: pct(sorted, 10),
        p50: pct(sorted, 50),
        p90: pct(sorted, 90),
      };
    });

    const endBand = bands[bands.length - 1];
    const dir =
      endRate > todayRate ? 'al alza' : endRate < todayRate ? 'a la baja' : 'estable';
    const scope = opts.domain ? ` de ${opts.domain}` : '';
    const adjNote =
      adj !== 0 ? ` con un ajuste hipotético de ${adj > 0 ? '+' : ''}${adj}%` : '';
    const bandNote = endBand
      ? ` Escenario a ${horizon}d: P50 ~${endBand.p50}/día (P10–P90: ${endBand.p10}–${endBand.p90}).`
      : '';
    const narrative = `Al ritmo actual${scope}${adjNote}, la actividad proyectada a ${horizon} días es ~${endRate}/día (tendencia ${dir}; hoy ~${todayRate}/día).${bandNote}`;

    return {
      history: series,
      projection,
      bands,
      simulations: SIMS,
      slopePerDay: Math.round(slope * 100) / 100,
      horizonDays: horizon,
      adjustmentPct: adj,
      todayRate,
      endRate,
      narrative,
    };
  }
}
