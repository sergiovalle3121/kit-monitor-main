import { ReplenishmentService } from './replenishment.service';
import { WarehouseTaskType } from './entities/warehouse-task.entity';

/**
 * Unit del ReplenishmentService. El QueryBuilder de reglas se simula como objeto
 * encadenable; con un usuario sin scope de building se evita el subquery crudo.
 * Cubre el alta de reglas (folio/auditoría) y el análisis de señales min/max con
 * auto-creación de tareas.
 */
describe('ReplenishmentService', () => {
  let service: ReplenishmentService;
  let qb: { where: jest.Mock; andWhere: jest.Mock; getMany: jest.Mock };
  let ruleRepo: { createQueryBuilder: jest.Mock; create: jest.Mock; save: jest.Mock };
  let positionRepo: { find: jest.Mock };
  let warehouseService: { createTask: jest.Mock };
  let audit: { recordAction: jest.Mock };

  const user = { email: 'mat@axos.test', scopes: {} } as never;

  beforeEach(() => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    ruleRepo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 7, ...x })),
    };
    positionRepo = { find: jest.fn() };
    warehouseService = { createTask: jest.fn().mockResolvedValue({}) };
    audit = { recordAction: jest.fn().mockResolvedValue(undefined) };
    service = new ReplenishmentService(
      ruleRepo as never,
      positionRepo as never,
      warehouseService as never,
      audit as never,
      {} as never, // warehouseRepo
    );
  });

  describe('createRule', () => {
    it('persiste la regla y registra la acción de auditoría', async () => {
      const saved = await service.createRule(
        { partNumber: 'P1', warehouseId: 'WH-1' },
        user,
      );
      expect(ruleRepo.save).toHaveBeenCalled();
      expect(audit.recordAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REPLENISHMENT_RULE_CREATED', resourceId: '7' }),
      );
      expect(saved.id).toBe(7);
    });
  });

  describe('analyzeInventory', () => {
    it('emite OUT_OF_STOCK y auto-crea tarea cuando no hay stock disponible', async () => {
      qb.getMany.mockResolvedValue([
        {
          id: 1,
          partNumber: 'P1',
          warehouseId: 'WH-1',
          programId: 'PR1',
          minStock: 50,
          maxStock: 200,
          priority: 'high',
          autoCreateTasks: true,
          preferredSourceWarehouseId: 'WH-MAIN',
        },
      ]);
      positionRepo.find.mockResolvedValue([]); // sin posiciones → stock 0

      const signals = await service.analyzeInventory(user);

      expect(signals).toHaveLength(1);
      expect(signals[0]).toMatchObject({
        status: 'OUT_OF_STOCK',
        currentStock: 0,
        suggestedQty: 200, // maxStock - 0
        sourceWarehouseId: 'WH-MAIN',
      });
      expect(warehouseService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ type: WarehouseTaskType.TRANSFER, partNumber: 'P1', quantity: 200 }),
        user,
      );
    });

    it('marca BELOW_MIN (no OUT_OF_STOCK) cuando hay algo de stock disponible', async () => {
      qb.getMany.mockResolvedValue([
        {
          id: 2,
          partNumber: 'P2',
          warehouseId: 'WH-1',
          minStock: 50,
          maxStock: 200,
          autoCreateTasks: false,
        },
      ]);
      // 30 disponibles + 100 en hold (no cuentan) ⇒ stock disponible = 30 ≤ 50.
      positionRepo.find.mockResolvedValue([
        { onHand: 30, holdStatus: 'available' },
        { onHand: 100, holdStatus: 'hold' },
      ]);

      const signals = await service.analyzeInventory(user);
      expect(signals[0]).toMatchObject({ status: 'BELOW_MIN', currentStock: 30, suggestedQty: 170 });
      expect(warehouseService.createTask).not.toHaveBeenCalled();
    });

    it('no genera señal cuando el stock disponible supera el mínimo', async () => {
      qb.getMany.mockResolvedValue([
        { id: 3, partNumber: 'P3', warehouseId: 'WH-1', minStock: 50, maxStock: 200 },
      ]);
      positionRepo.find.mockResolvedValue([{ onHand: 120, holdStatus: 'available' }]);
      const signals = await service.analyzeInventory(user);
      expect(signals).toHaveLength(0);
    });
  });
});
