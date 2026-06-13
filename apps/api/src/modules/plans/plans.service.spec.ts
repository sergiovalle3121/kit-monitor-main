import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';

/**
 * Unit del PlansService con repos simulados (evita el tipo jsonb de la entidad
 * Plan bajo SQLite). Cubre la inteligencia de programación (carga por línea y
 * umbrales), la serialización/404 de findOne, la generación de folio de WO y los
 * candados de borrado.
 */
describe('PlansService', () => {
  let service: PlansService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let capacityRepo: { find: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 42, ...x })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    capacityRepo = { find: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new PlansService(
      repo as never,
      capacityRepo as never,
      {} as never, // programRepo
      {} as never, // lineRepo
      {} as never, // inventory
      {} as never, // quality
      audit as never,
      {} as never, // dataSource
    );
  });

  describe('findOne', () => {
    it('lanza 404 cuando el plan no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('serializa el plan derivando hasKit/kitId/kitStatus y oculta la relación kit', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        model: 'X1',
        kit: { id: 9, status: 'open' },
      });
      const res = await service.findOne(1);
      expect(res).toMatchObject({ id: 1, model: 'X1', hasKit: true, kitId: 9, kitStatus: 'open' });
      expect(res.kit).toBeUndefined();
    });

    it('serializa correctamente un plan sin kit', async () => {
      repo.findOne.mockResolvedValue({ id: 2, model: 'X2', kit: null });
      const res = await service.findOne(2);
      expect(res).toMatchObject({ hasKit: false, kitId: null, kitStatus: null });
    });
  });

  describe('create', () => {
    it('respeta el workOrder explícito y normaliza el modelo a MAYÚSCULAS', async () => {
      repo.findOne.mockResolvedValue({ id: 42, model: 'ABC', kit: null });
      await service.create({ model: ' abc ', workOrder: 'WO-7', quantity: 10 } as never);
      const created = repo.create.mock.calls[0][0] as { workOrder: string; model: string };
      expect(created.workOrder).toBe('WO-7');
      expect(created.model).toBe('ABC');
    });

    it('genera el siguiente folio numérico con padding cuando no se pasa workOrder', async () => {
      // generateWorkOrder lee los workOrder existentes; el máximo numérico es 41.
      repo.find.mockResolvedValue([
        { workOrder: '00041' },
        { workOrder: 'WO-LEGACY' }, // no numérico → ignorado
        { workOrder: '7' },
      ]);
      repo.findOne.mockResolvedValue({ id: 42, model: 'M', kit: null });
      await service.create({ model: 'm', quantity: 1 } as never);
      const created = repo.create.mock.calls[0][0] as { workOrder: string };
      expect(created.workOrder).toBe('00042'); // 41 + 1, padded a 5
    });
  });

  describe('update', () => {
    it('lanza 404 si el plan no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(1, { model: 'x' } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('normaliza el modelo a MAYÚSCULAS y persiste el patch', async () => {
      repo.findOne.mockResolvedValue({ id: 1, model: 'X9', kit: null });
      await service.update(1, { model: ' x9 ' } as never);
      expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({ model: 'X9' }));
    });
  });

  describe('releaseWorkOrder', () => {
    it('lanza 404 si el plan no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.releaseWorkOrder(1, 'mgr')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marca released con sello de readiness y registra la auditoría RELEASE_WO', async () => {
      repo.findOne.mockResolvedValue({ id: 1, model: 'M', status: 'pending', buildingId: 'b1', kit: null });
      await service.releaseWorkOrder(1, 'mgr');

      const saved = repo.save.mock.calls[0][0] as {
        status: string;
        releasedBy: string;
        releasedAt: Date;
        readinessSummary: unknown;
      };
      expect(saved.status).toBe('released');
      expect(saved.releasedBy).toBe('mgr');
      expect(saved.releasedAt).toBeInstanceOf(Date);
      expect(saved.readinessSummary).toMatchObject({ materials: 'green', quality: 'green' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RELEASE_WO', entity: 'Plan', entityId: '1' }),
      );
    });
  });

  describe('remove', () => {
    it('lanza 404 si el plan no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('protege planes con kit activo (no se borran)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, kit: { id: 9, status: 'open' } });
      await expect(service.remove(1)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getSchedulingIntelligence', () => {
    it('calcula carga por línea, backlog y riesgos de readiness con los umbrales correctos', async () => {
      // 1ª llamada: pendientes; 2ª: activos.
      repo.find
        .mockResolvedValueOnce([
          { line: 1, quantity: 10, priority: 'critical' },
          { line: 2, quantity: 5, priority: 'normal' },
        ])
        .mockResolvedValueOnce([
          { line: 10, quantity: 95 }, // overloaded
          { line: 20, quantity: 75 }, // warning
          { line: 30, quantity: 50 }, // optimal
        ]);
      capacityRepo.find.mockResolvedValue([
        { line: 10, buildingId: 'b1', dailyCapacityUnits: 100, efficiencyFactor: 100 },
        { line: 20, buildingId: 'b1', dailyCapacityUnits: 100, efficiencyFactor: 100 },
        { line: 30, buildingId: 'b1', dailyCapacityUnits: 100, efficiencyFactor: 100 },
        { line: 40, buildingId: 'b1', dailyCapacityUnits: 0, efficiencyFactor: 100 }, // sin capacidad
      ]);

      const res = await service.getSchedulingIntelligence();

      expect(res.backlog).toBe(2);
      expect(res.readinessRisks).toBe(1); // sólo un pendiente 'critical'

      const byLine = Object.fromEntries(res.lineLoad.map((l) => [l.line, l]));
      expect(byLine[10]).toMatchObject({ loadPercent: 95, status: 'overloaded', currentLoad: 95 });
      expect(byLine[20]).toMatchObject({ loadPercent: 75, status: 'warning' });
      expect(byLine[30]).toMatchObject({ loadPercent: 50, status: 'optimal' });
      // Capacidad 0 ⇒ loadPercent 0 sin dividir por cero.
      expect(byLine[40]).toMatchObject({ loadPercent: 0, status: 'optimal' });
    });
  });
});
