import { DataSource } from 'typeorm';
import { InboundService } from './inbound.service';
import { Receipt } from './entities/receipt.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('InboundService (integration)', () => {
  let dataSource: DataSource;
  let service: InboundService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [Receipt, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new InboundService(
      dataSource.getRepository(Receipt),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('captures a receipt with an RCV folio and RECEIVED status', async () => {
    const r = await service.create({ partNumber: 'RES-0402-10K', quantity: 5000, lotNumber: 'L1' });
    expect(r.folio).toBe(`RCV-${year}-000001`);
    expect(r.status).toBe('RECEIVED');
    expect(r.iqcResult).toBeNull();
  });

  it('passes IQC: RECEIVED → INSPECTING → RELEASED stamps PASS + release date', async () => {
    const r = await service.create({ partNumber: 'P1' });
    await service.transition(r.id, { status: 'INSPECTING' });
    const released = await service.transition(r.id, { status: 'RELEASED' });
    expect(released.iqcResult).toBe('PASS');
    expect(released.releasedAt).toBeTruthy();
  });

  it('fails IQC into quarantine then rejects with a code', async () => {
    const r = await service.create({ partNumber: 'P2' });
    await service.transition(r.id, { status: 'INSPECTING' });
    const q = await service.transition(r.id, { status: 'QUARANTINE', rejectCode: 'DMG' });
    expect(q.iqcResult).toBe('FAIL');
    const rej = await service.transition(r.id, { status: 'REJECTED' });
    expect(rej.status).toBe('REJECTED');
    expect(rej.rejectCode).toBe('DMG');
  });

  it('rejects an illegal transition', async () => {
    const r = await service.create({ partNumber: 'P3' });
    await expect(
      service.transition(r.id, { status: 'QUARANTINE' }),
    ).rejects.toThrow(/Cannot move a receipt/);
  });

  it('computes inbound KPIs (reject rate, pending IQC)', async () => {
    const a = await service.create({ partNumber: 'A' });
    await service.transition(a.id, { status: 'RELEASED' }); // released
    const b = await service.create({ partNumber: 'B' });
    await service.transition(b.id, { status: 'INSPECTING' });
    await service.transition(b.id, { status: 'QUARANTINE' });
    await service.transition(b.id, { status: 'REJECTED' }); // rejected
    await service.create({ partNumber: 'C' }); // pending (RECEIVED)

    const kpis = await service.kpis();
    expect(kpis.total).toBe(3);
    expect(kpis.released).toBe(1);
    expect(kpis.rejected).toBe(1);
    expect(kpis.pendingIqc).toBe(1);
    expect(kpis.rejectRatePct).toBe(50); // 1 rejected of 2 dispositioned
  });
});
