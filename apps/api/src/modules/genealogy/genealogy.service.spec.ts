import { DataSource } from 'typeorm';
import { GenealogyService } from './genealogy.service';
import { SfGenealogyLink } from './entities/sf-genealogy-link.entity';
import { SfGenealogyShipment } from './entities/sf-genealogy-shipment.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { TenantContextService, TenantContext } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

function ctxFor(tenant: string | null): TenantContext {
  return {
    tenant_id: tenant,
    organization_id: null,
    plant_id: null,
    user_email: 'op@axos',
    role: null,
    permissions: null,
    scopes: null,
  };
}

describe('GenealogyService (integration)', () => {
  let ds: DataSource;
  let svc: GenealogyService;
  let ctx: TenantContextService;

  const seedConsumption = (p: Partial<SfConsumptionEvent>) =>
    ds.getRepository(SfConsumptionEvent).save(
      ds.getRepository(SfConsumptionEvent).create({
        idempotencyKey: `k-${Math.random().toString(36).slice(2)}`,
        woId: 'w1',
        woFolio: 'WO-1',
        model: 'M',
        station: 'EST-10',
        part: 'P1',
        units: 1,
        backflushQty: 2,
        unitSerial: 'SN-1',
        operatorEmail: 'op@axos',
        outboxStatus: 'SENT_STUB',
        ...p,
      }),
    );

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfGenealogyLink, SfGenealogyShipment, SfConsumptionEvent],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    svc = new GenealogyService(
      createTenantScopedRepository(SfGenealogyLink, ds.manager, ctx),
      createTenantScopedRepository(SfGenealogyShipment, ds.manager, ctx),
      ds.getRepository(SfConsumptionEvent),
      ctx,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('derives an as-built tree from the live consumption ledger (no index, lot gap flagged)', async () => {
    await seedConsumption({ part: 'P1', station: 'EST-10' });
    await seedConsumption({ part: 'P2', station: 'EST-20', operatorEmail: 'op2@axos' });

    const tree = await svc.asBuiltBySerial('SN-1');
    expect(tree.componentCount).toBe(2);
    expect(tree.parts.map((p) => p.part)).toEqual(['P1', 'P2']);
    expect(tree.lotCaptureGap).toBe(true); // floor terminal captures no lot
    const p2 = tree.parts.find((p) => p.part === 'P2')!;
    expect(p2.consumptions[0].station).toBe('EST-20');
    expect(p2.consumptions[0].operator).toBe('op2@axos');
  });

  it('an index link enriches lot/reel and supersedes the live event (no double count)', async () => {
    const ev = await seedConsumption({ part: 'P1' });
    await svc.recordLink({
      builtSerial: 'SN-1',
      part: 'P1',
      lot: 'LOT-A',
      reel: 'REEL-9',
      qty: 2,
      sourceEventId: ev.id,
    });

    const tree = await svc.asBuiltBySerial('SN-1');
    expect(tree.componentCount).toBe(1);
    const p1 = tree.parts[0];
    expect(p1.consumptions).toHaveLength(1); // live event superseded by the enriched link
    expect(p1.lots).toEqual(['LOT-A']);
    expect(p1.reels).toEqual(['REEL-9']);
    expect(tree.lotCaptureGap).toBe(false);
  });

  it('where-used by lot rolls up to serials + shipments (the recall query)', async () => {
    await svc.recordLink({ builtSerial: 'SN-1', part: 'P1', lot: 'L1', qty: 1 });
    await svc.recordLink({ builtSerial: 'SN-2', part: 'P1', lot: 'L1', qty: 1 });
    await svc.recordLink({ builtSerial: 'SN-3', part: 'P1', lot: 'L2', qty: 1 });
    await svc.linkShipment({ builtSerial: 'SN-1', shipmentFolio: 'SHP-1', customerName: 'ACME' });

    const res = await svc.whereUsedByLot({ lot: 'L1' });
    expect(res.serialCount).toBe(2);
    expect(res.recallScope.serials).toEqual(['SN-1', 'SN-2']);
    expect(res.shipmentCount).toBe(1);
    expect(res.recallScope.customers).toEqual(['ACME']);
  });

  it('where-used requires at least a lot or a reel', async () => {
    await expect(svc.whereUsedByLot({})).rejects.toThrow(/lote o reel/i);
  });

  it('recordLink and linkShipment are idempotent', async () => {
    await svc.recordLink({ builtSerial: 'SN-1', part: 'P1', lot: 'L1', idempotencyKey: 'fixed' });
    await svc.recordLink({ builtSerial: 'SN-1', part: 'P1', lot: 'L1', idempotencyKey: 'fixed' });
    await svc.linkShipment({ builtSerial: 'SN-1', shipmentFolio: 'SHP-1', idempotencyKey: 'shp' });
    await svc.linkShipment({ builtSerial: 'SN-1', shipmentFolio: 'SHP-1', idempotencyKey: 'shp' });

    const k = await svc.kpis();
    expect(k.indexedLinks).toBe(1);
    expect(k.shipmentLinks).toBe(1);
    expect(k.lotsTracked).toBe(1);
  });

  it('scopes genealogy by tenant (no cross-tenant leak)', async () => {
    await ctx.run(ctxFor('tenant-A'), () =>
      svc.recordLink({ builtSerial: 'SN-1', part: 'P1', lot: 'L1' }),
    );
    const treeB = await ctx.run(ctxFor('tenant-B'), () => svc.asBuiltBySerial('SN-1'));
    expect(treeB.componentCount).toBe(0);

    const treeA = await ctx.run(ctxFor('tenant-A'), () => svc.asBuiltBySerial('SN-1'));
    expect(treeA.componentCount).toBe(1);
  });
});
