import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import {
  WarehouseTaskStatus,
  WarehouseTaskType,
} from './entities/warehouse-task.entity';

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
});
