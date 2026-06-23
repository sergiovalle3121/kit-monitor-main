import { Injectable, Logger, Type } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { MetricDefinition } from './entities/metric-definition.entity';
import { OntologyObjectType } from './entities/ontology-object-type.entity';
import { OntologyLinkType } from './entities/ontology-link-type.entity';
import { MetricSnapshot } from './entities/metric-snapshot.entity';
import {
  SEED_LINKS,
  SEED_METRICS,
  SEED_OBJECTS,
} from './semantic-defaults';
import { ErpMmService } from '../erp-core/services/erp-mm.service';
import { ErpSdService } from '../erp-core/services/erp-sd.service';
import { ErpPpService } from '../erp-core/services/erp-pp.service';
import { QualityService } from '../quality/quality.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { UpsertMetricDto } from './dto/upsert-metric.dto';
import { UpsertObjectDto } from './dto/upsert-object.dto';
import { UpsertLinkDto } from './dto/upsert-link.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

const DEFAULT_TENANT = '__default__';

/** The minimal caller identity needed to gate metric resolution by RBAC. */
export interface SemanticPrincipal {
  isAdmin: boolean;
  permissions: string[];
}

/** A computed live value for one metric. */
export interface MetricValue {
  key: string;
  name: string;
  unit: string | null;
  domain: string | null;
  value: number | null;
  restricted: boolean;
  definitionOnly: boolean;
  error?: string;
  asOf: string;
}

interface ResolverDef {
  requiredPermission: string | null;
  compute: () => Promise<number>;
}

/** A KPI alert: a metric whose value breaches its target or trends adversely. */
export interface KpiAlert {
  key: string;
  name: string;
  value: number;
  unit: string | null;
  domain: string | null;
  target: number | null;
  direction: string | null;
  severity: 'warning' | 'critical';
  kind: 'target' | 'trend';
  message: string;
}

/** Merge a target into a metric's config JSON (undefined = leave; null = clear). */
function applyTarget(
  config: Record<string, unknown> | null,
  target?: number | null,
): Record<string, unknown> | null {
  if (target === undefined) return config ?? null;
  const next: Record<string, unknown> = { ...(config ?? {}) };
  if (target === null) delete next.target;
  else next.target = target;
  return Object.keys(next).length ? next : null;
}

function fmtAlertNum(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString('es-MX')
    : n.toLocaleString('es-MX', { maximumFractionDigits: 2 });
}
function unitSuffix(unit: string | null): string {
  return unit === '%' ? '%' : unit === 'USD' ? ' USD' : '';
}

/**
 * The semantic layer: a versioned **metric catalog** + an **ontology** (object
 * types and links) over the real MES/ERP data. It is the single source of truth
 * that the Intelligence Center UI and CIDE both consume. Live metric values are
 * produced by a small resolver registry that delegates to existing domain
 * services, gated by the caller's RBAC permissions.
 */
@Injectable()
export class SemanticService {
  private readonly logger = new Logger(SemanticService.name);

  constructor(
    @InjectRepository(MetricDefinition)
    private readonly metricRepo: Repository<MetricDefinition>,
    @InjectRepository(OntologyObjectType)
    private readonly objectRepo: Repository<OntologyObjectType>,
    @InjectRepository(OntologyLinkType)
    private readonly linkRepo: Repository<OntologyLinkType>,
    @InjectRepository(MetricSnapshot)
    private readonly snapshotRepo: Repository<MetricSnapshot>,
    private readonly moduleRef: ModuleRef,
  ) {}

  private svc<T>(type: Type<T>): T {
    return this.moduleRef.get(type, { strict: false });
  }

  // ── Seeding (idempotent, per tenant) ───────────────────────────────────────
  private async ensureSeeded(tenantId: string): Promise<void> {
    const [metrics, objects, links] = await Promise.all([
      this.metricRepo.count({ where: { tenantId } }),
      this.objectRepo.count({ where: { tenantId } }),
      this.linkRepo.count({ where: { tenantId } }),
    ]);
    if (metrics === 0) {
      await this.metricRepo.save(
        SEED_METRICS.map((m) =>
          this.metricRepo.create({
            tenantId,
            key: m.key,
            name: m.name,
            description: m.description,
            unit: m.unit,
            domain: m.domain,
            grain: m.grain,
            formula: m.formula,
            resolver: m.resolver ?? null,
            direction: m.direction ?? null,
            version: 1,
            active: true,
          }),
        ),
      );
    }
    if (objects === 0) {
      await this.objectRepo.save(
        SEED_OBJECTS.map((o) => this.objectRepo.create({ tenantId, ...o })),
      );
    }
    if (links === 0) {
      await this.linkRepo.save(
        SEED_LINKS.map((l) => this.linkRepo.create({ tenantId, ...l })),
      );
    }
  }

