import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { RmaCase } from './entities/rma-case.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateRmaDto, TransitionRmaDto } from './dto/rma.dto';
import { assertTransition, RmaStatus } from './rma-state';

export interface RmaKpis {
  total: number;
  open: number;
  investigating: number;
  closed: number;
  avgCloseDays: number | null;
  byDisposition: Record<string, number>;
}

const DAY = 86_400_000;

@Injectable()
export class RmaService {
  private readonly logger = new Logger(RmaService.name);

  constructor(
    @Inject(getTenantRepositoryToken(RmaCase))
    private readonly repo: TenantScopedRepository<RmaCase>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<RmaCase>,
    alias: string,
  ): SelectQueryBuilder<RmaCase> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  async create(dto: CreateRmaDto): Promise<RmaCase> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('RMA');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      customerName: dto.customerName ?? null,
      partNumber: dto.partNumber ?? null,
      serialNumber: dto.serialNumber ?? null,
      failureDescription: dto.failureDescription,
      severity: dto.severity ?? 'MEDIUM',
      status: 'OPEN',
      quantity: dto.quantity ?? 1,
      programId: dto.programId ?? null,
      openedAt: new Date(),
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    await this.recordLedger('RMA_OPENED', saved, { after: saved });
    return saved;
  }

  async list(filters: { status?: string; customerName?: string } = {}): Promise<
    RmaCase[]
  > {
    const qb = this.repo.createQueryBuilder('r').orderBy('r.created_at', 'DESC');
    this.applyScope(qb, 'r');
    if (filters.status) qb.andWhere('r.status = :s', { s: filters.status });
    if (filters.customerName)
      qb.andWhere('r.customer_name = :cn', { cn: filters.customerName });
    return qb.getMany();
  }

  async getOne(id: string): Promise<RmaCase> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('RMA no encontrado.');
    return found;
  }

  async transition(id: string, dto: TransitionRmaDto): Promise<RmaCase> {
    const r = await this.getOne(id);
    const from = r.status;
    try {
      assertTransition(from, dto.status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (dto.rootCause !== undefined) r.rootCause = dto.rootCause;
    if (dto.status === 'DISPOSITION') {
      if (!dto.disposition) {
        throw new BadRequestException(
          'Se requiere una disposición (REPAIR/REPLACE/CREDIT/REJECT).',
        );
      }
      r.disposition = dto.disposition;
    }
    r.status = dto.status;
    if (dto.status === 'CLOSED') r.closedAt = new Date();

    const saved = await this.repo.save(r);
    await this.recordLedger('RMA_TRANSITIONED', saved, {
      before: { status: from },
      after: { status: dto.status },
    });
    return saved;
  }

  async kpis(): Promise<RmaKpis> {
    const all = await this.list();
    let open = 0;
    let investigating = 0;
    let closed = 0;
    let closeDaysSum = 0;
    let closeCount = 0;
    const byDisposition: Record<string, number> = {};

    for (const r of all) {
      if (r.status === 'OPEN') open += 1;
      if (r.status === 'INVESTIGATING' || r.status === 'DISPOSITION')
        investigating += 1;
      if (r.status === 'CLOSED') {
        closed += 1;
        if (r.openedAt && r.closedAt) {
          const days =
            (new Date(r.closedAt).getTime() - new Date(r.openedAt).getTime()) /
            DAY;
          if (days >= 0) {
            closeDaysSum += days;
            closeCount += 1;
          }
        }
      }
      if (r.disposition) {
        byDisposition[r.disposition] = (byDisposition[r.disposition] ?? 0) + 1;
      }
    }

    return {
      total: all.length,
      open,
      investigating,
      closed,
      avgCloseDays:
        closeCount > 0 ? Math.round((closeDaysSum / closeCount) * 10) / 10 : null,
      byDisposition,
    };
  }

  private async recordLedger(
    action: string,
    r: RmaCase,
    states: { before?: unknown; after?: unknown },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.QUALITY,
        action,
        referenceType: 'RMA',
        referenceId: r.id,
        program: r.programId ?? undefined,
        plant: r.plant_id ?? undefined,
        context: { serial: r.serialNumber ?? undefined },
        metadata: {
          folio: r.folio,
          customer: r.customerName,
          partNumber: r.partNumber,
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
