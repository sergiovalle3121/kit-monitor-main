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
import { EventLedgerService } from '../event-ledger/event-ledger.service';

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

  it('estimates line staffing at a takt (Fase 16)', async () => {
    await seedRoute(); // EST-10 40s, EST-20 55s, EST-30 30s
    // At 60s takt every cycle fits → one operator each.
    const easy = await service.getStaffing({
      model: 'AX-1000',
      taktTargetSec: 60,
    });
    expect(easy.totalOperators).toBe(3);
    expect(easy.stations.find((s) => s.station === 'EST-20')).toMatchObject({
      operators: 1,
      line: 'SMT-1',
    });

    // Tight 25s takt → EST-10 ⌈40/25⌉=2, EST-20 ⌈55/25⌉=3, EST-30 ⌈30/25⌉=2 = 7.
    const tight = await service.getStaffing({
      model: 'AX-1000',
      taktTargetSec: 25,
    });
    expect(tight.totalOperators).toBe(7);
    expect(tight.stations.find((s) => s.station === 'EST-20')?.operators).toBe(
      3,
    );
  });

  it('reports per-station documentation completeness (Fase 19)', async () => {
    await seedRoute(); // 3 stations, all with NP + factor + aid → complete
    // Add a station missing its visual aid.
    await service.createStation({
      model: 'AX-1000',
      line: 'SMT-1',
      station: 'EST-40',
      sequence: 40,
      npExpected: 'P4',
      useFactor: 1,
      // no visualAidUrl → incomplete
    });
    const c = await service.getCompleteness('AX-1000');
    expect(c.total).toBe(4);
    expect(c.complete).toBe(3);
    expect(c.missingVisualAid).toBe(1);
    const est40 = c.stations.find((s) => s.station === 'EST-40')!;
    expect(est40).toMatchObject({
      hasNp: true,
      hasUseFactor: true,
      hasVisualAid: false,
      complete: false,
      line: 'SMT-1',
    });
  });

  it('detects flow back-tracking against the routing order (Fase 21)', async () => {
    await seedRoute(); // EST-10 (10), EST-20 (20), EST-30 (30)
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    // Place EST-30 physically behind EST-20 → the 20→30 hop back-tracks.
    await service.saveLayout({
      model: 'AX-1000',
      positions: [
        { id: id['EST-10'], x: 0, y: 0, w: 100, h: 100, rotation: 0 }, // cx 50
        { id: id['EST-20'], x: 300, y: 0, w: 100, h: 100, rotation: 0 }, // cx 350
        { id: id['EST-30'], x: 100, y: 0, w: 100, h: 100, rotation: 0 }, // cx 150 (back)
      ],
    });
    const fd = await service.getFlowDirection('AX-1000');
    expect(fd.hasDirection).toBe(true);
    expect(fd.backtrackCount).toBe(1);
    expect(fd.backtrackHops[0]).toMatchObject({ from: 'EST-20', to: 'EST-30' });
    expect(fd.directionalEfficiencyPct).toBeCloseTo(60, 0);
  });

  it('optimizes the layout order to shorten material travel (Fase 23)', async () => {
    await seedRoute(); // EST-10, EST-20, EST-30
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    // Flow skips the middle station (EST-10 → EST-30), so the serpentine order
    // is sub-optimal; the optimizer should bring 10 and 30 together.
    await service.saveLayout({
      model: 'AX-1000',
      connectors: [{ from: id['EST-10'], to: id['EST-30'] }],
    });
    const opt = await service.optimizeLayout('AX-1000');
    expect(opt.positions).toHaveLength(3);
    expect(opt.costAfter).toBeLessThan(opt.costBefore);
    expect(opt.improvedPct).toBeGreaterThan(0);
    // The stored layout is untouched (suggestion only).
    const stored = await service.getLayout('AX-1000');
    expect(stored.stations.every((s) => s.x === null)).toBe(true);
  });

  it('persists cells and computes per-cell metrics (Fase 27)', async () => {
    await seedRoute(); // EST-10 40s, EST-20 55s, EST-30 30s
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    await service.saveLayout({
      model: 'AX-1000',
      footprint: {
        footprintW: 1000,
        footprintH: 1000,
        unit: 'mm',
        gridSize: 100,
      },
      positions: [
        { id: id['EST-10'], x: 0, y: 0, w: 100, h: 100, rotation: 0 },
        { id: id['EST-20'], x: 200, y: 0, w: 100, h: 100, rotation: 0 },
      ],
      cells: [
        {
          id: 'c1',
          name: 'Celda A',
          color: '#6366f1',
          stationIds: [id['EST-10'], id['EST-20'], 'ghost'], // ghost dropped
        },
      ],
    });

    const reloaded = await service.getLayout('AX-1000');
    expect(reloaded.cells).toHaveLength(1);
    expect(reloaded.cells[0].stationIds).toEqual([id['EST-10'], id['EST-20']]); // ghost filtered

    const metrics = await service.getCellMetrics('AX-1000');
    expect(metrics.cells[0]).toMatchObject({
      name: 'Celda A',
      stationCount: 2,
      placedCount: 2,
      totalCycleTimeSec: 95, // 40 + 55
    });
    // bbox 0..300 × 0..100 = 30000 over 1,000,000 = 3%.
    expect(metrics.cells[0].areaPctOfFootprint).toBeCloseTo(3, 1);
  });

  it('analyzes intra- vs inter-cell flow (Fase 28)', async () => {
    await seedRoute(); // EST-10, EST-20, EST-30
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    await service.saveLayout({
      model: 'AX-1000',
      positions: [
        { id: id['EST-10'], x: 0, y: 0, w: 100, h: 100, rotation: 0 }, // cx 50
        { id: id['EST-20'], x: 200, y: 0, w: 100, h: 100, rotation: 0 }, // cx 250
        { id: id['EST-30'], x: 600, y: 0, w: 100, h: 100, rotation: 0 }, // cx 650
      ],
      connectors: [
        { from: id['EST-10'], to: id['EST-20'] }, // intra c1
        { from: id['EST-20'], to: id['EST-30'] }, // inter c1→c2
      ],
      cells: [
        {
          id: 'c1',
          name: 'A',
          color: '#6366f1',
          stationIds: [id['EST-10'], id['EST-20']],
        },
        { id: 'c2', name: 'B', color: '#10b981', stationIds: [id['EST-30']] },
      ],
    });

    const cf = await service.getCellFlow('AX-1000');
    expect(cf.cellCount).toBe(2);
    expect(cf.intraCount).toBe(1);
    expect(cf.interCount).toBe(1);
    expect(cf.intraDistance).toBe(200); // 50→250
    expect(cf.interDistance).toBe(400); // 250→650
    expect(cf.interPct).toBeCloseTo(66.7, 0);
    expect(cf.interSegments[0]).toMatchObject({ from: 'EST-20', to: 'EST-30' });
  });

  it('drives the approval / sign-off lifecycle (Fase 29)', async () => {
    await seedRoute();
    // Default state is draft.
    expect((await service.getLayout('AX-1000')).approval.status).toBe('draft');

    // Submit for review — no stamp yet.
    const reviewing = await service.setApproval({
      model: 'AX-1000',
      status: 'in_review',
    });
    expect(reviewing.approval).toMatchObject({
      status: 'in_review',
      by: null,
      at: null,
    });

    // Approve — stamps the user + time.
    const approved = await service.setApproval({
      model: 'AX-1000',
      status: 'approved',
      note: 'Visto bueno IE',
    });
    expect(approved.approval.status).toBe('approved');
    expect(approved.approval.by).toBe('anonymous'); // no tenant context in the spec
    expect(approved.approval.at).not.toBeNull();
    expect(approved.approval.note).toBe('Visto bueno IE');

    // Back to draft clears the stamp.
    const back = await service.setApproval({
      model: 'AX-1000',
      status: 'draft',
    });
    expect(back.approval).toMatchObject({
      status: 'draft',
      by: null,
      at: null,
    });
  });

  it('returns an empty audit timeline when no ledger is wired (Fase 32)', async () => {
    // The default service in this suite is built without a ledger.
    await expect(service.getLayoutHistory('AX-1000', 'A')).resolves.toEqual([]);
  });

  it('builds a human-readable audit timeline from the ledger (Fase 32)', async () => {
    const stored = [
      {
        id: 'e1',
        action: 'SF_LINE_LAYOUT_APPROVAL',
        actorName: 'ana@plant',
        timestamp: new Date('2026-06-23T10:00:00.000Z'),
        metadata: { afterState: { status: 'approved' } },
      },
      {
        id: 'e2',
        action: 'SF_LINE_LAYOUT_SAVED',
        actorName: 'ana@plant',
        timestamp: new Date('2026-06-23T09:00:00.000Z'),
        metadata: { afterState: { placed: 3, cleared: 1 } },
      },
      {
        id: 'e3',
        action: 'SF_LINE_LAYOUT_CLONED',
        actorName: '',
        timestamp: new Date('2026-06-23T08:00:00.000Z'),
        metadata: { afterState: { from: 'AX-900|A', to: 'AX-1000|A' } },
      },
    ];
    const getEventsByReference = jest.fn().mockResolvedValue(stored);
    const withLedger = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, dataSource.manager, ctx),
      createTenantScopedRepository(SfModelLine, dataSource.manager, ctx),
      ctx,
      createTenantScopedRepository(SfLineLayout, dataSource.manager, ctx),
      { getEventsByReference } as unknown as EventLedgerService,
    );

    const history = await withLedger.getLayoutHistory('AX-1000', 'A');

    expect(getEventsByReference).toHaveBeenCalledWith(
      'SF_LINE_ENGINEERING',
      'AX-1000|A',
    );
    expect(history).toHaveLength(3);
    expect(history[0]).toMatchObject({
      kind: 'approval',
      title: 'Cambió aprobación a aprobado',
      actor: 'ana@plant',
      at: '2026-06-23T10:00:00.000Z',
    });
    expect(history[1]).toMatchObject({
      kind: 'save',
      title: 'Guardó el layout',
      detail: '3 colocadas · 1 retirada',
    });
    expect(history[2]).toMatchObject({
      kind: 'clone',
      title: 'Clonó el layout',
      detail: 'desde AX-900|A',
      actor: 'anónimo', // blank actor falls back
    });
  });

  it('degrades gracefully when the ledger query throws (Fase 32)', async () => {
    const getEventsByReference = jest
      .fn()
      .mockRejectedValue(new Error('db down'));
    const withLedger = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, dataSource.manager, ctx),
      createTenantScopedRepository(SfModelLine, dataSource.manager, ctx),
      ctx,
      createTenantScopedRepository(SfLineLayout, dataSource.manager, ctx),
      { getEventsByReference } as unknown as EventLedgerService,
    );
    await expect(withLedger.getLayoutHistory('AX-1000', 'A')).resolves.toEqual(
      [],
    );
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

  it('analyzes material flow: distance, longest hop and crossings (Fase 10)', async () => {
    await seedRoute(); // EST-10, EST-20, EST-30
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    // Place stations with explicit boxes so centers are exact (center = x+w/2).
    await service.saveLayout({
      model: 'AX-1000',
      positions: [
        { id: id['EST-10'], x: 0, y: 0, w: 200, h: 200, rotation: 0 }, // c(100,100)
        { id: id['EST-20'], x: 700, y: 0, w: 200, h: 200, rotation: 0 }, // c(800,100)
        { id: id['EST-30'], x: 700, y: 700, w: 200, h: 200, rotation: 0 }, // c(800,800)
      ],
      connectors: [
        { from: id['EST-10'], to: id['EST-20'] }, // horizontal 700
        { from: id['EST-20'], to: id['EST-30'] }, // vertical 700
      ],
    });

    const flow = await service.getFlowAnalysis('AX-1000');
    expect(flow.unit).toBe('mm');
    expect(flow.segmentCount).toBe(2);
    expect(flow.totalDistance).toBe(1400);
    expect(flow.longestSegment?.distance).toBe(700);
    expect(flow.crossings).toBe(0); // L-shaped path sharing EST-20
    expect(flow.unplacedLinks).toBe(0);
  });

  it('validates the layout: overlaps, clearance and out-of-bounds (Fase 11)', async () => {
    await seedRoute(); // EST-10, EST-20, EST-30
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    await service.saveLayout({
      model: 'AX-1000',
      footprint: {
        footprintW: 5000,
        footprintH: 5000,
        unit: 'mm',
        gridSize: 100,
      },
      positions: [
        { id: id['EST-10'], x: 100, y: 100, w: 200, h: 200, rotation: 0 },
        { id: id['EST-20'], x: 250, y: 100, w: 200, h: 200, rotation: 0 }, // overlaps EST-10
        { id: id['EST-30'], x: 2000, y: 2000, w: 200, h: 200, rotation: 0 }, // clear
      ],
    });

    const r = await service.getCollisions('AX-1000');
    expect(r.overlaps).toBe(1);
    expect(r.ok).toBe(false);
    const pair = r.conflicts.find((c) => c.type === 'overlap')!;
    expect([pair.aLabel, pair.bLabel].sort()).toEqual(['EST-10', 'EST-20']);

    // With a 600-unit clearance, EST-30 is now too close to nothing but the two
    // already-overlapping boxes stay an overlap; a generous footprint keeps all in.
    const withClear = await service.getCollisions('AX-1000', 'A', 600);
    expect(withClear.overlaps).toBe(1);
    expect(withClear.outOfBounds).toBe(0);
  });

  it('auto-arranges stations in routing order without persisting (Fase 12)', async () => {
    await seedRoute(); // EST-10, EST-20, EST-30
    const arranged = await service.autoArrangeLayout('AX-1000');
    expect(arranged.positions).toHaveLength(3);
    // Suggestion only — the stored layout is untouched (all still unplaced).
    const stored = await service.getLayout('AX-1000');
    expect(stored.stations.every((s) => s.x === null)).toBe(true);

    // Positions follow the route order EST-10 → EST-20 → EST-30.
    const byId = new Map(stored.stations.map((s) => [s.id, s.station]));
    expect(arranged.positions.map((p) => byId.get(p.id))).toEqual([
      'EST-10',
      'EST-20',
      'EST-30',
    ]);
    // First row, left to right: x is non-decreasing along the route.
    expect(arranged.positions[0].x).toBeLessThanOrEqual(
      arranged.positions[1].x,
    );
  });

  it('snapshots and restores a layout version (Fase 13)', async () => {
    await seedRoute();
    const before = await service.getLayout('AX-1000');
    const est10 = before.stations.find((s) => s.station === 'EST-10')!;

    // Place EST-10, then capture the arrangement as a named version.
    await service.saveLayout({
      model: 'AX-1000',
      positions: [
        { id: est10.id, x: 100, y: 200, w: 300, h: 200, rotation: 0 },
      ],
    });
    const snap = await service.createSnapshot('AX-1000', 'A', 'v1');
    expect(snap.name).toBe('v1');
    expect(snap.stationCount).toBe(1);
    expect(await service.listSnapshots('AX-1000')).toHaveLength(1);

    // Move EST-10 elsewhere, then restore the version → it comes back.
    await service.saveLayout({
      model: 'AX-1000',
      positions: [
        { id: est10.id, x: 4000, y: 4000, w: 300, h: 200, rotation: 0 },
      ],
    });
    const moved = await service.getLayout('AX-1000');
    expect(moved.stations.find((s) => s.station === 'EST-10')!.x).toBe(4000);

    const restored = await service.restoreSnapshot('AX-1000', 'A', snap.id);
    expect(restored.stations.find((s) => s.station === 'EST-10')!.x).toBe(100);

    // Delete the version → none left.
    const left = await service.deleteSnapshot('AX-1000', 'A', snap.id);
    expect(left).toHaveLength(0);
    await expect(
      service.restoreSnapshot('AX-1000', 'A', snap.id),
    ).rejects.toThrow(/no encontrada/);
  });

  it('diffs a version against the live layout (Fase 17)', async () => {
    await seedRoute();
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    // Snapshot with only EST-10 placed.
    await service.saveLayout({
      model: 'AX-1000',
      positions: [
        { id: id['EST-10'], x: 0, y: 0, w: 200, h: 200, rotation: 0 },
      ],
    });
    const snap = await service.createSnapshot('AX-1000', 'A', 'base');

    // Move EST-10 far and add EST-20.
    await service.saveLayout({
      model: 'AX-1000',
      positions: [
        { id: id['EST-10'], x: 1000, y: 0, w: 200, h: 200, rotation: 0 },
        { id: id['EST-20'], x: 500, y: 500, w: 200, h: 200, rotation: 0 },
      ],
    });

    const diff = await service.diffSnapshot('AX-1000', 'A', snap.id);
    expect(diff.movedCount).toBe(1);
    expect(diff.moved[0]).toMatchObject({ station: 'EST-10', distance: 1000 });
    expect(diff.addedCount).toBe(1);
    expect(diff.added).toEqual(['EST-20']);
    expect(diff.removedCount).toBe(0);
    expect(diff.footprintChanged).toBe(false);
  });

  it('builds a consolidated layout report (Fase 14)', async () => {
    await seedRoute(); // 3 stations
    const before = await service.getLayout('AX-1000');
    const id = Object.fromEntries(
      before.stations.map((s) => [s.station, s.id]),
    );
    await service.saveLayout({
      model: 'AX-1000',
      footprint: {
        footprintW: 1000,
        footprintH: 1000,
        unit: 'mm',
        gridSize: 100,
      },
      positions: [
        { id: id['EST-10'], x: 0, y: 0, w: 100, h: 100, rotation: 0 },
        { id: id['EST-20'], x: 300, y: 0, w: 100, h: 100, rotation: 0 },
      ],
      connectors: [{ from: id['EST-10'], to: id['EST-20'] }],
    });

    const rep = await service.getLayoutReport('AX-1000');
    expect(rep.stations).toMatchObject({ total: 3, placed: 2, unplaced: 1 });
    expect(rep.stations.readinessPct).toBeCloseTo(66.7, 0);
    // 2 boxes of 100×100 = 20000 over a 1,000,000 footprint = 2%.
    expect(rep.space.footprintArea).toBe(1_000_000);
    expect(rep.space.utilizationPct).toBeCloseTo(2, 1);
    expect(rep.flow.connectorCount).toBe(1);
    expect(rep.flow.totalDistance).toBe(300); // center-to-center
    expect(rep.validation.ok).toBe(true);
    expect(rep.balance?.bottleneckStation).toBe('EST-20'); // 55s is slowest
    expect(rep.balance?.stationCount).toBe(3);
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
