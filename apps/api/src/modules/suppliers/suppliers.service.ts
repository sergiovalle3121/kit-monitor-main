import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { SCAR, ScarStatus } from './entities/scar.entity';
import { SupplierContact } from './entities/supplier-contact.entity';
import { SupplierCertification } from './entities/supplier-certification.entity';
import { SupplierApprovedPart } from './entities/supplier-approved-part.entity';
import { ErpSupplierPrice } from '../erp-core/entities/erp-supplier-price.entity';
import { IQCInspection, IqcResult } from '../quality/entities/iqc-inspection.entity';
import { PurchaseOrder } from '../procurement/entities/purchase-order.entity';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  computePpm, computeOtd, computeScarResponsiveness, ppmToScore, certScore,
  buildComposite, gradeFromScore, selectAndRankForPart, monthlyTrend,
  SCORECARD_WEIGHTS, type PpmResult, type OtdResult,
} from './scorecard-math';

/** Days-to-expiry threshold under which a certification is flagged EXPIRING. */
const CERT_EXPIRING_DAYS = 90;
/** Rolling window (days) for the derived PPM / OTD scorecard. */
const SCORECARD_WINDOW_DAYS = 365;

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
    @InjectRepository(SupplierApprovedPart)
    private readonly avlRepo: Repository<SupplierApprovedPart>,
    @InjectRepository(ErpSupplierPrice)
    private readonly priceRepo: Repository<ErpSupplierPrice>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
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

  /**
   * The list, enriched with the DERIVED scorecard (OTD, PPM, grade) and live
   * counts (open SCARs, expiring certs, AVL parts) so the table can rank by real
   * performance. Computed with a handful of batch queries — not N per row.
   */
  async findAllEnriched(
    filters: { q?: string; qualification?: string; type?: string; status?: string } = {},
  ): Promise<any[]> {
    const suppliers = await this.findAll(filters);
    if (!suppliers.length) return [];
    const now = new Date();
    const sinceMs = now.getTime() - SCORECARD_WINDOW_DAYS * 86_400_000;
    const [ppmMap, otdMap, scarMap, certMap, avlMap] = await Promise.all([
      this.ppmBySupplier(sinceMs),
      this.otdBySupplier(suppliers),
      this.scarBySupplier(),
      this.certBySupplier(),
      this.avlCountBySupplier(),
    ]);
    return suppliers.map((s) => {
      const ppm = ppmMap.get(s.id) ?? computePpm([], s.ppm ?? null);
      const otd = otdMap.get(s.id) ?? computeOtd([], s.otdPct ?? null);
      const scar = scarMap.get(s.id) ?? computeScarResponsiveness([]);
      const certs = certMap.get(s.id) ?? { valid: 0, expiring: 0, expired: 0, total: 0, score: null as number | null };
      const composite = buildComposite({
        otdScore: otd.otdPct,
        ppmScore: ppmToScore(ppm.ppm),
        scarScore: scar.onTimeRate,
        certScore: certs.score,
      });
      return {
        ...s,
        otdEff: otd.otdPct,
        otdSource: otd.source,
        ppmEff: ppm.ppm,
        ppmSource: ppm.source,
        grade: composite.grade,
        gradeColor: composite.color,
        composite: composite.composite,
        openScars: scar.open,
        expiringCerts: certs.expiring + certs.expired,
        avlParts: avlMap.get(s.id) ?? 0,
      };
    });
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

    // Stamp closure time when a SCAR transitions to CLOSED (feeds responsiveness).
    if (dto.status === ScarStatus.CLOSED && scar.status !== ScarStatus.CLOSED && !dto.closedAt && !scar.closedAt) {
      scar.closedAt = new Date();
    }
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

  // --- DERIVATION HELPERS (real records → honest metrics) ---

  /** Purchase orders attributable to a supplier (denormalized name / loose id / code). */
  private async ordersForSupplier(s: Supplier): Promise<PurchaseOrder[]> {
    const qb = this.poRepo.createQueryBuilder('po')
      .where('LOWER(po.supplierName) = LOWER(:name)', { name: s.name })
      .orWhere('po.supplierId = :idStr', { idStr: String(s.id) });
    if (s.code) qb.orWhere('LOWER(po.supplierId) = LOWER(:code)', { code: s.code });
    return qb.getMany();
  }

  /** Batch: Σ inspected / Σ defects per supplier within the window → PpmResult. */
  private async ppmBySupplier(sinceMs: number): Promise<Map<number, PpmResult>> {
    const rows = await this.iqcRepo.createQueryBuilder('iqc')
      .leftJoin('iqc.supplier', 's')
      .select('s.id', 'sid')
      .addSelect('SUM(iqc.sampleSize)', 'inspected')
      .addSelect('SUM(iqc.defectsFound)', 'defects')
      .addSelect('COUNT(*)', 'lots')
      .where('s.id IS NOT NULL')
      .andWhere('iqc.createdAt >= :since', { since: new Date(sinceMs) })
      .groupBy('s.id')
      .getRawMany<{ sid: number; inspected: string; defects: string; lots: string }>();
    const map = new Map<number, PpmResult>();
    for (const r of rows) {
      const inspected = Number(r.inspected ?? 0);
      const defects = Number(r.defects ?? 0);
      map.set(Number(r.sid), {
        ppm: inspected > 0 ? Math.round((defects / inspected) * 1_000_000) : null,
        inspected, defects, lots: Number(r.lots ?? 0),
        source: inspected > 0 ? 'derived' : 'none',
      });
    }
    return map;
  }

  /** Batch: OTD per supplier from received/closed POs that carry the dates. */
  private async otdBySupplier(suppliers: Supplier[]): Promise<Map<number, OtdResult>> {
    const byName = new Map<string, number>();
    const byKey = new Map<string, number>();
    for (const s of suppliers) {
      byName.set(s.name.toLowerCase(), s.id);
      byKey.set(String(s.id), s.id);
      if (s.code) byKey.set(s.code.toLowerCase(), s.id);
    }
    const orders = await this.poRepo.createQueryBuilder('po')
      .where('po.receivedDate IS NOT NULL')
      .andWhere('(po.status = :r OR po.status = :c)', { r: 'RECEIVED', c: 'CLOSED' })
      .getMany();
    const grouped = new Map<number, PurchaseOrder[]>();
    for (const po of orders) {
      let sid = po.supplierName ? byName.get(po.supplierName.toLowerCase()) : undefined;
      if (sid == null && po.supplierId) sid = byKey.get(po.supplierId) ?? byKey.get(po.supplierId.toLowerCase());
      if (sid == null) continue;
      let arr = grouped.get(sid);
      if (!arr) { arr = []; grouped.set(sid, arr); }
      arr.push(po);
    }
    const map = new Map<number, OtdResult>();
    for (const [sid, pos] of grouped) {
      const s = suppliers.find((x) => x.id === sid);
      map.set(sid, computeOtd(pos, s?.otdPct ?? null));
    }
    return map;
  }

  private async scarBySupplier(): Promise<Map<number, ReturnType<typeof computeScarResponsiveness>>> {
    const rows = await this.scarRepo.createQueryBuilder('scar')
      .leftJoin('scar.supplier', 's')
      .select('s.id', 'sid')
      .addSelect('scar.status', 'status')
      .addSelect('scar.createdAt', 'createdAt')
      .addSelect('scar.closedAt', 'closedAt')
      .addSelect('scar.dueDate', 'dueDate')
      .where('s.id IS NOT NULL')
      .getRawMany<{ sid: number; status: string; createdAt: Date; closedAt: Date; dueDate: Date }>();
    const grouped = new Map<number, typeof rows>();
    for (const r of rows) {
      const sid = Number(r.sid);
      let arr = grouped.get(sid);
      if (!arr) { arr = []; grouped.set(sid, arr); }
      arr.push(r);
    }
    const map = new Map<number, ReturnType<typeof computeScarResponsiveness>>();
    for (const [sid, list] of grouped) map.set(sid, computeScarResponsiveness(list));
    return map;
  }

  private async certBySupplier(): Promise<Map<number, { valid: number; expiring: number; expired: number; total: number; score: number | null }>> {
    const certs = await this.certRepo.find();
    const grouped = new Map<number, SupplierCertification[]>();
    for (const c of certs) {
      let arr = grouped.get(c.supplierId);
      if (!arr) { arr = []; grouped.set(c.supplierId, arr); }
      arr.push(c);
    }
    const map = new Map<number, { valid: number; expiring: number; expired: number; total: number; score: number | null }>();
    for (const [sid, list] of grouped) {
      let valid = 0, expiring = 0, expired = 0;
      const withStatus = list.map((c) => {
        const st = c.status === 'REVOKED' ? 'REVOKED' : this.certStatus(c.expiresAt);
        if (st === 'EXPIRED') expired += 1; else if (st === 'EXPIRING') expiring += 1; else if (st !== 'REVOKED') valid += 1;
        return { status: st };
      });
      map.set(sid, { valid, expiring, expired, total: list.length, score: certScore(withStatus) });
    }
    return map;
  }

  private async avlCountBySupplier(): Promise<Map<number, number>> {
    const rows = await this.avlRepo.createQueryBuilder('avl')
      .select('avl.supplierId', 'sid')
      .addSelect('COUNT(*)', 'cnt')
      .where("avl.approvalStatus IN (:...st)", { st: ['APPROVED', 'CONDITIONAL'] })
      .groupBy('avl.supplierId')
      .getRawMany<{ sid: number; cnt: string }>();
    const map = new Map<number, number>();
    for (const r of rows) map.set(Number(r.sid), Number(r.cnt ?? 0));
    return map;
  }

  // --- SCORECARD ENGINE (derived) ---

  async getScorecard(supplierId: number): Promise<any> {
    const supplier = await this.findOne(supplierId);
    const now = new Date();
    const sinceMs = now.getTime() - SCORECARD_WINDOW_DAYS * 86_400_000;

    const [inspections, orders, scars, certs] = await Promise.all([
      this.iqcRepo.find({ where: { supplier: { id: supplierId } } }),
      this.ordersForSupplier(supplier),
      this.scarRepo.find({ where: { supplier: { id: supplierId } } }),
      this.certsForSupplier(supplierId),
    ]);

    // Derived metrics — PPM (windowed) and OTD from real records, manual fallback.
    const ppm = computePpm(inspections, supplier.ppm ?? null, sinceMs);
    const otd = computeOtd(orders, supplier.otdPct ?? null);
    const scar = computeScarResponsiveness(scars);
    const certSummary = {
      total: certs.length,
      valid: certs.filter((c) => c.status === 'VALID').length,
      expiring: certs.filter((c) => c.status === 'EXPIRING').length,
      expired: certs.filter((c) => c.status === 'EXPIRED').length,
    };
    const cScore = certScore(certs);

    // IQC pass rate kept for backward compatibility with the existing UI.
    const totalIqc = inspections.length;
    const passedIqc = inspections.filter((i) => i.result === IqcResult.PASS).length;
    const passRate = totalIqc > 0 ? Math.round((passedIqc / totalIqc) * 100) : 100;

    const composite = buildComposite({
      otdScore: otd.otdPct,
      ppmScore: ppmToScore(ppm.ppm),
      scarScore: scar.onTimeRate,
      certScore: cScore,
    });
    const trend = monthlyTrend(orders, inspections, now, 6);
    const trendDir = this.trendDirection(trend);

    // Legacy risk band (kept) — now informed by the derived PPM/OTD too.
    let riskLevel = 'Normal';
    if (passRate < 90 || scar.open > 2 || (otd.otdPct != null && otd.otdPct < 90)) riskLevel = 'Major';
    if (passRate < 80 || scar.open > 5 || (otd.otdPct != null && otd.otdPct < 80)) riskLevel = 'Critical';

    return {
      supplier,
      metrics: {
        iqc: {
          total: totalIqc,
          passed: passedIqc,
          passRate,
          failed: totalIqc - passedIqc,
          inspected: ppm.inspected,
          defects: ppm.defects,
          lots: ppm.lots,
          ppm: ppm.ppm,
          ppmSource: ppm.source,
        },
        scars: {
          total: scar.total,
          open: scar.open,
          closed: scar.closed,
          closedOnTime: scar.closedOnTime,
          onTimeRate: scar.onTimeRate,
          avgClosureDays: scar.avgClosureDays,
        },
        otd: {
          value: otd.otdPct,
          source: otd.source,
          onTime: otd.onTime,
          late: otd.late,
          eligible: otd.eligible,
        },
        certifications: certSummary,
      },
      scorecard: {
        qualityScore: passRate,
        responseScore: scar.onTimeRate ?? (scar.total > 0 ? Math.round((scar.closed / scar.total) * 100) : 100),
        riskLevel,
        trend: trendDir,
        // Derived headline numbers + provenance.
        otdPct: otd.otdPct,
        otdSource: otd.source,
        ppm: ppm.ppm,
        ppmSource: ppm.source,
        scarResponsiveness: scar.onTimeRate,
        certScore: cScore,
        composite: composite.composite,
        grade: composite.grade,
        gradeColor: composite.color,
        weights: SCORECARD_WEIGHTS,
      },
      trend,
    };
  }

  /** improving | declining | stable from the last two populated OTD points. */
  private trendDirection(trend: { otdPct: number | null }[]): string {
    const pts = trend.filter((t) => t.otdPct != null).map((t) => t.otdPct as number);
    if (pts.length < 2) return 'stable';
    const delta = pts[pts.length - 1] - pts[pts.length - 2];
    if (delta > 2) return 'improving';
    if (delta < -2) return 'declining';
    return 'stable';
  }

  async getAllScorecards(): Promise<any[]> {
    const enriched = await this.findAllEnriched();
    return enriched.map((s) => ({
      supplier: s,
      scorecard: {
        qualityScore: Math.round(s.qualityScore ?? 0),
        grade: s.grade,
        gradeColor: s.gradeColor,
        composite: s.composite,
        riskLevel: s.riskLevel,
        otdPct: s.otdEff,
        otdSource: s.otdSource,
        ppm: s.ppmEff,
        ppmSource: s.ppmSource,
        openScars: s.openScars,
        expiringCerts: s.expiringCerts,
      },
    }));
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

  /** The Supplier-360: master + derived scorecard + contacts + certs + AVL + SCARs. */
  async supplier360(id: number): Promise<any> {
    const card = await this.getScorecard(id);
    const supplier = card.supplier as Supplier;
    const [contacts, certifications, avl, parts, scars] = await Promise.all([
      this.contactRepo.find({ where: { supplierId: id }, order: { isPrimary: 'DESC', name: 'ASC' } }),
      this.certsForSupplier(id),
      this.avlRepo.find({ where: { supplierId: id }, order: { approvalStatus: 'ASC', partNumber: 'ASC' } }),
      this.priceRepo.find({ where: { supplierId: id }, order: { preferred: 'DESC', partNumber: 'ASC' } }),
      this.scarRepo.find({ where: { supplier: { id } }, order: { createdAt: 'DESC' } }),
    ]);
    const expiringCerts = certifications.filter((c) => c.status === 'EXPIRING' || c.status === 'EXPIRED').length;
    const approvedParts = avl.filter((p) => p.approvalStatus === 'APPROVED').length;
    return {
      supplier,
      scorecard: card.scorecard,
      trend: card.trend,
      metrics: {
        ...card.metrics,
        avl: avl.length,
        approvedParts,
        parts: parts.length,
        certifications: certifications.length,
        expiringCerts,
        contacts: contacts.length,
        otdPct: card.scorecard.otdPct,
        otdSource: card.scorecard.otdSource,
        ppm: card.scorecard.ppm,
        ppmSource: card.scorecard.ppmSource,
      },
      contacts,
      certifications,
      avl,
      parts,
      scars,
    };
  }

  async kpis(): Promise<any> {
    // Built on the SAME derived enrichment as the list, so the KPI tiles
    // reconcile with the table (derived OTD/PPM, grade, open SCARs, certs).
    const enriched = await this.findAllEnriched();
    const byQual: Record<string, number> = {};
    let atRisk = 0;
    let singleSource = 0;
    let otdSum = 0;
    let otdN = 0;
    let ppmSum = 0;
    let ppmN = 0;
    let expiringCerts = 0;
    let openScars = 0;
    for (const s of enriched) {
      const q = s.qualificationStatus || 'PENDING';
      byQual[q] = (byQual[q] ?? 0) + 1;
      const otd = s.otdEff as number | null;
      const ppm = s.ppmEff as number | null;
      if (s.riskLevel === 'HIGH' || (otd != null && otd < 90)) atRisk++;
      if (s.singleSource) singleSource++;
      if (otd != null) { otdSum += otd; otdN++; }
      if (ppm != null) { ppmSum += ppm; ppmN++; }
      expiringCerts += s.expiringCerts ?? 0;
      openScars += s.openScars ?? 0;
    }
    const approvedParts = await this.avlRepo.count({ where: { approvalStatus: 'APPROVED' } });
    return {
      total: enriched.length,
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
      approvedParts,
      byQualification: byQual,
    };
  }

  // --- AVL (APPROVED VENDOR LIST) ---

  async listAvl(filters: { supplierId?: number; part?: string; status?: string } = {}): Promise<SupplierApprovedPart[]> {
    const qb = this.avlRepo.createQueryBuilder('avl');
    if (filters.supplierId) qb.andWhere('avl.supplierId = :sid', { sid: filters.supplierId });
    if (filters.part) qb.andWhere('LOWER(avl.partNumber) LIKE :p', { p: `%${filters.part.toLowerCase()}%` });
    if (filters.status) qb.andWhere('avl.approvalStatus = :st', { st: filters.status });
    qb.orderBy('avl.partNumber', 'ASC');
    return qb.getMany();
  }

  async partsForSupplier(supplierId: number): Promise<SupplierApprovedPart[]> {
    return this.avlRepo.find({ where: { supplierId }, order: { approvalStatus: 'ASC', partNumber: 'ASC' } });
  }

  async addAvlPart(dto: Partial<SupplierApprovedPart>): Promise<SupplierApprovedPart> {
    const entity = this.avlRepo.create({
      ...dto,
      partNumber: (dto.partNumber || '').trim(),
      approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : (dto.approvalStatus === 'APPROVED' ? new Date() : undefined),
    });
    const saved = await this.avlRepo.save(entity);
    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'AVL_PART_ADDED',
      actorName: dto.approvedBy || 'SQE',
      referenceType: 'SUPPLIER_AVL',
      referenceId: saved.id.toString(),
      metadata: { supplierId: saved.supplierId, partNumber: saved.partNumber, status: saved.approvalStatus },
    });
    return saved;
  }

  async updateAvlPart(id: number, dto: Partial<SupplierApprovedPart>): Promise<SupplierApprovedPart> {
    const part = await this.avlRepo.findOne({ where: { id } });
    if (!part) throw new NotFoundException('AVL part not found');
    const becameApproved = dto.approvalStatus === 'APPROVED' && part.approvalStatus !== 'APPROVED';
    Object.assign(part, dto);
    if (dto.approvedAt) part.approvedAt = new Date(dto.approvedAt);
    else if (becameApproved && !part.approvedAt) part.approvedAt = new Date();
    return this.avlRepo.save(part);
  }

  async removeAvlPart(id: number): Promise<{ ok: true }> {
    await this.avlRepo.delete(id);
    return { ok: true };
  }

  /**
   * "Who supplies this part?" — the buyer's view. Returns the APPROVED sources
   * for a part number, each with its derived performance, ranked best-first.
   */
  async forPart(part: string): Promise<any> {
    const partNumber = (part || '').trim();
    if (!partNumber) return { part: '', suppliers: [] };
    const avl = await this.avlRepo.find({ where: { partNumber } });
    if (!avl.length) return { part: partNumber, suppliers: [] };

    const supplierIds = Array.from(new Set(avl.map((a) => a.supplierId)));
    const suppliers = await this.supplierRepo.createQueryBuilder('s')
      .where('s.id IN (:...ids)', { ids: supplierIds })
      .getMany();
    const supById = new Map(suppliers.map((s) => [s.id, s]));

    const now = new Date();
    const sinceMs = now.getTime() - SCORECARD_WINDOW_DAYS * 86_400_000;
    const [ppmMap, otdMap] = await Promise.all([
      this.ppmBySupplier(sinceMs),
      this.otdBySupplier(suppliers),
    ]);

    const candidates = avl.map((a) => {
      const s = supById.get(a.supplierId);
      const ppm = ppmMap.get(a.supplierId)?.ppm ?? s?.ppm ?? null;
      const otdPct = otdMap.get(a.supplierId)?.otdPct ?? s?.otdPct ?? null;
      return {
        avlId: a.id,
        supplierId: a.supplierId,
        approvalStatus: a.approvalStatus,
        code: s?.code ?? null,
        name: s?.name ?? `#${a.supplierId}`,
        commodity: a.commodity ?? s?.commodity ?? null,
        qualificationStatus: s?.qualificationStatus ?? null,
        singleSource: s?.singleSource ?? false,
        unitPrice: a.unitPrice ?? null,
        currency: a.currency ?? s?.currency ?? 'USD',
        moq: a.moq ?? null,
        leadTimeDays: a.leadTimeDays ?? s?.leadTimeDays ?? null,
        otdPct,
        ppm,
        ...gradeFromScore(
          buildComposite({ otdScore: otdPct, ppmScore: ppmToScore(ppm), scarScore: null, certScore: null }).composite,
        ),
      };
    });

    return { part: partNumber, suppliers: selectAndRankForPart(candidates) };
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
