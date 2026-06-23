import { UsersService } from './users.service';
import { User } from './entities/user.entity';

const any = (v: unknown): any => v;

describe('UsersService.listByPermission', () => {
  const prevOwners = process.env.OWNER_EMAILS;

  function svcWith(users: Partial<User>[]) {
    const repo = { find: jest.fn().mockResolvedValue(users) };
    return new UsersService(any(repo));
  }

  beforeEach(() => {
    process.env.OWNER_EMAILS = 'owner@plant.com';
  });
  afterEach(() => {
    if (prevOwners === undefined) delete process.env.OWNER_EMAILS;
    else process.env.OWNER_EMAILS = prevOwners;
  });

  it('matches by stored permission, Admin role and owner email; skips inactive / others', async () => {
    const svc = svcWith([
      {
        id: '1',
        email: 'ops@plant.com',
        role: any('Logistics'),
        permissions: ['logistics:write'],
        isActive: true,
      },
      {
        id: '2',
        email: 'qa@plant.com',
        role: any('Quality'),
        permissions: ['quality:read'],
        isActive: true,
      },
      {
        id: '3',
        email: 'boss@plant.com',
        role: any('Admin'),
        permissions: [],
        isActive: true,
      },
      {
        id: '4',
        email: 'owner@plant.com',
        role: any('Viewer'),
        permissions: [],
        isActive: true,
      },
      {
        id: '5',
        email: 'old@plant.com',
        role: any('Logistics'),
        permissions: ['logistics:write'],
        isActive: false,
      },
    ]);
    const res = await svc.listByPermission('logistics:write');
    expect(res.map((u) => u.id).sort()).toEqual(['1', '3', '4']);
  });
});
