import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Certification } from './entities/certification.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  CreateCertificationDto,
  UpdateCertificationDto,
} from './dto/people.dto';
import { certStatus, CertStatus, daysToExpiry } from './cert-status';

export type SerializedCertification = Certification & {
  status: CertStatus;
  daysToExpiry: number | null;
};

export interface PeopleKpis {
  total: number;
  valid: number;
  expiring30: number;
  expiring60: number;
  expiring90: number;
  expired: number;
  employees: number;
  skills: number;
  coverage: { skill: string; count: number }[];
}

@Injectable()
export class PeopleService {
  private readonly logger = new Logger(PeopleService.name);

  constructor(
    @InjectRepository(Certification)
    private readonly repo: Repository<Certification>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<Certification>,
    alias: string,
  ): SelectQueryBuilder<Certification> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private serialize(c: Certification): SerializedCertification {
    return {
      ...c,
      status: c.active ? certStatus(c.expiresDate) : 'EXPIRED',
      daysToExpiry: daysToExpiry(c.expiresDate),
    };
  }

  async create(dto: CreateCertificationDto): Promise<SerializedCertification> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('CERTIFICATION');
    } catch (err) {
      this.logger.warn(`Folio allocation failed: ${(err as Error)?.message}`);
    }

    const entity = this.repo.create({
      folio,
      employeeName: dto.employeeName,
      employeeEmail: dto.employeeEmail ?? null,
      skill: dto.skill,
      area: dto.area ?? null,
      station: dto.station ?? null,
      certifiedBy: dto.certifiedBy ?? this.tenantCtx.getUserEmail(),
      active: true,
      issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : new Date(),
      expiresDate: dto.expiresDate ? new Date(dto.expiresDate) : null,
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    });
    const saved = await this.repo.save(entity);
    if (this.ledger) {
      try {
        await this.ledger.recordEvent({
          actorName: this.tenantCtx.getUserEmail(),
          domain: EventDomain.SYSTEM,
          action: 'CERTIFICATION_CREATED',
          referenceType: 'CERTIFICATION',
          referenceId: saved.id,
          plant: saved.plant_id ?? undefined,
          metadata: { employee: saved.employeeName, skill: saved.skill },
        });
      } catch (err) {
        this.logger.warn(`Ledger write skipped: ${(err as Error)?.message}`);
      }
    }
    return this.serialize(saved);
  }

  async list(filters: {
    skill?: string;
    employeeName?: string;
    area?: string;
  } = {}): Promise<SerializedCertification[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .orderBy('c.expires_date', 'ASC');
    this.applyScope(qb, 'c');
    if (filters.skill) qb.andWhere('c.skill = :s', { s: filters.skill });
    if (filters.employeeName)
      qb.andWhere('c.employee_name = :e', { e: filters.employeeName });
    if (filters.area) qb.andWhere('c.area = :a', { a: filters.area });
    const rows = await qb.getMany();
    return rows.map((c) => this.serialize(c));
  }

  async getOne(id: string): Promise<SerializedCertification> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('Certificación no encontrada.');
    return this.serialize(found);
  }

  async update(
    id: string,
    dto: UpdateCertificationDto,
  ): Promise<SerializedCertification> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Certificación no encontrada.');
    Object.assign(c, {
      ...(dto.skill !== undefined && { skill: dto.skill }),
      ...(dto.area !== undefined && { area: dto.area }),
      ...(dto.station !== undefined && { station: dto.station }),
      ...(dto.certifiedBy !== undefined && { certifiedBy: dto.certifiedBy }),
      ...(dto.active !== undefined && { active: dto.active }),
      ...(dto.issuedDate !== undefined && {
        issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
      }),
      ...(dto.expiresDate !== undefined && {
        expiresDate: dto.expiresDate ? new Date(dto.expiresDate) : null,
      }),
    });
    const saved = await this.repo.save(c);
    return this.serialize(saved);
  }

  async kpis(): Promise<PeopleKpis> {
    const all = await this.list();
    let valid = 0;
    let expiring30 = 0;
    let expiring60 = 0;
    let expiring90 = 0;
    let expired = 0;
    const employees = new Set<string>();
    const skillCounts = new Map<string, number>();

    for (const c of all) {
      employees.add(c.employeeName);
      skillCounts.set(c.skill, (skillCounts.get(c.skill) ?? 0) + 1);

      if (c.status === 'EXPIRED') {
        expired += 1;
        continue;
      }
      // Not expired (VALID / EXPIRING / NO_EXPIRY) counts as currently valid.
      valid += 1;
      const d = c.daysToExpiry;
      if (d !== null) {
        if (d <= 30) expiring30 += 1;
        else if (d <= 60) expiring60 += 1;
        else if (d <= 90) expiring90 += 1;
      }
    }

    const coverage = [...skillCounts.entries()]
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return {
      total: all.length,
      valid,
      expiring30,
      expiring60,
      expiring90,
      expired,
      employees: employees.size,
      skills: skillCounts.size,
      coverage,
    };
  }
}
