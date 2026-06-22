import { Injectable } from '@nestjs/common';
import { EventLedgerService } from '../event-ledger/event-ledger.service';

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
@Injectable()
export class AnalyticsService {
  constructor(private readonly ledger: EventLedgerService) {}

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
}
