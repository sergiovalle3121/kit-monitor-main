import { ProductionPlanReadinessService } from './production-plan-readiness.service';
import { BomStatus } from '../bom/entities/bom-header.entity';

describe('ProductionPlanReadinessService', () => {
  let service: ProductionPlanReadinessService;
  let bomHeaders: { find: jest.Mock };
  let positions: { find: jest.Mock };

  beforeEach(() => {
    bomHeaders = { find: jest.fn() };
    positions = { find: jest.fn() };
    service = new ProductionPlanReadinessService(
      bomHeaders as never,
      positions as never,
    );
  });

  it('marks publishable when the active BOM is fully covered by available stock', async () => {
    bomHeaders.find.mockResolvedValue([
      activeBom({
        components: [
          { componentNumber: 'P-1', quantity: 2, usageFactor: 1, unit: 'EA' },
          { componentNumber: 'P-2', quantity: 0.5, usageFactor: 1, unit: 'M' },
        ],
      }),
    ]);
    positions.find.mockResolvedValue([
      { partNumber: 'P-1', onHand: 25, allocated: 5, holdStatus: 'available' },
      { partNumber: 'P-2', onHand: 6, allocated: 0, holdStatus: 'available' },
    ]);

    const result = await service.evaluatePublish({
      model: 'AX-1000',
      revision: 'A',
      line: 'SMT-1',
      quantityPlanned: 10,
    });

    expect(result.publishable).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.summary.materials).toBe('green');
    expect(result.demand).toEqual([
      expect.objectContaining({ partNumber: 'P-1', quantityRequired: 20 }),
      expect.objectContaining({ partNumber: 'P-2', quantityRequired: 5 }),
    ]);
  });

  it('blocks publish when there is no active BOM', async () => {
    bomHeaders.find.mockResolvedValue([]);

    const result = await service.evaluatePublish({
      model: 'AX-404',
      line: 'SMT-1',
      quantityPlanned: 10,
    });

    expect(result.publishable).toBe(false);
    expect(result.bomHeaderId).toBeNull();
    expect(result.blockers[0]).toMatch(/Sin BOM activo/);
    expect(positions.find).not.toHaveBeenCalled();
  });

  it('blocks publish and reports shortage detail when available stock is short', async () => {
    bomHeaders.find.mockResolvedValue([
      activeBom({
        components: [
          { componentNumber: 'P-1', quantity: 3, usageFactor: 1, unit: 'EA' },
        ],
      }),
    ]);
    positions.find.mockResolvedValue([
      { partNumber: 'P-1', onHand: 10, allocated: 4, holdStatus: 'available' },
    ]);

    const result = await service.evaluatePublish({
      model: 'AX-1000',
      revision: 'A',
      line: 'SMT-1',
      quantityPlanned: 4,
    });

    expect(result.publishable).toBe(false);
    expect(result.summary.materials).toBe('red');
    expect(result.blockers).toEqual([
      'Material readiness incompleto: 1 de 1 materiales tienen faltante.',
      'P-1: faltan 6 EA (req 12, disp 6)',
    ]);
  });

  it('prefers the requested revision when multiple active BOMs exist', async () => {
    bomHeaders.find.mockResolvedValue([
      activeBom({
        id: 1,
        revision: 'A',
        components: [{ componentNumber: 'OLD', quantity: 1 }],
      }),
      activeBom({
        id: 2,
        revision: 'B',
        components: [{ componentNumber: 'NEW', quantity: 1 }],
      }),
    ]);
    positions.find.mockResolvedValue([
      { partNumber: 'NEW', onHand: 5, allocated: 0, holdStatus: 'available' },
    ]);

    const result = await service.evaluatePublish({
      model: 'AX-1000',
      revision: 'B',
      line: 'SMT-1',
      quantityPlanned: 2,
    });

    expect(result.bomHeaderId).toBe(2);
    expect(result.demand).toEqual([
      expect.objectContaining({ partNumber: 'NEW', quantityRequired: 2 }),
    ]);
  });
});

function activeBom(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    model: 'AX-1000',
    revision: 'A',
    status: BomStatus.ACTIVE,
    baseQuantity: 1,
    components: [],
    ...overrides,
  };
}
