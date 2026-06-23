import { ForbiddenException } from '@nestjs/common';
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

  function makeService(p?: unknown): MesExecutionService {
    return new MesExecutionService(
      any(execRepo), any(stepRepo), any({}), any({}), any({}),
      any({}), any({}), any(assignRepo), any({}), any({}),
      any({}), any({}), any({}), any(signals), any({}),
      any({}), any({}), undefined, any(p),
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
