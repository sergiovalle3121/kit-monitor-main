import { TenantSubscriber } from './tenant.subscriber';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Construye el subscriber con un DataSource y un TenantContext mockeados. El
 * subscriber global no se instancia en ningún otro spec (todos usan DataSource
 * aislado o DI mockeado), así que este es el único test que cubre beforeInsert.
 */
function makeSub(ctx: unknown): TenantSubscriber {
  const tenantCtx = { get: () => ctx } as unknown as TenantContextService;
  const dataSource = { subscribers: [] as unknown[] } as never;
  return new TenantSubscriber(dataSource, tenantCtx);
}

describe('TenantSubscriber.beforeInsert — población de tenant_id', () => {
  it('estampa el tenant_id (snake) desde el claim JWT', () => {
    const sub = makeSub({ tenant_id: 'T1', scopes: {} });
    const ent: Record<string, unknown> = { tenant_id: null };
    sub.beforeInsert({ entity: ent } as never);
    expect(ent.tenant_id).toBe('T1');
  });

  it('no sobrescribe un tenant_id ya presente', () => {
    const sub = makeSub({ tenant_id: 'T1', scopes: {} });
    const ent: Record<string, unknown> = { tenant_id: 'KEEP' };
    sub.beforeInsert({ entity: ent } as never);
    expect(ent.tenant_id).toBe('KEEP');
  });

  it('deja tenant_id en null cuando el JWT no trae tenant (admin/owner/seed)', () => {
    const sub = makeSub({ tenant_id: null, scopes: {} });
    const ent: Record<string, unknown> = { tenant_id: null };
    sub.beforeInsert({ entity: ent } as never);
    expect(ent.tenant_id).toBeNull();
  });

  it('no agrega tenant_id a entidades que no declaran la columna', () => {
    const sub = makeSub({ tenant_id: 'T1', scopes: {} });
    const ent: Record<string, unknown> = { name: 'x' };
    sub.beforeInsert({ entity: ent } as never);
    expect('tenant_id' in ent).toBe(false);
  });

  it('nunca lanza en el path de sistema/seed (sin contexto)', () => {
    const sub = makeSub(undefined);
    const ent: Record<string, unknown> = { tenant_id: null };
    expect(() => sub.beforeInsert({ entity: ent } as never)).not.toThrow();
    expect(ent.tenant_id).toBeNull();
  });

  it('sigue auto-rellenando buildingId desde un scope de un solo building (sin cambios)', () => {
    const sub = makeSub({ tenant_id: null, scopes: { buildings: ['B1'] } });
    const ent: Record<string, unknown> = { buildingId: null };
    sub.beforeInsert({ entity: ent } as never);
    expect(ent.buildingId).toBe('B1');
  });
});