  // ── Catalog (definitions) ───────────────────────────────────────────────────
  async catalog(tenantId = DEFAULT_TENANT, includeInactive = false) {
    await this.ensureSeeded(tenantId);
    // includeInactive (admin editor) returns archived rows too, each with `active`.
    const active = includeInactive ? undefined : true;
    const [metrics, objects, links] = await Promise.all([
      this.metricRepo.find({
        where: { tenantId, active },
        order: { domain: 'ASC', name: 'ASC' },
      }),
      this.objectRepo.find({
        where: { tenantId, active },
        order: { domain: 'ASC', name: 'ASC' },
      }),
      this.linkRepo.find({ where: { tenantId, active } }),
    ]);
    return { metrics, objects, links };
  }

  /** Archive (active=false) or restore (active=true) a catalog item. Admin. */
  async setActive(
    tenantId: string,
    kind: 'metric' | 'object' | 'link',
    key: string,
    active: boolean,
  ): Promise<{ ok: boolean }> {
    const repo = (
      kind === 'metric'
        ? this.metricRepo
        : kind === 'object'
          ? this.objectRepo
          : this.linkRepo
    ) as unknown as Repository<{
      tenantId: string;
      key: string;
      active: boolean;
    }>;
    const res = await repo.update({ tenantId, key }, { active });
    return { ok: (res.affected ?? 0) > 0 };
  }

  async listMetrics(tenantId = DEFAULT_TENANT): Promise<MetricDefinition[]> {
    await this.ensureSeeded(tenantId);
    return this.metricRepo.find({
      where: { tenantId, active: true },
      order: { domain: 'ASC', name: 'ASC' },
    });
  }

  /** A single ontology object type by key (for the drill-down explorer). */
  async getObject(
    key: string,
    tenantId = DEFAULT_TENANT,
  ): Promise<OntologyObjectType | null> {
    await this.ensureSeeded(tenantId);
    return this.objectRepo.findOne({ where: { tenantId, key, active: true } });
  }

  /** Link types touching an object (either end) — its neighborhood in the graph. */
  async linksFor(
    key: string,
    tenantId = DEFAULT_TENANT,
  ): Promise<OntologyLinkType[]> {
    await this.ensureSeeded(tenantId);
    const all = await this.linkRepo.find({ where: { tenantId, active: true } });
    return all.filter((l) => l.fromObject === key || l.toObject === key);
  }

  /** Active metric definitions for a domain (related metrics on a drill-down). */
  async metricsForDomain(
    domain: string,
    tenantId = DEFAULT_TENANT,
  ): Promise<MetricDefinition[]> {
    await this.ensureSeeded(tenantId);
    return this.metricRepo.find({
      where: { tenantId, domain, active: true },
      order: { name: 'ASC' },
    });
  }

  /** Create or update a metric definition (admin). Keyed by tenant + key. */
  async upsertMetric(
    tenantId: string,
    dto: UpsertMetricDto,
  ): Promise<MetricDefinition> {
    await this.ensureSeeded(tenantId);
    const existing = await this.metricRepo.findOne({
      where: { tenantId, key: dto.key },
    });
    if (existing) {
      Object.assign(existing, {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        unit: dto.unit ?? existing.unit,
        domain: dto.domain ?? existing.domain,
        grain: dto.grain ?? existing.grain,
        formula: dto.formula ?? existing.formula,
        direction: dto.direction ?? existing.direction,
        config: applyTarget(existing.config, dto.target),
        // Editing a definition bumps its version (audit of metric drift).
        version: existing.version + 1,
      });
      return this.metricRepo.save(existing);
    }
    return this.metricRepo.save(
      this.metricRepo.create({
        tenantId,
        key: dto.key,
        name: dto.name ?? dto.key,
        description: dto.description ?? null,
        unit: dto.unit ?? null,
        domain: dto.domain ?? null,
        grain: dto.grain ?? null,
        formula: dto.formula ?? null,
        direction: dto.direction ?? null,
        config: applyTarget(null, dto.target),
        version: 1,
        active: true,
      }),
    );
  }

