import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  MesExecutionService,
  normalizeMaterialTraceInput,
} from './mes-execution.service';

describe('MesExecutionService - material trace input', () => {
  it('normalizes optional lot/reel tokens for genealogy capture', () => {
    expect(
      normalizeMaterialTraceInput({ lot: ' LOT-A ', reel: ' REEL-9 ' }),
    ).toEqual({ lot: 'LOT-A', reel: 'REEL-9' });
    expect(normalizeMaterialTraceInput({ lot: ' ', reel: '' })).toEqual({
      lot: undefined,
      reel: undefined,
    });
  });
});

describe('MesExecutionService - genealogy enrichment on confirm', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = (v: unknown): any => v;

  it('passes scanned lot/reel and source event id to genealogy links', async () => {
    const execution = {
      id: 1,
      planId: null,
      workOrder: 'WO-GEN',
      model: 'AX-GEN',
      line: 3,
      quantity: 10,
      status: 'running',
      startedAt: null,
    };
    const step = {
      id: 33,
      executionId: 1,
      stepId: 7,
      sequence: 10,
      name: 'ICT',
      status: 'pending',
      unitsTarget: 10,
      unitsCompleted: 0,
      scrapQty: 0,
      segregatedQty: 0,
      startedAt: null,
      completedAt: null,
    };
    const material = {
      id: 44,
      executionStepId: 33,
      partNumber: 'P1',
      qtyPerUnit: 2,
      plannedQty: 20,
      consumedQty: 0,
      scrapQty: 0,
      availableQty: 20,
      lowStockThreshold: 0,
      kitMaterialId: null,
    };
    const em = {
      findOne: jest.fn(async (entity: { name?: string }) => {
        if (entity.name === 'ExecutionEvent') return null;
        return null;
      }),
      find: jest.fn(async (entity: { name?: string }) => {
        if (entity.name === 'ExecutionStep') return [step];
        if (entity.name === 'ExecutionStepMaterial') return [material];
        return [];
      }),
      create: jest.fn((_entity: unknown, data: Record<string, unknown>) => data),
      save: jest.fn(async (...args: unknown[]) => {
        const entity = (args.length === 2 ? args[1] : args[0]) as Record<
          string,
          unknown
        >;
        if (entity.clientRequestId) return { ...entity, id: 99 };
        return entity;
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const execRepo = { findOne: jest.fn().mockResolvedValue(execution) };
    const downtimeRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (x: unknown) => x),
    };
    const ledger = { recordEvent: jest.fn().mockResolvedValue({}) };
    const signals = { emitToTenant: jest.fn() };
    const inventory = { recordTransaction: jest.fn().mockResolvedValue({}) };
    const genealogy = { recordLink: jest.fn().mockResolvedValue({}) };
    const dataSource = {
      transaction: jest.fn((fn: (manager: typeof em) => unknown) => fn(em)),
    };
    const tenantCtx = { getTenantId: () => null };
    const service = new MesExecutionService(
      any(execRepo),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any(downtimeRepo),
      any({}),
      any({}),
      any({}),
      any({}),
      any(inventory),
      any(ledger),
      any(signals),
      any({}),
      any({}),
      any(dataSource),
      any(tenantCtx),
      undefined,
      any(genealogy),
    );
    jest.spyOn(service, 'getBoard').mockResolvedValue(any({ ok: true }));

    await service.confirmAdvance(
      1,
      7,
      any({
        quantity: 1,
        scrap: 0,
        serial: ' SN-77 ',
        lot: ' LOT-A ',
        reel: ' REEL-9 ',
        clientRequestId: 'req-genealogy',
      }),
      'op@axos.test',
    );

    expect(genealogy.recordLink).toHaveBeenCalledWith(
      expect.objectContaining({
        builtSerial: 'SN-77',
        part: 'P1',
        lot: 'LOT-A',
        reel: 'REEL-9',
        qty: 2,
        sourceEventId: '99',
        idempotencyKey: 'mes-evt:99:P1',
      }),
    );
    expect(ledger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MES_STEP_ADVANCED',
        context: expect.objectContaining({
          serial: ' SN-77 ',
          lot: 'LOT-A',
          reel: 'REEL-9',
        }),
      }),
    );
  });
});

/**
 * Gate operador↔estación en modo BLOQUEO. El gate es additivo y está OFF por
 * defecto (sólo advertencia en la UI); aquí verificamos que el flag
 * ENFORCE_CERT_GATE lo endurece sin cambiar el flujo cuando está apagado.
 */
