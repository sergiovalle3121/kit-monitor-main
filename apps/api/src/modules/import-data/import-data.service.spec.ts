import { ImportDataService } from './import-data.service';

describe('ImportDataService', () => {
  const mapping = {
    modelNumber: 'model',
    name: 'name',
    customer: 'customer',
    revision: 'rev',
  };

  function makeService() {
    const productModels = {
      findByNumber: jest.fn(),
      create: jest.fn(async (dto) => ({ id: 'pm-new', ...dto })),
      update: jest.fn(async (id, dto) => ({ id, ...dto })),
    };
    const tenantCtx = {
      getUserEmail: jest.fn(() => 'importer@axos.local'),
      getPlantId: jest.fn(() => 'PLANT-1'),
    };
    const feed = { fetchRows: jest.fn() };
    const ledger = { recordEvent: jest.fn(async () => ({ id: 'ledger-1' })) };

    const service = new ImportDataService(
      {} as any,
      {} as any,
      {} as any,
      productModels as any,
      tenantCtx as any,
      feed as any,
      ledger as any,
    );

    return { service, productModels, ledger };
  }

  it('commits product model imports through ProductModelsService', async () => {
    const { service, productModels, ledger } = makeService();
    productModels.findByNumber.mockImplementation(async (modelNumber: string) =>
      modelNumber === 'ASM-200' ? { id: 'pm-existing' } : null,
    );

    const report = await service.commit({
      source: 'CSV',
      target: 'MODEL',
      mapping,
      rows: [
        { model: 'ASM-100', name: 'Controller board', customer: 'ACME', rev: 'A' },
        { model: 'ASM-200', name: 'Power board', customer: 'Globex', rev: 'B' },
      ],
    });

    expect(productModels.create).toHaveBeenCalledWith(
      expect.objectContaining({
        modelNumber: 'ASM-100',
        name: 'Controller board',
        customer: 'ACME',
        revision: 'A',
      }),
    );
    expect(productModels.update).toHaveBeenCalledWith(
      'pm-existing',
      expect.objectContaining({
        name: 'Power board',
        customer: 'Globex',
        revision: 'B',
      }),
    );
    expect(report.result).toMatchObject({ created: 1, updated: 1, skipped: 0 });
    expect(ledger.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_COMMITTED',
        referenceType: 'IMPORT',
        metadata: expect.objectContaining({
          target: 'MODEL',
          source: 'CSV',
          created: 1,
          updated: 1,
        }),
      }),
    );
  });
});