  /** Create or update an ontology object type (admin). Keyed by tenant + key. */
  async upsertObject(
    tenantId: string,
    dto: UpsertObjectDto,
  ): Promise<OntologyObjectType> {
    await this.ensureSeeded(tenantId);
    const properties = Array.isArray(dto.properties)
      ? dto.properties
          .filter((p) => p && typeof p.name === 'string' && p.name.trim())
          .map((p) => ({
            name: String(p.name).trim(),
            type: String(p.type ?? 'string'),
            description: p.description ? String(p.description) : undefined,
          }))
      : undefined;
    const existing = await this.objectRepo.findOne({
      where: { tenantId, key: dto.key },
    });
    if (existing) {
      Object.assign(existing, {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        domain: dto.domain ?? existing.domain,
        sourceEntity: dto.sourceEntity ?? existing.sourceEntity,
        primaryKey: dto.primaryKey ?? existing.primaryKey,
        ...(properties ? { properties } : {}),
      });
      return this.objectRepo.save(existing);
    }
    return this.objectRepo.save(
      this.objectRepo.create({
        tenantId,
        key: dto.key,
        name: dto.name ?? dto.key,
        description: dto.description ?? null,
        domain: dto.domain ?? null,
        sourceEntity: dto.sourceEntity ?? null,
        primaryKey: dto.primaryKey ?? null,
        properties: properties ?? null,
        active: true,
      }),
    );
  }

  /** Create or update an ontology link type (admin). Keyed by tenant + key. */
  async upsertLink(
    tenantId: string,
    dto: UpsertLinkDto,
  ): Promise<OntologyLinkType> {
    await this.ensureSeeded(tenantId);
    const existing = await this.linkRepo.findOne({
      where: { tenantId, key: dto.key },
    });
    if (existing) {
      Object.assign(existing, {
        fromObject: dto.fromObject ?? existing.fromObject,
        toObject: dto.toObject ?? existing.toObject,
        cardinality: dto.cardinality ?? existing.cardinality,
        verb: dto.verb ?? existing.verb,
        description: dto.description ?? existing.description,
      });
      return this.linkRepo.save(existing);
    }
    return this.linkRepo.save(
      this.linkRepo.create({
        tenantId,
        key: dto.key,
        fromObject: dto.fromObject,
        toObject: dto.toObject,
        cardinality: dto.cardinality ?? null,
        verb: dto.verb ?? null,
        description: dto.description ?? null,
        active: true,
      }),
    );
  }

  // ── Live values ─────────────────────────────────────────────────────────────
  /** Registry mapping a metric `resolver` key to a live, RBAC-gated computation. */
  private resolvers(): Record<string, ResolverDef> {
    return {
      inventory_value: {
        requiredPermission: 'inventory:read',
        compute: async () =>
          (await this.svc(ErpMmService).inventoryValuation()).totalValue,
      },
      active_quality_holds: {
        requiredPermission: 'quality:read',
        compute: async () =>
          (await this.svc(QualityService).findAllActiveHolds()).length,
      },
      open_sales_orders: {
        requiredPermission: 'sales:read',
        compute: async () =>
          (await this.svc(ErpSdService).listSOs({})).length,
      },
      suppliers_count: {
        requiredPermission: 'materials:read',
        compute: async () => (await this.svc(SuppliersService).findAll()).length,
      },
      mrp_runs: {
        requiredPermission: 'planning:read',
        compute: async () => (await this.svc(ErpPpService).listRuns()).length,
      },
      ledger_events_24h: {
        requiredPermission: null,
        compute: async () =>
          (await this.svc(EventLedgerService).summarizeActivity({ sinceHours: 24 }))
            .totalEvents,
      },
    };
  }

  private allowed(principal: SemanticPrincipal, perm: string | null): boolean {
    if (principal.isAdmin) return true;
    if (!perm) return true;
    return principal.permissions.includes(perm);
  }