describe('MesExecutionService — operator↔station gate (ENFORCE_CERT_GATE)', () => {
  const execRepo = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
  const stepRepo = { findOne: jest.fn().mockResolvedValue({ stationType: 'SMT-1' }) };
  const assignRepo = {
    update: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ ...x, id: 10 })),
  };
  const signals = { emitToTenant: jest.fn() };
  const people = { certificationCheck: jest.fn() };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = (v: unknown): any => v;

  const tenantCtx = { getTenantId: () => null };

  function makeService(p?: unknown): MesExecutionService {
    return new MesExecutionService(
      any(execRepo), any(stepRepo), any({}), any({}), any({}),
      any({}), any({}), any(assignRepo), any({}), any({}),
      any({}), any({}), any({}), any(signals), any({}),
      // ...tenantCtx, testFlow(19), genealogy(20), people(21)
      any({}), any({}), any(tenantCtx), undefined, undefined, any(p),
    );
  }

  const dto = any({ stepId: 5, operatorName: 'Ana', operatorId: undefined });

  afterEach(() => {
    jest.clearAllMocks();
    stepRepo.findOne.mockResolvedValue({ stationType: 'SMT-1' });
    delete process.env.ENFORCE_CERT_GATE;
  });

  it('does NOT check certification when the flag is off (pure warning mode)', async () => {
    await makeService(people).assignStation(1, dto, 'sup');
    expect(people.certificationCheck).not.toHaveBeenCalled();
    expect(assignRepo.save).toHaveBeenCalled();
  });

  it('blocks an uncertified operator when ENFORCE_CERT_GATE=true', async () => {
    process.env.ENFORCE_CERT_GATE = 'true';
    people.certificationCheck.mockResolvedValue({ certified: false, status: 'none' });
    await expect(makeService(people).assignStation(1, dto, 'sup')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(assignRepo.save).not.toHaveBeenCalled();
  });

  it('allows a certified operator when the flag is on', async () => {
    process.env.ENFORCE_CERT_GATE = 'true';
    people.certificationCheck.mockResolvedValue({ certified: true, status: 'valid' });
    await makeService(people).assignStation(1, dto, 'sup');
    expect(assignRepo.save).toHaveBeenCalled();
  });

  it('fails open when the station cannot be resolved (never breaks the MES flow)', async () => {
    process.env.ENFORCE_CERT_GATE = 'true';
    stepRepo.findOne.mockResolvedValueOnce({ stationType: null });
    await makeService(people).assignStation(1, dto, 'sup');
    expect(people.certificationCheck).not.toHaveBeenCalled();
    expect(assignRepo.save).toHaveBeenCalled();
  });
});

describe('MesExecutionService - Andon supervisor actions', () => {
  const createdAt = new Date('2026-06-29T09:00:00Z');
  const execution = {
    id: 8,
    workOrder: 'WO-ANDON',
    model: 'AX-CTRL',
    line: 4,
  };
  const baseAndon = {
    id: 77,
    tenant_id: null,
    executionId: 8,
    executionStepId: 12,
    stepName: 'AOI',
    type: 'maintenance',
    status: 'open',
    note: 'Sensor blocked',
    raisedBy: 'operator@axos.test',
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt,
  };
  const execRepo = {
    findOne: jest.fn().mockResolvedValue(execution),
    find: jest.fn().mockResolvedValue([execution]),
  };
  const andonRepo = {
    find: jest.fn().mockResolvedValue([baseAndon]),
    findOne: jest.fn().mockResolvedValue({ ...baseAndon }),
    save: jest.fn(async (x: Record<string, unknown>) => x),
  };
  const downtimeRepo = {
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn(async (x: Record<string, unknown>) => x),
  };
  const ledger = { recordEvent: jest.fn().mockResolvedValue({}) };
  const signals = { emitToTenant: jest.fn() };
  const tenantCtx = { getTenantId: () => null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = (v: unknown): any => v;

  function makeService(): MesExecutionService {
    return new MesExecutionService(
      any(execRepo),
      any({}),
      any({}),
      any({}),
      any({}),
      any(andonRepo),
      any(downtimeRepo),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any(ledger),
      any(signals),
      any({}),
      any({}),
      any({}),
      any(tenantCtx),
    );
  }

  afterEach(() => {
    jest.clearAllMocks();
    execRepo.findOne.mockResolvedValue(execution);
    execRepo.find.mockResolvedValue([execution]);
    andonRepo.find.mockResolvedValue([baseAndon]);
    andonRepo.findOne.mockResolvedValue({ ...baseAndon });
    downtimeRepo.find.mockResolvedValue([]);
  });

  it('lists active andons with WO and line context for the live board', async () => {
    const result = await makeService().listAndons();

    expect(andonRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 77,
        executionId: 8,
        workOrder: 'WO-ANDON',
        model: 'AX-CTRL',
        line: 4,
        status: 'open',
      }),
    ]);
  });

  it('acknowledges an open andon and records ledger evidence', async () => {
    const result = await makeService().updateAndon(
      77,
      'ack',
      'supervisor@axos.test',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 77,
        status: 'ack',
        acknowledgedBy: 'supervisor@axos.test',
        workOrder: 'WO-ANDON',
      }),
    );
    expect(ledger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MES_ANDON_ACKNOWLEDGED',
        referenceType: 'ANDON',
        referenceId: '77',
        actorName: 'supervisor@axos.test',
        metadata: expect.objectContaining({
          beforeStatus: 'open',
          afterStatus: 'ack',
        }),
      }),
    );
    expect(signals.emitToTenant).toHaveBeenCalledWith(
      'default',
      'mes:andon',
      expect.objectContaining({ andonId: 77, status: 'ack' }),
    );
  });

  it('resolves a stop andon and closes its downtime clock', async () => {
    andonRepo.findOne.mockResolvedValueOnce({
      ...baseAndon,
      type: 'stop',
      status: 'ack',
    });

    const result = await makeService().updateAndon(
      77,
      'resolve',
      'lead@axos.test',
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'resolved',
        resolvedBy: 'lead@axos.test',
      }),
    );
    expect(downtimeRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({ andonId: 77 }),
    });
    expect(ledger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MES_ANDON_RESOLVED',
        metadata: expect.objectContaining({
          beforeStatus: 'ack',
          afterStatus: 'resolved',
        }),
      }),
    );
  });
});

