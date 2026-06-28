import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { MaterialReturnStatus } from './entities/material-return.entity';

/**
 * Unit del ReturnsService con repos/colaboradores simulados. Cubre el folio,
 * la confirmación con reingreso de stock (recordTransaction type RETURN) y la
 * resiliencia cuando el reingreso falla (la devolución queda registrada).
 */
describe('ReturnsService', () => {
  let service: ReturnsService;
  let returnRepo: { count: jest.Mock; create: jest.Mock; save: jest.Mock; findOne: jest.Mock };
  let inventory: { recordTransaction: jest.Mock; ensureMaterial: jest.Mock };
  let audit: { recordAction: jest.Mock };

  const user = { email: 'mat@axos.test' } as never;

  beforeEach(() => {
    returnRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 1, ...x })),
      findOne: jest.fn(),
    };
    inventory = {
      recordTransaction: jest.fn().mockResolvedValue({}),
      ensureMaterial: jest.fn().mockResolvedValue({}),
    };
    audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
    service = new ReturnsService(returnRepo as never, {} as never, inventory as never, audit as never, { getTenantId: () => null } as never);
  });

  describe('create', () => {
    it('asigna folio RET secuencial y estado PENDING', async () => {
      returnRepo.count.mockResolvedValue(2);
      const saved = await service.create(
        { partNumber: 'P1', quantity: 7, toWarehouseId: 'WH-1', batch: 'L-99', vendor: 'AX-SUP-FERRUM' },
        user,
      );
      expect(saved.returnNumber).toBe('RET-2024-0003');
      expect(saved.status).toBe(MaterialReturnStatus.PENDING);
      expect(saved.batch).toBe('L-99');
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MATERIAL_RETURN_CREATED' }),
      );
    });

    it('exige parte y almacén destino', async () => {
      await expect(service.create({ quantity: 1 }, user)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.create({ partNumber: 'P1' }, user)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('complete', () => {
    it('confirma, reingresa stock (RETURN) y marca restocked', async () => {
      returnRepo.findOne.mockResolvedValue({
        id: 1,
        returnNumber: 'RET-2024-0001',
        status: MaterialReturnStatus.PENDING,
        partNumber: 'P1',
        quantity: 7,
        toWarehouseId: 'WH-1',
        toLocation: 'RET-01',
        batch: 'L-99',
      });
      const res = await service.complete(1, 'beto', user);
      expect(inventory.ensureMaterial).toHaveBeenCalled();
      expect(inventory.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'RETURN', partNumber: 'P1', toWarehouseId: 'WH-1', referenceType: 'MATERIAL_RETURN' }),
      );
      expect(res.status).toBe(MaterialReturnStatus.COMPLETED);
      expect(res.restocked).toBe(true);
      expect(res.completedAt).toBeInstanceOf(Date);
    });

    it('queda registrada aunque el reingreso falle (restocked=false)', async () => {
      returnRepo.findOne.mockResolvedValue({
        id: 2,
        returnNumber: 'RET-2024-0002',
        status: MaterialReturnStatus.PENDING,
        partNumber: 'P9',
        quantity: 1,
        toWarehouseId: 'WH-1',
      });
      inventory.recordTransaction.mockRejectedValueOnce(new Error('Insufficient stock'));
      const res = await service.complete(2, 'beto', user);
      expect(res.status).toBe(MaterialReturnStatus.COMPLETED);
      expect(res.restocked).toBe(false);
      expect(res.notes).toContain('sin reingreso');
    });

    it('404 si la devolución no existe', async () => {
      returnRepo.findOne.mockResolvedValue(null);
      await expect(service.complete(9, 'beto', user)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
