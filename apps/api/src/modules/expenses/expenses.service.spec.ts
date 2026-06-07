import { DataSource } from 'typeorm';
import { ExpensesService } from './expenses.service';
import { ExpenseReport } from './entities/expense-report.entity';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { DocumentSequence } from '../numbering/entities/document-sequence.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

describe('ExpensesService (integration)', () => {
  let dataSource: DataSource;
  let service: ExpensesService;
  const year = new Date().getFullYear();

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      synchronize: true,
      entities: [ExpenseReport, DocumentSequence],
    });
    await dataSource.initialize();

    const ctx = new TenantContextService();
    const numbering = new DocumentNumberingService(
      dataSource.getRepository(DocumentSequence),
      dataSource,
      ctx,
    );
    service = new ExpensesService(
      dataSource.getRepository(ExpenseReport),
      ctx,
      numbering,
    );
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates an expense with an EXP folio at DRAFT', async () => {
    const e = await service.create({ description: 'Vuelo', amount: 4500 });
    expect(e.folio).toBe(`EXP-${year}-00001`);
    expect(e.status).toBe('DRAFT');
  });

  it('drives the approval + reimbursement lifecycle', async () => {
    const e = await service.create({ description: 'Hotel', amount: 1200 });
    await service.transition(e.id, { status: 'SUBMITTED' });
    const approved = await service.transition(e.id, { status: 'APPROVED' });
    expect(approved.approvedAt).toBeTruthy();
    expect(approved.approverEmail).toBeTruthy();
    const reimbursed = await service.transition(e.id, { status: 'REIMBURSED' });
    expect(reimbursed.reimbursedAt).toBeTruthy();
  });

  it('rejects then allows resubmission', async () => {
    const e = await service.create({ description: 'Comida', amount: 300 });
    await service.transition(e.id, { status: 'SUBMITTED' });
    const rejected = await service.transition(e.id, { status: 'REJECTED', rejectReason: 'Falta recibo' });
    expect(rejected.rejectReason).toBe('Falta recibo');
    const back = await service.transition(e.id, { status: 'DRAFT' });
    expect(back.rejectReason).toBeNull();
    await expect(service.transition(e.id, { status: 'REIMBURSED' })).rejects.toThrow(
      /Cannot move an expense report/,
    );
  });

  it('computes expense KPIs', async () => {
    const a = await service.create({ description: 'A', amount: 1000 });
    await service.transition(a.id, { status: 'SUBMITTED' }); // pending approval
    const b = await service.create({ description: 'B', amount: 2000 });
    await service.transition(b.id, { status: 'SUBMITTED' });
    await service.transition(b.id, { status: 'APPROVED' });
    await service.transition(b.id, { status: 'REIMBURSED' }); // reimbursed 2000

    const kpis = await service.kpis();
    expect(kpis.pendingApproval).toBe(1);
    expect(kpis.reimbursedAmount).toBe(2000);
    expect(kpis.pendingAmount).toBe(1000); // submitted A
  });
});
