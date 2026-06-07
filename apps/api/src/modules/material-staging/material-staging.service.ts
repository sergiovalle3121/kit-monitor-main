import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { SfStaging } from './entities/sf-staging.entity';
import { SfReplenishCall } from './entities/sf-replenish-call.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  ConfirmStagedDto,
  GenerateStagingDto,
  RaiseReplenishDto,
  ShortageDto,
} from './dto/material-staging.dto';
import {
  assertReplenishTransition,
  belowKanban,
  deriveStagingStatus,
  ReplenishStatus,
} from './staging-status';

export interface StagingKpis {
  totalLines: number;
  stagedLines: number;
  shortageLines: number;
  fillRatePct: number;
  openCalls: number;
  avgReplenishMinutes: number;
  stationsShort: number;
}

@Injectable()
export class MaterialStagingService {
  private readonly logger = new Logger(MaterialStagingService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfStaging))
    private readonly staging: TenantScopedRepository<SfStaging>,
    @Inject(getTenantRepositoryToken(SfReplenishCall))
    private readonly calls: TenantScopedRepository<SfReplenishCall>,
    private readonly tenantCtx: TenantContextService,
    private readonly lineEng: LineEngineeringService,
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

  // ── Generate staging lines from the WO routing (the IE bridge) ──────────────
  async generateForWorkOrder(dto: GenerateStagingDto): Promise<SfStaging[]> {
    const wo = await this.plan.getOne(dto.woId);
    const reqs = await this.lineEng.stationRequirements(wo.model, wo.revision);
    const withPart = reqs.filter((r) => !!r.npExpected);
    if (withPart.length === 0) {
      throw new BadRequestException(
        `El layout de ${wo.model} rev ${wo.revision} no define NP por estación; configúralo en Ing. Industrial.`,
      );
    }
    const fraction = dto.kanbanFraction ?? 0.15;
    const created: SfStaging[] = [];
    for (const r of withPart) {
      const existing = await this.findLine(wo.id, r.station, r.npExpected!);
      if (existing) {
        created.push(existing);
        continue;
      }
      const requiredQty = Number(r.useFactor) * Number(wo.quantityPlanned);
      const minQty = Math.max(1, Math.ceil(requiredQty * fraction));
      const entity = this.staging.create({
        woId: wo.id,
        woFolio: wo.folio,
        model: wo.model,
        station: r.station,
        sequence: r.sequence,
        part: r.npExpected!,
        requiredQty,
        stagedQty: 0,
        minQty,
        status: 'PENDING',
        feederPosition: r.feederPosition,
        programId: wo.programId,
        ...this.scopeFields(),
      });
      created.push(await this.staging.save(entity));
    }
    await this.record('SF_STAGING_GENERATED', wo.id, { lines: created.length });
    // a freshly generated kit is not ready yet
    await this.plan.setMaterialReady(wo.id, false);
    return this.listForWorkOrder(wo.id);
  }

  private async findLine(woId: string, station: string, part: string): Promise<SfStaging | null> {
    const qb = this.staging.createQueryBuilder('s');
    this.applyScope(qb, 's');
    qb.andWhere('s.wo_id = :w', { w: woId })
      .andWhere('s.station = :st', { st: station })
      .andWhere('s.part = :p', { p: part });
    return qb.getOne();
  }

  async listForWorkOrder(woId: string): Promise<SfStaging[]> {
    const qb = this.staging.createQueryBuilder('s');
    this.applyScope(qb, 's');
    qb.andWhere('s.wo_id = :w', { w: woId });
    return qb.orderBy('s.sequence', 'ASC').getMany();
  }

  async listStaging(filters: { status?: string } = {}): Promise<SfStaging[]> {
    const qb = this.staging.createQueryBuilder('s');
    this.applyScope(qb, 's');
    if (filters.status) qb.andWhere('s.status = :st', { st: filters.status });
    return qb.orderBy('s.created_at', 'DESC').getMany();
  }

  async getLine(id: string): Promise<SfStaging> {
    const line = await this.staging.findOne({ where: { id } });
    if (!line) throw new NotFoundException('Línea de surtido no encontrada.');
    return line;
  }

  // ── Confirm staged material per station ─────────────────────────────────────
  async confirmStaged(id: string, dto: ConfirmStagedDto): Promise<SfStaging> {
    const line = await this.getLine(id);
    line.stagedQty = dto.stagedQty;
    line.status = deriveStagingStatus(line.requiredQty, line.stagedQty);
    const saved = await this.staging.save(line);
    await this.record('SF_STAGING_CONFIRMED', line.woId, { station: line.station, part: line.part, stagedQty: line.stagedQty });
    await this.recomputeReadiness(line.woId);
    return saved;
  }

  async markShortage(id: string, dto: ShortageDto): Promise<SfStaging> {
    const line = await this.getLine(id);
    line.status = 'SHORTAGE';
    const saved = await this.staging.save(line);
    await this.raiseCall(line.woId, line.woFolio, line.station, line.part, Math.max(0, line.requiredQty - line.stagedQty) || line.requiredQty, dto.priority ?? 'HIGH', dto.reason ?? 'SHORTAGE', line.programId);
    await this.plan.setMaterialReady(line.woId, false);
    await this.record('SF_STAGING_SHORTAGE', line.woId, { station: line.station, part: line.part });
    return saved;
  }

  /** Recompute WO material readiness: ready only when every line is staged. */
  private async recomputeReadiness(woId: string): Promise<void> {
    const lines = await this.listForWorkOrder(woId);
    if (lines.length === 0) return;
    const allStaged = lines.every((l) => l.status === 'STAGED' && Number(l.stagedQty) >= Number(l.requiredQty));
    await this.plan.setMaterialReady(woId, allStaged);
  }

  // ── Backflush consumption (called by the operator terminal) ──────────────────
  /**
   * Decrement staged material for a confirmed unit/quantity. Returns null when no
   * staging line tracks this (wo, station, part) — not every station is tracked.
   * Throws on a critical stockout (and raises a replenishment call), which the
   * operator terminal surfaces as a block.
   */
  async consumeStaged(woId: string, station: string, part: string, qty: number): Promise<SfStaging | null> {
    const line = await this.findLine(woId, station, part);
    if (!line) return null;
    const need = Number(qty) || 0;
    if (Number(line.stagedQty) < need) {
      await this.raiseCall(woId, line.woFolio, station, part, line.requiredQty, 'URGENT', 'STOCKOUT', line.programId);
      line.status = 'SHORTAGE';
      await this.staging.save(line);
      await this.plan.setMaterialReady(woId, false);
      throw new BadRequestException(
        `Faltante crítico de ${part} en ${station}: en línea ${line.stagedQty}, se requieren ${need}. Llamado de reposición urgente generado.`,
      );
    }
    line.stagedQty = Number(line.stagedQty) - need;
    line.status = deriveStagingStatus(line.requiredQty, line.stagedQty);
    const saved = await this.staging.save(line);
    if (belowKanban(line.stagedQty, line.minQty)) {
      await this.raiseCallIfNone(woId, line.woFolio, station, part, line.requiredQty, 'HIGH', 'KANBAN', line.programId);
    }
    return saved;
  }

  // ── Replenishment calls (e-kanban) ──────────────────────────────────────────
  async raiseReplenish(dto: RaiseReplenishDto): Promise<SfReplenishCall> {
    return this.raiseCall(dto.woId, null, dto.station, dto.part, dto.qty, dto.priority ?? 'MEDIUM', dto.reason ?? 'MANUAL', null);
  }

  private async raiseCallIfNone(
    woId: string, folio: string | null, station: string, part: string,
    qty: number, priority: SfReplenishCall['priority'], reason: string, programId: string | null,
  ): Promise<void> {
    const qb = this.calls.createQueryBuilder('c');
    this.applyScope(qb, 'c');
    qb.andWhere('c.wo_id = :w', { w: woId })
      .andWhere('c.station = :st', { st: station })
      .andWhere('c.part = :p', { p: part })
      .andWhere('c.status IN (:...open)', { open: ['OPEN', 'IN_TRANSIT'] });
    const existing = await qb.getOne();
    if (existing) return;
    await this.raiseCall(woId, folio, station, part, qty, priority, reason, programId);
  }

  private async raiseCall(
    woId: string, folio: string | null, station: string, part: string,
    qty: number, priority: SfReplenishCall['priority'], reason: string, programId: string | null,
  ): Promise<SfReplenishCall> {
    const call = this.calls.create({
      woId, woFolio: folio, station, part, qty, priority,
      status: 'OPEN', reason, raisedAt: new Date(),
      raisedBy: this.tenantCtx.getUserEmail(), programId,
      ...this.scopeFields(),
    });
    const saved = await this.calls.save(call);
    await this.record('SF_REPLENISH_RAISED', woId, { station, part, qty, reason });
    return saved;
  }

  async listReplenishCalls(filters: { status?: string } = {}): Promise<SfReplenishCall[]> {
    const qb = this.calls.createQueryBuilder('c');
    this.applyScope(qb, 'c');
    if (filters.status) qb.andWhere('c.status = :st', { st: filters.status });
    return qb.orderBy('c.raised_at', 'DESC').getMany();
  }

  async transitionReplenish(id: string, status: ReplenishStatus): Promise<SfReplenishCall> {
    const call = await this.calls.findOne({ where: { id } });
    if (!call) throw new NotFoundException('Llamado no encontrado.');
    try {
      assertReplenishTransition(call.status, status);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    call.status = status;
    if (status === 'DELIVERED') {
      call.deliveredAt = new Date();
      call.deliveredBy = this.tenantCtx.getUserEmail();
    }
    const saved = await this.calls.save(call);
    await this.record('SF_REPLENISH_TRANSITIONED', call.woId, { status });
    return saved;
  }

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  async kpis(): Promise<StagingKpis> {
    const [lines, calls] = await Promise.all([this.listStaging(), this.listReplenishCalls()]);
    const stagedLines = lines.filter((l) => l.status === 'STAGED').length;
    const shortageLines = lines.filter((l) => l.status === 'SHORTAGE').length;
    const openCalls = calls.filter((c) => c.status === 'OPEN' || c.status === 'IN_TRANSIT').length;
    const delivered = calls.filter((c) => c.status === 'DELIVERED' && c.raisedAt && c.deliveredAt);
    const avgReplenishMinutes = delivered.length
      ? round(
          delivered.reduce((a, c) => a + (new Date(c.deliveredAt as Date).getTime() - new Date(c.raisedAt as Date).getTime()) / 60000, 0) / delivered.length,
          1,
        )
      : 0;
    const stationsShort = new Set(lines.filter((l) => l.status === 'SHORTAGE').map((l) => l.station)).size;
    return {
      totalLines: lines.length,
      stagedLines,
      shortageLines,
      fillRatePct: lines.length ? round(stagedLines / lines.length, 4) : 0,
      openCalls,
      avgReplenishMinutes,
      stationsShort,
    };
  }

  private async record(action: string, referenceId: string, metadata: Record<string, unknown>): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.MATERIALS,
        action,
        referenceType: 'SF_STAGING',
        referenceId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata,
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
