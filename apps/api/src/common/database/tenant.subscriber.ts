import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  SoftRemoveEvent,
  LoadEvent,
} from 'typeorm';
import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { TenantContextService } from '../services/tenant-context.service';

/**
 * TenantSubscriber — Global TypeORM EntitySubscriber
 *
 * Enforces organizational scope (tenant isolation) at the database layer.
 * Intercepts every entity lifecycle event to:
 *
 *   • beforeInsert  — Auto-populate tenantId / buildingId from the current
 *                     TenantContext when the entity carries those fields.
 *   • beforeUpdate  — Validate that the mutation targets an entity within
 *                     the caller's allowed scope (scoped users only).
 *   • beforeRemove  — Same scope validation as beforeUpdate.
 *   • afterLoad     — Log cross-tenant reads in debug mode for auditing.
 *
 * FIND QUERY INTERCEPTION
 * TypeORM 0.3.x EntitySubscriberInterface does not expose a beforeFind hook.
 * Automatic SELECT filtering is implemented at the service layer via:
 *
 *   1. TenantContextService.allowsBuilding() guards in service methods.
 *   2. The withTenantScope() query builder helper (see below).
 *   3. For critical entities a TenantAwareBaseService abstract class forces
 *      scope injection before every repository.find() call.
 *
 * TENANT MODEL
 * AXOS OS uses organisational scoping (building / program / line) rather than
 * classic row-level tenancy. The "tenantId" column on Plans and Kits maps to
 * the primary buildingId of the owning unit. This subscriber enforces that
 * model without requiring per-entity repository changes.
 */
@EventSubscriber()
@Injectable()
export class TenantSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TenantSubscriber.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly tenantCtx: TenantContextService,
  ) {
    // Self-register with TypeORM at construction time
    this.dataSource.subscribers.push(this);
  }

  /** Applies to ALL entities — no listenTo() filter. */

  // ── INSERT ─────────────────────────────────────────────────────────────

  beforeInsert(event: InsertEvent<any>): void {
    const ctx  = this.tenantCtx.get();
    const ent  = event.entity;
    if (!ctx || !ent) return;

    // Auto-populate tenantId when the entity declares it and context provides one
    if ('tenantId' in ent && !ent.tenantId && ctx.buildings?.length === 1) {
      ent.tenantId = ctx.buildings[0];
    }

    // Auto-populate buildingId (Plans, Advances, etc.) from single-building context
    if ('buildingId' in ent && !ent.buildingId && ctx.buildings?.length === 1) {
      ent.buildingId = ctx.buildings[0];
    }

    // Auto-populate building (ProductionWip, etc.)
    if ('building' in ent && !ent.building && ctx.buildings?.length === 1) {
      ent.building = ctx.buildings[0];
    }
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────

  beforeUpdate(event: UpdateEvent<any>): void {
    const ctx = this.tenantCtx.get();
    const ent = event.entity;
    if (!ctx || !ent || !ctx.isScoped) return; // Skip for unrestricted users

    this.assertAllowed(ent, ctx, 'UPDATE', event.metadata?.tableName);
  }

  // ── REMOVE ─────────────────────────────────────────────────────────────

  beforeRemove(event: RemoveEvent<any>): void {
    const ctx = this.tenantCtx.get();
    const ent = event.entity;
    if (!ctx || !ent || !ctx.isScoped) return;

    this.assertAllowed(ent, ctx, 'DELETE', event.metadata?.tableName);
  }

  beforeSoftRemove(event: SoftRemoveEvent<any>): void {
    const ctx = this.tenantCtx.get();
    const ent = event.entity;
    if (!ctx || !ent || !ctx.isScoped) return;

    this.assertAllowed(ent, ctx, 'SOFT_DELETE', event.metadata?.tableName);
  }

  // ── LOAD (read) ─────────────────────────────────────────────────────────

  afterLoad(entity: any, event?: LoadEvent<any>): void {
    const ctx = this.tenantCtx.get();
    if (!ctx?.isScoped || !entity) return;

    // Debug-level cross-tenant read auditing
    if (
      ctx.buildings.length > 0 &&
      'buildingId' in entity &&
      entity.buildingId &&
      !ctx.buildings.includes(entity.buildingId)
    ) {
      this.logger.debug(
        `Cross-scope read: table=${event?.metadata?.tableName} ` +
        `buildingId=${entity.buildingId} allowedScope=${ctx.buildings.join(',')}`,
      );
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private assertAllowed(
    entity: Record<string, any>,
    ctx: ReturnType<TenantContextService['get']>,
    operation: string,
    table: string | undefined,
  ): void {
    if (!ctx) return;

    const entityBuilding = entity.buildingId ?? entity.building ?? entity.tenantId;
    if (
      entityBuilding &&
      ctx.buildings.length > 0 &&
      !ctx.buildings.includes(entityBuilding)
    ) {
      const msg =
        `Tenant scope violation: ${operation} on table=${table} ` +
        `building=${entityBuilding} blocked for user=${ctx.userId}`;
      this.logger.warn(msg);
      throw new ForbiddenException('Operation not permitted in your organizational scope');
    }
  }
}

// ── Utility: withTenantScope query builder helper ───────────────────────────

/**
 * Injects tenant-scoping WHERE conditions onto a TypeORM SelectQueryBuilder.
 *
 * Usage in services:
 *   const qb = this.planRepo.createQueryBuilder('plan');
 *   withTenantScope(qb, ctx, 'plan');
 *   return qb.getMany();
 */
import { SelectQueryBuilder } from 'typeorm';

export function withTenantScope<T>(
  qb: SelectQueryBuilder<T>,
  ctx: ReturnType<TenantContextService['get']>,
  alias: string,
  opts: {
    buildingField?: string;
    programField?: string;
    lineField?: string;
  } = {},
): SelectQueryBuilder<T> {
  if (!ctx || !ctx.isScoped) return qb;

  const buildingField = opts.buildingField ?? 'buildingId';
  const programField  = opts.programField  ?? 'program';
  const lineField     = opts.lineField     ?? 'line';

  if (ctx.buildings.length > 0) {
    qb.andWhere(`${alias}.${buildingField} IN (:...tenantBuildings)`, {
      tenantBuildings: ctx.buildings,
    });
  }

  if (ctx.programs.length > 0) {
    qb.andWhere(`${alias}.${programField} IN (:...tenantPrograms)`, {
      tenantPrograms: ctx.programs,
    });
  }

  return qb;
}
