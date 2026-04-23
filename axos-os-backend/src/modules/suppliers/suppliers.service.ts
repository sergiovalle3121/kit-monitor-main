import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR, ScarStatus } from './entities/scar.entity';
import { IQCInspection, IqcResult } from '../quality/entities/iqc-inspection.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SCAR)
    private readonly scarRepo: Repository<SCAR>,
    @InjectRepository(IQCInspection)
    private readonly iqcRepo: Repository<IQCInspection>,
    private readonly eventLedger: EventLedgerService,
  ) {}

  async findAll(): Promise<Supplier[]> {
    return this.supplierRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(dto: Partial<Supplier>): Promise<Supplier> {
    const supplier = this.supplierRepo.create(dto);
    return this.supplierRepo.save(supplier);
  }

  // --- SCAR ENGINE ---

  async findScars(filters: any): Promise<SCAR[]> {
    const qb = this.scarRepo.createQueryBuilder('scar')
      .leftJoinAndSelect('scar.supplier', 'supplier')
      .leftJoinAndSelect('scar.iqcInspection', 'iqc');

    if (filters.supplierId) qb.andWhere('supplier.id = :sid', { sid: filters.supplierId });
    if (filters.status) qb.andWhere('scar.status = :status', { status: filters.status });

    qb.orderBy('scar.createdAt', 'DESC');
    return qb.getMany();
  }

  async createScar(dto: Partial<SCAR>): Promise<SCAR> {
    const count = await this.scarRepo.count();
    const year = new Date().getFullYear();
    const scarNumber = `SCAR-${year}-${(count + 1).toString().padStart(4, '0')}`;

    const scar = this.scarRepo.create({
      ...dto,
      scarNumber,
      status: ScarStatus.OPEN
    });
    const saved = await this.scarRepo.save(scar);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'SCAR_CREATED',
      actorName: dto.createdBy || 'QA System',
      referenceType: 'SCAR',
      referenceId: saved.id.toString(),
      metadata: { scarNumber: saved.scarNumber, supplierId: dto.supplier?.id }
    });

    return saved;
  }

  async updateScar(id: number, dto: Partial<SCAR>, actor: string): Promise<SCAR> {
    const scar = await this.scarRepo.findOne({ where: { id } });
    if (!scar) throw new NotFoundException('SCAR not found');

    Object.assign(scar, dto);
    const updated = await this.scarRepo.save(scar);

    await this.eventLedger.recordEvent({
      domain: EventDomain.QUALITY,
      action: 'SCAR_UPDATED',
      actorName: actor,
      referenceType: 'SCAR',
      referenceId: id.toString(),
      metadata: { status: updated.status }
    });

    return updated;
  }

  // --- SCORECARD ENGINE ---

  async getScorecard(supplierId: number): Promise<any> {
    const supplier = await this.findOne(supplierId);
    
    // IQC Metrics
    const inspections = await this.iqcRepo.find({ 
      where: { supplier: { id: supplierId } } 
    });
    const totalIqc = inspections.length;
    const passedIqc = inspections.filter(i => i.result === IqcResult.PASS).length;
    const passRate = totalIqc > 0 ? (passedIqc / totalIqc) * 100 : 100;

    // SCAR Metrics
    const scars = await this.scarRepo.find({ 
      where: { supplier: { id: supplierId } } 
    });
    const openScars = scars.filter(s => s.status !== ScarStatus.CLOSED).length;
    const closedScars = scars.filter(s => s.status === ScarStatus.CLOSED).length;
    
    // Average Closure Time (Mock logic for now, using createdAt/closedAt)
    let avgClosureDays = 0;
    if (closedScars > 0) {
      const totalDays = scars
        .filter(s => s.status === ScarStatus.CLOSED && s.closedAt)
        .reduce((acc, s) => {
          const diff = s.closedAt.getTime() - s.createdAt.getTime();
          return acc + (diff / (1000 * 60 * 60 * 24));
        }, 0);
      avgClosureDays = totalDays / closedScars;
    }

    // Risk Level Calculation
    let riskLevel = 'Normal';
    if (passRate < 90 || openScars > 2) riskLevel = 'Major';
    if (passRate < 80 || openScars > 5) riskLevel = 'Critical';

    return {
      supplier,
      metrics: {
        iqc: {
          total: totalIqc,
          passed: passedIqc,
          passRate: Math.round(passRate),
          failed: totalIqc - passedIqc
        },
        scars: {
          total: scars.length,
          open: openScars,
          closed: closedScars,
          avgClosureDays: Math.round(avgClosureDays)
        }
      },
      scorecard: {
        qualityScore: Math.round(passRate),
        responseScore: scars.length > 0 ? Math.round((closedScars / scars.length) * 100) : 100,
        riskLevel,
        trend: 'stable' // Hardcoded for foundation
      }
    };
  }

  async getAllScorecards(): Promise<any[]> {
    const suppliers = await this.findAll();
    const scorecards = [];
    for (const s of suppliers) {
      scorecards.push(await this.getScorecard(s.id));
    }
    return scorecards;
  }
}
