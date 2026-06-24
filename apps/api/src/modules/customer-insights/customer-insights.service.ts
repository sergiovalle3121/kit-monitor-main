import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnterpriseCustomer } from '../enterprise-campus/entities/enterprise-customer.entity';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { CrmAccount } from '../crm/entities/crm-account.entity';
import { Opportunity } from '../crm/entities/opportunity.entity';
import { CrmQuote } from '../crm/entities/crm-quote.entity';
import { RmaCase } from '../rma/entities/rma-case.entity';
import { Shipment } from '../outbound/entities/shipment.entity';
import { ErpSalesOrder } from '../erp-core/entities/erp-sales-order.entity';

const OPEN_OPP = ['LEAD', 'QUALIFIED', 'PROPOSAL'];

/**
 * Customer-360 across departments. Joins the operational customer master
 * (enterprise_customers) with commercial (CRM account/opps/quotes), quality
 * (RMA), delivery (shipments) and finance (sales orders) — the "one customer,
 * every department" executive view. Read-only aggregation; no new tables.
 */
@Injectable()
export class CustomerInsightsService {
  constructor(
    @InjectRepository(EnterpriseCustomer) private readonly customers: Repository<EnterpriseCustomer>,
    @InjectRepository(EnterpriseProgram) private readonly programs: Repository<EnterpriseProgram>,
    @InjectRepository(CrmAccount) private readonly accounts: Repository<CrmAccount>,
    @InjectRepository(Opportunity) private readonly opps: Repository<Opportunity>,
    @InjectRepository(CrmQuote) private readonly quotes: Repository<CrmQuote>,
    @InjectRepository(RmaCase) private readonly rmas: Repository<RmaCase>,
    @InjectRepository(Shipment) private readonly shipments: Repository<Shipment>,
    @InjectRepository(ErpSalesOrder) private readonly salesOrders: Repository<ErpSalesOrder>,
  ) {}

  /** Executive index: every customer with a cross-department rollup. */
  async list(): Promise<any[]> {
    const customers = await this.customers.find({ order: { name: 'ASC' } });
    return Promise.all(customers.map((c) => this.rollup(c)));
  }

  async customer360(code: string): Promise<any> {
    const customer = await this.customers.findOne({ where: { code } });
    if (!customer) throw new NotFoundException('Cliente no encontrado.');

    const [programs, account, quality, delivery, finance] = await Promise.all([
      this.programs
        .createQueryBuilder('p')
        .where('p.customer_id = :id', { id: customer.id })
        .orderBy('p.name', 'ASC')
        .getMany(),
      this.accounts.findOne({ where: { enterpriseCustomerCode: code } }),
      this.quality(customer.name),
      this.delivery(customer.name),
      this.finance(code),
    ]);
    const commercial = await this.commercial(account);

    return {
      customer,
      account: account ?? null,
      programs,
      commercial,
      quality,
      delivery,
      finance,
      metrics: {
        programs: programs.length,
        activePrograms: programs.filter((p) => p.status === 'active' || p.status === 'ramping').length,
        pipelineValue: commercial.pipelineValue,
        wonValue: commercial.wonValue,
        openRmas: quality.open,
        otdPct: delivery.otdPct,
        salesOrderValue: finance.totalValue,
      },
    };
  }

  // ── Per-department aggregations ──────────────────────────────────────────────
  private async rollup(c: EnterpriseCustomer): Promise<any> {
    const [account, programs, openRmas] = await Promise.all([
      this.accounts.findOne({ where: { enterpriseCustomerCode: c.code } }),
      this.programs.createQueryBuilder('p').where('p.customer_id = :id', { id: c.id }).getCount(),
      this.rmas
        .createQueryBuilder('r')
        .where('r.customer_name = :n', { n: c.name })
        .andWhere('r.status != :s', { s: 'CLOSED' })
        .getCount(),
    ]);
    const commercial = await this.commercial(account);
    return {
      code: c.code,
      name: c.name,
      industry: c.industry ?? null,
      status: c.status,
      tier: account?.tier ?? null,
      healthScore: account?.healthScore ?? null,
      programs,
      pipelineValue: commercial.pipelineValue,
      wonValue: commercial.wonValue,
      openRmas,
    };
  }

  private async commercial(account: CrmAccount | null) {
    if (!account) {
      return { account: null, pipelineValue: 0, weightedValue: 0, wonValue: 0, openQuotes: 0, quoteValue: 0, currency: 'USD' };
    }
    const [opps, quotes] = await Promise.all([
      this.opps.find({ where: { accountId: account.id } }),
      this.quotes.find({ where: { account_id: account.id } }),
    ]);
    const open = opps.filter((o) => OPEN_OPP.includes(o.status));
    const pipelineValue = Math.round(open.reduce((s, o) => s + Number(o.estimatedValue ?? 0), 0));
    const weightedValue = Math.round(open.reduce((s, o) => s + (Number(o.estimatedValue ?? 0) * Number(o.probability ?? 0)) / 100, 0));
    const wonValue = Math.round(opps.filter((o) => o.status === 'WON').reduce((s, o) => s + Number(o.estimatedValue ?? 0), 0));
    const openQuotesList = quotes.filter((q) => q.status === 'SENT' || q.status === 'DRAFT');
    return {
      account: { id: account.id, tier: account.tier, healthScore: account.healthScore, ownerEmail: account.ownerEmail, paymentTerms: account.paymentTerms, creditLimit: account.creditLimit },
      pipelineValue, weightedValue, wonValue,
      openOpps: open.length,
      openQuotes: openQuotesList.length,
      quoteValue: Math.round(openQuotesList.reduce((s, q) => s + Number(q.total ?? 0), 0)),
      currency: account.currency || 'USD',
    };
  }

  private async quality(customerName: string) {
    const rows = await this.rmas.find({ where: { customerName }, order: { openedAt: 'DESC' } });
    const open = rows.filter((r) => r.status !== 'CLOSED').length;
    return {
      total: rows.length,
      open,
      closed: rows.length - open,
      recent: rows.slice(0, 8).map((r) => ({ id: r.id, folio: r.folio, failureDescription: r.failureDescription, severity: r.severity, status: r.status, partNumber: r.partNumber, openedAt: r.openedAt })),
    };
  }

  private async delivery(customerName: string) {
    const rows = await this.shipments.find({ where: { customerName } });
    const shipped = rows.filter((s) => s.shippedDate);
    const onTime = shipped.filter((s) => s.promisedDate && s.shippedDate && new Date(s.shippedDate) <= new Date(s.promisedDate)).length;
    return {
      total: rows.length,
      shipped: shipped.length,
      // "In transit" = shipped but not yet delivered.
      inTransit: rows.filter((s) => s.status === 'SHIPPED').length,
      otdPct: shipped.length ? Math.round((onTime / shipped.length) * 1000) / 10 : null,
    };
  }

  private async finance(customerCode: string) {
    const rows = await this.salesOrders.find({ where: { customerCode } });
    const open = rows.filter((s) => s.status !== 'closed' && s.status !== 'cancelled');
    return {
      total: rows.length,
      open: open.length,
      totalValue: Math.round(rows.reduce((s, o) => s + Number(o.total ?? 0), 0)),
      openValue: Math.round(open.reduce((s, o) => s + Number(o.total ?? 0), 0)),
      currency: rows[0]?.currency || 'USD',
    };
  }
}
