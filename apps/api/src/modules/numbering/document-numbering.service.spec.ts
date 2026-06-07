import { DataSource } from 'typeorm';
import { DocumentNumberingService } from './document-numbering.service';
import { DocumentSequence } from './entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

/**
 * Critical-flow test for the folio engine against a real (in-memory) datasource.
 * Proves allocation consumes & increments, blocks are contiguous, unknown types
 * are lazily provisioned from defaults, and preview never consumes a number.
 */
describe('DocumentNumberingService (integration)', () => {
  let dataSource: DataSource;
  let service: DocumentNumberingService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [DocumentSequence],
    });
    await dataSource.initialize();

    // Real TenantContextService: outside .run() the scope is null (global),
    // which is exactly the dev/unscoped case we want to exercise.
    const ctx = new TenantContextService();
    service = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('lazily provisions an unknown type and formats the first folio', async () => {
    const folio = await service.allocate('WORK_ORDER');
    expect(folio).toBe(`WO-${year}-000001`);

    const seq = await service.getByType('WORK_ORDER');
    expect(seq.docType).toBe('WORK_ORDER');
    expect(seq.nextValue).toBe(2);
    expect(seq.totalIssued).toBe(1);
  });

  it('increments monotonically across allocations', async () => {
    expect(await service.allocate('PURCHASE_ORDER')).toBe(`PO-${year}-000001`);
    expect(await service.allocate('PURCHASE_ORDER')).toBe(`PO-${year}-000002`);
    expect(await service.allocate('PURCHASE_ORDER')).toBe(`PO-${year}-000003`);
  });

  it('allocates a contiguous block', async () => {
    const block = await service.allocateBlock('NCR', 3);
    expect(block).toEqual([
      `NCR-${year}-00001`,
      `NCR-${year}-00002`,
      `NCR-${year}-00003`,
    ]);
    // Next single allocation continues after the block.
    expect(await service.allocate('NCR')).toBe(`NCR-${year}-00004`);
  });

  it('preview does not consume a number', async () => {
    const p1 = await service.preview('SALES_ORDER');
    expect(p1.next).toBe(`SO-${year}-000001`);
    expect(p1.configured).toBe(false);

    const p2 = await service.preview('SALES_ORDER');
    expect(p2.next).toBe(`SO-${year}-000001`); // unchanged — nothing consumed

    // First real allocation still gets 000001.
    expect(await service.allocate('SALES_ORDER')).toBe(`SO-${year}-000001`);
  });

  it('reports KPIs from issued counters', async () => {
    await service.allocate('WORK_ORDER');
    await service.allocate('WORK_ORDER');
    await service.allocate('PURCHASE_ORDER');

    const kpis = await service.kpis();
    expect(kpis.totalTypes).toBe(2);
    expect(kpis.totalIssued).toBe(3);
    expect(kpis.mostActive?.docType).toBe('WORK_ORDER');
    expect(kpis.mostActive?.totalIssued).toBe(2);
  });

  it('refuses to move a counter backwards (folio reuse guard)', async () => {
    await service.allocate('INVOICE'); // nextValue → 2
    const seq = await service.getByType('INVOICE');
    await expect(service.update(seq.id, { nextValue: 1 })).rejects.toThrow(
      /no puede ser menor/,
    );
  });
});
