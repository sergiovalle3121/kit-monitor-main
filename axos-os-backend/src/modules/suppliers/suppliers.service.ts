import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR, ScarStatus } from './entities/scar.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SCAR)
    private readonly scarRepo: Repository<SCAR>,
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
}
