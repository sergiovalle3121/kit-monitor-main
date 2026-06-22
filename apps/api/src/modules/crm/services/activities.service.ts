import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmActivity } from '../entities/crm-activity.entity';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { applyCrmScope, crmScopeStamp } from './crm-scope';
import { CreateActivityDto, UpdateActivityDto } from '../dto/activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectRepository(CrmActivity)
    private readonly repo: Repository<CrmActivity>,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async create(dto: CreateActivityDto): Promise<CrmActivity> {
    const isTask = dto.type === 'TASK';
    const entity = this.repo.create({
      account_id: dto.accountId ?? null,
      contactId: dto.contactId ?? null,
      opportunityId: dto.opportunityId ?? null,
      quoteId: dto.quoteId ?? null,
      type: dto.type ?? 'NOTE',
      subject: dto.subject,
      body: dto.body ?? null,
      direction: dto.direction ?? null,
      // Tasks start OPEN; logged interactions (calls/notes) are DONE on capture.
      status: dto.status ?? (isTask ? 'OPEN' : 'DONE'),
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      completedAt: isTask ? null : new Date(),
      ownerEmail: dto.ownerEmail ?? this.tenantCtx.getUserEmail(),
      outcome: dto.outcome ?? null,
      ...crmScopeStamp(this.tenantCtx),
    });
    return this.repo.save(entity);
  }

  async list(filters: {
    accountId?: string;
    opportunityId?: string;
    status?: string;
    type?: string;
    limit?: number;
  } = {}): Promise<CrmActivity[]> {
    const qb = applyCrmScope(this.repo.createQueryBuilder('a'), 'a', this.tenantCtx)
      .orderBy('a.created_at', 'DESC')
      .limit(Math.min(filters.limit ?? 100, 300));
    if (filters.accountId) qb.andWhere('a.account_id = :acc', { acc: filters.accountId });
    if (filters.opportunityId) qb.andWhere('a.opportunity_id = :opp', { opp: filters.opportunityId });
    if (filters.status) qb.andWhere('a.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('a.type = :t', { t: filters.type });
    return qb.getMany();
  }

  /** Open tasks for the current user — the "my next actions" worklist. */
  async myTasks(): Promise<CrmActivity[]> {
    const email = this.tenantCtx.getUserEmail();
    const qb = applyCrmScope(this.repo.createQueryBuilder('a'), 'a', this.tenantCtx)
      .andWhere('a.status = :s', { s: 'OPEN' })
      .orderBy('a.due_at', 'ASC');
    if (email) qb.andWhere('a.owner_email = :e', { e: email });
    return qb.getMany();
  }

  async update(id: string, dto: UpdateActivityDto): Promise<CrmActivity> {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Actividad no encontrada.');
    if (dto.subject !== undefined) a.subject = dto.subject;
    if (dto.body !== undefined) a.body = dto.body;
    if (dto.outcome !== undefined) a.outcome = dto.outcome;
    if (dto.dueAt !== undefined) a.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.status !== undefined) {
      a.status = dto.status;
      a.completedAt = dto.status === 'DONE' ? new Date() : a.completedAt;
    }
    return this.repo.save(a);
  }

  async complete(id: string, outcome?: string): Promise<CrmActivity> {
    return this.update(id, { status: 'DONE', outcome });
  }
}
