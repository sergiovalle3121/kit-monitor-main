import { DataSource } from 'typeorm';
import { LineEngineeringService } from './line-engineering.service';
import { SfLineStation } from './entities/sf-line-station.entity';
import { SfModelLine } from './entities/sf-model-line.entity';
import { SfLineLayout } from './entities/sf-line-layout.entity';
import {
  TenantContextService,
  TenantContext,
} from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

function ctxFor(tenant: string | null): TenantContext {
  return {
    tenant_id: tenant,
    organization_id: null,
    plant_id: null,
    user_email: 'ie@test',
    role: null,
    permissions: null,
    scopes: null,
  };
}

describe('LineEngineeringService (integration)', () => {
  let dataSource: DataSource;
  let service: LineEngineeringService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfLineStation, SfModelLine, SfLineLayout],
    });
    await dataSource.initialize();
    ctx = new TenantContextService();
    service = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, dataSource.manager, ctx),
      createTenantScopedRepository(SfModelLine, dataSource.manager, ctx),
      ctx,
      createTenantScopedRepository(SfLineLayout, dataSource.manager, ctx),
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  async function seedRoute() {
    await service.createStation({
      model: 'AX-1000',
      line: 'SMT-1',
      station: 'EST-30',
      sequence: 30,
      npExpected: 'P3',
      useFactor: 1,
      stdTimeSec: 30,
      visualAidUrl: 'c',
    });
    await service.createStation({
      model: 'AX-1000',
      line: 'SMT-1',
      station: 'EST-10',
      sequence: 10,
      npExpected: 'P1',
      useFactor: 2,
      stdTimeSec: 40,
      visualAidUrl: 'a',
    });
    await service.createStation({
      model: 'AX-1000',
      line: 'SMT-1',
      station: 'EST-20',
      sequence: 20,
      npExpected: 'P2',
      useFactor: 1,
      stdTimeSec: 55,
      visualAidUrl: 'b',
      ctq: true,
    });
  }

  it('returns the routing ordered by sequence', async () => {
    await seedRoute();
    const route = await service.routing('AX-1000');
    expect(route.map((s) => s.station)).toEqual(['EST-10', 'EST-20', 'EST-30']);
  });

  it('exposes station requirements (np + use factor) — the staging/operator bridge', async () => {
    await seedRoute();
    const reqs = await service.stationRequirements('AX-1000');
    expect(reqs).toHaveLength(3);
    expect(reqs[0]).toMatchObject({
      station: 'EST-10',
      npExpected: 'P1',
      useFactor: 2,
    });
    expect(reqs[1]).toMatchObject({ station: 'EST-20', ctq: true });
  });

  it('balances the line against a takt target', async () => {
    await seedRoute();
    const b = await service.balance({ model: 'AX-1000', taktTargetSec: 60 });
    expect(b.bottleneckStation).toBe('EST-20');
    expect(b.lineCycleTimeSec).toBe(55);
    expect(b.stationsOverTakt).toEqual([]);
    expect(b.completeness.total).toBe(3);
    expect(b.completeness.completenessPct).toBe(1); // all have np + factor + aid
  });

  it('computes capacity/load including changeover', async () => {
    await seedRoute();
    await service.qualify({
      model: 'AX-1000',
      line: 'SMT-1',
      changeoverMinutes: 30,
      taktTargetSec: 60,
    });
    // bottleneck 55s/unit × 100 units = 5500s = 91.67min + 30 changeover = 121.67
    const cap = await service.capacity({
      model: 'AX-1000',
      line: 'SMT-1',
      availableMinutes: 480,
      demandUnits: 100,
    });
    expect(cap.requiredMinutes).toBeCloseTo(91.67, 1);
    expect(cap.changeoverMinutes).toBe(30);
    expect(cap.feasible).toBe(true);
  });

  it('rejects duplicate model↔line qualification', async () => {
    await service.qualify({ model: 'AX-1000', line: 'SMT-1' });
    await expect(
      service.qualify({ model: 'AX-1000', line: 'SMT-1' }),
    ).rejects.toThrow(/ya está calificado/);
  });

  it('aggregates IE KPIs (visual-aid coverage, balanced models)', async () => {
    await seedRoute();
    await service.qualify({
      model: 'AX-1000',
      line: 'SMT-1',
      taktTargetSec: 60,
    });
    const k = await service.kpis();
    expect(k.stationsTotal).toBe(3);
    expect(k.stationsWithVisualAid).toBe(3);
    expect(k.pctVisualAid).toBe(1);
    expect(k.modelsQualified).toBe(1);
    expect(k.ctqStations).toBe(1);
  });

  it('persists a 2D layout additively and reloads it (routing stays intact)', async () => {
    await seedRoute();
    const before = await service.getLayout('AX-1000');
    expect(before.stations).toHaveLength(3);
    expect(before.stations.every((s) => s.x === null)).toBe(true); // empty state
    expect(before.footprint).toMatchObject({ unit: 'mm', gridSize: 500 }); // defaults

    const target = before.stations.find((s) => s.station === 'EST-20')!;
    await service.saveLayout({
      model: 'AX-1000',
      footprint: {
        footprintW: 12000,
        footprintH: 8000,
        unit: 'm',
        gridSize: 250,
      },
      positions: [
        { id: target.id, x: 1000, y: 2000, w: 1500, h: 900, rotation: 90 },
      ],
    });

    const after = await service.getLayout('AX-1000');
    expect(after.footprint).toEqual({
      footprintW: 12000,
      footprintH: 8000,
      unit: 'm',
      gridSize: 250,
    });
    const placed = after.stations.find((s) => s.station === 'EST-20')!;
    expect(placed).toMatchObject({
      x: 1000,
      y: 2000,
      w: 1500,
      h: 900,
      rotation: 90,
    });
    // Other stations remain unplaced; routing/balance untouched by the layout save.
    expect(after.stations.filter((s) => s.x === null)).toHaveLength(2);
    const route = await service.routing('AX-1000');
    expect(route.map((s) => s.station)).toEqual(['EST-10', 'EST-20', 'EST-30']);

    // Un-placing clears the coordinates back to NULL.
    await service.saveLayout({ model: 'AX-1000', cleared: [target.id] });
    const cleared = await service.getLayout('AX-1000');
    expect(cleared.stations.every((s) => s.x === null)).toBe(true);
  });

  it('scopes the layout by tenant', async () => {
    const mk = (tenant: string) =>
      ctx.run(ctxFor(tenant), async () => {
        const s = await service.createStation({
          model: 'M',
          line: 'L',
          station: 'S1',
          stdTimeSec: 10,
        });
        await service.saveLayout({
          model: 'M',
          positions: [{ id: s.id, x: 5, y: 6 }],
        });
        return service.getLayout('M');
      });
    const a = await mk('T_A');
    const b = await mk('T_B');
    expect(a.stations).toHaveLength(1);
    expect(b.stations).toHaveLength(1);
    expect(a.stations[0].x).toBe(5);
  });

  it('isolates stations by tenant', async () => {
    await ctx.run(ctxFor('T_A'), () =>
      service.createStation({
        model: 'M',
        line: 'L',
        station: 'S',
        stdTimeSec: 10,
      }),
    );
    await ctx.run(ctxFor('T_B'), () =>
      service.createStation({
        model: 'M',
        line: 'L',
        station: 'S',
        stdTimeSec: 10,
      }),
    );
    const aList = await ctx.run(ctxFor('T_A'), () => service.listStations());
    const bList = await ctx.run(ctxFor('T_B'), () => service.listStations());
    expect(aList).toHaveLength(1);
    expect(bList).toHaveLength(1);
    expect(aList[0].tenant_id).toBe('T_A');
  });
});
