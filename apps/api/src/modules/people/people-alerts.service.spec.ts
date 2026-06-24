import { DataSource } from 'typeorm';
import { PeopleAlertsService } from './people-alerts.service';
import { Certification } from './entities/certification.entity';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const any = (v: unknown): any => v;

describe('PeopleAlertsService (recert alerts → mailbox)', () => {
  let ds: DataSource;
  let svc: PeopleAlertsService;
  const created: { dedupeKey?: string | null; title: string; severity?: string }[] = [];
  const inDays = (n: number) =>
    new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  const users = { findOneByEmail: jest.fn() };
  const notifications = {
    create: jest.fn(async (i: { dedupeKey?: string | null; title: string; severity?: string }) => {
      created.push(i);
      return i;
    }),
  };

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Certification],
    });
    await ds.initialize();
    created.length = 0;
    jest.clearAllMocks();
    users.findOneByEmail.mockImplementation(async (email: string) =>
      email === 'op@plant.com' ? { id: 'u-1' } : null,
    );
    svc = new PeopleAlertsService(
      ds.getRepository(Certification),
      any(users),
      any(notifications),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  async function seed(partial: Partial<Certification>) {
    const repo = ds.getRepository(Certification);
    await repo.save(
      repo.create({
        employeeName: 'Op',
        employeeEmail: 'op@plant.com',
        skill: 'ESD',
        active: true,
        ...partial,
      }),
    );
  }

  it('notifies expiring + expired (deduped), skips valid / no-expiry', async () => {
    await seed({ skill: 'A', expiresDate: new Date(inDays(10)) }); // expiring
    await seed({ skill: 'B', expiresDate: new Date(inDays(-3)) }); // expired
    await seed({ skill: 'C', expiresDate: new Date(inDays(200)) }); // valid → skip
    await seed({ skill: 'D', expiresDate: null }); // no expiry → skip

    const r = await svc.scanRecertAndNotify(30);
    expect(r.scanned).toBe(4);
    expect(r.expiring).toBe(1);
    expect(r.expired).toBe(1);
    expect(r.notified).toBe(2);

    const keys = created.map((c) => c.dedupeKey ?? '');
    expect(keys.some((k) => /^cert-expiry:.+:expiring:/.test(k))).toBe(true);
    expect(keys.some((k) => /^cert-expiry:.+:expired:/.test(k))).toBe(true);
    expect(created.find((c) => c.title.includes('vencida'))?.severity).toBe('critical');
    expect(created.find((c) => c.title.includes('por vencer'))?.severity).toBe('high');
  });

  it('counts unresolved when neither the operator nor an owner has a system user', async () => {
    users.findOneByEmail.mockResolvedValue(null);
    await seed({ employeeEmail: 'ghost@plant.com', expiresDate: new Date(inDays(5)) });
    const r = await svc.scanRecertAndNotify(30);
    expect(r.notified).toBe(0);
    expect(r.unresolved).toBe(1);
  });
});
