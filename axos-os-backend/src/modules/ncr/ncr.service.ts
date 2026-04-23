import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NCR, NcrStatus } from './entities/ncr.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { AuditService } from '../governance/audit.service';
import { ExceptionSeverity, ExceptionDomain } from '../governance/entities/operational-exception.entity';

@Injectable()
export class NcrService {
  constructor(
    @InjectRepository(NCR)
    private readonly ncrRepo: Repository<NCR>,
    private readonly eventLedger: EventLedgerService,
    private readonly audit: AuditService,
  ) {}

  async findAll(filters: any): Promise<NCR[]> {
    const qb = this.ncrRepo.createQueryBuilder('ncr')
      .leftJoinAndSelect('ncr.hold', 'hold')
      .leftJoinAndSelect('ncr.quarantineTransfer', 'transfer');

    if (filters.partNumber) qb.andWhere('ncr.partNumber = :pn', { pn: filters.partNumber });
    if (filters.status) qb.andWhere('ncr.status = :status', { status: filters.status });
    if (filters.workOrder) qb.andWhere('ncr.workOrder = :wo', { wo: filters.workOrder });

    qb.orderBy('ncr.createdAt', 'DESC');
    return qb.getMany();
  }

  async findOne(id: number): Promise<NCR> {
    const ncr = await this.ncrRepo.findOne({ 
      where: { id },
      relations: ['hold', 'quarantineTransfer']
    });
    if (!ncr) throw new NotFoundException('NCR not found');
    return ncr;
  }

  async create(dto: Partial<NCR>): Promise<NCR> {
    const count = await this.ncrRepo.count();
    const year = new Date().getFullYear();
    const ncrNumber = `NCR-${year}-${(count + 1).toString().padStart(4, '0')}`;

    const ncr = this.ncrRepo.create({
      ...dto,
      ncrNumber,
      status: NcrStatus.OPEN
    });
    const saved = await this.ncrRepo.save(ncr);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'NCR_CREATED',
      actorName: dto.createdBy || 'QA System',
      referenceType: 'NCR',
      referenceId: saved.id.toString(),
      metadata: { ncrNumber: saved.ncrNumber, partNumber: saved.partNumber }
    });

    // AUTOMATION: Create Operational Exception for Quality NCR
    await this.audit.recordException({
      severity: ExceptionSeverity.HIGH,
      domain: ExceptionDomain.QUALITY,
      title: `NCR Reported: ${saved.ncrNumber}`,
      description: `Non-Conformance Report for ${saved.partNumber}. Category: ${saved.category || 'General'}. Reported by ${saved.createdBy}`,
      actor: saved.createdBy,
      resourceType: 'NCR',
      resourceId: saved.id.toString(),
      metadata: { ncrNumber: saved.ncrNumber, partNumber: saved.partNumber, buildingId: saved.building }
    });

    return saved;
  }

  async updateStatus(id: number, status: NcrStatus, actor: string): Promise<NCR> {
    const ncr = await this.findOne(id);
    ncr.status = status;
    const updated = await this.ncrRepo.save(ncr);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: `NCR_STATUS_${status.toUpperCase()}`,
      actorName: actor,
      referenceType: 'NCR',
      referenceId: id.toString(),
      metadata: { ncrNumber: ncr.ncrNumber }
    });

    return updated;
  }
}
