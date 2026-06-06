import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { SignalGateway } from '../../../common/gateway/signal.gateway';
import { ErpAccount } from '../entities/erp-account.entity';
import { ErpCostCenter } from '../entities/erp-cost-center.entity';
import { ErpFiscalPeriod } from '../entities/erp-fiscal-period.entity';
import { ErpPostingRule } from '../entities/erp-posting-rule.entity';
import {
  ErpJournalEntry,
  JournalDocType,
  JournalStatus,
} from '../entities/erp-journal-entry.entity';
import { ErpJournalLine } from '../entities/erp-journal-line.entity';
import { ErpInvoice, InvoiceKind } from '../entities/erp-invoice.entity';
import { ErpInvoiceLine } from '../entities/erp-invoice-line.entity';
import { ErpPayment, PaymentMethod } from '../entities/erp-payment.entity';

const TENANT = 'default';
const round = (n: number) => Math.round((Number(n) || 0) * 10000) / 10000;

export interface JournalLineCmd {
  accountCode: string;
  debit?: number;
  credit?: number;
  costCenterCode?: string | null;
  partNumber?: string | null;
  workOrder?: string | null;
  partnerType?: string | null;
  partnerId?: string | null;
  description?: string | null;
}
export interface PostJournalInput {
  postingDate?: string | Date;
  docType?: JournalDocType;
  sourceType?: string;
  sourceId?: string;
  reference?: string;
  currency?: string;
  status?: JournalStatus;
  costCenterCode?: string | null;
  narrative?: string;
  reversalOf?: number | null;
  actorName?: string;
  lines: JournalLineCmd[];
}
export interface RuleContext {
  docType?: JournalDocType;
  sourceId?: string;
  reference?: string;
  narrative?: string;
  actorName?: string;
  costCenterCode?: string | null;
  partNumber?: string | null;
  workOrder?: string | null;
  partnerType?: string | null;
  partnerId?: string | null;
}

@Injectable()
export class ErpFinService {
  private readonly logger = new Logger(ErpFinService.name);

  constructor(
    @InjectRepository(ErpAccount)
    private readonly accountRepo: Repository<ErpAccount>,
    @InjectRepository(ErpCostCenter)
    private readonly ccRepo: Repository<ErpCostCenter>,
    @InjectRepository(ErpFiscalPeriod)
    private readonly periodRepo: Repository<ErpFiscalPeriod>,
    @InjectRepository(ErpPostingRule)
    private readonly ruleRepo: Repository<ErpPostingRule>,
    @InjectRepository(ErpJournalEntry)
    private readonly entryRepo: Repository<ErpJournalEntry>,
    @InjectRepository(ErpJournalLine)
    private readonly lineRepo: Repository<ErpJournalLine>,
    @InjectRepository(ErpInvoice)
    private readonly invoiceRepo: Repository<ErpInvoice>,
    @InjectRepository(ErpInvoiceLine)
    private readonly invLineRepo: Repository<ErpInvoiceLine>,
    @InjectRepository(ErpPayment)
    private readonly paymentRepo: Repository<ErpPayment>,
    private readonly dataSource: DataSource,
    private readonly signals: SignalGateway,
  ) {}

