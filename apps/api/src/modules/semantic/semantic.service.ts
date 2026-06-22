import { Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricDefinition } from './entities/metric-definition.entity';
import { OntologyObjectType } from './entities/ontology-object-type.entity';
import { OntologyLinkType } from './entities/ontology-link-type.entity';
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
  async catalog(tenantId = DEFAULT_TENANT) {
    await this.ensureSeeded(tenantId);
    const [metrics, objects, links] = await Promise.all([
      this.metricRepo.find({
        where: { tenantId, active: true },
        order: { domain: 'ASC', name: 'ASC' },
      }),
      this.objectRepo.find({
        where: { tenantId, active: true },
        order: { domain: 'ASC', name: 'ASC' },
      }),
      this.linkRepo.find({ where: { tenantId, active: true } }),
    ]);
    return { metrics, objects, links };
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
        version: 1,
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
}
