import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CharacteristicsService } from './characteristics.service';

/**
 * Unit del CharacteristicsService con repo/contexto/numbering simulados. El foco
 * es la VALIDACIÓN de límites de especificación (USL > nominal > LSL) al crear y
 * actualizar — el corazón del cimiento de datos para SPC.
 */
describe('CharacteristicsService', () => {
  let service: CharacteristicsService;
  let repo: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    softRemove: jest.Mock;
  };
  let tenantCtx: {
    getTenantId: jest.Mock;
    getOrganizationId: jest.Mock;
    getPlantId: jest.Mock;
    getUserEmail: jest.Mock;
  };
  let numbering: { allocate: jest.Mock };

  beforeEach(() => {
    repo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 'uuid-1', ...x })),
      findOne: jest.fn(),
      softRemove: jest.fn(async () => undefined),
    };
    tenantCtx = {
      getTenantId: jest.fn().mockReturnValue(null),
      getOrganizationId: jest.fn().mockReturnValue(null),
      getPlantId: jest.fn().mockReturnValue(null),
      getUserEmail: jest.fn().mockReturnValue('qa@axos.example'),
    };
    numbering = { allocate: jest.fn().mockResolvedValue('CTQ-00001') };
    service = new CharacteristicsService(
      repo as never,
      tenantCtx as never,
      numbering as never,
      undefined, // ledger opcional
    );
  });

  it('crea una característica VARIABLE válida (USL > nominal > LSL) y asigna folio CTQ', async () => {
    const c = await service.create({
      name: 'Altura del conector',
      modelId: 'model-1',
      type: 'VARIABLE',
      unit: 'mm',
      nominal: 10,
      usl: 10.2,
      lsl: 9.8,
    });
    expect(c.code).toBe('CTQ-00001');
    expect(c.unit).toBe('mm');
    expect(c.nominal).toBe(10);
    expect(c.usl).toBe(10.2);
    expect(c.lsl).toBe(9.8);
    expect(c.active).toBe(true);
    expect(c.isCritical).toBe(true);
    expect(repo.save).toHaveBeenCalled();
  });

  it('rechaza al crear cuando USL <= nominal', async () => {
    await expect(
      service.create({ name: 'X', type: 'VARIABLE', nominal: 10, usl: 9, lsl: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rechaza al crear cuando nominal <= LSL', async () => {
    await expect(
      service.create({ name: 'X', type: 'VARIABLE', nominal: 10, usl: 20, lsl: 11 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza nombre vacío', async () => {
    await expect(service.create({ name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('para ATRIBUTO no exige ventana numérica y limpia la unidad', async () => {
    const c = await service.create({
      name: 'Presencia de etiqueta',
      type: 'ATTRIBUTE',
      unit: 'mm', // debe ignorarse para atributos
    });
    expect(c.type).toBe('ATTRIBUTE');
    expect(c.unit).toBeNull();
  });

  it('update revalida la ventana con los valores combinados y rechaza si rompe el orden', async () => {
    repo.findOne.mockResolvedValue({
      id: 'uuid-1',
      type: 'VARIABLE',
      nominal: 10,
      usl: 10.2,
      lsl: 9.8,
    });
    // Bajar el USL por debajo del nominal existente debe fallar.
    await expect(
      service.update('uuid-1', { usl: 9 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getOne lanza 404 cuando no existe', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.getOne('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
