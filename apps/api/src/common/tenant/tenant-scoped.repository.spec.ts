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

@Entity('tsr_test_widgets')
class Widget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  tenant_id: string | null;

  @Column({ type: 'varchar' })
  name: string;
}

@Entity('tsr_test_globals')
class GlobalThing {
  @PrimaryGeneratedColumn()
  id: number;

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

describe('TenantScopedRepository (anti-leak)', () => {
  let dataSource: DataSource;
  let ctx: TenantContextService;
  let widgets: TenantScopedRepository<Widget>;
  let globals: TenantScopedRepository<GlobalThing>;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Widget, GlobalThing],
    });
    await dataSource.initialize();

    ctx = new TenantContextService();
    widgets = createTenantScopedRepository(Widget, dataSource.manager, ctx);
    globals = createTenantScopedRepository(GlobalThing, dataSource.manager, ctx);

    // Seed two tenants.
    await dataSource.getRepository(Widget).save([
      { tenant_id: 'TENANT_A', name: 'a1' },
      { tenant_id: 'TENANT_A', name: 'a2' },
      { tenant_id: 'TENANT_B', name: 'b1' },
    ]);
    await dataSource.getRepository(GlobalThing).save([{ name: 'g1' }, { name: 'g2' }]);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('find() returns only the active tenant rows', async () => {
    const a = await ctx.run(ctxFor('TENANT_A'), () => widgets.find());
    expect(a.map((w) => w.name).sort()).toEqual(['a1', 'a2']);

    const b = await ctx.run(ctxFor('TENANT_B'), () => widgets.find());
    expect(b.map((w) => w.name)).toEqual(['b1']);
  });

  it('count() is tenant-scoped', async () => {
    expect(await ctx.run(ctxFor('TENANT_A'), () => widgets.count())).toBe(2);
    expect(await ctx.run(ctxFor('TENANT_B'), () => widgets.count())).toBe(1);
  });

  it('findOne() cannot reach another tenant row', async () => {
    const leaked = await ctx.run(ctxFor('TENANT_A'), () =>
      widgets.findOne({ where: { name: 'b1' } }),
    );
    expect(leaked).toBeNull();
  });

  it('findBy() with an empty filter still scopes by tenant', async () => {
    const a = await ctx.run(ctxFor('TENANT_A'), () => widgets.findBy({}));
    expect(a).toHaveLength(2);
  });

  it('an OR-array where is scoped on every branch (no leak)', async () => {
    const rows = await ctx.run(ctxFor('TENANT_A'), () =>
      widgets.find({ where: [{ name: 'a1' }, { name: 'b1' }] }),
    );
    // b1 belongs to tenant B → must not appear for tenant A.
    expect(rows.map((w) => w.name)).toEqual(['a1']);
  });

  it('without a tenant in context it does not filter (backward compatible)', async () => {
    const all = await widgets.find(); // no ctx.run → getTenantId() null
    expect(all).toHaveLength(3);
  });

  it('entities without a tenant_id column are never filtered', async () => {
    const all = await ctx.run(ctxFor('TENANT_A'), () => globals.find());
    expect(all).toHaveLength(2);
  });
});
