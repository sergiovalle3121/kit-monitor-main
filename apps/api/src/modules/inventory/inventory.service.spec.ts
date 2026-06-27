import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

/**
 * Unit del InventoryService. El `QueryRunner` transaccional y los repos se
 * simulan, lo que permite ejercitar `recordTransaction` (validación de material,
 * candados de stock/estado, alta de posición destino, log de movimiento + auditoría
 * y rollback) y `ensureMaterial` sin una base real.
 */
describe('InventoryService', () => {
  let service: InventoryService;
  let materialRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let audit: { recordAction: jest.Mock; recordException: jest.Mock };
  let qrManager: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: typeof qrManager;
  };
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(() => {
    materialRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x })),
    };
    audit = {
      recordAction: jest.fn().mockResolvedValue(undefined),
      recordException: jest.fn().mockResolvedValue(undefined),
    };
    qrManager = {
      findOne: jest.fn(),
      create: jest.fn((_e, x) => x),
      save: jest.fn(async (x) => ({ id: 99, ...x })),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: qrManager,
    };
    dataSource = { createQueryRunner: jest.fn(() => queryRunner) };

    service = new InventoryService(
      {} as never, // positionRepo (no usado por estos métodos)
      {} as never, // movementRepo
      materialRepo as never,
      {} as never, // warehouseRepo
      audit as never,
      dataSource as never,
      { getTenantId: () => null } as never, // tenantCtx
    );
  });

  describe('recordTransaction', () => {
    const baseDto = {
      type: 'RECEIVE' as const,
      partNumber: 'RES-10K',
      quantity: 100,
      actorName: 'op1',
    };

    it('lanza NotFound y hace rollback si el material no existe en el maestro', async () => {
      materialRepo.findOne.mockResolvedValue(null);
      await expect(
        service.recordTransaction({ ...baseDto, toWarehouseId: 'WH-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('bloquea por stock insuficiente y registra una excepción HIGH', async () => {
      materialRepo.findOne.mockResolvedValue({ partNumber: 'RES-10K' });
      qrManager.findOne.mockResolvedValueOnce({ onHand: 10, holdStatus: 'available' });
      await expect(
        service.recordTransaction({
          ...baseDto,
          type: 'TRANSFER',
          fromWarehouseId: 'WH-1',
          toWarehouseId: 'WH-2',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(audit.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'HIGH', title: expect.stringContaining('Insufficient Stock') }),
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('bloquea el movimiento si el stock origen no está available (excepción CRITICAL)', async () => {
      materialRepo.findOne.mockResolvedValue({ partNumber: 'RES-10K' });
      qrManager.findOne.mockResolvedValueOnce({ onHand: 500, holdStatus: 'hold' });
      await expect(
        service.recordTransaction({
          ...baseDto,
          type: 'TRANSFER',
          fromWarehouseId: 'WH-1',
          toWarehouseId: 'WH-2',
        }),
      ).rejects.toThrow(/BLOCKED/);
      expect(audit.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'CRITICAL' }),
      );
    });

    it('camino feliz RECEIVE: crea posición destino, registra movimiento y audita ALLOWED', async () => {
      materialRepo.findOne.mockResolvedValue({ partNumber: 'RES-10K' });
      qrManager.findOne.mockResolvedValueOnce(undefined); // no hay posición destino previa
      const mov = await service.recordTransaction({ ...baseDto, toWarehouseId: 'WH-1' });

      // Creó la posición destino con el holdStatus por defecto 'available'.
      // (onHand parte en 0 y se incrementa después; jest retiene la referencia
      // mutada, por eso aquí sólo se afirman los campos estables.)
      expect(qrManager.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ partNumber: 'RES-10K', warehouseId: 'WH-1', holdStatus: 'available' }),
      );
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'INVENTORY_RECEIVE', outcome: 'ALLOWED' }),
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(mov).toBeDefined();
    });

    it('TRANSFER con stock disponible descuenta del origen y suma al destino', async () => {
      materialRepo.findOne.mockResolvedValue({ partNumber: 'RES-10K' });
      const source = { onHand: 500, holdStatus: 'available' };
      const dest = { onHand: 20, holdStatus: 'available' };
      qrManager.findOne
        .mockResolvedValueOnce(source) // posición origen
        .mockResolvedValueOnce(dest); // posición destino existente

      await service.recordTransaction({
        ...baseDto,
        type: 'TRANSFER',
        quantity: 100,
        fromWarehouseId: 'WH-1',
        toWarehouseId: 'WH-2',
      });

      expect(source.onHand).toBe(400); // 500 - 100
      expect(dest.onHand).toBe(120); // 20 + 100
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('ensureMaterial', () => {
    it('exige partNumber', async () => {
      await expect(service.ensureMaterial({})).rejects.toBeInstanceOf(BadRequestException);
    });

    it('devuelve el material existente sin volver a crearlo', async () => {
      const existing = { partNumber: 'P1', description: 'X' };
      materialRepo.findOne.mockResolvedValue(existing);
      const res = await service.ensureMaterial({ partNumber: 'P1' });
      expect(res).toBe(existing);
      expect(materialRepo.save).not.toHaveBeenCalled();
    });

    it('crea el material con defaults y audita cuando se pasa un usuario', async () => {
      materialRepo.findOne.mockResolvedValue(null);
      const res = await service.ensureMaterial(
        { partNumber: 'P2' },
        { email: 'qa@axos.test' } as never,
      );
      expect(materialRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ partNumber: 'P2', uom: 'EA', standardCost: 0 }),
      );
      expect(materialRepo.save).toHaveBeenCalled();
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MATERIAL_MASTER_CREATED' }),
      );
      expect(res.partNumber).toBe('P2');
    });
  });
});
