import { WarehouseAlertsService } from './warehouse-alerts.service';
import { WarehouseTaskStatus } from './entities/warehouse-task.entity';
import { UserRole } from '../users/entities/user.entity';

/**
 * Unit del productor de alertas del Pull Monitor: SLA roto → supervisor,
 * pull urgente → handler, con dedupe por pull, scope de almacén y best-effort.
 */
describe('WarehouseAlertsService', () => {
  const minsAgo = (m: number) => new Date(Date.now() - m * 60000);

  let tasks: { find: jest.Mock };
  let users: { findByStatus: jest.Mock; findOneByEmail: jest.Mock };
  let notifications: { create: jest.Mock };

  const sup1 = { id: 'sup1', role: UserRole.MATERIALS_LEAD, status: 'active', scopes: {} };
  const op1 = { id: 'op1', role: UserRole.WAREHOUSE_OPERATOR, status: 'active', scopes: {} };
  const op2 = { id: 'op2', role: UserRole.WAREHOUSE_OPERATOR, status: 'active', scopes: { warehouses: ['WH-OTHER'] } };

  beforeEach(() => {
    tasks = { find: jest.fn().mockResolvedValue([]) };
    users = {
      findByStatus: jest.fn().mockResolvedValue([sup1, op1, op2]),
      findOneByEmail: jest.fn().mockResolvedValue(null), // sin cuenta owner en este test
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };
  });

  function make() {
    return new WarehouseAlertsService(tasks as never, users as never, notifications as never);
  }

  it('no-opera si no hay servicio de notificaciones', async () => {
    const svc = new WarehouseAlertsService(tasks as never, users as never, undefined);
    const r = await svc.scanPullSlaAndNotify();
    expect(r).toEqual({ scanned: 0, breached: 0, urgent: 0, notified: 0, unresolved: 0 });
    expect(tasks.find).not.toHaveBeenCalled();
  });

  it('SLA roto → avisa al supervisor con dedupe por folio', async () => {
    tasks.find.mockResolvedValue([
      { taskNumber: 'TSK-1', status: WarehouseTaskStatus.PENDING, partNumber: 'P1', project: 'AX-100', fromWarehouseId: 'WH-RM', toLocation: 'L1', slaMinutes: 60, urgent: false, createdAt: minsAgo(95) },
    ]);
    const r = await make().scanPullSlaAndNotify();
    expect(r.breached).toBe(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'sup1', kind: 'warehouse-sla', dedupeKey: 'warehouse-sla:TSK-1', href: '/dashboard/warehouse' }),
    );
    // No avisa a operadores por SLA.
    expect(notifications.create).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'op1', kind: 'warehouse-sla' }));
  });

  it('pull urgente → avisa al handler con scope de almacén (excluye otro almacén)', async () => {
    tasks.find.mockResolvedValue([
      { taskNumber: 'TSK-2', status: WarehouseTaskStatus.PENDING, partNumber: 'P2', project: 'AX-200', fromWarehouseId: 'WH-RM', toLocation: 'L2', slaMinutes: 999, urgent: true, createdAt: minsAgo(5) },
    ]);
    const r = await make().scanPullSlaAndNotify();
    expect(r.urgent).toBe(1);
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'op1', kind: 'warehouse-urgent', dedupeKey: 'warehouse-urgent:TSK-2' }),
    );
    // op2 está acotado a WH-OTHER → no recibe el aviso del pull en WH-RM.
    expect(notifications.create).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'op2' }));
  });

  it('pull fresco y no urgente no genera avisos', async () => {
    tasks.find.mockResolvedValue([
      { taskNumber: 'TSK-3', status: WarehouseTaskStatus.PENDING, partNumber: 'P3', fromWarehouseId: 'WH-RM', slaMinutes: 999, urgent: false, createdAt: minsAgo(2) },
    ]);
    const r = await make().scanPullSlaAndNotify();
    expect(r.breached).toBe(0);
    expect(r.urgent).toBe(0);
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
