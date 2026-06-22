import { SelectQueryBuilder } from 'typeorm';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

/**
 * Shared tenant/plant scoping for every CRM query builder. Mirrors the rule used
 * across the codebase: NULL scope rows are visible only to the NULL context, so
 * demo/global data and tenant data never leak across each other.
 */
export function applyCrmScope<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  ctx: TenantContextService,
): SelectQueryBuilder<T> {
  const tenant = ctx.getTenantId();
  const plant = ctx.getPlantId();
  if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
  else qb.andWhere(`${alias}.tenant_id IS NULL`);
  if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
  else qb.andWhere(`${alias}.plant_id IS NULL`);
  return qb;
}

/** The scope stamp written on every CRM row at create time. */
export function crmScopeStamp(ctx: TenantContextService) {
  return {
    tenant_id: ctx.getTenantId(),
    plant_id: ctx.getPlantId(),
    created_by: ctx.getUserEmail(),
  };
}
