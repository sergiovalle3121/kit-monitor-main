import { DataSource } from 'typeorm';
import { TrafficAlertsService } from './traffic-alerts.service';
import { LoadingDock } from './entities/loading-dock.entity';

const any = (v: unknown): any => v;

describe('TrafficAlertsService (dock overstay → mailbox)', () => {
  let ds: DataSource;
  let svc: TrafficAlertsService;
  const created: {
    dedupeKey?: string | null;
    title: string;
    severity?: string;
  }[] = [];
  const minsAgo = (n: number) => new Date(Date.now() - n * 60_000);
  const prevOwners = process.env.OWNER_EMAILS;

  const users = { findOneByEmail: jest.fn() };
  const notifications = {
    create: jest.fn(
      async (i: {
        dedupeKey?: string | null;
        title: string;
        severity?: string;
      }) => {
        created.push(i);
        return i;
      },
    ),
  };

  beforeEach(async () => {
    ds = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [LoadingDock],
    });
    await ds.initialize();
    created.length = 0;
    jest.clearAllMocks();
    process.env.OWNER_EMAILS = 'owner@plant.com';
    users.findOneByEmail.mockImplementation(async (email: string) =>
      email === 'owner@plant.com' ? { id: 'owner-1' } : null,
    );
    svc = new TrafficAlertsService(
      ds.getRepository(LoadingDock),
      any(users),
      any(notifications),
    );
  });

  afterEach(async () => {
    if (prevOwners === undefined) delete process.env.OWNER_EMAILS;
    else process.env.OWNER_EMAILS = prevOwners;
    await ds.destroy();
  });

  async function seedDock(partial: Partial<LoadingDock>) {
    const repo = ds.getRepository(LoadingDock);
    await repo.save(
      repo.create({
        code: 'D',
        type: 'shipping',
        status: 'available',
        ...partial,
      }),
    );
  }

  it('notifies docks over the threshold (deduped key per occupancy), skips fresh / free docks', async () => {
    await seedDock({
      code: 'D-1',
      status: 'occupied',
      occupiedAt: minsAgo(300),
    }); // 5h → overstay (high)
    await seedDock({
      code: 'D-2',
      status: 'occupied',
      occupiedAt: minsAgo(60),
    }); // 1h → ok
    await seedDock({
      code: 'D-3',
      status: 'occupied',
      occupiedAt: minsAgo(500),
    }); // ~8.3h → critical
    await seedDock({ code: 'D-4', status: 'available' }); // libre → fuera del barrido

    const r = await svc.scanDockOverstayAndNotify(240); // umbral 4h

    expect(r.occupied).toBe(3);
    expect(r.overstay).toBe(2);
    expect(r.notified).toBe(2);
    expect(r.unresolved).toBe(0);

    expect(
      created.every((c) => /^dock-overstay:.+:/.test(c.dedupeKey ?? '')),
    ).toBe(true);
    expect(created.some((c) => c.severity === 'high')).toBe(true);
    expect(created.some((c) => c.severity === 'critical')).toBe(true);

    // Idempotente: re-barrer produce las MISMAS dedupeKeys (el buzón las reusa).
    const firstKeys = created.map((c) => c.dedupeKey).sort();
    created.length = 0;
    await svc.scanDockOverstayAndNotify(240);
    expect(created.map((c) => c.dedupeKey).sort()).toEqual(firstKeys);
  });

  it('counts unresolved when no owner has a system user', async () => {
    users.findOneByEmail.mockResolvedValue(null);
    await seedDock({
      code: 'D-9',
      status: 'occupied',
      occupiedAt: minsAgo(600),
    });
    const r = await svc.scanDockOverstayAndNotify(240);
    expect(r.overstay).toBe(1);
    expect(r.notified).toBe(0);
    expect(r.unresolved).toBe(1);
  });
});