describe('MesExecutionService — line-stop downtime reason', () => {
  const execution = {
    id: 1,
    workOrder: 'WO-100',
    model: 'AX-MODEL',
    line: 2,
  };
  const execRepo = { findOne: jest.fn().mockResolvedValue(execution) };
  const stepRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 33, stepId: 7, name: 'ICT' }),
  };
  const andonRepo = {
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({
      ...x,
      id: 44,
      createdAt: new Date('2026-06-29T08:00:00Z'),
    })),
  };
  const downtimeRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((x: unknown) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({
      ...x,
      id: 55,
      createdAt: new Date('2026-06-29T08:00:01Z'),
    })),
  };
  const ledger = { recordEvent: jest.fn().mockResolvedValue({}) };
  const signals = { emitToTenant: jest.fn() };
  const tenantCtx = { getTenantId: () => null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = (v: unknown): any => v;

  function makeService(): MesExecutionService {
    return new MesExecutionService(
      any(execRepo),
      any(stepRepo),
      any({}),
      any({}),
      any({}),
      any(andonRepo),
      any(downtimeRepo),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any(ledger),
      any(signals),
      any({}),
      any({}),
      any({}),
      any(tenantCtx),
    );
  }

  afterEach(() => {
    jest.clearAllMocks();
    execRepo.findOne.mockResolvedValue(execution);
    stepRepo.findOne.mockResolvedValue({ id: 33, stepId: 7, name: 'ICT' });
    downtimeRepo.findOne.mockResolvedValue(null);
  });

  it('rejects a line-stop Andon without a downtime reason code', async () => {
    await expect(
      makeService().raiseAndon(
        1,
        any({ type: 'stop', stepId: 7 }),
        'ana@axos.test',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(andonRepo.save).not.toHaveBeenCalled();
    expect(downtimeRepo.save).not.toHaveBeenCalled();
  });

  it('opens downtime with the selected reason and writes ledger evidence', async () => {
    const result = await makeService().raiseAndon(
      1,
      any({
        type: 'stop',
        stepId: 7,
        downtimeReason: 'equipment_failure',
        note: 'Fixture bloqueado en ICT',
      }),
      'ana@axos.test',
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: 44,
        type: 'stop',
        status: 'open',
        note: 'Fixture bloqueado en ICT',
      }),
    );
    expect(downtimeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: 1,
        executionStepId: 33,
        reason: 'equipment_failure',
        triggeredBy: 'ana@axos.test',
        andonId: 44,
        notes: 'Fixture bloqueado en ICT',
      }),
    );
    expect(ledger.recordEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'MES_DOWNTIME_OPENED',
        referenceType: 'DOWNTIME',
        referenceId: '55',
        actorName: 'ana@axos.test',
        metadata: expect.objectContaining({
          reasonCode: 'equipment_failure',
          andonId: 44,
          note: 'Fixture bloqueado en ICT',
        }),
      }),
    );
    expect(ledger.recordEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: 'MES_ANDON_RAISED',
        referenceType: 'ANDON',
        referenceId: '44',
        metadata: expect.objectContaining({
          type: 'stop',
          downtimeReason: 'equipment_failure',
        }),
      }),
    );
  });
});
