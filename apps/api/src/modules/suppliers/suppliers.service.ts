import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR, ScarStatus } from './entities/scar.entity';
import { SupplierContact } from './entities/supplier-contact.entity';
import { SupplierCertification } from './entities/supplier-certification.entity';
import { ErpSupplierPrice } from '../erp-core/entities/erp-supplier-price.entity';
import { IQCInspection, IqcResult } from '../quality/entities/iqc-inspection.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

/** Days-to-expiry threshold under which a certification is flagged EXPIRING. */
const CERT_EXPIRING_DAYS = 90;

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SCAR)
    private readonly scarRepo: Repository<SCAR>,
    @InjectRepository(IQCInspection)
    private readonly iqcRepo: Repository<IQCInspection>,
    @InjectRepository(SupplierContact)
    private readonly contactRepo: Repository<SupplierContact>,
    @InjectRepository(SupplierCertification)
    private readonly certRepo: Repository<SupplierCertification>,
    @InjectRepository(ErpSupplierPrice)
    private readonly priceRepo: Repository<ErpSupplierPrice>,
    private readonly eventLedger: EventLedgerService,
  ) {}

  async findAll(
    filters: { q?: string; qualification?: string; type?: string; status?: string } = {},
  ): Promise<Supplier[]> {
    const qb = this.supplierRepo.createQueryBuilder('s').orderBy('s.name', 'ASC');
    if (filters.qualification) qb.andWhere('s.qualification_status = :qz', { qz: filters.qualification });
    if (filters.type) qb.andWhere('s.type = :ty', { ty: filters.type });
    if (filters.status) qb.andWhere('s.status = :st', { st: filters.status });
    if (filters.q) {
      qb.andWhere(
        '(LOWER(s.name) LIKE :q OR LOWER(s.code) LIKE :q OR LOWER(s.commodity) LIKE :q OR LOWER(s.country) LIKE :q)',
        { q: `%${filters.q.toLowerCase()}%` },
      );
    }
    return qb.getMany();
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

  async update(id: number, dto: Partial<Supplier>): Promise<Supplier> {
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
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
          const diff = s.closedAt!.getTime() - s.createdAt.getTime();
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
    const scorecards: any[] = [];
    for (const s of suppliers) {
      scorecards.push(await this.getScorecard(s.id));
    }
    return scorecards;
  }

  // --- SUPPLIER 360 + KPIs ---

  /** Derive a certification status from its expiry date. */
  private certStatus(expiresAt?: Date | null): string {
    if (!expiresAt) return 'VALID';
    const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
    if (days < 0) return 'EXPIRED';
    if (days <= CERT_EXPIRING_DAYS) return 'EXPIRING';
    return 'VALID';
  }

  private async certsForSupplier(supplierId: number): Promise<SupplierCertification[]> {
    const certs = await this.certRepo.find({ where: { supplierId }, order: { expiresAt: 'ASC' } });
    return certs.map((c) => ({ ...c, status: c.status === 'REVOKED' ? 'REVOKED' : this.certStatus(c.expiresAt) }));
  }

  /** The Supplier-360: master + scorecard + contacts + certs + parts (AVL) + SCARs. */
  async supplier360(id: number): Promise<any> {
    const card = await this.getScorecard(id);
    const supplier = card.supplier as Supplier;
    const [contacts, certifications, parts, scars] = await Promise.all([
      this.contactRepo.find({ where: { supplierId: id }, order: { isPrimary: 'DESC', name: 'ASC' } }),
      this.certsForSupplier(id),
      this.priceRepo.find({ where: { supplierId: id }, order: { preferred: 'DESC', partNumber: 'ASC' } }),
      this.scarRepo.find({ where: { supplier: { id } }, order: { createdAt: 'DESC' } }),
    ]);
    const expiringCerts = certifications.filter((c) => c.status === 'EXPIRING' || c.status === 'EXPIRED').length;
    return {
      supplier,
      scorecard: card.scorecard,
      metrics: {
        ...card.metrics,
        parts: parts.length,
        certifications: certifications.length,
        expiringCerts,
        contacts: contacts.length,
        otdPct: supplier.otdPct ?? null,
        ppm: supplier.ppm ?? null,
      },
      contacts,
      certifications,
      parts,
      scars,
    };
  }

  async kpis(): Promise<any> {
    const all = await this.findAll();
    const byQual: Record<string, number> = {};
    let atRisk = 0;
    let singleSource = 0;
    let otdSum = 0;
    let otdN = 0;
    let ppmSum = 0;
    let ppmN = 0;
    for (const s of all) {
      const q = s.qualificationStatus || 'PENDING';
      byQual[q] = (byQual[q] ?? 0) + 1;
      if (s.riskLevel === 'HIGH' || (s.otdPct != null && s.otdPct < 90)) atRisk++;
      if (s.singleSource) singleSource++;
      if (s.otdPct != null) { otdSum += s.otdPct; otdN++; }
      if (s.ppm != null) { ppmSum += s.ppm; ppmN++; }
    }
    // Expiring/expired certs across the base.
    const certs = await this.certRepo.find();
    const expiringCerts = certs.filter((c) => {
      const st = c.status === 'REVOKED' ? 'REVOKED' : this.certStatus(c.expiresAt);
      return st === 'EXPIRING' || st === 'EXPIRED';
    }).length;
    const openScars = await this.scarRepo
      .createQueryBuilder('scar')
      .where('scar.status != :c', { c: ScarStatus.CLOSED })
      .getCount();
    return {
      total: all.length,
      approved: byQual['APPROVED'] ?? 0,
      conditional: byQual['CONDITIONAL'] ?? 0,
      pending: byQual['PENDING'] ?? 0,
      disqualified: byQual['DISQUALIFIED'] ?? 0,
      atRisk,
      singleSource,
      avgOtd: otdN ? Math.round((otdSum / otdN) * 10) / 10 : null,
      avgPpm: ppmN ? Math.round(ppmSum / ppmN) : null,
      expiringCerts,
      openScars,
      byQualification: byQual,
    };
  }

  // --- CONTACTS ---
  async listContacts(supplierId: number): Promise<SupplierContact[]> {
    return this.contactRepo.find({ where: { supplierId }, order: { isPrimary: 'DESC', name: 'ASC' } });
  }

  async addContact(dto: Partial<SupplierContact>): Promise<SupplierContact> {
    if (dto.isPrimary && dto.supplierId) {
      await this.contactRepo.createQueryBuilder().update(SupplierContact).set({ isPrimary: false }).where('supplier_id = :s', { s: dto.supplierId }).execute();
    }
    return this.contactRepo.save(this.contactRepo.create(dto));
  }

  async updateContact(id: number, dto: Partial<SupplierContact>): Promise<SupplierContact> {
    const c = await this.contactRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Contact not found');
    if (dto.isPrimary) {
      await this.contactRepo.createQueryBuilder().update(SupplierContact).set({ isPrimary: false }).where('supplier_id = :s', { s: c.supplierId }).execute();
    }
    Object.assign(c, dto);
    return this.contactRepo.save(c);
  }

  async removeContact(id: number): Promise<{ ok: true }> {
    await this.contactRepo.delete(id);
    return { ok: true };
  }

  // --- CERTIFICATIONS ---
  async addCertification(dto: Partial<SupplierCertification>): Promise<SupplierCertification> {
    const entity = this.certRepo.create({
      ...dto,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
    entity.status = this.certStatus(entity.expiresAt);
    return this.certRepo.save(entity);
  }

  async removeCertification(id: number): Promise<{ ok: true }> {
    await this.certRepo.delete(id);
    return { ok: true };
  }
}
