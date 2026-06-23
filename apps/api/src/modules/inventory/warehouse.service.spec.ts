import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import {
  WarehouseTaskStatus,
  WarehouseTaskType,
} from './entities/warehouse-task.entity';
import { DEFAULT_PULL_SLA_MINUTES } from './pull.util';

/**
 * Unit del WarehouseService con repos y colaboradores simulados. Cubre el ciclo
 * de la tarea (folio, start con candado de estado, complete con movimiento físico)
 * y la excepción de surtido (short-pick → movimiento parcial + tarea remanente).
 */
describe('WarehouseService', () => {
  let service: WarehouseService;
  let taskRepo: { count: jest.Mock; create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let inventory: { recordTransaction: jest.Mock };
  let audit: { recordAction: jest.Mock };

  const user = { email: 'mat@axos.test' } as never;

  beforeEach(() => {
    taskRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 1, ...x })),
      findOne: jest.fn(),
    };
    inventory = { recordTransaction: jest.fn().mockResolvedValue({}) };
    audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
    service = new WarehouseService(
      taskRepo as never,
      inventory as never,
      audit as never,
      {} as never, // warehouseRepo (sólo lo usan los list con QueryBuilder)
    );
  });

  describe('createTask', () => {
    it('asigna folio TSK secuencial, estado PENDING y audita', async () => {
      taskRepo.count.mockResolvedValue(4);
      const saved = await service.createTask(
        { type: WarehouseTaskType.TRANSFER, partNumber: 'P1', quantity: 10 },
        user,
      );
      expect(saved.taskNumber).toBe('TSK-2024-0005');
      expect(saved.status).toBe(WarehouseTaskStatus.PENDING);
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAREHOUSE_TASK_CREATED' }),
      );
    });
  });

  describe('startTask', () => {
    it('pasa una tarea PENDING a IN_PROGRESS y fija el asignado', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        taskNumber: 'TSK-2024-0001',
        status: WarehouseTaskStatus.PENDING,
      });
      const res = await service.startTask(1, 'op2', user);
      expect(res.status).toBe(WarehouseTaskStatus.IN_PROGRESS);
      expect(res.assignedTo).toBe('op2');
    });

    it('lanza 404 si la tarea no existe', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.startTask(9, 'op2', user)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza arrancar una tarea que no está PENDING', async () => {
      taskRepo.findOne.mockResolvedValue({ status: WarehouseTaskStatus.IN_PROGRESS });
      await expect(service.startTask(1, 'op2', user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('completeTask', () => {
    it('ejecuta el movimiento físico y marca COMPLETED', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        taskNumber: 'TSK-2024-0001',
        status: WarehouseTaskStatus.IN_PROGRESS,
        type: WarehouseTaskType.TRANSFER,
        partNumber: 'P1',
        quantity: 5,
        fromWarehouseId: 'WH-1',
        fromLocation: 'A',
        toWarehouseId: 'WH-2',
        toLocation: 'B',
      });
      const res = await service.completeTask(1, 'op2', user);
      expect(inventory.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TRANSFER', partNumber: 'P1', quantity: 5, referenceType: 'WAREHOUSE_TASK' }),
      );
      expect(res.status).toBe(WarehouseTaskStatus.COMPLETED);
      expect(res.completedBy).toBe('op2');
    });

    it('exige que la tarea esté IN_PROGRESS', async () => {
      taskRepo.findOne.mockResolvedValue({ status: WarehouseTaskStatus.PENDING });
      await expect(service.completeTask(1, 'op2', user)).rejects.toBeInstanceOf(BadRequestException);
      expect(inventory.recordTransaction).not.toHaveBeenCalled();
    });
  });

  describe('handlePickException', () => {
    it('SHORT_PICK con cantidad parcial mueve lo surtido, crea tarea remanente y cancela la original', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        taskNumber: 'TSK-2024-0001',
        status: WarehouseTaskStatus.IN_PROGRESS,
        type: WarehouseTaskType.PICK,
        partNumber: 'P1',
        quantity: 10,
        fromWarehouseId: 'WH-1',
        fromLocation: 'A',
        toWarehouseId: 'WH-2',
        toLocation: 'B',
      });

      const res = await service.handlePickException(
        1,
        { reason: 'SHORT_PICK', pickedQty: 4, actor: 'op2' },
        user,
      );

      // Movimiento parcial por lo surtido.
      expect(inventory.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 4, referenceType: 'PICK_EXCEPTION' }),
      );
      // Se generó una tarea remanente (createTask vuelve a llamar a count/save).
      const remainderCreate = taskRepo.create.mock.calls.find(
        ([dto]) => (dto as { referenceId?: string }).referenceId === 'TSK-2024-0001-REMAINDER',
      );
      expect(remainderCreate).toBeTruthy();
      expect((remainderCreate![0] as { quantity: number }).quantity).toBe(6); // 10 - 4
      // La original queda CANCELLED.
      expect(res.status).toBe(WarehouseTaskStatus.CANCELLED);
    });

    it('lanza 404 si la tarea no existe', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(
        service.handlePickException(9, { reason: 'SHORT_PICK', pickedQty: 1, actor: 'op2' }, user),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── PULL MONITOR ───────────────────────────────────────────────────────────

  describe('createPull', () => {
    it('crea un PICK PENDING con campos de pull (proyecto, SLA default, touches=0)', async () => {
      taskRepo.count.mockResolvedValue(0);
      const saved = await service.createPull(
        { partNumber: 'P1', quantity: 5, fromWarehouseId: 'WH-1', toWarehouseId: 'WH-2', project: 'AX-100', requestor: 'line.lead' },
        user,
      );
      expect(saved.taskNumber).toBe('TSK-2024-0001');
      expect(saved.type).toBe(WarehouseTaskType.PICK);
      expect(saved.status).toBe(WarehouseTaskStatus.PENDING);
      expect(saved.project).toBe('AX-100');
      expect(saved.requestor).toBe('line.lead');
      expect(saved.slaMinutes).toBe(DEFAULT_PULL_SLA_MINUTES);
      expect(saved.touches).toBe(0);
    });

    it('exige partNumber y almacén origen', async () => {
      await expect(service.createPull({ quantity: 1 }, user)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.createPull({ partNumber: 'P1' }, user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('deliverTask (Entregar)', () => {
    it('crear-pull → entregar: cambia estado a COMPLETED y registra deliveredAt', async () => {
      // Pull recién creado (PENDING), se entrega directo sin pasar por start.
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        taskNumber: 'TSK-2024-0001',
        status: WarehouseTaskStatus.PENDING,
        type: WarehouseTaskType.PICK,
        partNumber: 'P1',
        quantity: 5,
        fromWarehouseId: 'WH-1',
        fromLocation: 'A-01',
        toWarehouseId: 'WH-2',
        toLocation: 'L1-POU',
      });

      const res = await service.deliverTask(1, 'beto', user);

      expect(res.status).toBe(WarehouseTaskStatus.COMPLETED);
      expect(res.deliveredAt).toBeInstanceOf(Date);
      expect(res.completedBy).toBe('beto');
      // Movimiento físico best-effort con referencia de pull.
      expect(inventory.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'TRANSFER', referenceType: 'WAREHOUSE_PULL', partNumber: 'P1' }),
      );
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WAREHOUSE_PULL_DELIVERED' }),
      );
    });

    it('entrega aunque el inventario falle (no bloquea el cierre del SLA)', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 2,
        taskNumber: 'TSK-2024-0002',
        status: WarehouseTaskStatus.IN_PROGRESS,
        partNumber: 'P9',
        quantity: 3,
        fromWarehouseId: 'WH-1',
        toWarehouseId: 'WH-2',
      });
      inventory.recordTransaction.mockRejectedValueOnce(new Error('Insufficient stock'));

      const res = await service.deliverTask(2, 'beto', user);
      expect(res.status).toBe(WarehouseTaskStatus.COMPLETED);
      expect(res.deliveredAt).toBeInstanceOf(Date);
    });

    it('rechaza entregar un pull ya cerrado', async () => {
      taskRepo.findOne.mockResolvedValue({ status: WarehouseTaskStatus.COMPLETED });
      await expect(service.deliverTask(1, 'beto', user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancelTask (Cancelar)', () => {
    it('marca CANCELLED y registra canceledAt', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        taskNumber: 'TSK-2024-0001',
        status: WarehouseTaskStatus.PENDING,
      });
      const res = await service.cancelTask(1, 'beto', 'duplicado', user);
      expect(res.status).toBe(WarehouseTaskStatus.CANCELLED);
      expect(res.canceledAt).toBeInstanceOf(Date);
      expect(inventory.recordTransaction).not.toHaveBeenCalled();
    });

    it('no permite cancelar un pull ya entregado', async () => {
      taskRepo.findOne.mockResolvedValue({ status: WarehouseTaskStatus.COMPLETED });
      await expect(service.cancelTask(1, 'beto', undefined, user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('startTask — touches', () => {
    it('incrementa touches al tomar el pull', async () => {
      taskRepo.findOne.mockResolvedValue({
        id: 1,
        taskNumber: 'TSK-2024-0001',
        status: WarehouseTaskStatus.PENDING,
        touches: 1,
      });
      const res = await service.startTask(1, 'op2', user);
      expect(res.touches).toBe(2);
    });
  });

  describe('importReplenishCalls (kit → pull)', () => {
    it('crea pulls desde llamados de resurtido ABIERTOS, mapeando estación→destino', async () => {
      const materialStaging = {
        listReplenishCalls: jest.fn().mockResolvedValue([
          { id: 'c1', part: 'P1', qty: 10, station: 'L1-POU', priority: 'URGENT', status: 'OPEN', woFolio: 'WO-1', raisedBy: 'kanban' },
          { id: 'c2', part: 'P2', qty: 5, station: 'L2-POU', priority: 'MEDIUM', status: 'DELIVERED', woFolio: 'WO-2' }, // cerrado → se ignora
        ]),
      };
      const svc = new WarehouseService(taskRepo as never, inventory as never, audit as never, {} as never, materialStaging as never);
      taskRepo.findOne.mockResolvedValue(null); // ninguno importado aún
      const res = await svc.importReplenishCalls({ sourceWarehouseId: 'WH-RM' }, user);
      expect(res.total).toBe(1); // sólo c1 está abierto
      expect(res.imported).toBe(1);
      const created = taskRepo.create.mock.calls.find(([d]) => (d as { referenceId?: string }).referenceId === 'c1');
      expect(created).toBeTruthy();
      expect((created![0] as { toLocation: string }).toLocation).toBe('L1-POU');
      expect((created![0] as { urgent: boolean }).urgent).toBe(true);
      expect((created![0] as { referenceType: string }).referenceType).toBe('REPLENISH_CALL');
    });

    it('es idempotente: omite llamados ya importados', async () => {
      const materialStaging = {
        listReplenishCalls: jest.fn().mockResolvedValue([
          { id: 'c1', part: 'P1', qty: 10, station: 'L1', priority: 'HIGH', status: 'OPEN' },
        ]),
      };
      const svc = new WarehouseService(taskRepo as never, inventory as never, audit as never, {} as never, materialStaging as never);
      taskRepo.findOne.mockResolvedValue({ id: 99 }); // ya existe el pull del llamado
      const res = await svc.importReplenishCalls({ sourceWarehouseId: 'WH-RM' }, user);
      expect(res.imported).toBe(0);
      expect(res.skipped).toBe(1);
    });

    it('exige integración disponible y almacén origen', async () => {
      const noStaging = new WarehouseService(taskRepo as never, inventory as never, audit as never, {} as never, undefined);
      await expect(noStaging.importReplenishCalls({ sourceWarehouseId: 'WH-RM' }, user)).rejects.toBeInstanceOf(BadRequestException);
      const withStaging = new WarehouseService(taskRepo as never, inventory as never, audit as never, {} as never, { listReplenishCalls: jest.fn() } as never);
      await expect(withStaging.importReplenishCalls({ sourceWarehouseId: '' }, user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('importPullList (CSV)', () => {
    it('crea pulls de filas válidas y reporta errores por fila (best-effort)', async () => {
      taskRepo.count.mockResolvedValue(0);
      const rows = [
        { partNumber: 'P1', quantity: 10, fromWarehouseId: 'WH-RM', project: 'AX', urgent: 'sí' },
        { partNumber: '', quantity: 5, fromWarehouseId: 'WH-RM' }, // sin parte → falla
        { partNumber: 'P3', quantity: 3, fromWarehouseId: '' }, // sin almacén → falla
      ];
      const res = await service.importPullList(rows, user);
      expect(res.imported).toBe(1);
      expect(res.failed).toBe(2);
      expect(res.errors.map((e) => e.row)).toEqual([2, 3]);
      // La fila válida marca urgente y referenceType PULL_LIST.
      const created = taskRepo.create.mock.calls.find(([d]) => (d as { partNumber?: string }).partNumber === 'P1');
      expect((created![0] as { urgent: boolean }).urgent).toBe(true);
      expect((created![0] as { referenceType: string }).referenceType).toBe('PULL_LIST');
    });

    it('rechaza lista vacía', async () => {
      await expect(service.importPullList([], user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
