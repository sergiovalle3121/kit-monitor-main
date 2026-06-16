import { DataSource } from 'typeorm';
import { OeeService } from './oee.service';
import { SfDowntimeEvent } from './entities/sf-downtime-event.entity';
import { SfHxhTarget } from './entities/sf-hxh-target.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('OeeService (integration)', () => {
  let ds: DataSource;
  let svc: OeeService;
  let plan: ProductionPlanService;
  let ctx: TenantContextService;

  // today's bounds, used to build deterministic windows independent of wall-clock
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const at = (h: number, m = 0) =>
    new Date(dayStart.getTime() + h * 3_600_000 + m * 60_000);
  const ymd = `${dayStart.getFullYear()}-${pad(dayStart.getMonth() + 1)}-${pad(dayStart.getDate())}`;

  async function addConsumption(
    woId: string,
    model: string,
    units: number,
    key: string,
  ) {
    const repo = ds.getRepository(SfConsumptionEvent);
    await repo.save(
      repo.create({
        idempotencyKey: key,
        woId,
        woFolio: null,
        model,
        station: 'EST-10',
        part: 'P1',
        units,
        backflushQty: 0,
        unitSerial: null,
        operatorEmail: 'op@x',
        outboxStatus: 'SENT_STUB',
      }),
    );
  }

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        SfDowntimeEvent,
        SfHxhTarget,
        SfConsumptionEvent,
        SfQualityHold,
        SfWorkOrder,
        DocumentSequence,
      ],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      ds.getRepository(DocumentSequence),
      ds,
      ctx,
    );
    plan = new ProductionPlanService(
      createTenantScopedRepository(SfWorkOrder, ds.manager, ctx),
      ctx,
      numbering,
    );
    svc = new OeeService(
      createTenantScopedRepository(SfDowntimeEvent, ds.manager, ctx),
      createTenantScopedRepository(SfHxhTarget, ds.manager, ctx),
      ds.getRepository(SfConsumptionEvent),
      ds.getRepository(SfQualityHold),
      ctx,
      plan,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  // ── Downtime ──────────────────────────────────────────────────────────────
  it('opens a downtime (OPEN, no duration) and closes it computing minutes', async () => {
    const dt = await svc.openDowntime({
      line: 'L1',
      station: 'EST-20',
      reasonCode: 'EQUIPMENT',
      startAt: at(2).toISOString(),
    });
    expect(dt.status).toBe('OPEN');
    expect(dt.durationMinutes).toBe(0);
    const closed = await svc.closeDowntime(dt.id, {
      endAt: at(2, 30).toISOString(),
    });
    expect(closed.status).toBe('CLOSED');
    expect(closed.durationMinutes).toBe(30);
    const open = await svc.listDowntime({ status: 'OPEN' });
    expect(open).toHaveLength(0);
  });

  it('rejects closing twice and an end before start', async () => {
    const dt = await svc.openDowntime({
      line: 'L1',
      reasonCode: 'MATERIAL',
      startAt: at(3).toISOString(),
    });
    await expect(
      svc.closeDowntime(dt.id, { endAt: at(2).toISOString() }),
    ).rejects.toThrow(/anterior/i);
    await svc.closeDowntime(dt.id, { endAt: at(3, 10).toISOString() });
    await expect(svc.closeDowntime(dt.id, {})).rejects.toThrow(
      /ya está cerrado/i,
    );
  });

  // ── OEE by line ───────────────────────────────────────────────────────────
  it('computes OEE for a line from downtime + derived output + scrap', async () => {
    const wo = await plan.publish({
      model: 'MX',
      line: 'L1',
      quantityPlanned: 200,
      taktTargetSec: 270,
    });
    await addConsumption(wo.id, 'MX', 100, 'k1'); // 100 pieces produced (now → today)
    // 30 min equipment downtime fully inside today
    const dt = await svc.openDowntime({
      line: 'L1',
      reasonCode: 'EQUIPMENT',
      startAt: at(2).toISOString(),
    });
    await svc.closeDowntime(dt.id, { endAt: at(2, 30).toISOString() });
    // 5 pcs scrap on the WO
    const holdRepo = ds.getRepository(SfQualityHold);
    await holdRepo.save(
      holdRepo.create({
        part: 'P1',
        qty: 5,
        scrapQty: 5,
        woId: wo.id,
        status: 'CLOSED',
      }),
    );

    const r = await svc.oeeForLine('L1', {
      from: dayStart.toISOString(),
      to: dayEnd.toISOString(),
      plannedMinutes: 480,
    });
    expect(r.totalPieces).toBe(100);
    expect(r.downtimeMin).toBe(30);
    expect(r.availability).toBe(0.9375); // (480-30)/480
    expect(r.performance).toBe(1); // ideal 270s*100/60 = 450 min = run time
    expect(r.quality).toBe(0.95); // 95/100
    expect(r.oee).toBeCloseTo(0.9375 * 0.95, 4);
    expect(r.downtimeByReason.EQUIPMENT).toBe(30);
  });

  it('computes OEE for a single WO', async () => {
    const wo = await plan.publish({
      model: 'MX',
      line: 'L2',
      quantityPlanned: 100,
      taktTargetSec: 270,
    });
    await addConsumption(wo.id, 'MX', 100, 'k2');
    const r = await svc.oeeForWorkOrder(wo.id, {
      from: dayStart.toISOString(),
      to: dayEnd.toISOString(),
      plannedMinutes: 450,
    });
    expect(r.scope).toBe('WORK_ORDER');
    expect(r.woFolio).toBe(wo.folio);
    expect(r.totalPieces).toBe(100);
    expect(r.availability).toBe(1); // no downtime
    expect(r.performance).toBe(1); // 450 ideal vs 450 run
    expect(r.quality).toBe(1); // no holds → no scrap → all good
    expect(r.oee).toBe(1);
  });

  // ── Hour-by-hour ──────────────────────────────────────────────────────────
  it('upserts an hour target (no duplicate rows)', async () => {
    await svc.setTarget({ line: 'L1', hour: 8, targetQty: 40 });
    await svc.setTarget({ line: 'L1', hour: 8, targetQty: 55 });
    const list = await svc.listTargets({ line: 'L1' });
    expect(list).toHaveLength(1);
    expect(list[0].targetQty).toBe(55);
  });

  it('derives real per hour and attributes the miss reason to downtime', async () => {
    const wo = await plan.publish({
      model: 'MX',
      line: 'L1',
      quantityPlanned: 100,
      taktTargetSec: 60,
    });
    await addConsumption(wo.id, 'MX', 12, 'k3'); // produced "now" → current clock hour
    const nowHour = new Date().getHours();
    await svc.setTarget({
      line: 'L1',
      shift: 'A',
      hour: nowHour,
      targetQty: 30,
    }); // miss: 12 < 30
    // equipment downtime inside the current hour
    const hs = new Date();
    hs.setMinutes(1, 0, 0);
    const he = new Date();
    he.setMinutes(6, 0, 0);
    const dt = await svc.openDowntime({
      line: 'L1',
      reasonCode: 'EQUIPMENT',
      startAt: hs.toISOString(),
    });
    await svc.closeDowntime(dt.id, { endAt: he.toISOString() });

    const rep = await svc.hourByHour('L1', { date: ymd, shift: 'A' });
    const row = rep.rows.find((r) => r.hour === nowHour);
    expect(row).toBeDefined();
    expect(row!.real).toBe(12);
    expect(row!.target).toBe(30);
    expect(row!.hit).toBe(false);
    expect(row!.missReason).toBe('EQUIPMENT');
    expect(row!.missMinutes).toBeGreaterThan(0);
    expect(rep.totals.real).toBe(12);
  });

  it('marks a miss with no downtime as PACE_OR_QUALITY', async () => {
    const wo = await plan.publish({
      model: 'MX',
      line: 'L3',
      quantityPlanned: 100,
      taktTargetSec: 60,
    });
    await addConsumption(wo.id, 'MX', 5, 'k4');
    const nowHour = new Date().getHours();
    await svc.setTarget({ line: 'L3', hour: nowHour, targetQty: 20 });
    const rep = await svc.hourByHour('L3', { date: ymd });
    const row = rep.rows.find((r) => r.hour === nowHour);
    expect(row!.missReason).toBe('PACE_OR_QUALITY');
  });

  // ── Control Tower feed ──────────────────────────────────────────────────────
  it('aggregates an OEE/output card per line for the control tower', async () => {
    const wo = await plan.publish({
      model: 'MX',
      line: 'L1',
      quantityPlanned: 100,
      taktTargetSec: 270,
    });
    await addConsumption(wo.id, 'MX', 80, 'k5');
    await plan.publish({
      model: 'MY',
      line: 'L2',
      quantityPlanned: 50,
      taktTargetSec: 120,
    });

    const feed = await svc.controlTowerFeed({
      from: dayStart.toISOString(),
      to: dayEnd.toISOString(),
      plannedMinutes: 480,
    });
    const l1 = feed.lines.find((c) => c.line === 'L1');
    expect(l1).toBeDefined();
    expect(l1!.output).toBe(80);
    expect(feed.lines.map((c) => c.line)).toContain('L2');
    expect(feed.rollup.totalOutput).toBe(80);
  });

  it('isolates by tenant (no cross-tenant downtime leakage)', async () => {
    const t1 = {
      tenant_id: 'T1',
      organization_id: null,
      plant_id: null,
      user_email: 'u@test',
      role: null,
      permissions: null,
      scopes: null,
    };
    await ctx.run(t1, () =>
      svc.openDowntime({
        line: 'L1',
        reasonCode: 'OTHER',
        startAt: at(1).toISOString(),
      }),
    );
    // default context (no tenant) must not see T1's downtime
    const seen = await svc.listDowntime({ line: 'L1' });
    expect(seen).toHaveLength(0);
    // but inside T1's context it is visible
    const t1seen = await ctx.run(t1, () => svc.listDowntime({ line: 'L1' }));
    expect(t1seen).toHaveLength(1);
  });
});

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
