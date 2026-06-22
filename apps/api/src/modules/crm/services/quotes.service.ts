import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmQuote, QuoteStatus } from '../entities/crm-quote.entity';
import { CrmQuoteLine } from '../entities/crm-quote-line.entity';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../../numbering/document-numbering.service';
import { EventLedgerService } from '../../event-ledger/event-ledger.service';
import { EventDomain } from '../../event-ledger/entities/ledger-event.entity';
import { applyCrmScope, crmScopeStamp } from './crm-scope';
import {
  CreateQuoteDto,
  CreateQuoteLineDto,
  UpdateQuoteDto,
  UpdateQuoteLineDto,
} from '../dto/quote.dto';

const ALLOWED: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ['SENT'],
  SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'DRAFT'],
  ACCEPTED: [],
  REJECTED: ['DRAFT'],
  EXPIRED: ['DRAFT'],
};

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    @InjectRepository(CrmQuote)
    private readonly quotes: Repository<CrmQuote>,
    @InjectRepository(CrmQuoteLine)
    private readonly lines: Repository<CrmQuoteLine>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  async create(dto: CreateQuoteDto): Promise<CrmQuote> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('QUOTE');
    } catch (err) {
      this.logger.warn(`Folio QUOTE failed: ${(err as Error)?.message}`);
    }
    const entity = this.quotes.create({
      folio,
      account_id: dto.accountId,
      opportunityId: dto.opportunityId ?? null,
      rev: dto.rev ?? 1,
      title: dto.title,
      status: 'DRAFT',
      currency: (dto.currency ?? 'USD').toUpperCase(),
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      paymentTerms: dto.paymentTerms ?? null,
      incoterm: dto.incoterm ?? null,
      leadTimeDays: dto.leadTimeDays ?? null,
      subtotal: 0,
      discountPct: dto.discountPct ?? 0,
      total: 0,
      estAnnualValue: 0,
      marginPct: null,
      ownerEmail: dto.ownerEmail ?? this.tenantCtx.getUserEmail(),
      notes: dto.notes ?? null,
      ...crmScopeStamp(this.tenantCtx),
    });
    const saved = await this.quotes.save(entity);
    if (dto.lines?.length) {
      for (const [i, l] of dto.lines.entries()) {
        await this.addLineRaw(saved.id, l, i + 1);
      }
      await this.recalc(saved.id);
    }
    await this.record('QUOTE_CREATED', saved, {});
    return this.getOne(saved.id).then((r) => r.quote);
  }

  async list(filters: { accountId?: string; status?: string } = {}): Promise<CrmQuote[]> {
    const qb = applyCrmScope(this.quotes.createQueryBuilder('q'), 'q', this.tenantCtx)
      .orderBy('q.created_at', 'DESC');
    if (filters.accountId) qb.andWhere('q.account_id = :a', { a: filters.accountId });
    if (filters.status) qb.andWhere('q.status = :s', { s: filters.status });
    return qb.getMany();
  }

  async getOne(id: string): Promise<{ quote: CrmQuote; lines: CrmQuoteLine[] }> {
    const quote = await this.quotes.findOne({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada.');
    const lines = await applyCrmScope(this.lines.createQueryBuilder('l'), 'l', this.tenantCtx)
      .andWhere('l.quote_id = :id', { id })
      .orderBy('l.line_no', 'ASC')
      .getMany();
    return { quote, lines };
  }

  async update(id: string, dto: UpdateQuoteDto): Promise<CrmQuote> {
    const { quote } = await this.getOne(id);
    for (const k of [
      'title', 'opportunityId', 'rev', 'validUntil', 'paymentTerms',
      'incoterm', 'leadTimeDays', 'discountPct', 'notes', 'ownerEmail',
    ] as const) {
      if (dto[k] !== undefined) {
        if (k === 'validUntil') quote.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
        else (quote as unknown as Record<string, unknown>)[k] = dto[k];
      }
    }
    if (dto.currency !== undefined) quote.currency = dto.currency.toUpperCase();
    await this.quotes.save(quote);
    return this.recalc(id);
  }

  async transition(id: string, status: QuoteStatus): Promise<CrmQuote> {
    const { quote } = await this.getOne(id);
    if (!ALLOWED[quote.status]?.includes(status)) {
      throw new BadRequestException(`Transición no permitida ${quote.status} → ${status}.`);
    }
    quote.status = status;
    if (status === 'SENT') quote.sentAt = new Date();
    if (status === 'ACCEPTED' || status === 'REJECTED') quote.decidedAt = new Date();
    const saved = await this.quotes.save(quote);
    await this.record('QUOTE_' + status, saved, {});
    return saved;
  }

  // ── Lines ──────────────────────────────────────────────────────────────────
  async addLine(quoteId: string, dto: CreateQuoteLineDto): Promise<CrmQuote> {
    const existing = await this.lines.count({ where: { quote_id: quoteId } });
    await this.addLineRaw(quoteId, dto, existing + 1);
    return this.recalc(quoteId);
  }

  private async addLineRaw(quoteId: string, dto: CreateQuoteLineDto, lineNo: number): Promise<CrmQuoteLine> {
    const line = this.lines.create({
      quote_id: quoteId,
      lineNo: dto.lineNo ?? lineNo,
      partNumber: dto.partNumber ?? null,
      description: dto.description,
      eau: dto.eau ?? 0,
      quantity: dto.quantity ?? 1,
      unitCost: dto.unitCost ?? 0,
      unitPrice: dto.unitPrice ?? 0,
      leadTimeDays: dto.leadTimeDays ?? null,
      notes: dto.notes ?? null,
      ...crmScopeStamp(this.tenantCtx),
    });
    return this.lines.save(line);
  }

  async updateLine(lineId: string, dto: UpdateQuoteLineDto): Promise<CrmQuote> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Línea no encontrada.');
    for (const k of [
      'lineNo', 'partNumber', 'description', 'eau', 'quantity',
      'unitCost', 'unitPrice', 'leadTimeDays', 'notes',
    ] as const) {
      if (dto[k] !== undefined) (line as unknown as Record<string, unknown>)[k] = dto[k];
    }
    await this.lines.save(line);
    return this.recalc(line.quote_id);
  }

  async removeLine(lineId: string): Promise<CrmQuote> {
    const line = await this.lines.findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Línea no encontrada.');
    const quoteId = line.quote_id;
    await this.lines.delete(lineId);
    return this.recalc(quoteId);
  }

  /** Roll up money from the lines: subtotal, total (after discount), margin, EAU value. */
  async recalc(quoteId: string): Promise<CrmQuote> {
    const { quote, lines } = await this.getOne(quoteId);
    let subtotal = 0;
    let cost = 0;
    let annual = 0;
    for (const l of lines) {
      const ext = Number(l.quantity ?? 0) * Number(l.unitPrice ?? 0);
      subtotal += ext;
      cost += Number(l.quantity ?? 0) * Number(l.unitCost ?? 0);
      annual += Number(l.eau ?? 0) * Number(l.unitPrice ?? 0);
    }
    const discount = Number(quote.discountPct ?? 0) / 100;
    const total = subtotal * (1 - discount);
    const netCost = cost * (1 - discount);
    quote.subtotal = Math.round(subtotal * 100) / 100;
    quote.total = Math.round(total * 100) / 100;
    quote.estAnnualValue = Math.round(annual * (1 - discount));
    quote.marginPct = total > 0 ? Math.round(((total - netCost) / total) * 1000) / 10 : null;
    return this.quotes.save(quote);
  }

  private async record(action: string, q: CrmQuote, meta: Record<string, unknown>): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'CRM_QUOTE',
        referenceId: q.id,
        metadata: { folio: q.folio, total: q.total, ...meta },
      });
    } catch (err) {
      this.logger.warn(`Ledger skipped ${action}: ${(err as Error)?.message}`);
    }
  }
}
