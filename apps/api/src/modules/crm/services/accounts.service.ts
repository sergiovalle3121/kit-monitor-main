import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmAccount } from '../entities/crm-account.entity';
import { CrmContact } from '../entities/crm-contact.entity';
import { CrmActivity } from '../entities/crm-activity.entity';
import { CrmQuote } from '../entities/crm-quote.entity';
import { Opportunity } from '../entities/opportunity.entity';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../../event-ledger/event-ledger.service';
import { EventDomain } from '../../event-ledger/entities/ledger-event.entity';
import { applyCrmScope, crmScopeStamp } from './crm-scope';
import { CreateAccountDto, UpdateAccountDto } from '../dto/account.dto';

const OPEN_STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL'];

export interface AccountKpis {
  total: number;
  customers: number;
  prospects: number;
  strategic: number;
  atRisk: number;
  avgHealth: number;
  byTier: Record<string, number>;
  byRegion: Record<string, number>;
}

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(CrmAccount)
    private readonly accounts: Repository<CrmAccount>,
    @InjectRepository(CrmContact)
    private readonly contacts: Repository<CrmContact>,
    @InjectRepository(CrmActivity)
    private readonly activities: Repository<CrmActivity>,
    @InjectRepository(CrmQuote)
    private readonly quotes: Repository<CrmQuote>,
    @InjectRepository(Opportunity)
    private readonly opps: Repository<Opportunity>,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  async create(dto: CreateAccountDto): Promise<CrmAccount> {
    const code =
      dto.code?.trim() ||
      dto.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36);
    const entity = this.accounts.create({
      code,
      name: dto.name,
      legalName: dto.legalName ?? null,
      type: dto.type ?? 'PROSPECT',
      tier: dto.tier ?? 'C',
      status: 'ACTIVE',
      industry: dto.industry ?? null,
      segment: dto.segment ?? null,
      website: dto.website ?? null,
      region: dto.region ?? null,
      country: dto.country ?? null,
      city: dto.city ?? null,
      addressLine: dto.addressLine ?? null,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      paymentTerms: dto.paymentTerms ?? null,
      incoterm: dto.incoterm ?? null,
      creditLimit: dto.creditLimit ?? 0,
      annualRevenue: dto.annualRevenue ?? null,
      employees: dto.employees ?? null,
      taxId: dto.taxId ?? null,
      duns: dto.duns ?? null,
      ownerEmail: dto.ownerEmail ?? this.tenantCtx.getUserEmail(),
      parentAccountId: dto.parentAccountId ?? null,
      enterpriseCustomerCode: dto.enterpriseCustomerCode ?? null,
      healthScore: dto.healthScore ?? 70,
      riskLevel: dto.riskLevel ?? 'LOW',
      npsScore: dto.npsScore ?? null,
      tags: dto.tags ?? null,
      notes: dto.notes ?? null,
      ...crmScopeStamp(this.tenantCtx),
    });
    const saved = await this.accounts.save(entity);
    await this.record('ACCOUNT_CREATED', saved.id, { name: saved.name });
    return saved;
  }

  async list(filters: { q?: string; tier?: string; type?: string; status?: string } = {}): Promise<CrmAccount[]> {
    const qb = this.accounts.createQueryBuilder('a').orderBy('a.name', 'ASC');
    applyCrmScope(qb, 'a', this.tenantCtx);
    if (filters.tier) qb.andWhere('a.tier = :t', { t: filters.tier });
    if (filters.type) qb.andWhere('a.type = :ty', { ty: filters.type });
    if (filters.status) qb.andWhere('a.status = :s', { s: filters.status });
    if (filters.q) {
      qb.andWhere('(LOWER(a.name) LIKE :q OR LOWER(a.code) LIKE :q OR LOWER(a.industry) LIKE :q)', {
        q: `%${filters.q.toLowerCase()}%`,
      });
    }
    return qb.getMany();
  }

  async getOne(id: string): Promise<CrmAccount> {
    const a = await this.accounts.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Cuenta no encontrada.');
    return a;
  }

  async update(id: string, dto: UpdateAccountDto): Promise<CrmAccount> {
    const a = await this.getOne(id);
    const patch: Partial<CrmAccount> = {};
    for (const k of [
      'name', 'legalName', 'type', 'tier', 'status', 'industry', 'segment',
      'website', 'region', 'country', 'city', 'addressLine', 'paymentTerms',
      'incoterm', 'creditLimit', 'annualRevenue', 'employees', 'taxId', 'duns',
      'ownerEmail', 'parentAccountId', 'enterpriseCustomerCode', 'healthScore',
      'riskLevel', 'npsScore', 'tags', 'notes',
    ] as const) {
      if (dto[k] !== undefined) (patch as Record<string, unknown>)[k] = dto[k];
    }
    if (dto.currency !== undefined) patch.currency = dto.currency.toUpperCase();
    Object.assign(a, patch);
    const saved = await this.accounts.save(a);
    await this.record('ACCOUNT_UPDATED', saved.id, { name: saved.name });
    return saved;
  }

  /** The Account-360: the account plus everything attached to it, aggregated. */
  async account360(id: string) {
    const account = await this.getOne(id);

    const scoped = <T extends object>(repo: Repository<T>, alias: string) =>
      applyCrmScope(repo.createQueryBuilder(alias), alias, this.tenantCtx);

    const [contacts, opportunities, quotes, activities] = await Promise.all([
      scoped(this.contacts, 'c').andWhere('c.account_id = :id', { id }).orderBy('c.is_primary', 'DESC').getMany(),
      scoped(this.opps, 'o').andWhere('o.account_id = :id', { id }).orderBy('o.created_at', 'DESC').getMany(),
      scoped(this.quotes, 'q').andWhere('q.account_id = :id', { id }).orderBy('q.created_at', 'DESC').getMany(),
      scoped(this.activities, 'ac').andWhere('ac.account_id = :id', { id }).orderBy('ac.created_at', 'DESC').limit(50).getMany(),
    ]);

    const openOpps = opportunities.filter((o) => OPEN_STAGES.includes(o.status));
    const pipelineValue = openOpps.reduce((s, o) => s + Number(o.estimatedValue ?? 0), 0);
    const weightedValue = openOpps.reduce((s, o) => s + (Number(o.estimatedValue ?? 0) * Number(o.probability ?? 0)) / 100, 0);
    const wonValue = opportunities.filter((o) => o.status === 'WON').reduce((s, o) => s + Number(o.estimatedValue ?? 0), 0);
    const quoteValue = quotes
      .filter((q) => q.status === 'SENT' || q.status === 'DRAFT')
      .reduce((s, q) => s + Number(q.total ?? 0), 0);
    const openTasks = activities.filter((a) => a.status === 'OPEN');
    const overdueTasks = openTasks.filter((a) => a.dueAt && new Date(a.dueAt) < new Date());
    const lastActivityAt = activities[0]?.created_at ?? null;

    return {
      account,
      contacts,
      opportunities,
      quotes,
      activities,
      metrics: {
        contacts: contacts.length,
        openOpportunities: openOpps.length,
        pipelineValue: Math.round(pipelineValue),
        weightedValue: Math.round(weightedValue),
        wonValue: Math.round(wonValue),
        openQuotes: quotes.filter((q) => q.status === 'SENT' || q.status === 'DRAFT').length,
        quoteValue: Math.round(quoteValue),
        openTasks: openTasks.length,
        overdueTasks: overdueTasks.length,
        lastActivityAt,
      },
    };
  }

  async kpis(): Promise<AccountKpis> {
    const all = await this.list();
    const byTier: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    let health = 0;
    let customers = 0;
    let prospects = 0;
    let strategic = 0;
    let atRisk = 0;
    for (const a of all) {
      byTier[a.tier] = (byTier[a.tier] ?? 0) + 1;
      const region = a.region || '—';
      byRegion[region] = (byRegion[region] ?? 0) + 1;
      health += a.healthScore ?? 0;
      if (a.type === 'CUSTOMER') customers++;
      if (a.type === 'PROSPECT') prospects++;
      if (a.tier === 'STRATEGIC') strategic++;
      if (a.riskLevel === 'HIGH' || (a.healthScore ?? 100) < 50) atRisk++;
    }
    return {
      total: all.length,
      customers,
      prospects,
      strategic,
      atRisk,
      avgHealth: all.length ? Math.round(health / all.length) : 0,
      byTier,
      byRegion,
    };
  }

  private async record(action: string, id: string, meta: Record<string, unknown>): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'CRM_ACCOUNT',
        referenceId: id,
        metadata: meta,
      });
    } catch (err) {
      this.logger.warn(`Ledger skipped ${action}: ${(err as Error)?.message}`);
    }
  }
}