  // ── Accounts & cost centers ────────────────────────────────────────────────
  listAccounts(filters?: { type?: string }) {
    return this.accountRepo.find({
      where: filters?.type ? { type: filters.type as never } : {},
      order: { code: 'ASC' },
    });
  }
  async upsertAccount(dto: Partial<ErpAccount>) {
    if (!dto.code || !dto.name || !dto.type || !dto.normalBalance) {
      throw new BadRequestException(
        'code, name, type y normalBalance son obligatorios.',
      );
    }
    const existing = await this.accountRepo.findOne({
      where: { code: dto.code },
    });
    return this.accountRepo.save({ ...(existing ?? {}), ...dto });
  }
  listCostCenters() {
    return this.ccRepo.find({ order: { code: 'ASC' } });
  }
  async upsertCostCenter(dto: Partial<ErpCostCenter>) {
    if (!dto.code || !dto.name)
      throw new BadRequestException('code y name son obligatorios.');
    const existing = await this.ccRepo.findOne({ where: { code: dto.code } });
    return this.ccRepo.save({ ...(existing ?? {}), ...dto });
  }
  listPostingRules() {
    return this.ruleRepo.find({ order: { event: 'ASC' } });
  }
  async upsertPostingRule(dto: Partial<ErpPostingRule>) {
    if (!dto.event || !dto.debitCode || !dto.creditCode) {
      throw new BadRequestException(
        'event, debitCode y creditCode son obligatorios.',
      );
    }
    const existing = await this.ruleRepo.findOne({
      where: { event: dto.event },
    });
    return this.ruleRepo.save({ ...(existing ?? {}), ...dto });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  currentPeriod(date: Date = new Date()): string {
    return date.toISOString().slice(0, 7);
  }
  private async assertPeriodOpen(
    period: string,
    mgr: EntityManager,
  ): Promise<void> {
    const p = await mgr.findOne(ErpFiscalPeriod, { where: { period } });
    if (!p) {
      await mgr.save(mgr.create(ErpFiscalPeriod, { period, status: 'open' }));
      return;
    }
    if (p.status === 'closed') {
      throw new BadRequestException(
        `El periodo ${period} está cerrado; no se puede postear.`,
      );
    }
  }
  private async nextDocNumber(
    docType: JournalDocType,
    date: Date,
    mgr: EntityManager,
  ): Promise<string> {
    const count = await mgr.count(ErpJournalEntry, { where: { docType } });
    return `${docType}-${date.getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  // ── Core double-entry posting ───────────────────────────────────────────────
  async postJournal(input: PostJournalInput, em?: EntityManager) {
    const run = async (mgr: EntityManager) => {
      const lines = input.lines ?? [];
      if (lines.length < 2) {
        throw new BadRequestException(
          'Un asiento requiere al menos un débito y un crédito.',
        );
      }
      let totalDebit = 0;
      let totalCredit = 0;
      for (const l of lines) {
        const d = round(l.debit ?? 0);
        const c = round(l.credit ?? 0);
        if (d < 0 || c < 0)
          throw new BadRequestException('Importes negativos no permitidos.');
        if (d > 0 && c > 0) {
          throw new BadRequestException(
            'Una línea no puede tener débito y crédito simultáneos.',
          );
        }
        totalDebit += d;
        totalCredit += c;
      }
      totalDebit = round(totalDebit);
      totalCredit = round(totalCredit);
      if (totalDebit !== totalCredit) {
        throw new BadRequestException(
          `Asiento descuadrado: débito ${totalDebit} ≠ crédito ${totalCredit}.`,
        );
      }
      if (totalDebit <= 0)
        throw new BadRequestException('El asiento debe tener importe.');

      const codes = [...new Set(lines.map((l) => l.accountCode))];
      const accounts = await mgr.find(ErpAccount, {
        where: { code: In(codes) },
      });
      const byCode = new Map(accounts.map((a) => [a.code, a]));
      for (const code of codes) {
        const a = byCode.get(code);
        if (!a)
          throw new BadRequestException(
            `La cuenta ${code} no existe en el catálogo.`,
          );
        if (!a.isPostable || !a.active) {
          throw new BadRequestException(`La cuenta ${code} no es posteable.`);
        }
      }

      const postingDate = input.postingDate
        ? new Date(input.postingDate)
        : new Date();
      const period = this.currentPeriod(postingDate);
      const status = input.status ?? 'posted';
      if (status === 'posted') await this.assertPeriodOpen(period, mgr);

      const docNumber = await this.nextDocNumber(
        input.docType ?? 'GL',
        postingDate,
        mgr,
      );
      const header = await mgr.save(
        mgr.create(ErpJournalEntry, {
          docNumber,
          postingDate,
          period,
          docType: input.docType ?? 'GL',
          sourceType: input.sourceType ?? null,
          sourceId: input.sourceId ?? null,
          reference: input.reference ?? null,
          currency: input.currency ?? 'USD',
          totalDebit,
          totalCredit,
          status,
          costCenterCode: input.costCenterCode ?? null,
          narrative: input.narrative ?? null,
          reversalOf: input.reversalOf ?? null,
          actorName: input.actorName ?? null,
          tenantId: null,
        }),
      );

      const lineRows = await mgr.save(
        lines.map((l, i) =>
          mgr.create(ErpJournalLine, {
            entryId: header.id,
            lineNo: i + 1,
            accountCode: l.accountCode,
            accountName: byCode.get(l.accountCode)?.name ?? l.accountCode,
            debit: round(l.debit ?? 0),
            credit: round(l.credit ?? 0),
            costCenterCode: l.costCenterCode ?? input.costCenterCode ?? null,
            partNumber: l.partNumber ?? null,
            workOrder: l.workOrder ?? null,
            partnerType: l.partnerType ?? null,
            partnerId: l.partnerId ?? null,
            description: l.description ?? input.narrative ?? null,
          }),
        ),
      );

      // Roll actuals into cost centers for expense debits.
      await this.applyCostCenterActuals(mgr, lineRows, byCode);

      return { header, lines: lineRows };
    };

    const result = em ? await run(em) : await this.dataSource.transaction(run);
    if (!em) {
      this.signals.emitToTenant(TENANT, 'erp:journal-posted', {
        id: result.header.id,
        docNumber: result.header.docNumber,
        docType: result.header.docType,
        amount: result.header.totalDebit,
      });
    }
    return { ...result.header, lines: result.lines };
  }

  private async applyCostCenterActuals(
    mgr: EntityManager,
    lines: ErpJournalLine[],
    byCode: Map<string, ErpAccount>,
  ): Promise<void> {
    const deltas = new Map<string, number>();
    for (const l of lines) {
      if (!l.costCenterCode) continue;
      const acct = byCode.get(l.accountCode);
      if (acct?.type !== 'expense') continue;
      deltas.set(
        l.costCenterCode,
        (deltas.get(l.costCenterCode) ?? 0) + l.debit - l.credit,
      );
    }
    for (const [code, delta] of deltas) {
      const cc = await mgr.findOne(ErpCostCenter, { where: { code } });
      if (cc) {
        cc.actualAmount = round(cc.actualAmount + delta);
        await mgr.save(cc);
      }
    }
  }

  /** Build a balanced 2-line journal from a posting rule (account determination). */
  async postByRule(
    event: string,
    amount: number,
    ctx: RuleContext,
    em?: EntityManager,
  ) {
    const amt = round(amount);
    if (amt <= 0) return null;
    const rule = await (
      em ? em.getRepository(ErpPostingRule) : this.ruleRepo
    ).findOne({
      where: { event },
    });
    if (!rule)
      throw new BadRequestException(
        `No hay regla de posteo configurada para ${event}.`,
      );
    return this.postJournal(
      {
        docType: ctx.docType ?? 'GL',
        sourceType: event,
        sourceId: ctx.sourceId,
        reference: ctx.reference,
        narrative: ctx.narrative ?? rule.description,
        actorName: ctx.actorName,
        costCenterCode: ctx.costCenterCode ?? null,
        lines: [
          {
            accountCode: rule.debitCode,
            debit: amt,
            partNumber: ctx.partNumber,
            workOrder: ctx.workOrder,
            partnerType: ctx.partnerType,
            partnerId: ctx.partnerId,
          },
          {
            accountCode: rule.creditCode,
            credit: amt,
            partNumber: ctx.partNumber,
            workOrder: ctx.workOrder,
            partnerType: ctx.partnerType,
            partnerId: ctx.partnerId,
          },
        ],
      },
      em,
    );
  }

  async reverseJournal(entryId: number, actor: string) {
    return this.dataSource.transaction(async (mgr) => {
      const original = await mgr.findOne(ErpJournalEntry, {
        where: { id: entryId },
      });
      if (!original)
        throw new NotFoundException(`Asiento ${entryId} no encontrado.`);
      if (original.status === 'reversed') {
        throw new BadRequestException('El asiento ya fue reversado.');
      }
      const lines = await mgr.find(ErpJournalLine, { where: { entryId } });
      const rev = await this.postJournal(
        {
          docType: original.docType,
          sourceType: 'REVERSAL',
          sourceId: String(original.id),
          reference: original.docNumber,
          narrative: `Reversa de ${original.docNumber}`,
          actorName: actor,
          reversalOf: original.id,
          lines: lines.map((l) => ({
            accountCode: l.accountCode,
            debit: l.credit,
            credit: l.debit,
            costCenterCode: l.costCenterCode,
            partNumber: l.partNumber,
            workOrder: l.workOrder,
            partnerType: l.partnerType,
            partnerId: l.partnerId,
            description: `Reversa: ${l.description ?? ''}`,
          })),
        },
        mgr,
      );
      original.status = 'reversed';
      await mgr.save(original);
      return rev;
    });
  }

  async getJournal(id: number) {
    const header = await this.entryRepo.findOne({ where: { id } });
    if (!header) throw new NotFoundException(`Asiento ${id} no encontrado.`);
    const lines = await this.lineRepo.find({
      where: { entryId: id },
      order: { lineNo: 'ASC' },
    });
    return { ...header, lines };
  }
  listJournals(filters?: {
    period?: string;
    docType?: string;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.period) where.period = filters.period;
    if (filters?.docType) where.docType = filters.docType;
    return this.entryRepo.find({
      where,
      order: { postingDate: 'DESC', id: 'DESC' },
      take: filters?.limit ?? 100,
    });
  }

  // ── Invoices (AR / AP) ──────────────────────────────────────────────────────
  async createInvoice(dto: {
    kind: InvoiceKind;
    partnerType: 'customer' | 'supplier';
    partnerId: string;
    partnerName?: string;
    salesOrderId?: number;
    purchaseOrderId?: number;
    issueDate?: string;
    dueDate?: string;
    currency?: string;
    narrative?: string;
    createdBy?: string;
    lines: {
      partNumber?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate?: number;
      accountCode?: string;
    }[];
  }) {
    if (!dto.kind || !dto.partnerId || !dto.lines?.length) {
      throw new BadRequestException(
        'kind, partnerId y al menos una línea son obligatorios.',
      );
    }
    let subtotal = 0;
    let taxAmount = 0;
    const lines = dto.lines.map((l) => {
      const lineTotal = round(
        (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0),
      );
      subtotal += lineTotal;
      taxAmount += round((lineTotal * (Number(l.taxRate) || 0)) / 100);
      return { ...l, lineTotal };
    });
    subtotal = round(subtotal);
    taxAmount = round(taxAmount);
    const total = round(subtotal + taxAmount);
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();

    const invoice = await this.invoiceRepo.save(
      this.invoiceRepo.create({
        invoiceNumber: await this.nextInvoiceNumber(dto.kind),
        kind: dto.kind,
        partnerType: dto.partnerType,
        partnerId: dto.partnerId,
        partnerName: dto.partnerName ?? null,
        salesOrderId: dto.salesOrderId ?? null,
        purchaseOrderId: dto.purchaseOrderId ?? null,
        issueDate,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        period: this.currentPeriod(issueDate),
        currency: dto.currency ?? 'USD',
        subtotal,
        taxAmount,
        total,
        amountPaid: 0,
        status: 'draft',
        narrative: dto.narrative ?? null,
        createdBy: dto.createdBy ?? null,
      }),
    );
    await this.invLineRepo.save(
      lines.map((l, i) =>
        this.invLineRepo.create({
          invoiceId: invoice.id,
          lineNo: i + 1,
          partNumber: l.partNumber ?? null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          taxRate: l.taxRate ?? 0,
          accountCode: l.accountCode ?? null,
        }),
      ),
    );
    return this.getInvoice(invoice.id);
  }

  private async nextInvoiceNumber(kind: InvoiceKind): Promise<string> {
    const count = await this.invoiceRepo.count({ where: { kind } });
    return `${kind}-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  async getInvoice(id: number) {
    const invoice = await this.invoiceRepo.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException(`Factura ${id} no encontrada.`);
    const lines = await this.invLineRepo.find({
      where: { invoiceId: id },
      order: { lineNo: 'ASC' },
    });
    const payments = await this.paymentRepo.find({ where: { invoiceId: id } });
    return { ...invoice, lines, payments };
  }
  listInvoices(filters?: {
    kind?: string;
    status?: string;
    partnerId?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters?.kind) where.kind = filters.kind;
    if (filters?.status) where.status = filters.status;
    if (filters?.partnerId) where.partnerId = filters.partnerId;
    return this.invoiceRepo.find({
      where,
      order: { issueDate: 'DESC', id: 'DESC' },
      take: 200,
    });
  }

  /** Post the invoice to the GL (AR: D AR / C Revenue + VAT; AP: D GR-IR + VAT / C AP). */
  async postInvoice(id: number, actor: string) {
    return this.dataSource.transaction(async (mgr) => {
      const invoice = await mgr.findOne(ErpInvoice, { where: { id } });
      if (!invoice) throw new NotFoundException(`Factura ${id} no encontrada.`);
      if (invoice.status !== 'draft') {
        throw new BadRequestException(
          'Solo se pueden postear facturas en borrador.',
        );
      }
      const lines = await mgr.find(ErpInvoiceLine, {
        where: { invoiceId: id },
      });
      const event = invoice.kind === 'AR' ? 'SALES_INVOICE' : 'AP_INVOICE';
      const rule = await mgr.findOne(ErpPostingRule, { where: { event } });
      if (!rule)
        throw new BadRequestException(`Falta la regla de posteo ${event}.`);

      const journalLines: JournalLineCmd[] = [];
      if (invoice.kind === 'AR') {
        journalLines.push({
          accountCode: rule.debitCode,
          debit: invoice.total,
          partnerType: 'customer',
          partnerId: invoice.partnerId,
          description: `CxC ${invoice.invoiceNumber}`,
        });
        // Revenue by line (use line account override or rule credit).
        for (const l of lines) {
          journalLines.push({
            accountCode: l.accountCode ?? rule.creditCode,
            credit: l.lineTotal,
            partNumber: l.partNumber,
            description: l.description,
          });
        }
        if (invoice.taxAmount > 0 && rule.taxCode) {
          journalLines.push({
            accountCode: rule.taxCode,
            credit: invoice.taxAmount,
            description: 'IVA trasladado',
          });
        }
      } else {
        for (const l of lines) {
          journalLines.push({
            accountCode: l.accountCode ?? rule.debitCode,
            debit: l.lineTotal,
            partNumber: l.partNumber,
            description: l.description,
          });
        }
        if (invoice.taxAmount > 0 && rule.taxCode) {
          journalLines.push({
            accountCode: rule.taxCode,
            debit: invoice.taxAmount,
            description: 'IVA acreditable',
          });
        }
        journalLines.push({
          accountCode: rule.creditCode,
          credit: invoice.total,
          partnerType: 'supplier',
          partnerId: invoice.partnerId,
          description: `CxP ${invoice.invoiceNumber}`,
        });
      }

      const entry = await this.postJournal(
        {
          docType: invoice.kind,
          sourceType: event,
          sourceId: String(invoice.id),
          reference: invoice.invoiceNumber,
          narrative: `Factura ${invoice.invoiceNumber}`,
          actorName: actor,
          postingDate: invoice.issueDate,
          lines: journalLines,
        },
        mgr,
      );
      invoice.status = 'posted';
      invoice.journalEntryId = entry.id;
      await mgr.save(invoice);
      return { ...invoice, journalEntryId: entry.id };
    });
  }

  async payInvoice(
    id: number,
    dto: {
      amount: number;
      date?: string;
      method?: PaymentMethod;
      reference?: string;
    },
    actor: string,
  ) {
    return this.dataSource.transaction(async (mgr) => {
      const invoice = await mgr.findOne(ErpInvoice, { where: { id } });
      if (!invoice) throw new NotFoundException(`Factura ${id} no encontrada.`);
      if (!['posted', 'partially_paid'].includes(invoice.status)) {
        throw new BadRequestException(
          'La factura debe estar posteada para liquidarse.',
        );
      }
      const amount = round(dto.amount);
      const outstanding = round(invoice.total - invoice.amountPaid);
      if (amount <= 0)
        throw new BadRequestException('El importe del pago debe ser positivo.');
      if (amount > outstanding + 0.0001) {
        throw new BadRequestException(
          `El pago (${amount}) excede el saldo (${outstanding}).`,
        );
      }
      const date = dto.date ? new Date(dto.date) : new Date();
      const event = invoice.kind === 'AR' ? 'AR_PAYMENT' : 'AP_PAYMENT';
      const entry = await this.postByRule(
        event,
        amount,
        {
          docType: invoice.kind,
          sourceId: String(invoice.id),
          reference: invoice.invoiceNumber,
          narrative: `Pago factura ${invoice.invoiceNumber}`,
          actorName: actor,
          partnerType: invoice.partnerType,
          partnerId: invoice.partnerId,
        },
        mgr,
      );

      const payment = await mgr.save(
        mgr.create(ErpPayment, {
          paymentNumber: `PAY-${date.getFullYear()}-${String(
            (await mgr.count(ErpPayment)) + 1,
          ).padStart(6, '0')}`,
          invoiceId: invoice.id,
          kind: invoice.kind,
          date,
          period: this.currentPeriod(date),
          amount,
          method: dto.method ?? 'transfer',
          reference: dto.reference ?? null,
          journalEntryId: entry?.id ?? null,
          createdBy: actor,
        }),
      );

      invoice.amountPaid = round(invoice.amountPaid + amount);
      invoice.status =
        invoice.amountPaid >= invoice.total - 0.0001
          ? 'paid'
          : 'partially_paid';
      await mgr.save(invoice);
      return payment;
    });
  }

  // ── Fiscal periods ──────────────────────────────────────────────────────────
  listPeriods() {
    return this.periodRepo.find({ order: { period: 'DESC' } });
  }
  async closePeriod(period: string, actor: string) {
    const p =
      (await this.periodRepo.findOne({ where: { period } })) ??
      this.periodRepo.create({ period, status: 'open' });
    p.status = 'closed';
    p.closedAt = new Date();
    p.closedBy = actor;
    return this.periodRepo.save(p);
  }
  async openPeriod(period: string) {
    const p =
      (await this.periodRepo.findOne({ where: { period } })) ??
      this.periodRepo.create({ period });
    p.status = 'open';
    p.closedAt = null;
    p.closedBy = null;
    return this.periodRepo.save(p);
  }

  // ── Reports ──────────────────────────────────────────────────────────────────
  async trialBalance(period?: string) {
    const qb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoin(ErpJournalEntry, 'e', 'e.id = l.entryId')
      .select('l.accountCode', 'accountCode')
      .addSelect('SUM(l.debit)', 'debit')
      .addSelect('SUM(l.credit)', 'credit')
      .where("e.status = 'posted'")
      .groupBy('l.accountCode');
    if (period) qb.andWhere('e.period = :period', { period });
    const raw = await qb.getRawMany<{
      accountCode: string;
      debit: string;
      credit: string;
    }>();

    const accounts = await this.accountRepo.find();
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    let totalDebit = 0;
    let totalCredit = 0;
    const rows = raw
      .map((r) => {
        const debit = round(Number(r.debit));
        const credit = round(Number(r.credit));
        totalDebit += debit;
        totalCredit += credit;
        const acct = byCode.get(r.accountCode);
        return {
          accountCode: r.accountCode,
          accountName: acct?.name ?? r.accountCode,
          type: acct?.type ?? 'expense',
          debit,
          credit,
          balance: round(debit - credit),
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return {
      period: period ?? 'all',
      rows,
      totalDebit: round(totalDebit),
      totalCredit: round(totalCredit),
      balanced: round(totalDebit) === round(totalCredit),
    };
  }

  async generalLedger(
    accountCode: string,
    filters?: { period?: string; limit?: number },
  ) {
    const qb = this.lineRepo
      .createQueryBuilder('l')
      .innerJoinAndMapOne('l.entry', ErpJournalEntry, 'e', 'e.id = l.entryId')
      .where('l.accountCode = :accountCode', { accountCode })
      .andWhere("e.status = 'posted'")
      .orderBy('e.postingDate', 'ASC')
      .addOrderBy('l.id', 'ASC')
      .take(filters?.limit ?? 500);
    if (filters?.period)
      qb.andWhere('e.period = :period', { period: filters.period });
    const lines = await qb.getMany();
    let running = 0;
    return lines.map((l) => {
      running = round(running + l.debit - l.credit);
      const e = (l as ErpJournalLine & { entry?: ErpJournalEntry }).entry;
      return {
        entryId: l.entryId,
        docNumber: e?.docNumber,
        postingDate: e?.postingDate,
        description: l.description,
        debit: l.debit,
        credit: l.credit,
        balance: running,
      };
    });
  }

  async aging(kind: InvoiceKind) {
    const invoices = await this.invoiceRepo.find({
      where: { kind, status: In(['posted', 'partially_paid']) },
    });
    const now = Date.now();
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
    const rows = invoices.map((inv) => {
      const outstanding = round(inv.total - inv.amountPaid);
      const due = inv.dueDate
        ? new Date(inv.dueDate).getTime()
        : new Date(inv.issueDate).getTime();
      const daysOverdue = Math.floor((now - due) / 86400000);
      let bucket: keyof typeof buckets = 'current';
      if (daysOverdue <= 0) bucket = 'current';
      else if (daysOverdue <= 30) bucket = 'd1_30';
      else if (daysOverdue <= 60) bucket = 'd31_60';
      else if (daysOverdue <= 90) bucket = 'd61_90';
      else bucket = 'd90_plus';
      buckets[bucket] = round(buckets[bucket] + outstanding);
      return {
        invoiceNumber: inv.invoiceNumber,
        partnerId: inv.partnerId,
        partnerName: inv.partnerName,
        total: inv.total,
        outstanding,
        dueDate: inv.dueDate,
        daysOverdue,
        bucket,
      };
    });
    return {
      kind,
      buckets,
      rows,
      totalOutstanding: round(rows.reduce((s, r) => s + r.outstanding, 0)),
    };
  }

  async incomeStatement(period?: string) {
    const tb = await this.trialBalance(period);
    const revenue = round(
      tb.rows
        .filter((r) => r.type === 'revenue')
        .reduce((s, r) => s + r.credit - r.debit, 0),
    );
    const expense = round(
      tb.rows
        .filter((r) => r.type === 'expense')
        .reduce((s, r) => s + r.debit - r.credit, 0),
    );
    return {
      period: period ?? 'all',
      revenue,
      expense,
      netIncome: round(revenue - expense),
      lines: tb.rows.filter(
        (r) => r.type === 'revenue' || r.type === 'expense',
      ),
    };
  }

  async balanceSheet(period?: string) {
    const tb = await this.trialBalance(period);
    const sum = (t: string) =>
      round(
        tb.rows
          .filter((r) => r.type === t)
          .reduce((s, r) => s + r.debit - r.credit, 0),
      );
    const assets = sum('asset');
    const liabilities = round(-sum('liability'));
    const equity = round(-sum('equity'));
    const incomeStatement = await this.incomeStatement(period);
    return {
      period: period ?? 'all',
      assets,
      liabilities,
      equity,
      retainedEarnings: incomeStatement.netIncome,
      liabilitiesPlusEquity: round(
        liabilities + equity + incomeStatement.netIncome,
      ),
      balanced:
        round(assets) ===
        round(liabilities + equity + incomeStatement.netIncome),
    };
  }
}
