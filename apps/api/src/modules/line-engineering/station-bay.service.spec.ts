import { DataSource } from 'typeorm';
import { LineEngineeringService } from './line-engineering.service';
import { StationBayService } from './station-bay.service';
import { SfLineStation } from './entities/sf-line-station.entity';
import { SfModelLine } from './entities/sf-model-line.entity';
import { SfLineLayout } from './entities/sf-line-layout.entity';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { createTenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';

describe('StationBayService (integration)', () => {
  let ds: DataSource;
  let svc: StationBayService;
  let lineEng: LineEngineeringService;
  let ctx: TenantContextService;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [SfLineStation, SfModelLine, SfLineLayout, BayLayout],
    });
    await ds.initialize();
    ctx = new TenantContextService();
    lineEng = new LineEngineeringService(
      createTenantScopedRepository(SfLineStation, ds.manager, ctx),
      createTenantScopedRepository(SfModelLine, ds.manager, ctx),
      ctx,
      createTenantScopedRepository(SfLineLayout, ds.manager, ctx),
    );
    svc = new StationBayService(lineEng, ds.getRepository(BayLayout));
  });

  afterEach(async () => {
    await ds.destroy();
  });

  async function seed() {
    await lineEng.createStation({
      model: 'AX',
      line: 'L1',
      station: 'E10',
      sequence: 10,
      npExpected: 'NP-1',
      stdTimeSec: 30,
    });
    await lineEng.createStation({
      model: 'AX',
      line: 'L1',
      station: 'E20',
      sequence: 20,
      npExpected: 'NP-2',
      stdTimeSec: 30,
    });
    await lineEng.createStation({
      model: 'AX',
      line: 'L1',
      station: 'E30',
      sequence: 30,
      npExpected: 'NP-X', // no bay assignment → unmapped
      stdTimeSec: 30,
    });
  }

  it('resolves each station to the bay that supplies its NP', async () => {
    await seed();
    await ds.getRepository(BayLayout).save([
      { model: 'AX', partNumber: 'NP-1', bahia: 2 },
      { model: 'AX', partNumber: 'NP-2', bahia: 5 },
    ] as object[]);

    const r = await svc.getStationBays('AX');
    expect(r.total).toBe(3);
    const by = Object.fromEntries(r.stations.map((s) => [s.station, s]));
    expect(by['E10'].bahia).toBe(2);
    expect(by['E20'].bahia).toBe(5);
    expect(by['E30'].bahia).toBeNull(); // NP-X not assigned
    expect(r.mapped).toBe(2);
    expect(r.unmapped).toBe(1);
    expect(r.baysUsed).toEqual([2, 5]);
  });

  it('returns all bays unmapped when the model has no bay layout', async () => {
    await seed();
    const r = await svc.getStationBays('AX');
    expect(r.mapped).toBe(0);
    expect(r.unmapped).toBe(3);
    expect(r.baysUsed).toEqual([]);
  });
});
