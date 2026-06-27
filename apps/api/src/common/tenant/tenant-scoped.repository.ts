import {
  DataSource,
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { Provider } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

/**
 * A TypeORM repository that AUTOMATICALLY injects `WHERE tenant_id = <ctx tenant>`
 * into every read (`find` / `findOne` / `findBy` / `findOneBy` / `count` /
 * `findAndCount` / `exist`), reading the active tenant from TenantContextService.
 *
 * Isolation no longer depends on each service remembering to filter. Notes:
 * - The tenant comes from the JWT (via TenantInterceptor → context), never the
 *   request body.
 * - If there is no tenant in context (e.g. system/seed) OR the entity has no
 *   `tenant_id` column, no filter is added — so existing single-tenant/admin
 *   flows are unaffected. This makes adoption additive and safe.
 * - QueryBuilder reads bypass these methods; for those use `withTenantScope()`.
 */
export class TenantScopedRepository<
  T extends ObjectLiteral,
> extends Repository<T> {
  private tenantCtx?: TenantContextService;

  setTenantContext(ctx: TenantContextService): this {
    this.tenantCtx = ctx;
    return this;
  }

  /**
   * The PROPERTY name of the tenant column on this entity, or null if it has none.
   * Supports both conventions in the codebase: snake `tenant_id` (mayoría) and
   * camel `tenantId` (ai_*, sem_*, erp_journal_entries, …). Se filtra por nombre
   * de propiedad porque el `where` de TypeORM usa propiedades, no columnas DB.
   */
  private tenantProp(): string | null {
    const col = this.metadata.columns.find(
      (c) =>
        c.databaseName === 'tenant_id' ||
        c.propertyName === 'tenant_id' ||
        c.databaseName === 'tenantId' ||
        c.propertyName === 'tenantId',
    );
    return col ? col.propertyName : null;
  }

  /** The tenant filter to apply, or null when scoping should not be applied. */
  private tenantFilter(): FindOptionsWhere<T> | null {
    const tenant = this.tenantCtx?.getTenantId() ?? null;
    const prop = this.tenantProp();
    if (!tenant || !prop) return null;
    return { [prop]: tenant } as unknown as FindOptionsWhere<T>;
  }

  private mergeWhere(where: unknown): unknown {
    const tf = this.tenantFilter();
    if (!tf) return where;
    if (where === undefined || where === null) return tf;
    if (Array.isArray(where)) {
      // OR-array of conditions: scope each branch by tenant (AND).
      return where.map((w) => ({ ...(w as object), ...tf }));
    }
    return { ...(where as object), ...tf };
  }

  override find(options?: FindManyOptions<T>): Promise<T[]> {
    return super.find({ ...(options ?? {}), where: this.mergeWhere(options?.where) as FindOptionsWhere<T> });
  }

  override findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return super.findAndCount({ ...(options ?? {}), where: this.mergeWhere(options?.where) as FindOptionsWhere<T> });
  }

  override findOne(options: FindOneOptions<T>): Promise<T | null> {
    return super.findOne({ ...options, where: this.mergeWhere(options.where) as FindOptionsWhere<T> });
  }

  override count(options?: FindManyOptions<T>): Promise<number> {
    return super.count({ ...(options ?? {}), where: this.mergeWhere(options?.where) as FindOptionsWhere<T> });
  }

  override findBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T[]> {
    return super.findBy(this.mergeWhere(where) as FindOptionsWhere<T>);
  }

  override findOneBy(
    where: FindOptionsWhere<T> | FindOptionsWhere<T>[],
  ): Promise<T | null> {
    return super.findOneBy(this.mergeWhere(where) as FindOptionsWhere<T>);
  }

  override exists(options?: FindManyOptions<T>): Promise<boolean> {
    return super.exists({ ...(options ?? {}), where: this.mergeWhere(options?.where) as FindOptionsWhere<T> });
  }
}

/** Factory: build a tenant-scoped repository bound to a context + manager. */
export function createTenantScopedRepository<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  manager: EntityManager,
  ctx: TenantContextService,
): TenantScopedRepository<T> {
  const repo = new TenantScopedRepository<T>(entity, manager, manager.queryRunner);
  return repo.setTenantContext(ctx);
}

/** Injection token for a tenant-scoped repository of `entity`. */
export function getTenantRepositoryToken(entity: EntityTarget<ObjectLiteral>): string {
  const name =
    typeof entity === 'function'
      ? entity.name
      : (entity as { name?: string }).name ?? String(entity);
  return `TENANT_SCOPED_REPOSITORY_${name}`;
}

/**
 * NestJS provider for a tenant-scoped repository. Inject it in a service with
 * `@Inject(getTenantRepositoryToken(Entity))`.
 */
export function provideTenantScopedRepository(
  entity: EntityTarget<ObjectLiteral>,
): Provider {
  return {
    provide: getTenantRepositoryToken(entity),
    inject: [DataSource, TenantContextService],
    useFactory: (dataSource: DataSource, ctx: TenantContextService) =>
      createTenantScopedRepository(entity, dataSource.manager, ctx),
  };
}
