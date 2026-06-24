import {
  Column,
  DataSource,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantContextService, TenantContext } from './tenant-context.service';
import {
  createTenantScopedRepository,
  TenantScopedRepository,
} from './tenant-scoped.repository';

/**
 * Anti-leak: contrato de aislamiento del TenantScopedRepository sobre TODA su
 * superficie de lectura. Los datos se siembran con tenant_id explícito (la
 * población automática del tenant_id la cubre tenant.subscriber.spec.ts). Aquí se
 * prueba que el tenant A nunca ve ni alcanza filas del tenant B por ningún método.
 */
@Entity('tiso_widgets')
class Widget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true, name: 'tenant_id' })
  tenant_id: string | null;

  @Column({ type: 'varchar' })
  name: string;
}

function ctxFor(tenant: string | null): TenantContext {
  return {
    tenant_id: tenant,
    organization_id: null,
    plant_id: null,
    user_email: 'u@test',
    role: null,
    permissions: null,
    scopes: null,
  };
}

describe('Tenant isolation — anti-leak (A nunca alcanza B)', () => {
  let dataSource: DataSource;
  let ctx: TenantContextService;
  let scoped: TenantScopedRepository<Widget>;
  let bId: number;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Widget],
    });
    await dataSource.initialize();
    ctx = new TenantContextService();
    scoped = createTenantScopedRepository(Widget, dataSource.manager, ctx);

    await dataSource.getRepository(Widget).save([
      { tenant_id: 'A', name: 'a1' },
      { tenant_id: 'A', name: 'a2' },
      { tenant_id: 'B', name: 'b1' },
    ]);
    bId = (await dataSource
      .getRepository(Widget)
      .findOneByOrFail({ name: 'b1' })).id;
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('todas las lecturas con scope de A devuelven solo filas de A', async () => {
    await ctx.run(ctxFor('A'), async () => {
      expect((await scoped.find()).map((w) => w.name).sort()).toEqual([
        'a1',
        'a2',
      ]);
      expect(await scoped.count()).toBe(2);
      const [rows, total] = await scoped.findAndCount();
      expect(rows).toHaveLength(2);
      expect(total).toBe(2);
      expect(await scoped.findBy({})).toHaveLength(2);
      expect(await scoped.exists({ where: { name: 'a1' } })).toBe(true);
    });
  });

  it('A no puede alcanzar una fila de B (ni por filtro ni por id) — no leak', async () => {
    await ctx.run(ctxFor('A'), async () => {
      expect(await scoped.findOne({ where: { name: 'b1' } })).toBeNull();
      expect(await scoped.findOneBy({ name: 'b1' })).toBeNull();
      // Aun conociendo el id de B, el scope evita traerlo (no se puede editar/borrar
      // lo que no se puede leer a través del repo con scope).
      expect(await scoped.findOne({ where: { id: bId } })).toBeNull();
      expect(await scoped.exists({ where: { name: 'b1' } })).toBe(false);
    });
  });

  it('una condición OR se acota por tenant en cada rama (sin fuga por b1)', async () => {
    const rows = await ctx.run(ctxFor('A'), () =>
      scoped.find({ where: [{ name: 'a1' }, { name: 'b1' }] }),
    );
    expect(rows.map((w) => w.name)).toEqual(['a1']);
  });

  it('contexto sin tenant (admin/sistema) no filtra: ve las 3 filas', async () => {
    expect(await scoped.find()).toHaveLength(3); // sin ctx.run → getTenantId() null
  });
});
