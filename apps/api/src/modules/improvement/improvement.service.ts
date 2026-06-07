import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ImprovementInitiative } from './entities/improvement-initiative.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateInitiativeDto,
  TransitionInitiativeDto,
  UpdateInitiativeDto,
} from './dto/improvement.dto';
import { assertTransition, InitiativeStatus } from './initiative-state';

export interface InitiativeKpis {
  total: number;
  byStatus: Record<InitiativeStatus, number>;
  inProgress: number;
  implemented: number;
  estimatedSavings: number;
  realizedSavings: number;
  currency: string;
}

interface ListFilters {
  status?: string;
  methodology?: string;
  area?: string;
  programId?: string;
}

@Injectable()
export class ImprovementService {
  private readonly logger = new Logger(ImprovementService.name);

  constructor(
    @InjectRepository(ImprovementInitiative)
    private readonly repo: Repository<ImprovementInitiative>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<ImprovementInitiative>,
    alias: string,
  ): SelectQueryBuilder<ImprovementInitiative> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateInitiativeDto): Promise<ImprovementInitiative> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('IMPROVEMENT');
    } catch (err) {
      // Numbering must never block idea capture; fall back to no folio.
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      title: dto.title,
      description: dto.description ?? null,
      methodology: dto.methodology ?? 'KAIZEN',
      priority: dto.priority ?? 'MEDIUM',
      area: dto.area ?? null,
      programId: dto.programId ?? null,
      ownerEmail: dto.ownerEmail ?? this.tenantCtx.getUserEmail(),
      estimatedSavings: dto.estimatedSavings ?? 0,
      actualSavings: 0,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      status: 'DRAFT',
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('IMPROVEMENT_INITIATIVE_CREATED', saved, {
      after: saved,
    });
    return saved;
  }

  async list(filters: ListFilters = {}): Promise<ImprovementInitiative[]> {
    const qb = this.repo
      .createQueryBuilder('ini')
      .orderBy('ini.created_at', 'DESC');
    this.applyScope(qb, 'ini');
    if (filters.status) qb.andWhere('ini.status = :s', { s: filters.status });
    if (filters.methodology)
      qb.andWhere('ini.methodology = :m', { m: filters.methodology });
    if (filters.area) qb.andWhere('ini.area = :a', { a: filters.area });
    if (filters.programId)
      qb.andWhere('ini.program_id = :p', { p: filters.programId });
    return qb.getMany();
  }

  async getOne(id: string): Promise<ImprovementInitiative> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Iniciativa no encontrada.');
    return found;
  }

  async update(
    id: string,
    dto: UpdateInitiativeDto,
  ): Promise<ImprovementInitiative> {
    const ini = await this.getOne(id);
    const before = { ...ini };
    Object.assign(ini, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.methodology !== undefined && { methodology: dto.methodology }),
      ...(dto.priority !== undefined && { priority: dto.priority }),
      ...(dto.area !== undefined && { area: dto.area }),
      ...(dto.programId !== undefined && { programId: dto.programId }),
      ...(dto.ownerEmail !== undefined && { ownerEmail: dto.ownerEmail }),
      ...(dto.estimatedSavings !== undefined && {
        estimatedSavings: dto.estimatedSavings,
      }),
      ...(dto.actualSavings !== undefined && {
        actualSavings: dto.actualSavings,
      }),
      ...(dto.currency !== undefined && {
        currency: dto.currency.toUpperCase(),
      }),
    });
    const saved = await this.repo.save(ini);
    await this.recordLedger('IMPROVEMENT_INITIATIVE_UPDATED', saved, {
      before,
      after: saved,
    });
    return saved;
  }

  async transition(
    id: string,
    dto: TransitionInitiativeDto,
  ): Promise<ImprovementInitiative> {
    const ini = await this.getOne(id);
    const from = ini.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const now = new Date();
    ini.status = dto.status;
    if (dto.status === 'IN_PROGRESS' && !ini.startedAt) ini.startedAt = now;
    if (dto.status === 'IMPLEMENTED') ini.implementedAt = now;
    if (dto.status === 'VERIFIED') {
      ini.verifiedAt = now;
      if (dto.actualSavings !== undefined) ini.actualSavings = dto.actualSavings;
    }
    if (dto.status === 'CLOSED') ini.closedAt = now;

    const saved = await this.repo.save(ini);
    await this.recordLedger('IMPROVEMENT_INITIATIVE_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<InitiativeKpis> {
    const all = await this.list();
    const byStatus = {
      DRAFT: 0,
      IN_PROGRESS: 0,
      IMPLEMENTED: 0,
      VERIFIED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    } as Record<InitiativeStatus, number>;
    let estimatedSavings = 0;
    let realizedSavings = 0;
    let currency = 'USD';

    for (const i of all) {
      byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
      // Estimated counts for non-cancelled work; realized counts once verified.
      if (i.status !== 'CANCELLED') {
        estimatedSavings += Number(i.estimatedSavings ?? 0);
      }
      if (i.status === 'VERIFIED' || i.status === 'CLOSED') {
        realizedSavings += Number(i.actualSavings ?? 0);
      }
      if (i.currency) currency = i.currency;
    }

    return {
      total: all.length,
      byStatus,
      inProgress: byStatus.IN_PROGRESS,
      implemented: byStatus.IMPLEMENTED + byStatus.VERIFIED + byStatus.CLOSED,
      estimatedSavings,
      realizedSavings,
      currency,
    };
  }

  private async recordLedger(
    action: string,
    ini: ImprovementInitiative,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'IMPROVEMENT_INITIATIVE',
        referenceId: ini.id,
        program: ini.programId ?? undefined,
        plant: ini.plant_id ?? undefined,
        metadata: {
          folio: ini.folio,
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
