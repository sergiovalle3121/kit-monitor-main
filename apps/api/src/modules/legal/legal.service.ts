import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateContractDto,
  TransitionContractDto,
  UpdateContractDto,
} from './dto/legal.dto';
import { assertTransition, ContractStatus } from './contract-state';

export interface LegalKpis {
  total: number;
  active: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  activeValue: number;
  currency: string;
  byStatus: Record<ContractStatus, number>;
}

const DAY = 86_400_000;

@Injectable()
export class LegalService {
  private readonly logger = new Logger(LegalService.name);

  constructor(
    @Inject(getTenantRepositoryToken(Contract))
    private readonly repo: TenantScopedRepository<Contract>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Contract>,
    alias: string,
  ): SelectQueryBuilder<Contract> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateContractDto): Promise<Contract> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('CONTRACT');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      title: dto.title,
      counterparty: dto.counterparty ?? null,
      type: dto.type ?? 'OTHER',
      status: 'DRAFT',
      value: dto.value ?? 0,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      ownerEmail: dto.ownerEmail ?? this.tenantCtx.getUserEmail(),
      autoRenew: dto.autoRenew ?? false,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      notes: dto.notes ?? null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('CONTRACT_CREATED', saved, { after: saved });
    return saved;
  }

  async list(filters: {
    status?: string;
    type?: string;
    counterparty?: string;
  } = {}): Promise<Contract[]> {
    const qb = this.repo.createQueryBuilder('c').orderBy('c.end_date', 'ASC');
    this.applyScope(qb, 'c');
    if (filters.status) qb.andWhere('c.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('c.type = :t', { t: filters.type });
    if (filters.counterparty)
      qb.andWhere('c.counterparty = :cp', { cp: filters.counterparty });
    return qb.getMany();
  }

  async getOne(id: string): Promise<Contract> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Contrato no encontrado.');
    return found;
  }

  async update(id: string, dto: UpdateContractDto): Promise<Contract> {
    const c = await this.getOne(id);
    Object.assign(c, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.counterparty !== undefined && { counterparty: dto.counterparty }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.value !== undefined && { value: dto.value }),
      ...(dto.currency !== undefined && { currency: dto.currency.toUpperCase() }),
      ...(dto.ownerEmail !== undefined && { ownerEmail: dto.ownerEmail }),
      ...(dto.autoRenew !== undefined && { autoRenew: dto.autoRenew }),
      ...(dto.startDate !== undefined && {
        startDate: dto.startDate ? new Date(dto.startDate) : null,
      }),
      ...(dto.endDate !== undefined && {
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    });
    const saved = await this.repo.save(c);
    await this.recordLedger('CONTRACT_UPDATED', saved, { after: saved });
    return saved;
  }

  async transition(id: string, dto: TransitionContractDto): Promise<Contract> {
    const c = await this.getOne(id);
    const from = c.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    c.status = dto.status;
    // On renewal (EXPIRED → ACTIVE) a new end date may be supplied.
    if (dto.endDate) c.endDate = new Date(dto.endDate);
    const saved = await this.repo.save(c);
    await this.recordLedger('CONTRACT_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<LegalKpis> {
    const all = await this.list();
    const now = Date.now();
    const byStatus = {
      DRAFT: 0,
      ACTIVE: 0,
      EXPIRED: 0,
      TERMINATED: 0,
      CANCELLED: 0,
    } as Record<ContractStatus, number>;

    let active = 0;
    let expiring30 = 0;
    let expiring60 = 0;
    let expiring90 = 0;
    let expired = 0;
    let activeValue = 0;
    let currency = 'USD';

    for (const c of all) {
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
      if (c.currency) currency = c.currency;
      if (c.status === 'EXPIRED') expired += 1;
      if (c.status === 'ACTIVE') {
        active += 1;
        activeValue += Number(c.value ?? 0);
        if (c.endDate) {
          const days = (new Date(c.endDate).getTime() - now) / DAY;
          if (days < 0) {
            expired += 1; // active but past its end date
          } else if (days <= 30) {
            expiring30 += 1;
          } else if (days <= 60) {
            expiring60 += 1;
          } else if (days <= 90) {
            expiring90 += 1;
          }
        }
      }
    }

    return {
      total: all.length,
      active,
      expiring30,
      expiring60,
      expiring90,
      expired,
      activeValue,
      currency,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    c: Contract,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'CONTRACT',
        referenceId: c.id,
        plant: c.plant_id ?? undefined,
        metadata: {
          folio: c.folio,
          counterparty: c.counterparty,
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
