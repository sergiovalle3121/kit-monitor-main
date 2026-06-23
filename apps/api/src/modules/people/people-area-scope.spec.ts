import { DataSource, Repository } from 'typeorm';
import { PeopleService } from './people.service';
import { Certification } from './entities/certification.entity';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const any = (v: unknown): any => v;

describe('PeopleService — hard area scope (ENFORCE_AREA_SCOPE)', () => {
  let ds: DataSource;
  let certRepo: Repository<Certification>;
  const ctx = { email: 'leader@plant.com', role: 'operator' as string | null };
  const tenantCtx = {
    getTenantId: () => null,
    getPlantId: () => null,
    getUserEmail: () => ctx.email,
    getRole: () => ctx.role,
  };
  const hrRepo = { findOne: jest.fn() };
  const numbering = { allocate: jest.fn(async () => 'CERT-X') };

  function service() {
    return new PeopleService(
      certRepo,
      any(tenantCtx),
      any(numbering),
      undefined,
      undefined,
      any(hrRepo),
    );
  }

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Certification],
    });
    await ds.initialize();
    certRepo = ds.getRepository(Certification);
    await certRepo.save([
      certRepo.create({ employeeName: 'A', skill: 'ESD', area: 'SMT', active: true }),
      certRepo.create({ employeeName: 'B', skill: 'AOI', area: 'AOI', active: true }),
    ]);
    jest.clearAllMocks();
    hrRepo.findOne.mockResolvedValue({ area: 'SMT' });
    ctx.email = 'leader@plant.com';
    ctx.role = 'operator';
    delete process.env.ENFORCE_AREA_SCOPE;
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('returns all areas when the flag is off (default — no behaviour change)', async () => {
    expect(await service().list()).toHaveLength(2);
  });

  it('restricts a non-admin to their hr area when ENFORCE_AREA_SCOPE=true', async () => {
    process.env.ENFORCE_AREA_SCOPE = 'true';
    const r = await service().list();
    expect(r).toHaveLength(1);
    expect(r[0].area).toBe('SMT');
  });

  it('admins / executives bypass the area scope', async () => {
    process.env.ENFORCE_AREA_SCOPE = 'true';
    ctx.role = 'Admin';
    expect(await service().list()).toHaveLength(2);
  });

  it('fails open when the area cannot be resolved (never locks anyone out)', async () => {
    process.env.ENFORCE_AREA_SCOPE = 'true';
    hrRepo.findOne.mockResolvedValue(null);
    expect(await service().list()).toHaveLength(2);
  });
});
