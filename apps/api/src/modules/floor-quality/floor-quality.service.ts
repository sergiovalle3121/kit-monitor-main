import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { SfQualityHold } from './entities/sf-quality-hold.entity';
import { SfConsumptionEvent } from '../operator-terminal/entities/sf-consumption-event.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { DocumentNumberingService } from '../numbering/document-numbering.service';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { CreateHoldDto, DispositionDto, ReinspectDto } from './dto/floor-quality.dto';
import {
  assertTransition,
  HoldStatus,
  needsRework,
  requiresScar,
  requiresWaiver,
} from './hold-state';

export interface QualityKpis {
  openHolds: number;
  byStatus: Record<HoldStatus, number>;
  dispositioned: number;
  useAsIs: number;
  pctUseAsIs: number;
  scrapQty: number;
  reworkHours: number;
  avgDispositionDays: number;
  overdue: number;
}

const OVERDUE_DAYS = 5;

@Injectable()
export class FloorQualityService {
  private readonly logger = new Logger(FloorQualityService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfQualityHold))
    private readonly holds: TenantScopedRepository<SfQualityHold>,
    @InjectRepository(SfConsumptionEvent)
    private readonly consumption: Repository<SfConsumptionEvent>,
    private readonly tenantCtx: TenantContextService,
    private readonly numbering: DocumentNumberingService,
    private readonly plan: ProductionPlanService,
    @Optional() private readonly ledger?: EventLedgerService,
  ) {}

  private applyScope<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, alias: string): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    const plant = this.tenantCtx.getPlantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    if (plant) qb.andWhere(`${alias}.plant_id = :plant`, { plant });
    else qb.andWhere(`${alias}.plant_id IS NULL`);
    return qb;
  }

  private scopeFields() {
    return {
      tenant_id: this.tenantCtx.getTenantId(),
      plant_id: this.tenantCtx.getPlantId(),
      created_by: this.tenantCtx.getUserEmail(),
    };
  }

  // ── Create hold (quarantine + block the WO) ─────────────────────────────────
  async createHold(dto: CreateHoldDto): Promise<SfQualityHold> {
    let folio: string | null = null;
    try {
      folio = await this.numbering.allocate('NCR');
    } catch (err) {
      this.logger.warn(`NCR folio failed: ${(err as Error)?.message}`);
    }
    let woFolio: string | null = null;
    if (dto.woId) {
      try {
        const wo = await this.plan.getOne(dto.woId);
        woFolio = wo.folio;
      } catch {
        /* WO optional */
      }
    }
    const hold = this.holds.create({
      folio,
      origin: dto.origin ?? 'IN_PROCESS',
      part: dto.part.trim(),
      qty: dto.qty,
      lot: dto.lot?.trim() || null,
      serial: dto.serial?.trim() || null,
      woId: dto.woId ?? null,
      woFolio,
      station: dto.station ?? null,
      defectType: dto.defectType ?? null,
      severity: dto.severity ?? 'MEDIUM',
      photoUrl: dto.photoUrl ?? null,
      status: 'HELD',
      raisedBy: this.tenantCtx.getUserEmail(),
      raisedAt: new Date(),
      programId: null,
      ...this.scopeFields(),
    });
    const saved = await this.holds.save(hold);
    // Block consumption/shipment on the affected WO.
    if (dto.woId) await this.plan.setQualityClear(dto.woId, false).catch(() => undefined);
    await this.record('SF_QUALITY_HOLD_CREATED', saved, { after: saved });
    return saved;
  }

  async listHolds(filters: { status?: string; part?: string } = {}): Promise<SfQualityHold[]> {
    const qb = this.holds.createQueryBuilder('h');
    this.applyScope(qb, 'h');
    if (filters.status) qb.andWhere('h.status = :s', { s: filters.status });
    if (filters.part) qb.andWhere('h.part = :p', { p: filters.part });
    return qb.orderBy('h.raised_at', 'DESC').getMany();
  }

  async getHold(id: string): Promise<SfQualityHold> {
    const h = await this.holds.findOne({ where: { id } });
    if (!h) throw new NotFoundException('Hold no encontrado.');
    return h;
  }

  // ── MRB workflow ─────────────────────────────────────────────────────────────
  async toMrb(id: string): Promise<SfQualityHold> {
    const h = await this.getHold(id);
    this.move(h, 'MRB_REVIEW');
    const saved = await this.holds.save(h);
    await this.record('SF_QUALITY_HOLD_TO_MRB', saved, { after: { status: saved.status } });
    return saved;
  }

  async disposition(id: string, dto: DispositionDto): Promise<SfQualityHold> {
    const h = await this.getHold(id);
    if (requiresWaiver(dto.disposition) && !dto.waiver) {
      throw new BadRequestException('USE_AS_IS requiere una desviación/waiver.');
    }
    if (requiresScar(dto.disposition) && !dto.scarRef) {
      throw new BadRequestException('RTV requiere referencia de SCAR / nota de débito.');
    }
    this.move(h, 'DISPOSITIONED');
    h.disposition = dto.disposition;
    h.signedBy = dto.signedBy;
    h.dispositionNotes = dto.notes ?? null;
    h.waiver = dto.waiver ?? null;
    h.scarRef = dto.scarRef ?? null;
    h.dispositionedAt = new Date();
    const saved = await this.holds.save(h);
    await this.record('SF_QUALITY_HOLD_DISPOSITIONED', saved, { after: { disposition: saved.disposition } });
    return saved;
  }

  async startRework(id: string): Promise<SfQualityHold> {
    const h = await this.getHold(id);
    if (!h.disposition || !needsRework(h.disposition)) {
      throw new BadRequestException('Solo dispoosiciones REWORK/REPAIR generan orden de retrabajo.');
    }
    this.move(h, 'REWORK');
    const saved = await this.holds.save(h);
    await this.record('SF_QUALITY_REWORK_STARTED', saved, { after: { status: saved.status } });
    return saved;
  }

  async reinspect(id: string, dto: ReinspectDto): Promise<SfQualityHold> {
    const h = await this.getHold(id);
    this.move(h, 'REINSPECT');
    if (dto.reworkHours !== undefined) h.reworkHours = (h.reworkHours ?? 0) + dto.reworkHours;
    if (dto.pass) {
      this.move(h, 'CLOSED');
      h.closedAt = new Date();
      await this.releaseWoIfClear(h);
    } else {
      if (dto.scrapQty !== undefined) h.scrapQty = dto.scrapQty;
      this.move(h, 'REWORK'); // failed re-inspect → back to rework
    }
    const saved = await this.holds.save(h);
    await this.record('SF_QUALITY_REINSPECT', saved, { after: { status: saved.status, pass: dto.pass } });
    return saved;
  }

  async close(id: string): Promise<SfQualityHold> {
    const h = await this.getHold(id);
    this.move(h, 'CLOSED');
    h.closedAt = new Date();
    if (h.disposition === 'SCRAP' && !h.scrapQty) h.scrapQty = h.qty;
    await this.releaseWoIfClear(h);
    const saved = await this.holds.save(h);
    await this.record('SF_QUALITY_HOLD_CLOSED', saved, { after: { status: saved.status } });
    return saved;
  }

  async cancel(id: string): Promise<SfQualityHold> {
    const h = await this.getHold(id);
    this.move(h, 'CANCELLED');
    await this.releaseWoIfClear(h);
    return this.holds.save(h);
  }

  private move(h: SfQualityHold, to: HoldStatus): void {
    try {
      assertTransition(h.status, to);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    h.status = to;
  }

  /** Release the WO's quality block once it has no more open holds. */
  private async releaseWoIfClear(h: SfQualityHold): Promise<void> {
    if (!h.woId) return;
    const qb = this.holds.createQueryBuilder('x');
    this.applyScope(qb, 'x');
    qb.andWhere('x.wo_id = :w', { w: h.woId })
      .andWhere('x.id != :id', { id: h.id })
      .andWhere('x.status NOT IN (:...done)', { done: ['CLOSED', 'CANCELLED'] });
    const others = await qb.getCount();
    if (others === 0) await this.plan.setQualityClear(h.woId, true).catch(() => undefined);
  }

  // ── Containment / where-used (genealogy) ────────────────────────────────────
  /**
   * Where a part (optionally a serial) has been consumed — the containment list
   * for a recall / customer audit. Read from the immutable consumption ledger.
   */
  async whereUsed(part: string, serial?: string): Promise<SfConsumptionEvent[]> {
    const tenant = this.tenantCtx.getTenantId();
    const qb = this.consumption.createQueryBuilder('e').where('e.part = :p', { p: part });
    if (serial) qb.andWhere('e.unit_serial = :s', { s: serial });
    if (tenant) qb.andWhere('e.tenant_id = :t', { t: tenant });
    return qb.orderBy('e.created_at', 'DESC').getMany();
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  async kpis(): Promise<QualityKpis> {
    const all = await this.listHolds();
    const byStatus = { HELD: 0, MRB_REVIEW: 0, DISPOSITIONED: 0, REWORK: 0, REINSPECT: 0, CLOSED: 0, CANCELLED: 0 } as Record<HoldStatus, number>;
    let useAsIs = 0;
    let dispositioned = 0;
    let scrapQty = 0;
    let reworkHours = 0;
    let dispoDaysSum = 0;
    let dispoCount = 0;
    let overdue = 0;
    const now = Date.now();

    for (const h of all) {
      byStatus[h.status] = (byStatus[h.status] ?? 0) + 1;
      if (h.disposition) dispositioned++;
      if (h.disposition === 'USE_AS_IS') useAsIs++;
      scrapQty += Number(h.scrapQty ?? 0);
      reworkHours += Number(h.reworkHours ?? 0);
      if (h.dispositionedAt && h.raisedAt) {
        dispoDaysSum += (new Date(h.dispositionedAt).getTime() - new Date(h.raisedAt).getTime()) / 86_400_000;
        dispoCount++;
      }
      if ((h.status === 'HELD' || h.status === 'MRB_REVIEW') && h.raisedAt) {
        const ageDays = (now - new Date(h.raisedAt).getTime()) / 86_400_000;
        if (ageDays > OVERDUE_DAYS) overdue++;
      }
    }
    const openHolds = all.filter((h) => h.status !== 'CLOSED' && h.status !== 'CANCELLED').length;
    return {
      openHolds,
      byStatus,
      dispositioned,
      useAsIs,
      pctUseAsIs: dispositioned ? round(useAsIs / dispositioned, 4) : 0,
      scrapQty: round(scrapQty),
      reworkHours: round(reworkHours),
      avgDispositionDays: dispoCount ? round(dispoDaysSum / dispoCount, 1) : 0,
      overdue,
    };
  }

  private async record(action: string, hold: SfQualityHold, states: { before?: unknown; after?: unknown }): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.QUALITY,
        action,
        referenceType: 'SF_QUALITY_HOLD',
        referenceId: hold.id,
        plant: hold.plant_id ?? undefined,
        metadata: { folio: hold.folio, part: hold.part, lot: hold.lot, serial: hold.serial, beforeState: states.before, afterState: states.after },
      });
    } catch (err) {
      this.logger.warn(`Ledger skipped for ${action}: ${(err as Error)?.message}`);
    }
  }
}

function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
