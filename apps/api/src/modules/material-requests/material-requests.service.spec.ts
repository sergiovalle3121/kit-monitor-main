import { MaterialRequestsService } from './material-requests.service';
import { MaterialRequest } from './entities/material-request.entity';

function makeKit() {
  return {
    id: 7,
    plan: {
      status: 'published',
      workOrder: 'WO-700',
      model: 'MODEL-X',
      line: 2,
      quantity: 120,
    },
  };
}

function makeService(rows: MaterialRequest[] = []) {
  const repo = {
    find: jest.fn(async () => rows),
    findOne: jest.fn(async () => null),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      id: 1,
      createdAt: new Date('2026-06-29T12:00:00.000Z'),
      ...value,
    })),
  };
  const kitRepo = {
    findOne: jest.fn(async () => makeKit()),
  };
  const signals = { emitToTenant: jest.fn() };
  const eventLedger = { recordEvent: jest.fn(async () => undefined) };
  const inventory = { recordTransaction: jest.fn(async () => ({ id: 1 })) };
  const service = new MaterialRequestsService(
    repo as any,
    kitRepo as any,
    signals as any,
    eventLedger as any,
    inventory as any,
  );

  return { service, repo, kitRepo, signals, eventLedger, inventory };
}

describe('MaterialRequestsService', () => {
  it('stores structured operator context and emits it to downstream boards', async () => {
    const { service, repo, signals, eventLedger } = makeService();

    const created = await service.create(
      {
        kitId: 7,
        note: 'Urgente para ICT',
        workOrder: ' WO-700 ',
        line: ' L2 ',
        station: ' ICT-10 ',
        partNumber: ' PN-100 ',
        requestedQty: 24,
        unit: ' EA ',
      },
      'ana@axos.test',
    );

    expect(created).toMatchObject({
      kitId: 7,
      requestedBy: 'ana@axos.test',
      workOrder: 'WO-700',
      line: 'L2',
      station: 'ICT-10',
      partNumber: 'PN-100',
      requestedQty: 24,
      unit: 'EA',
    });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workOrder: 'WO-700',
        line: 'L2',
        station: 'ICT-10',
        partNumber: 'PN-100',
        requestedQty: 24,
        unit: 'EA',
      }),
    );
    expect(signals.emitToTenant).toHaveBeenCalledWith(
      'default',
      'materials:request-created',
      expect.objectContaining({
        workOrder: 'WO-700',
        line: 'L2',
        station: 'ICT-10',
        partNumber: 'PN-100',
        requestedQty: 24,
        unit: 'EA',
      }),
    );
    expect(eventLedger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MATERIAL_REQUESTED',
        metadata: expect.objectContaining({
          kitId: 7,
          status: 'pending',
          station: 'ICT-10',
          partNumber: 'PN-100',
          requestedQty: 24,
          unit: 'EA',
        }),
      }),
    );
  });

  it('serializes request context with plan fallback for legacy callers', async () => {
    const row = {
      id: 2,
      kitId: 7,
      requestedBy: 'luis@axos.test',
      status: 'pending',
      note: null,
      workOrder: null,
      line: null,
      station: 'SMT-20',
      partNumber: 'PN-200',
      requestedQty: 8,
      unit: 'EA',
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: new Date('2026-06-29T12:01:00.000Z'),
      kit: makeKit(),
    } as MaterialRequest;
    const { service } = makeService([row]);

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({
        id: 2,
        workOrder: 'WO-700',
        line: '2',
        station: 'SMT-20',
        partNumber: 'PN-200',
        requestedQty: 8,
        unit: 'EA',
        model: 'MODEL-X',
        quantity: 120,
      }),
    ]);
  });

  describe('fulfill — closes the inventory loop (supply deposits into LINE-<n>)', () => {
    function authorizedRequest(overrides: Record<string, unknown> = {}): any {
      return {
        id: 5,
        kitId: 7,
        status: 'authorized',
        partNumber: 'PN-100',
        requestedQty: 24,
        line: 'L2',
        workOrder: 'WO-700',
        ...overrides,
      };
    }

    it('deposits supplied material into the plan-line warehouse via recordTransaction (ISSUE → LINE-<line>)', async () => {
      const { service, repo, inventory } = makeService();
      repo.findOne.mockResolvedValue(authorizedRequest());

      await service.fulfill(5, {}, 'wh@axos.test');

      // Uses the PLAN line (2, what the execution consumes from), not the free
      // text request.line ('L2'); deposits at the shared line-level location.
      expect(inventory.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ISSUE',
          partNumber: 'PN-100',
          quantity: 24,
          toWarehouseId: 'LINE-2',
          toLocation: 'LINE',
          referenceType: 'MATERIAL_REQUEST_FULFILL',
          referenceId: '5',
        }),
      );
      // And the request is marked fulfilled (status flipped + saved).
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fulfilled' }),
      );
    });

    it('skips the deposit (no phantom LINE warehouse) when neither plan nor request has a line', async () => {
      const { service, repo, kitRepo, inventory } = makeService();
      kitRepo.findOne.mockResolvedValue({
        id: 7,
        plan: { status: 'published', workOrder: 'WO-700', line: null },
      } as never);
      repo.findOne.mockResolvedValue(authorizedRequest({ line: null }));

      await service.fulfill(5, {}, 'wh@axos.test');

      expect(inventory.recordTransaction).not.toHaveBeenCalled();
      // Still completes the request — the deposit is skipped, not the fulfill.
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'fulfilled' }),
      );
    });

    it('propagates inventory failures and does NOT mark the request fulfilled', async () => {
      const { service, repo, inventory } = makeService();
      repo.findOne.mockResolvedValue(authorizedRequest());
      inventory.recordTransaction.mockRejectedValue(
        new Error('Insufficient stock in LINE-2 for PN-100'),
      );

      await expect(service.fulfill(5, {}, 'wh@axos.test')).rejects.toThrow(
        'Insufficient stock',
      );
      // Status was never flipped — we don't mark fulfilled what we couldn't supply.
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
