import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BriefAlertRow,
  BriefMetricRow,
  DecisionBrief,
} from './entities/decision-brief.entity';
import {
  KpiAlert,
  MetricValue,
  SemanticPrincipal,
  SemanticService,
} from './semantic.service';

const DEFAULT_TENANT = '__default__';
/** A system actor so generation sees every metric; RBAC is applied on read. */
const SYSTEM: SemanticPrincipal = { isAdmin: true, permissions: [] };
/** Trailing window (days) used to compute each KPI's recent movement. */
const TREND_DAYS = 14;
/** How many KPI lines to keep in a brief. */
const MAX_METRICS = 8;

function pct(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : ''}${r.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`;
}

function fmtNum(n: number, unit: string | null): string {
  const s = Number.isInteger(n)
    ? n.toLocaleString('es-MX')
    : n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  return unit === '%' ? `${s}%` : unit === 'USD' ? `${s} USD` : s;
}

/**
 * Builds **Decision Briefs**: a deterministic executive synthesis of a tenant's
 * KPI values, their recent movement and active alerts. Deterministic on purpose
 * — it needs no inference engine, so it works on any deployment and stays
 * auditable. CIDE narration can enrich it later without changing this contract.
 */
@Injectable()
export class BriefsService {
  private readonly logger = new Logger(BriefsService.name);

  constructor(
    @InjectRepository(DecisionBrief)
    private readonly briefRepo: Repository<DecisionBrief>,
    private readonly semantic: SemanticService,
  ) {}

  /** Daily brief for every tenant with a catalog (runs after the 2AM snapshot). */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyBriefs(): Promise<void> {
    let tenants: string[] = [DEFAULT_TENANT];
    try {
      tenants = await this.semantic.listTenants();
    } catch (e) {
      this.logger.warn(
        `listTenants failed, brief for default only: ${(e as Error)?.message}`,
      );
    }
    for (const t of tenants) {
      try {
        await this.generate(t);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`Decision brief failed for tenant ${t}: ${msg}`);
      }
    }
  }

  /** Latest brief + recent history for a tenant. */
  async listForTenant(
    tenantId = DEFAULT_TENANT,
    limit = 10,
  ): Promise<{ latest: DecisionBrief | null; recent: DecisionBrief[] }> {
    const recent = await this.briefRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return { latest: recent[0] ?? null, recent };
  }

  async getOne(tenantId: string, id: string): Promise<DecisionBrief> {
    const brief = await this.briefRepo.findOne({ where: { id } });
    if (!brief || brief.tenantId !== tenantId) {
      throw new NotFoundException('Resumen de decisión no encontrado.');
    }
    return brief;
  }

  /**
   * Compute and persist today's brief for a tenant (idempotent per day —
   * re-running refreshes the same row instead of duplicating).
   */
  async generate(tenantId = DEFAULT_TENANT): Promise<DecisionBrief> {
    const [defs, values, history, alerts] = await Promise.all([
      this.semantic.listMetrics(tenantId),
      this.semantic.values(SYSTEM, tenantId),
      this.semantic.metricHistoryBatch(SYSTEM, tenantId, TREND_DAYS),
      this.semantic.evaluateAlerts(SYSTEM, tenantId),
    ]);

    const dirByKey = new Map(defs.map((d) => [d.key, d.direction ?? null]));
    const rows = this.buildMetricRows(values, history, dirByKey);
    const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

    const headline = this.buildHeadline(rows, alerts, criticalCount);
    const summary = this.buildSummary(rows, alerts, criticalCount);

    const periodKey = new Date().toISOString().slice(0, 10);
    let brief = await this.briefRepo.findOne({ where: { tenantId, periodKey } });
    if (!brief) brief = this.briefRepo.create({ tenantId, periodKey });
    brief.headline = headline;
    brief.summary = summary;
    brief.metrics = rows.slice(0, MAX_METRICS);
    brief.alerts = alerts.slice(0, 6).map(
      (a): BriefAlertRow => ({
        name: a.name,
        severity: a.severity,
        kind: a.kind,
        message: a.message,
      }),
    );
    brief.alertsCount = alerts.length;
    brief.criticalCount = criticalCount;
    return this.briefRepo.save(brief);
  }

  // ── Synthesis ───────────────────────────────────────────────────────────────

  /** Turn live values + history into KPI rows, ordered by relevance (movers first). */
  private buildMetricRows(
    values: MetricValue[],
    history: Record<string, { day: string; value: number }[]>,
    dirByKey: Map<string, string | null>,
  ): BriefMetricRow[] {
    const rows: BriefMetricRow[] = [];
    for (const v of values) {
      if (v.value == null || v.restricted || v.definitionOnly) continue;
      const pts = history[v.key] ?? [];
      let deltaPct: number | null = null;
      if (pts.length >= 2 && pts[0].value !== 0) {
        deltaPct = ((pts[pts.length - 1].value - pts[0].value) /
          Math.abs(pts[0].value)) *
          100;
      }
      const direction = dirByKey.get(v.key) ?? null;
      const good =
        deltaPct == null || !direction
          ? null
          : direction === 'up'
            ? deltaPct >= 0
            : direction === 'down'
              ? deltaPct <= 0
              : null;
      rows.push({
        key: v.key,
        name: v.name,
        value: v.value,
        unit: v.unit,
        domain: v.domain,
        deltaPct,
        direction,
        good,
      });
    }
    // Movers (largest absolute change) first, then the rest by name.
    return rows.sort((a, b) => {
      const am = a.deltaPct == null ? -1 : Math.abs(a.deltaPct);
      const bm = b.deltaPct == null ? -1 : Math.abs(b.deltaPct);
      if (am !== bm) return bm - am;
      return a.name.localeCompare(b.name);
    });
  }

  private buildHeadline(
    rows: BriefMetricRow[],
    alerts: KpiAlert[],
    criticalCount: number,
  ): string {
    if (criticalCount > 0) {
      return `${criticalCount} alerta${criticalCount === 1 ? '' : 's'} crítica${
        criticalCount === 1 ? '' : 's'
      } requieren tu atención`;
    }
    if (alerts.length > 0) {
      return `${alerts.length} señal${alerts.length === 1 ? '' : 'es'} de KPI por revisar`;
    }
    const worst = rows.find((r) => r.good === false && r.deltaPct != null);
    if (worst && worst.deltaPct != null) {
      return `A vigilar: ${worst.name} ${pct(worst.deltaPct)} en ${TREND_DAYS} días`;
    }
    const best = rows.find((r) => r.good === true && r.deltaPct != null);
    if (best && best.deltaPct != null) {
      return `Buen momento: ${best.name} ${pct(best.deltaPct)} en ${TREND_DAYS} días`;
    }
    return 'Operación estable — sin señales relevantes hoy';
  }

  private buildSummary(
    rows: BriefMetricRow[],
    alerts: KpiAlert[],
    criticalCount: number,
  ): string {
    const parts: string[] = [];
    const domains = new Set(rows.map((r) => r.domain).filter(Boolean));
    parts.push(
      rows.length === 0
        ? 'Aún no hay KPIs con valor calculable; en cuanto haya datos los resumiré aquí.'
        : `Hoy se monitorean ${rows.length} KPI${
            rows.length === 1 ? '' : 's'
          }${domains.size ? ` en ${domains.size} dominio${domains.size === 1 ? '' : 's'}` : ''}.`,
    );

    if (alerts.length > 0) {
      const warn = alerts.length - criticalCount;
      const bits: string[] = [];
      if (criticalCount > 0)
        bits.push(`${criticalCount} crítica${criticalCount === 1 ? '' : 's'}`);
      if (warn > 0) bits.push(`${warn} en advertencia`);
      parts.push(`Hay ${alerts.length} alerta(s) de KPI: ${bits.join(' y ')}.`);
    } else {
      parts.push('Ningún KPI está fuera de objetivo ni con tendencia adversa.');
    }

    const best = rows.find((r) => r.good === true && r.deltaPct != null);
    if (best && best.deltaPct != null) {
      parts.push(
        `Lo mejor: ${best.name} mejoró ${pct(best.deltaPct)} (ahora ${fmtNum(best.value, best.unit)}).`,
      );
    }
    const worst = rows.find((r) => r.good === false && r.deltaPct != null);
    if (worst && worst.deltaPct != null) {
      parts.push(
        `A vigilar: ${worst.name} ${worst.deltaPct >= 0 ? 'subió' : 'bajó'} ${pct(
          worst.deltaPct,
        )} (ahora ${fmtNum(worst.value, worst.unit)}).`,
      );
    }

    parts.push(
      criticalCount > 0
        ? 'Recomendación: atiende primero las alertas críticas.'
        : alerts.length > 0
          ? 'Recomendación: revisa las señales de KPI antes de que escalen.'
          : 'Sin acciones urgentes; mantén el monitoreo habitual.',
    );
    return parts.join(' ');
  }
}
