import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ExpenseReport } from './entities/expense-report.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateExpenseDto, TransitionExpenseDto } from './dto/expenses.dto';
import { assertTransition, ExpenseStatus } from './expense-state';

export interface ExpensesKpis {
  total: number;
  pendingApproval: number;
  approvedUnpaid: number;
  reimbursedAmount: number;
  pendingAmount: number;
  avgAmount: number;
  currency: string;
  byStatus: Record<ExpenseStatus, number>;
}

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    @InjectRepository(ExpenseReport)
    private readonly repo: Repository<ExpenseReport>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<ExpenseReport>,
    alias: string,
  ): SelectQueryBuilder<ExpenseReport> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateExpenseDto): Promise<ExpenseReport> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('EXPENSE');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      employeeName: dto.employeeName ?? this.tenantCtx.getUserEmail(),
      description: dto.description,
      category: dto.category ?? 'OTHER',
      amount: dto.amount,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      status: 'DRAFT',
      programId: dto.programId ?? null,
      expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('EXPENSE_CREATED', saved, { after: saved });
    return saved;
  }

  async list(filters: { status?: string; employeeName?: string } = {}): Promise<
    ExpenseReport[]
  > {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.created_at', 'DESC');
    this.applyScope(qb, 'e');
    if (filters.status) qb.andWhere('e.status = :s', { s: filters.status });
    if (filters.employeeName)
      qb.andWhere('e.employee_name = :en', { en: filters.employeeName });
    return qb.getMany();
  }

  async getOne(id: string): Promise<ExpenseReport> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Reporte de gasto no encontrado.');
    return found;
  }

  async transition(
    id: string,
    dto: TransitionExpenseDto,
  ): Promise<ExpenseReport> {
    const e = await this.getOne(id);
    const from = e.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    const now = new Date();
    e.status = dto.status;
    if (dto.status === 'APPROVED') {
      e.approverEmail = this.tenantCtx.getUserEmail();
      e.approvedAt = now;
    }
    if (dto.status === 'REJECTED') {
      e.approverEmail = this.tenantCtx.getUserEmail();
      e.rejectReason = dto.rejectReason ?? null;
    }
    if (dto.status === 'REIMBURSED') e.reimbursedAt = now;
    if (dto.status === 'DRAFT') e.rejectReason = null; // resubmission clears reason

    const saved = await this.repo.save(e);
    await this.recordLedger('EXPENSE_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<ExpensesKpis> {
    const all = await this.list();
    const byStatus = {
      DRAFT: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      REJECTED: 0,
      REIMBURSED: 0,
      CANCELLED: 0,
    } as Record<ExpenseStatus, number>;

    let reimbursedAmount = 0;
    let pendingAmount = 0;
    let amountSum = 0;
    let amountCount = 0;
    let currency = 'USD';

    for (const e of all) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      if (e.currency) currency = e.currency;
      const amt = Number(e.amount ?? 0);
      if (e.status !== 'CANCELLED' && e.status !== 'REJECTED') {
        amountSum += amt;
        amountCount += 1;
      }
      if (e.status === 'REIMBURSED') reimbursedAmount += amt;
      if (e.status === 'SUBMITTED' || e.status === 'APPROVED') pendingAmount += amt;
    }

    return {
      total: all.length,
      pendingApproval: byStatus.SUBMITTED,
      approvedUnpaid: byStatus.APPROVED,
      reimbursedAmount: Math.round(reimbursedAmount),
      pendingAmount: Math.round(pendingAmount),
      avgAmount: amountCount > 0 ? Math.round(amountSum / amountCount) : 0,
      currency,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    e: ExpenseReport,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'EXPENSE',
        referenceId: e.id,
        program: e.programId ?? undefined,
        plant: e.plant_id ?? undefined,
        metadata: {
          folio: e.folio,
          employee: e.employeeName,
          amount: e.amount,
          beforeState: states.before,
          afterState: states.after,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped for ${action}: ${(err as Error)?.message}`,
      );
    }
  }
}
