import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MesExecutionService } from './mes-execution.service';

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

describe('MesExecutionService - operator material request', () => {
  const execution = {
    id: 1,
    kitId: 22,
    workOrder: 'WO-100',
    model: 'AX-MODEL',
    line: 2,
  };
  const execRepo = { findOne: jest.fn().mockResolvedValue(execution) };
  const stepRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 33, stepId: 7, name: 'ICT' }),
  };
  const stepMatRepo = {
    find: jest.fn().mockResolvedValue([
      {
        partNumber: 'P1',
        unit: 'EA',
        availableQty: 0,
        lowStockThreshold: 1,
      },
      {
        partNumber: 'P2',
        unit: 'EA',
        availableQty: 10,
        lowStockThreshold: 1,
      },
    ]),
  };
  const materialRequests = {
    create: jest.fn().mockResolvedValue({
      id: 99,
      kitId: 22,
      status: 'pending',
      note: 'created note',
    }),
  };
  const signals = { emitToTenant: jest.fn() };
  const tenantCtx = { getTenantId: () => null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = (v: unknown): any => v;

  function makeService(): MesExecutionService {
    return new MesExecutionService(
      any(execRepo),
      any(stepRepo),
      any(stepMatRepo),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any({}),
      any(signals),
      any(materialRequests),
      any({}),
      any({}),
      any(tenantCtx),
    );
  }

  afterEach(() => {
    jest.clearAllMocks();
    execRepo.findOne.mockResolvedValue(execution);
    stepRepo.findOne.mockResolvedValue({ id: 33, stepId: 7, name: 'ICT' });
    stepMatRepo.find.mockResolvedValue([
      {
        partNumber: 'P1',
        unit: 'EA',
        availableQty: 0,
        lowStockThreshold: 1,
      },
      {
        partNumber: 'P2',
        unit: 'EA',
        availableQty: 10,
        lowStockThreshold: 1,
      },
    ]);
  });

  it('creates a real material request for the active execution kit and station', async () => {
    const result = await makeService().requestMaterial(
      1,
      any({ stepId: 7, partNumbers: ['P1'], operator: 'Ana' }),
      'supervisor@axos.test',
    );

    expect(materialRequests.create).toHaveBeenCalledWith(
      {
        kitId: 22,
        note: expect.stringContaining('P1 (0 EA disponible)'),
      },
      'Ana',
    );
    expect(materialRequests.create.mock.calls[0][0].note).toContain('WO-100');
    expect(materialRequests.create.mock.calls[0][0].note).toContain('ICT');
    expect(signals.emitToTenant).toHaveBeenCalledWith(
      'default',
      'mes:material-requested',
      expect.objectContaining({
        executionId: 1,
        stepId: 7,
        materialRequestId: 99,
        workOrder: 'WO-100',
        line: 2,
        requestedBy: 'Ana',
        parts: ['P1'],
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 99,
        kitId: 22,
        status: 'pending',
        workOrder: 'WO-100',
        line: 2,
        stepId: 7,
        parts: ['P1'],
      }),
    );
  });

  it('rejects material requests when the execution has no published kit', async () => {
    execRepo.findOne.mockResolvedValueOnce({ ...execution, kitId: null });

    await expect(
      makeService().requestMaterial(
        1,
        any({ stepId: 7, partNumbers: ['P1'] }),
        'ana@axos.test',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(materialRequests.create).not.toHaveBeenCalled();
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
