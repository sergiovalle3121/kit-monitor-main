import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NCR, NcrStatus } from './entities/ncr.entity';
import { CreateNcrDto } from './dto/ncr.dto';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { AuditService } from '../governance/audit.service';
import { ExceptionSeverity, ExceptionDomain } from '../governance/entities/operational-exception.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class NcrService {
  constructor(
    @InjectRepository(NCR)
    private readonly ncrRepo: Repository<NCR>,
    private readonly eventLedger: EventLedgerService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll(filters: {
    partNumber?: string;
    status?: string;
    workOrder?: string;
    severity?: string;
    sourceType?: string;
  }): Promise<NCR[]> {
    const qb = this.ncrRepo
      .createQueryBuilder('ncr')
      .leftJoinAndSelect('ncr.hold', 'hold')
      .leftJoinAndSelect('ncr.quarantineTransfer', 'transfer');

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('ncr.tenant_id = :tenantId', { tenantId });

    if (filters.partNumber) qb.andWhere('ncr.partNumber = :pn', { pn: filters.partNumber });
    if (filters.status) qb.andWhere('ncr.status = :status', { status: filters.status });
    if (filters.workOrder) qb.andWhere('ncr.workOrder = :wo', { wo: filters.workOrder });
    if (filters.severity) qb.andWhere('ncr.severity = :sev', { sev: filters.severity });
    if (filters.sourceType) qb.andWhere('ncr.sourceType = :src', { src: filters.sourceType });

    return qb.orderBy('ncr.createdAt', 'DESC').getMany();
  }

  async findOne(id: number): Promise<NCR> {
    const tenantId = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { id };
    if (tenantId) where['tenant_id'] = tenantId;

    const ncr = await this.ncrRepo.findOne({
      where: where as any,
      relations: ['hold', 'quarantineTransfer'],
    });
    if (!ncr) throw new NotFoundException('NCR not found');
    return ncr;
  }

  async create(dto: CreateNcrDto): Promise<NCR> {
    const count = await this.ncrRepo.count();
    const year = new Date().getFullYear();
    const ncrNumber = `NCR-${year}-${(count + 1).toString().padStart(4, '0')}`;
    const actor = this.tenantContext.getUserEmail();

    const ncr = this.ncrRepo.create({
      ...dto,
      ncrNumber,
      status: NcrStatus.OPEN,
      createdBy: actor,
      tenant_id: this.tenantContext.getTenantId(),
      organization_id: this.tenantContext.getOrganizationId(),
      plant_id: this.tenantContext.getPlantId(),
    });
    const saved = await this.ncrRepo.save(ncr);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'NCR_CREATED',
      actorName: actor,
      referenceType: 'NCR',
      referenceId: saved.id.toString(),
      metadata: { ncrNumber: saved.ncrNumber, partNumber: saved.partNumber },
    });

    await this.audit.recordException({
      severity: ExceptionSeverity.HIGH,
      domain: ExceptionDomain.QUALITY,
      title: `NCR Reported: ${saved.ncrNumber}`,
      description: `Non-Conformance for ${saved.partNumber}. Category: ${saved.category}. Reported by ${actor}`,
      actor,
      resourceType: 'NCR',
      resourceId: saved.id.toString(),
      metadata: { ncrNumber: saved.ncrNumber, partNumber: saved.partNumber, buildingId: saved.building },
    });

    return saved;
  }

  async updateStatus(id: number, status: NcrStatus, dispositionNotes?: string): Promise<NCR> {
    const ncr = await this.findOne(id);
    ncr.status = status;
    if (dispositionNotes) ncr.dispositionNotes = dispositionNotes;
    const updated = await this.ncrRepo.save(ncr);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: `NCR_STATUS_${status.toUpperCase()}`,
      actorName: this.tenantContext.getUserEmail(),
      referenceType: 'NCR',
      referenceId: id.toString(),
      metadata: { ncrNumber: ncr.ncrNumber, newStatus: status },
    });

    return updated;
  }
}
