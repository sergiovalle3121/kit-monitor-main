import { AiBriefingTask, sameTenant } from './ai-briefing.task';
import { SemanticService } from '../semantic/semantic.service';
import { BriefsService } from '../semantic/briefs.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('sameTenant', () => {
  it('matches the default tenant for users without a tenant', () => {
    expect(sameTenant(null, '__default__')).toBe(true);
    expect(sameTenant('__default__', '__default__')).toBe(true);
    expect(sameTenant('acme', '__default__')).toBe(false);
  });
  it('matches exact tenant otherwise', () => {
    expect(sameTenant('acme', 'acme')).toBe(true);
    expect(sameTenant('other', 'acme')).toBe(false);
    expect(sameTenant(null, 'acme')).toBe(false);
  });
});

describe('AiBriefingTask.run', () => {
  function setup(opts: {
    tenants: string[];
    briefByTenant: Record<string, unknown>;
    admins: Array<{ id: string; tenantId: string | null }>;
  }) {
    const notifs = { create: jest.fn().mockResolvedValue({}) };
    const fakes = new Map<unknown, unknown>([
      [SemanticService, { listTenants: jest.fn().mockResolvedValue(opts.tenants) }],
      [
        BriefsService,
        {
          listForTenant: jest
            .fn()
            .mockImplementation((t: string) =>
              Promise.resolve({ latest: opts.briefByTenant[t] ?? null }),
            ),
        },
      ],
      [UsersService, { listByPermission: jest.fn().mockResolvedValue(opts.admins) }],
      [NotificationsService, notifs],
    ]);
    const moduleRef = { get: (type: unknown) => fakes.get(type) };
    const task = new AiBriefingTask(moduleRef as never);
    return { task, notifs };
  }

  it('pushes a brief with alerts to that tenant’s admins only', async () => {
    const { task, notifs } = setup({
      tenants: ['acme', 'globex'],
      briefByTenant: {
        acme: {
          headline: '2 alertas críticas',
          summary: 'Resumen…',
          alertsCount: 2,
          criticalCount: 2,
          periodKey: '2026-06-28',
        },
        globex: {
          headline: 'Todo estable',
          summary: 'ok',
          alertsCount: 0,
          criticalCount: 0,
          periodKey: '2026-06-28',
        },
      },
      admins: [
        { id: 'a1', tenantId: 'acme' },
        { id: 'a2', tenantId: 'globex' },
        { id: 'a3', tenantId: null },
      ],
    });

    const pushed = await task.run();
    expect(pushed).toBe(1);
    expect(notifs.create).toHaveBeenCalledTimes(1);
    expect(notifs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'a1',
        severity: 'critical',
        source: 'CIDE',
        dedupeKey: 'cide-brief:acme:2026-06-28:a1',
      }),
    );
  });

  it('does not push when the latest brief has no alerts', async () => {
    const { task, notifs } = setup({
      tenants: ['acme'],
      briefByTenant: {
        acme: {
          headline: 'Estable',
          summary: 'ok',
          alertsCount: 0,
          criticalCount: 0,
          periodKey: '2026-06-28',
        },
      },
      admins: [{ id: 'a1', tenantId: 'acme' }],
    });
    expect(await task.run()).toBe(0);
    expect(notifs.create).not.toHaveBeenCalled();
  });
});
