import { DataSource } from 'typeorm';
import { TestingService } from './testing.service';
import { TestRecord } from './entities/test-record.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('TestingService (integration)', () => {
  let dataSource: DataSource;
  let service: TestingService;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [TestRecord, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new TestingService(
      dataSource.getRepository(TestRecord),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('captures a test record with a TST folio', async () => {
    const r = await service.create({ serialNumber: 'SN-1', result: 'PASS' });
    expect(r.folio).toMatch(/^TST-\d{6}-000001$/);
    expect(r.result).toBe('PASS');
  });

  it('forces a failure code on FAIL and clears it on PASS', async () => {
    const fail = await service.create({ serialNumber: 'SN-2', result: 'FAIL' });
    expect(fail.failureCode).toBe('UNKNOWN');
    const pass = await service.create({ serialNumber: 'SN-3', result: 'PASS', failureCode: 'X' });
    expect(pass.failureCode).toBeNull();
  });

  it('computes yield, first-pass yield and a failure Pareto', async () => {
    // S1: FAIL (F-101) then PASS (retest). S2: PASS. S3: FAIL (F-101).
    await service.create({ serialNumber: 'S1', result: 'FAIL', failureCode: 'F-101', testedAt: '2026-06-07T10:00:00Z' });
    await service.create({ serialNumber: 'S1', result: 'PASS', testedAt: '2026-06-07T11:00:00Z' });
    await service.create({ serialNumber: 'S2', result: 'PASS', testedAt: '2026-06-07T10:00:00Z' });
    await service.create({ serialNumber: 'S3', result: 'FAIL', failureCode: 'F-101', testedAt: '2026-06-07T10:00:00Z' });

    const kpis = await service.kpis();
    expect(kpis.totalTests).toBe(4);
    expect(kpis.pass).toBe(2);
    expect(kpis.fail).toBe(2);
    expect(kpis.yieldPct).toBe(50); // 2/4
    expect(kpis.distinctSerials).toBe(3); // S1,S2,S3
    // First test per serial: S1=FAIL, S2=PASS, S3=FAIL → 1/3 ≈ 33.3
    expect(kpis.firstPassYieldPct).toBe(33.3);
    expect(kpis.pareto[0]).toEqual({ failureCode: 'F-101', count: 2, pct: 100 });
  });
});