  /** Resolve one metric's current value (or a restricted/definition-only stub). */
  async resolveMetric(
    principal: SemanticPrincipal,
    key: string,
    tenantId = DEFAULT_TENANT,
  ): Promise<MetricValue> {
    await this.ensureSeeded(tenantId);
    const def = await this.metricRepo.findOne({ where: { tenantId, key } });
    const asOf = new Date().toISOString();
    const base = {
      key,
      name: def?.name ?? key,
      unit: def?.unit ?? null,
      domain: def?.domain ?? null,
      value: null as number | null,
      restricted: false,
      definitionOnly: false,
      asOf,
    };
    if (!def) return { ...base, error: 'Métrica no encontrada' };
    const resolver = def.resolver ? this.resolvers()[def.resolver] : undefined;
    if (!resolver) return { ...base, definitionOnly: true };
    if (!this.allowed(principal, resolver.requiredPermission)) {
      return { ...base, restricted: true };
    }
    try {
      const value = await resolver.compute();
      return { ...base, value: Number.isFinite(value) ? value : null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Metric '${key}' failed to resolve: ${message}`);
      return { ...base, error: 'No se pudo calcular en este momento' };
    }
  }

  /** Resolve every active metric the caller may see (one batch for the UI). */
  async values(
    principal: SemanticPrincipal,
    tenantId = DEFAULT_TENANT,
  ): Promise<MetricValue[]> {
    const metrics = await this.listMetrics(tenantId);
    return Promise.all(
      metrics.map((m) => this.resolveMetric(principal, m.key, tenantId)),
    );
  }

  // ── Snapshots (KPI trend over time) ─────────────────────────────────────────
  /**
   * Capture today's value for every resolvable metric of a tenant (idempotent
   * per tenant+metric+day). Runs as a system actor so all metrics are captured;
   * the per-caller RBAC gate is applied later on *read*.
   */
  async captureSnapshots(tenantId = DEFAULT_TENANT): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    const metrics = await this.listMetrics(tenantId);
    const system: SemanticPrincipal = { isAdmin: true, permissions: [] };
    let captured = 0;
    for (const m of metrics) {
      if (!m.resolver) continue;
      const exists = await this.snapshotRepo.findOne({
        where: { tenantId, metricKey: m.key, day },
      });
      if (exists) continue;
      const mv = await this.resolveMetric(system, m.key, tenantId);
      if (mv.value == null) continue;
      await this.snapshotRepo.save(
        this.snapshotRepo.create({
          tenantId,
          metricKey: m.key,
          value: mv.value,
          unit: mv.unit ?? null,
          day,
        }),
      );
      captured++;
    }
    return captured;
  }

  /**
   * Per-metric value history the caller may see (RBAC-gated by the metric's
   * resolver permission). One snapshot query; lazy-seeds a first point if none
   * exist yet so the UI isn't empty on a fresh deploy.
   */
  async metricHistoryBatch(
    principal: SemanticPrincipal,
    tenantId = DEFAULT_TENANT,
    days = 30,
  ): Promise<Record<string, { day: string; value: number }[]>> {
    await this.ensureSeeded(tenantId);
    const total = await this.snapshotRepo.count({ where: { tenantId } });
    if (total === 0) await this.captureSnapshots(tenantId);

    const since = new Date(Date.now() - Math.min(Math.max(days, 1), 365) * 86_400_000);
    const rows = await this.snapshotRepo.find({
      where: { tenantId, capturedAt: MoreThanOrEqual(since) },
      order: { capturedAt: 'ASC' },
      take: 5000,
    });

    const metrics = await this.listMetrics(tenantId);
    const resolverMap = this.resolvers();
    const allowedKeys = new Set(
      metrics
        .filter((m) => {
          const perm = m.resolver
            ? (resolverMap[m.resolver]?.requiredPermission ?? null)
            : null;
          return this.allowed(principal, perm);
        })
        .map((m) => m.key),
    );

    const out: Record<string, { day: string; value: number }[]> = {};
    for (const r of rows) {
      if (r.value == null || !allowedKeys.has(r.metricKey)) continue;
      (out[r.metricKey] ??= []).push({ day: r.day, value: r.value });
    }
    return out;
  }

  // ── KPI alerts (proactive: target breach or adverse trend) ──────────────────
  /**
   * Evaluate proactive KPI alerts for the metrics the caller may see: a value
   * that breaches its target (per `direction`), or a value trending adversely
   * over the recent snapshot window. Deterministic and RBAC-gated.
   */
  async evaluateAlerts(
    principal: SemanticPrincipal,
    tenantId = DEFAULT_TENANT,
  ): Promise<KpiAlert[]> {
    const [metrics, values, history] = await Promise.all([
      this.listMetrics(tenantId),
      this.values(principal, tenantId),
      this.metricHistoryBatch(principal, tenantId, 14),
    ]);
    const valueByKey = new Map(values.map((v) => [v.key, v]));
    const alerts: KpiAlert[] = [];

    for (const m of metrics) {
      const mv = valueByKey.get(m.key);
      if (!mv || mv.value == null || mv.restricted) continue;
      const value = mv.value;
      const dir = m.direction;
      const target =
        m.config && typeof m.config.target === 'number'
          ? (m.config.target as number)
          : null;

      // 1) Target breach (needs a target + a direction).
      if (target != null && dir) {
        const breached = dir === 'down' ? value > target : value < target;
        if (breached) {
          const over =
            target !== 0 ? Math.abs((value - target) / target) * 100 : 100;
          const severity: KpiAlert['severity'] =
            over >= 20 ? 'critical' : 'warning';
          const cmp = dir === 'down' ? 'por encima de' : 'por debajo de';
          alerts.push({
            key: m.key,
            name: m.name,
            value,
            unit: m.unit,
            domain: m.domain,
            target,
            direction: dir,
            severity,
            kind: 'target',
            message: `${m.name}: ${fmtAlertNum(value)}${unitSuffix(m.unit)} está ${cmp} su objetivo (${fmtAlertNum(target)}${unitSuffix(m.unit)}).`,
          });
          continue; // a breached metric doesn't also need a trend alert
        }
      }

      // 2) Adverse trend over the snapshot window.
      if (dir) {
        const pts = history[m.key] ?? [];
        if (pts.length >= 2) {
          const first = pts[0].value;
          const last = pts[pts.length - 1].value;
          if (first !== 0) {
            const changePct = ((last - first) / Math.abs(first)) * 100;
            const adverse =
              (dir === 'up' && changePct <= -15) ||
              (dir === 'down' && changePct >= 15);
            if (adverse) {
              const word = changePct >= 0 ? 'subió' : 'bajó';
              alerts.push({
                key: m.key,
                name: m.name,
                value,
                unit: m.unit,
                domain: m.domain,
                target,
                direction: dir,
                severity: 'warning',
                kind: 'trend',
                message: `${m.name} ${word} ${Math.abs(Math.round(changePct))}% (tendencia adversa) en la ventana reciente.`,
              });
            }
          }
        }
      }
    }

    const rank = { critical: 0, warning: 1 };
    return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }

  /**
   * Push critical KPI alerts to admins via the notifications module (in-app +
   * web-push). Deduped per metric+kind+day so an admin gets at most one ping per
   * critical KPI per day. Only `critical` alerts are pushed (high signal); the
   * dashboard still shows all. Best-effort: failures never break the caller.
   * Services are resolved lazily so the semantic module stays decoupled.
   */
  async notifyAlerts(tenantId = DEFAULT_TENANT): Promise<number> {
    const alerts = await this.evaluateAlerts(
      { isAdmin: true, permissions: [] },
      tenantId,
    );
    const critical = alerts.filter((a) => a.severity === 'critical');
    if (critical.length === 0) return 0;

    let notifs: NotificationsService;
    let users: UsersService;
    try {
      notifs = this.moduleRef.get(NotificationsService, { strict: false });
      users = this.moduleRef.get(UsersService, { strict: false });
    } catch {
      return 0; // notifications/users not resolvable in this context
    }

    const admins = (await users.findAll()).filter((u) => u.role === 'Admin');
    if (admins.length === 0) return 0;
    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    for (const a of critical) {
      for (const admin of admins) {
        try {
          await notifs.create({
            userId: admin.id,
            title: `Alerta de KPI: ${a.name}`,
            body: a.message,
            kind: 'kpi-alert',
            severity: 'critical',
            domain: a.domain ?? undefined,
            href: '/dashboard/intelligence',
            dedupeKey: `kpi:${a.key}:${a.kind}:${today}`,
          });
          sent++;
        } catch (e) {
          this.logger.warn(
            `KPI alert notify failed: ${(e as Error)?.message ?? e}`,
          );
        }
      }
    }
    if (sent > 0) this.logger.log(`Sent ${sent} KPI alert notification(s).`);
    return sent;
  }

  /** Daily KPI snapshot + critical-alert push for the default tenant. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailySnapshot(): Promise<void> {
    try {
      const n = await this.captureSnapshots(DEFAULT_TENANT);
      if (n > 0) this.logger.log(`Captured ${n} metric snapshot(s).`);
      await this.notifyAlerts(DEFAULT_TENANT);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Metric snapshot/alert job failed: ${msg}`);
    }
  }
}
