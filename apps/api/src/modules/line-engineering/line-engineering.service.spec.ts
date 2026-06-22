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

  it('builds a per-station cycle-time heatmap vs takt (Fase 9)', async () => {
    await seedRoute();
    const hm = await service.getHeatmap({
      model: 'AX-1000',
      taktTargetSec: 60,
    });
    expect(hm.bottleneckStation).toBe('EST-20');
    expect(hm.taktSec).toBe(60);
    const byName = new Map(hm.stations.map((s) => [s.station, s]));
    // 55/60 ≈ 0.92 → hot + bottleneck; 40/60 ≈ 0.67 → warm; 30/60 = 0.5 → cool
    expect(byName.get('EST-20')).toMatchObject({
      level: 'hot',
      bottleneck: true,
      overTakt: false,
      line: 'SMT-1',
    });
    expect(byName.get('EST-10')?.level).toBe('warm');
    expect(byName.get('EST-30')?.level).toBe('cool');
    expect(byName.get('EST-20')?.utilizationPct).toBeCloseTo(91.7, 0);
  });

  it('flags over-takt stations and falls back to the bottleneck with no takt (Fase 9)', async () => {
    await seedRoute();
    // Tight takt: the 55s bottleneck now exceeds takt → over.
    const tight = await service.getHeatmap({
      model: 'AX-1000',
      taktTargetSec: 45,
    });
    const est20 = tight.stations.find((s) => s.station === 'EST-20');
    expect(est20).toMatchObject({ level: 'over', overTakt: true });

    // No takt at all → ramp normalizes against the bottleneck (load 0..1).
    const noTakt = await service.getHeatmap({ model: 'AX-1000' });
    expect(noTakt.taktSec).toBe(0);
    const byName = new Map(noTakt.stations.map((s) => [s.station, s]));
    expect(byName.get('EST-20')).toMatchObject({ loadPct: 100, level: 'hot' });
    expect(byName.get('EST-20')?.overTakt).toBe(false);
    expect(byName.get('EST-10')?.loadPct).toBeCloseTo(72.7, 0);
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

  it('persists flow connectors, dropping invalid links (Fase 4)', async () => {
    await seedRoute(); // EST-10, EST-20, EST-30
    const before = await service.getLayout('AX-1000');
    expect(before.connectors).toEqual([]);
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );

    await service.saveLayout({
      model: 'AX-1000',
      connectors: [
        { from: id['EST-10'], to: id['EST-20'] },
        { from: id['EST-20'], to: id['EST-30'], kind: 'conveyor' },
        { from: id['EST-30'], to: 'ghost' }, // dropped: unknown target
        { from: id['EST-10'], to: id['EST-10'] }, // dropped: self-link
      ],
    });

    const after = await service.getLayout('AX-1000');
    expect(after.connectors).toHaveLength(2);
    expect(after.connectors[0]).toMatchObject({
      from: id['EST-10'],
      to: id['EST-20'],
      kind: 'flow',
    });
    expect(after.connectors[1]).toMatchObject({ kind: 'conveyor' });
  });

  it('persists equipment assets on the plan (Fase 5)', async () => {
    await seedRoute();
    expect((await service.getLayout('AX-1000')).assets).toEqual([]);
    await service.saveLayout({
      model: 'AX-1000',
      assets: [
        {
          id: 'a1',
          kind: 'workbench',
          x: 100,
          y: 200,
          w: 1200,
          h: 800,
          rotation: 90,
          label: 'Mesa 1',
        },
        { id: 'a2', kind: 'rack', x: 0, y: 0, w: 600, h: 400 },
      ],
    });
    const after = await service.getLayout('AX-1000');
    expect(after.assets).toHaveLength(2);
    expect(after.assets[0]).toMatchObject({
      id: 'a1',
      kind: 'workbench',
      x: 100,
      w: 1200,
      rotation: 90,
      label: 'Mesa 1',
    });
    expect(after.assets[1]).toMatchObject({ kind: 'rack', rotation: 0 });
  });

  it('persists annotations: text labels and dimensions (Fase 7)', async () => {
    await seedRoute();
    expect((await service.getLayout('AX-1000')).annotations).toEqual([]);
    await service.saveLayout({
      model: 'AX-1000',
      annotations: [
        { id: 'n1', type: 'text', x: 500, y: 600, text: 'Celda A' },
        { id: 'n2', type: 'dim', x: 0, y: 0, x2: 1000, y2: 0 },
      ],
    });
    const after = await service.getLayout('AX-1000');
    expect(after.annotations).toHaveLength(2);
    expect(after.annotations[0]).toMatchObject({
      id: 'n1',
      type: 'text',
      text: 'Celda A',
    });
    expect(after.annotations[1]).toMatchObject({ type: 'dim', x2: 1000 });
  });

  it('clones a layout to another model, remapping by station name (Fase 8)', async () => {
    await seedRoute(); // AX-1000: EST-10/20/30
    await service.createStation({
      model: 'AX-2000',
      line: 'SMT-1',
      station: 'EST-10',
      sequence: 10,
      stdTimeSec: 30,
    });
    await service.createStation({
      model: 'AX-2000',
      line: 'SMT-1',
      station: 'EST-20',
      sequence: 20,
      stdTimeSec: 30,
    });

    const src = await service.getLayout('AX-1000');
    const id = Object.fromEntries(src.stations.map((s) => [s.station, s.id]));
    await service.saveLayout({
      model: 'AX-1000',
      footprint: { footprintW: 9000, gridSize: 300 },
      positions: [
        { id: id['EST-10'], x: 100, y: 100, w: 500, h: 400 },
        { id: id['EST-20'], x: 700, y: 100, w: 500, h: 400 },
        { id: id['EST-30'], x: 1300, y: 100, w: 500, h: 400 },
      ],
      connectors: [
        { from: id['EST-10'], to: id['EST-20'] },
        { from: id['EST-20'], to: id['EST-30'] },
      ],
      assets: [{ id: 'a1', kind: 'rack', x: 0, y: 0, w: 600, h: 400 }],
    });

    const out = await service.cloneLayout({
      fromModel: 'AX-1000',
      toModel: 'AX-2000',
    });
    expect(out.model).toBe('AX-2000');
    expect(out.footprint).toMatchObject({ footprintW: 9000, gridSize: 300 });
    expect(out.assets).toHaveLength(1);
    const placed = out.stations.filter((s) => s.x !== null);
    expect(placed.map((s) => s.station).sort()).toEqual(['EST-10', 'EST-20']);
    expect(out.stations.find((s) => s.station === 'EST-10')!.x).toBe(100);
    // EST-10→EST-20 remaps to target ids; EST-20→EST-30 drops (no EST-30 here).
    expect(out.connectors).toHaveLength(1);
    const tid = Object.fromEntries(out.stations.map((s) => [s.station, s.id]));
    expect(out.connectors[0]).toMatchObject({
      from: tid['EST-10'],
      to: tid['EST-20'],
    });
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

  it('stores, transforms and clears a DXF background (Fase 2)', async () => {
    await seedRoute();
    const dxf = ['0', 'SECTION', '2', 'ENTITIES', '0', 'EOF'].join('\n');

    // No background initially.
    expect((await service.getLayout('AX-1000')).dxf).toBeNull();
    expect(await service.getDxf('AX-1000')).toBeNull();

    // Upload: data + name stored, placement defaults applied.
    await service.setDxf({ model: 'AX-1000', name: 'planta.dxf', data: dxf });
    const raw = await service.getDxf('AX-1000');
    expect(raw).toMatchObject({ name: 'planta.dxf' });
    expect(raw!.data).toContain('SECTION');
    expect((await service.getLayout('AX-1000')).dxf).toMatchObject({
      name: 'planta.dxf',
      scale: 1,
      visible: true,
      opacity: 0.5,
    });

    // Transform via the normal save (does not touch the DXF data).
    await service.saveLayout({
      model: 'AX-1000',
      dxf: { offsetX: 100, scale: 2.5, opacity: 0.3, visible: false },
    });
    expect((await service.getLayout('AX-1000')).dxf).toMatchObject({
      offsetX: 100,
      scale: 2.5,
      opacity: 0.3,
      visible: false,
    });
    expect((await service.getDxf('AX-1000'))!.data).toContain('SECTION');

    // Clear removes the background entirely.
    await service.clearDxf('AX-1000');
    expect((await service.getLayout('AX-1000')).dxf).toBeNull();
    expect(await service.getDxf('AX-1000')).toBeNull();
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
