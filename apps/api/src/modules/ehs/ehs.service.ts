import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { SafetyIncident } from './entities/safety-incident.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateIncidentDto,
  TransitionIncidentDto,
  UpdateIncidentDto,
} from './dto/ehs.dto';
import { assertTransition, IncidentStatus } from './incident-state';

const RECORDABLE_TYPES = ['RECORDABLE', 'LOST_TIME'];

export interface EhsKpis {
  total: number;
  open: number;
  recordableCount: number;
  lostTimeCount: number;
  nearMissCount: number;
  totalLostDays: number;
  daysSinceLastRecordable: number | null;
  byStatus: Record<IncidentStatus, number>;
}

interface ListFilters {
  status?: string;
  type?: string;
  severity?: string;
  area?: string;
  programId?: string;
}

@Injectable()
export class EhsService {
  private readonly logger = new Logger(EhsService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SafetyIncident))
    private readonly repo: TenantScopedRepository<SafetyIncident>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<SafetyIncident>,
    alias: string,
  ): SelectQueryBuilder<SafetyIncident> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateIncidentDto): Promise<SafetyIncident> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('EHS_INCIDENT');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      title: dto.title,
      description: dto.description ?? null,
      type: dto.type ?? 'NEAR_MISS',
      severity: dto.severity ?? 'LOW',
      status: 'REPORTED',
      area: dto.area ?? null,
      location: dto.location ?? null,
      programId: dto.programId ?? null,
      reportedBy: this.tenantCtx.getUserEmail(),
      injuredPerson: dto.injuredPerson ?? null,
      lostDays: 0,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('SAFETY_INCIDENT_REPORTED', saved, { after: saved });
    return saved;
  }

  async list(filters: ListFilters = {}): Promise<SafetyIncident[]> {
    const qb = this.repo
      .createQueryBuilder('inc')
      .orderBy('inc.created_at', 'DESC');
    this.applyScope(qb, 'inc');
    if (filters.status) qb.andWhere('inc.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('inc.type = :t', { t: filters.type });
    if (filters.severity)
      qb.andWhere('inc.severity = :sev', { sev: filters.severity });
    if (filters.area) qb.andWhere('inc.area = :a', { a: filters.area });
    if (filters.programId)
      qb.andWhere('inc.program_id = :p', { p: filters.programId });
    return qb.getMany();
  }

  async getOne(id: string): Promise<SafetyIncident> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Incidente no encontrado.');
    return found;
  }

  async update(id: string, dto: UpdateIncidentDto): Promise<SafetyIncident> {
    const inc = await this.getOne(id);
    const before = { ...inc };
    Object.assign(inc, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.severity !== undefined && { severity: dto.severity }),
      ...(dto.area !== undefined && { area: dto.area }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.programId !== undefined && { programId: dto.programId }),
      ...(dto.injuredPerson !== undefined && {
        injuredPerson: dto.injuredPerson,
      }),
      ...(dto.lostDays !== undefined && { lostDays: dto.lostDays }),
      ...(dto.rootCause !== undefined && { rootCause: dto.rootCause }),
      ...(dto.correctiveAction !== undefined && {
        correctiveAction: dto.correctiveAction,
      }),
    });
    const saved = await this.repo.save(inc);
    await this.recordLedger('SAFETY_INCIDENT_UPDATED', saved, {
      before,
      after: saved,
    });
    return saved;
  }

  async transition(
    id: string,
    dto: TransitionIncidentDto,
  ): Promise<SafetyIncident> {
    const inc = await this.getOne(id);
    const from = inc.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    const now = new Date();
    inc.status = dto.status;
    if (dto.rootCause !== undefined) inc.rootCause = dto.rootCause;
    if (dto.correctiveAction !== undefined)
      inc.correctiveAction = dto.correctiveAction;
    if (dto.lostDays !== undefined) inc.lostDays = dto.lostDays;
    if (dto.status === 'INVESTIGATING' && !inc.investigatedAt)
      inc.investigatedAt = now;
    if (dto.status === 'CLOSED') inc.closedAt = now;

    const saved = await this.repo.save(inc);
    await this.recordLedger('SAFETY_INCIDENT_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<EhsKpis> {
    const all = await this.list();
    const byStatus = {
      REPORTED: 0,
      INVESTIGATING: 0,
      ACTION_PENDING: 0,
      CLOSED: 0,
      CANCELLED: 0,
    } as Record<IncidentStatus, number>;

    let open = 0;
    let recordableCount = 0;
    let lostTimeCount = 0;
    let nearMissCount = 0;
    let totalLostDays = 0;
    let lastRecordableTime: number | null = null;

    for (const i of all) {
      byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
      if (i.status !== 'CLOSED' && i.status !== 'CANCELLED') open += 1;
      if (RECORDABLE_TYPES.includes(i.type)) recordableCount += 1;
      if (i.type === 'LOST_TIME') lostTimeCount += 1;
      if (i.type === 'NEAR_MISS') nearMissCount += 1;
      totalLostDays += Number(i.lostDays ?? 0);

      if (RECORDABLE_TYPES.includes(i.type)) {
        const when = i.occurredAt ?? i.created_at;
        const t = when ? new Date(when).getTime() : null;
        if (t !== null && (lastRecordableTime === null || t > lastRecordableTime)) {
          lastRecordableTime = t;
        }
      }
    }

    const daysSinceLastRecordable =
      lastRecordableTime === null
        ? null
        : Math.max(
            0,
            Math.floor((Date.now() - lastRecordableTime) / 86_400_000),
          );

    return {
      total: all.length,
      open,
      recordableCount,
      lostTimeCount,
      nearMissCount,
      totalLostDays,
      daysSinceLastRecordable,
      byStatus,
    };
  }

  private async recordLedger(
    action: string,
    inc: SafetyIncident,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.SYSTEM,
        action,
        referenceType: 'SAFETY_INCIDENT',
        referenceId: inc.id,
        program: inc.programId ?? undefined,
        plant: inc.plant_id ?? undefined,
        metadata: {
          folio: inc.folio,
          type: inc.type,
          severity: inc.severity,
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
