import { DataSource } from 'typeorm';
import { LineEngineeringService } from './line-engineering.service';
import { StationStatusService } from './station-status.service';
import { SfLineStation } from './entities/sf-line-station.entity';
import { SfModelLine } from './entities/sf-model-line.entity';
import { SfLineLayout } from './entities/sf-line-layout.entity';
import { SfFloorEvent } from '../operator-terminal/entities/sf-floor-event.entity';
import { SfQualityHold } from '../floor-quality/entities/sf-quality-hold.entity';
import { SfReplenishCall } from '../material-staging/entities/sf-replenish-call.entity';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
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

describe('StationStatusService (integration)', () => {
  let ds: DataSource;
  let svc: StationStatusService;
  let lineEng: LineEngineeringService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [
        SfLineStation,
        SfModelLine,
        SfLineLayout,
        SfFloorEvent,
        SfQualityHold,
        SfReplenishCall,
        SfWorkOrder,
      ],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    lineEng = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, ds.manager, ctx),
      createTenantScopedRepository(SfModelLine, ds.manager, ctx),
      ctx,
      createTenantScopedRepository(SfLineLayout, ds.manager, ctx),
    );
    svc = new StationStatusService(
      lineEng,
      createTenantScopedRepository(SfFloorEvent, ds.manager, ctx),
      createTenantScopedRepository(SfQualityHold, ds.manager, ctx),
      createTenantScopedRepository(SfReplenishCall, ds.manager, ctx),
      createTenantScopedRepository(SfWorkOrder, ds.manager, ctx),
      ctx,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  async function seedStations() {
    await lineEng.createStation({
      model: 'AX',
      line: 'L1',
      station: 'E10',
      sequence: 10,
      stdTimeSec: 30,
    });
    await lineEng.createStation({
      model: 'AX',
      line: 'L1',
      station: 'E20',
      sequence: 20,
      stdTimeSec: 30,
    });
    await lineEng.createStation({
      model: 'AX',
      line: 'L1',
      station: 'E30',
      sequence: 30,
      stdTimeSec: 30,
    });
  }

  it('is idle when nothing runs and there are no signals', async () => {
    await seedStations();
    const s = await svc.getStatus('AX');
    expect(s.running).toBe(false);
    expect(s.stations.map((x) => x.status)).toEqual(['idle', 'idle', 'idle']);
    expect(s.counts.idle).toBe(3);
  });

  it('is ok when the model is in production on the line', async () => {
    await seedStations();
    await ds.getRepository(SfWorkOrder).save({
      model: 'AX',
      revision: 'A',
      line: 'L1',
      status: 'IN_PRODUCTION',
    } as object);
    const s = await svc.getStatus('AX');
    expect(s.running).toBe(true);
    expect(s.stations.every((x) => x.status === 'ok')).toBe(true);
  });

  it('derives down/warn from live floor signals (worst-of wins)', async () => {
    await seedStations();
    await ds.getRepository(SfWorkOrder).save({
      model: 'AX',
      revision: 'A',
      line: 'L1',
      status: 'IN_PRODUCTION',
    } as object);
    await ds.getRepository(SfFloorEvent).save({
      type: 'ANDON_MACHINE',
      station: 'E10',
      line: 'L1',
      severity: 'HIGH',
      status: 'OPEN',
      raisedAt: new Date(),
    } as object);
    await ds.getRepository(SfReplenishCall).save({
      woId: 'w',
      station: 'E20',
      part: 'CAP-100',
      status: 'OPEN',
      priority: 'HIGH',
      raisedAt: new Date(),
    } as object);
    await ds.getRepository(SfQualityHold).save({
      part: 'P1',
      station: 'E30',
      severity: 'CRITICAL',
      status: 'HELD',
      raisedAt: new Date(),
    } as object);

    const s = await svc.getStatus('AX');
    const by = Object.fromEntries(s.stations.map((x) => [x.station, x]));
    expect(by['E10'].status).toBe('down'); // machine andon
    expect(by['E20'].status).toBe('warn'); // material call
    expect(by['E20'].label).toContain('CAP-100');
    expect(by['E30'].status).toBe('down'); // critical quality hold
    expect(s.counts).toMatchObject({ down: 2, warn: 1, ok: 0 });
  });

  it('ignores resolved signals and scopes by tenant', async () => {
    await seedStations();
    // A resolved andon must not light the station.
    await ds.getRepository(SfFloorEvent).save({
      type: 'ANDON_MACHINE',
      station: 'E10',
      line: 'L1',
      severity: 'CRITICAL',
      status: 'RESOLVED',
      raisedAt: new Date(),
    } as object);
    expect((await svc.getStatus('AX')).counts.down).toBe(0);

    // Another tenant's open andon is invisible here.
    await ctx.run(ctxFor('T_B'), async () => {
      await lineEng.createStation({
        model: 'AX',
        line: 'L1',
        station: 'E10',
        sequence: 10,
        stdTimeSec: 30,
      });
      await ds.getRepository(SfFloorEvent).save({
        type: 'ANDON_MACHINE',
        station: 'E10',
        line: 'L1',
        severity: 'CRITICAL',
        status: 'OPEN',
        tenant_id: 'T_B',
        raisedAt: new Date(),
      } as object);
    });
    expect((await svc.getStatus('AX')).counts.down).toBe(0); // default tenant unaffected
    const b = await ctx.run(ctxFor('T_B'), () => svc.getStatus('AX'));
    expect(b.stations.find((x) => x.station === 'E10')?.status).toBe('down');
  });
});
