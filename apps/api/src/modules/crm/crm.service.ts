import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Opportunity } from './entities/opportunity.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateOpportunityDto,
  TransitionOpportunityDto,
  UpdateOpportunityDto,
} from './dto/crm.dto';
import {
  assertTransition,
  defaultProbability,
  OpportunityStatus,
} from './opportunity-state';

export interface CrmKpis {
  total: number;
  open: number;
  pipelineValue: number;
  weightedValue: number;
  wonValue: number;
  winRatePct: number | null;
  currency: string;
  byStatus: Record<OpportunityStatus, number>;
}

const OPEN_STAGES: OpportunityStatus[] = ['LEAD', 'QUALIFIED', 'PROPOSAL'];

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    @InjectRepository(Opportunity)
    private readonly repo: Repository<Opportunity>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Opportunity>,
    alias: string,
  ): SelectQueryBuilder<Opportunity> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateOpportunityDto): Promise<Opportunity> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('OPPORTUNITY');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      title: dto.title,
      customerName: dto.customerName ?? null,
      contactName: dto.contactName ?? null,
      status: 'LEAD',
      estimatedValue: dto.estimatedValue ?? 0,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      probability: dto.probability ?? defaultProbability('LEAD'),
      ownerEmail: this.tenantCtx.getUserEmail(),
      programId: dto.programId ?? null,
      accountId: dto.accountId ?? null,
      source: dto.source ?? null,
      competitor: dto.competitor ?? null,
      productLine: dto.productLine ?? null,
      nextStep: dto.nextStep ?? null,
      nextStepDate: dto.nextStepDate ? new Date(dto.nextStepDate) : null,
      notes: dto.notes ?? null,
      expectedCloseDate: dto.expectedCloseDate
        ? new Date(dto.expectedCloseDate)
        : null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('OPPORTUNITY_CREATED', saved, { after: saved });
    return saved;
  }

  async list(
    filters: { status?: string; customerName?: string; accountId?: string } = {},
  ): Promise<Opportunity[]> {
    const qb = this.repo.createQueryBuilder('o').orderBy('o.created_at', 'DESC');
    this.applyScope(qb, 'o');
    if (filters.status) qb.andWhere('o.status = :s', { s: filters.status });
    if (filters.customerName)
      qb.andWhere('o.customer_name = :cn', { cn: filters.customerName });
    if (filters.accountId)
      qb.andWhere('o.account_id = :aid', { aid: filters.accountId });
    return qb.getMany();
  }

  async getOne(id: string): Promise<Opportunity> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Oportunidad no encontrada.');
    return found;
  }

  async update(id: string, dto: UpdateOpportunityDto): Promise<Opportunity> {
    const o = await this.getOne(id);
    Object.assign(o, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.customerName !== undefined && { customerName: dto.customerName }),
      ...(dto.contactName !== undefined && { contactName: dto.contactName }),
      ...(dto.estimatedValue !== undefined && {
        estimatedValue: dto.estimatedValue,
      }),
      ...(dto.currency !== undefined && { currency: dto.currency.toUpperCase() }),
      ...(dto.probability !== undefined && { probability: dto.probability }),
      ...(dto.accountId !== undefined && { accountId: dto.accountId }),
      ...(dto.source !== undefined && { source: dto.source }),
      ...(dto.competitor !== undefined && { competitor: dto.competitor }),
      ...(dto.productLine !== undefined && { productLine: dto.productLine }),
      ...(dto.nextStep !== undefined && { nextStep: dto.nextStep }),
      ...(dto.nextStepDate !== undefined && {
        nextStepDate: dto.nextStepDate ? new Date(dto.nextStepDate) : null,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.expectedCloseDate !== undefined && {
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : null,
      }),
    });
    const saved = await this.repo.save(o);
    await this.recordLedger('OPPORTUNITY_UPDATED', saved, { after: saved });
    return saved;
  }

  async transition(
    id: string,
    dto: TransitionOpportunityDto,
  ): Promise<Opportunity> {
    const o = await this.getOne(id);
    const from = o.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    o.status = dto.status;
    o.probability = defaultProbability(dto.status);
    if (dto.status === 'WON' || dto.status === 'LOST') o.closedAt = new Date();
    if (dto.status === 'LOST' && dto.lossReason) o.lossReason = dto.lossReason;
    const saved = await this.repo.save(o);
    await this.recordLedger('OPPORTUNITY_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<CrmKpis> {
    const all = await this.list();
    const byStatus = {
      LEAD: 0,
      QUALIFIED: 0,
      PROPOSAL: 0,
      WON: 0,
      LOST: 0,
    } as Record<OpportunityStatus, number>;

    let pipelineValue = 0;
    let weightedValue = 0;
    let wonValue = 0;
    let currency = 'USD';

    for (const o of all) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      if (o.currency) currency = o.currency;
      const value = Number(o.estimatedValue ?? 0);
      if (OPEN_STAGES.includes(o.status)) {
        pipelineValue += value;
        weightedValue += (value * Number(o.probability ?? 0)) / 100;
      }
      if (o.status === 'WON') wonValue += value;
    }

    const closed = byStatus.WON + byStatus.LOST;
    return {
      total: all.length,
      open: byStatus.LEAD + byStatus.QUALIFIED + byStatus.PROPOSAL,
      pipelineValue: Math.round(pipelineValue),
      weightedValue: Math.round(weightedValue),
      wonValue: Math.round(wonValue),
      winRatePct:
        closed > 0 ? Math.round((byStatus.WON / closed) * 1000) / 10 : null,
      currency,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    o: Opportunity,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'OPPORTUNITY',
        referenceId: o.id,
        program: o.programId ?? undefined,
        plant: o.plant_id ?? undefined,
        metadata: {
          folio: o.folio,
          customer: o.customerName,
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
