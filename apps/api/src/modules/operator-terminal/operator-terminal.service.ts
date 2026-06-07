import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { SfConsumptionEvent } from './entities/sf-consumption-event.entity';
import { SfFloorEvent, FloorEventType } from './entities/sf-floor-event.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { LineEngineeringService } from '../line-engineering/line-engineering.service';
import { ProductionPlanService } from '../production-plan/production-plan.service';
import { SfWorkOrder } from '../production-plan/entities/sf-work-order.entity';
import { MaterialStagingService } from '../material-staging/material-staging.service';
import { Certification } from '../people/entities/certification.entity';
import { certStatus } from '../people/cert-status';
import { SapAdapter } from './sap-adapter';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import {
  ConfirmProductionDto,
  RaiseAndonDto,
  ReportDefectDto,
} from './dto/operator-terminal.dto';

export interface SkillCheck {
  required: boolean;
  certified: boolean;
  reason: string | null;
}

export interface WorkContext {
  workOrder: SfWorkOrder;
  station: {
    station: string;
    sequence: number;
    npExpected: string | null;
    useFactor: number;
    stdTimeSec: number;
    visualAidUrl: string | null;
    ctq: boolean;
  } | null;
  material: { part: string; requiredQty: number; stagedQty: number; status: string } | null;
  runnable: boolean;
  blockers: string[];
  skill: SkillCheck;
  authorized: boolean;
}

const ANDON_TARGET: Record<string, string> = {
  ANDON_MATERIAL: 'materialist',
  ANDON_QUALITY: 'quality_engineer',
  ANDON_MACHINE: 'maintenance_tech',
  ANDON_HELP: 'production_supervisor',
  ANDON_SAFETY: 'production_supervisor',
  DEFECT: 'quality_engineer',
  DOWNTIME: 'production_supervisor',
};

@Injectable()
export class OperatorTerminalService {
  private readonly logger = new Logger(OperatorTerminalService.name);

  constructor(
    @Inject(getTenantRepositoryToken(SfConsumptionEvent))
    private readonly events: TenantScopedRepository<SfConsumptionEvent>,
    @Inject(getTenantRepositoryToken(SfFloorEvent))
    private readonly floor: TenantScopedRepository<SfFloorEvent>,
    @InjectRepository(Certification)
    private readonly certs: Repository<Certification>,
    private readonly tenantCtx: TenantContextService,
    private readonly lineEng: LineEngineeringService,
    private readonly plan: ProductionPlanService,
    private readonly staging: MaterialStagingService,
    private readonly sap: SapAdapter,
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

  // ── Skill gate (people / certifications) ────────────────────────────────────
  /**
   * A station with certified people requires the operator to be one of them; a
   * station with NO certifications configured is treated as ungated (so the
   * system is usable before the skill matrix is populated). Non-expired & active.
   */
  async skillCheck(station: string, operatorEmail?: string | null): Promise<SkillCheck> {
    const tenant = this.tenantCtx.getTenantId();
    const where: Record<string, unknown> = { station, active: true };
    if (tenant) where.tenant_id = tenant;
    const stationCerts = await this.certs.find({ where });
    const valid = stationCerts.filter((c) => certStatus(c.expiresDate) !== 'EXPIRED');
    if (valid.length === 0) {
      return { required: false, certified: true, reason: null };
    }
    const email = (operatorEmail ?? '').toLowerCase();
    const ok = valid.some((c) => (c.employeeEmail ?? '').toLowerCase() === email);
    return {
      required: true,
      certified: ok,
      reason: ok ? null : `Operador no certificado para la estación ${station}.`,
    };
  }

  // ── Poka-yoke ────────────────────────────────────────────────────────────────
  async verifyScan(woId: string, station: string, scannedPart: string): Promise<{ ok: boolean; expected: string | null }> {
    const wo = await this.plan.getOne(woId);
    const reqs = await this.lineEng.stationRequirements(wo.model, wo.revision);
    const req = reqs.find((r) => r.station === station);
    const expected = req?.npExpected ?? null;
    if (!expected) return { ok: true, expected: null }; // nothing to error-proof
    return { ok: (scannedPart ?? '').trim() === expected, expected };
  }

  // ── Work context ────────────────────────────────────────────────────────────
  async workContext(woId: string, station: string, operatorEmail?: string | null): Promise<WorkContext> {
    const wo = await this.plan.getOne(woId);
    const reqs = await this.lineEng.stationRequirements(wo.model, wo.revision);
    const req = reqs.find((r) => r.station === station) ?? null;
    const blockers = this.plan.runBlockers(wo);
    const skill = await this.skillCheck(station, operatorEmail);
    const authorized = this.plan.isOperatorAuthorized(wo, operatorEmail);

    let material: WorkContext['material'] = null;
    if (req?.npExpected) {
      const lines = await this.staging.listForWorkOrder(woId);
      const line = lines.find((l) => l.station === station && l.part === req.npExpected);
      if (line) material = { part: line.part, requiredQty: line.requiredQty, stagedQty: line.stagedQty, status: line.status };
    }

    return {
      workOrder: wo,
      station: req
        ? { station: req.station, sequence: req.sequence, npExpected: req.npExpected, useFactor: req.useFactor, stdTimeSec: req.stdTimeSec, visualAidUrl: req.visualAidUrl, ctq: req.ctq }
        : null,
      material,
      runnable: blockers.runnable && skill.certified && authorized,
      blockers: [
        ...blockers.blockers,
        ...(skill.certified ? [] : [skill.reason as string]),
        ...(authorized ? [] : ['Operador no autorizado a esta WO por el supervisor.']),
      ],
      skill,
      authorized,
    };
  }

  // ── Confirm production (skill + poka-yoke + backflush + serial + idempotent) ──
  async confirm(dto: ConfirmProductionDto): Promise<{ event: SfConsumptionEvent; workOrder: unknown; blockers: string[] }> {
    const operatorEmail = this.tenantCtx.getUserEmail();
    const wo = await this.plan.getOne(dto.woId);

    // 1. Run gating: material readiness, quality hold, FAI.
    const blockers = this.plan.runBlockers(wo);
    if (!blockers.runnable) {
      throw new BadRequestException(`No se puede confirmar: ${blockers.blockers.join(' ')}`);
    }
    // 2. Supervisor authorization (the "acceso").
    if (!this.plan.isOperatorAuthorized(wo, operatorEmail)) {
      throw new ForbiddenException('No estás autorizado a esta WO. Pide acceso al supervisor.');
    }
    // 3. Station must be in the routing.
    const reqs = await this.lineEng.stationRequirements(wo.model, wo.revision);
    const req = reqs.find((r) => r.station === dto.station);
    if (!req) {
      throw new BadRequestException(`La estación ${dto.station} no está en el ruteo de ${wo.model}.`);
    }
    // 4. Skill gate.
    const skill = await this.skillCheck(dto.station, operatorEmail);
    if (skill.required && !skill.certified) {
      throw new ForbiddenException(skill.reason ?? 'Operador no certificado para la estación.');
    }
    // 5. Poka-yoke: scanned part must match the expected NP.
    if (req.npExpected && dto.scannedPart && dto.scannedPart.trim() !== req.npExpected) {
      throw new BadRequestException(
        `Poka-yoke: NP escaneado "${dto.scannedPart}" no coincide con el esperado "${req.npExpected}" en ${dto.station}.`,
      );
    }
    // 6. Serial control (genealogy).
    if (wo.serialControl === 'BY_UNIT' && !dto.unitSerial) {
      throw new BadRequestException('Este programa exige serial por unidad (genealogía).');
    }

    // 7. Idempotency: if we have already recorded this key, return it.
    const key = (dto.idempotencyKey && dto.idempotencyKey.trim()) ||
      `${dto.woId}:${dto.station}:${dto.unitSerial ?? ''}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const existing = await this.events.findOne({ where: { idempotencyKey: key } });
    if (existing) {
      const woNow = await this.plan.getOne(dto.woId);
      return { event: existing, workOrder: woNow, blockers: this.plan.runBlockers(woNow).blockers };
    }

    // 8. Units produced + backflush.
    const unitsProduced = wo.consumptionMode === 'BY_UNIT' ? 1 : Math.max(1, dto.units ?? 1);
    const backflushQty = unitsProduced * Number(req.useFactor ?? 1);

    // 9. Backflush staged material (live decrement; throws on critical shortage).
    if (req.npExpected) {
      await this.staging.consumeStaged(dto.woId, dto.station, req.npExpected, backflushQty);
    }

    // 10. Record the immutable consumption event.
    const event = this.events.create({
      idempotencyKey: key,
      woId: wo.id,
      woFolio: wo.folio,
      model: wo.model,
      station: dto.station,
      part: req.npExpected,
      units: unitsProduced,
      backflushQty,
      unitSerial: dto.unitSerial ?? null,
      operatorEmail,
      outboxStatus: 'PENDING',
      programId: wo.programId,
      ...this.scopeFields(),
    });
    // 11. SAP 261 outbox (stub).
    try {
      const res = await this.sap.postGoodsIssue261({
        idempotencyKey: key,
        orderFolio: wo.folio,
        material: req.npExpected ?? wo.model,
        quantity: backflushQty,
        plant: wo.plant_id,
        unitSerial: dto.unitSerial ?? null,
      });
      event.outboxStatus = res.stub ? 'SENT_STUB' : 'ACK';
    } catch {
      event.outboxStatus = 'ERROR';
    }
    const saved = await this.events.save(event);

    // 12. Advance the WO (auto start / auto complete).
    const updatedWo = await this.plan.incrementCompleted(dto.woId, unitsProduced);

    await this.record('SF_PRODUCTION_CONFIRMED', wo.id, {
      station: dto.station, units: unitsProduced, backflushQty, part: req.npExpected, serial: dto.unitSerial,
    });

    return { event: saved, workOrder: updatedWo, blockers: this.plan.runBlockers(updatedWo).blockers };
  }

  // ── Andon / defect / floor events ───────────────────────────────────────────
  async raiseAndon(dto: RaiseAndonDto): Promise<SfFloorEvent> {
    return this.createFloorEvent(dto.type, {
      woId: dto.woId, line: dto.line, station: dto.station, severity: dto.severity, note: dto.note,
    });
  }

  async reportDefect(dto: ReportDefectDto): Promise<SfFloorEvent> {
    return this.createFloorEvent('DEFECT', {
      woId: dto.woId, line: dto.line, station: dto.station, part: dto.part, severity: dto.severity, note: dto.note,
    });
  }

  private async createFloorEvent(
    type: FloorEventType,
    p: { woId?: string; line?: string; station?: string; part?: string; severity?: string; note?: string },
  ): Promise<SfFloorEvent> {
    let folio: string | null = null;
    let line = p.line ?? null;
    let model: string | null = null;
    if (p.woId) {
      try {
        const wo = await this.plan.getOne(p.woId);
        folio = wo.folio;
        line = line ?? wo.line;
        model = wo.model;
      } catch {
        /* WO optional */
      }
    }
    const ev = this.floor.create({
      type,
      woId: p.woId ?? null,
      woFolio: folio,
      line,
      station: p.station ?? null,
      model,
      part: p.part ?? null,
      severity: (p.severity as SfFloorEvent['severity']) ?? (type === 'ANDON_SAFETY' ? 'CRITICAL' : 'MEDIUM'),
      status: 'OPEN',
      targetRole: ANDON_TARGET[type] ?? null,
      escalationLevel: 0,
      note: p.note ?? null,
      raisedAt: new Date(),
      raisedBy: this.tenantCtx.getUserEmail(),
      ...this.scopeFields(),
    });
    const saved = await this.floor.save(ev);
    await this.record(`SF_${type}`, saved.id, { line, station: p.station, severity: saved.severity, targetRole: saved.targetRole });
    return saved;
  }

  async listFloorEvents(filters: { status?: string; type?: string; line?: string } = {}): Promise<SfFloorEvent[]> {
    const qb = this.floor.createQueryBuilder('f');
    this.applyScope(qb, 'f');
    if (filters.status) qb.andWhere('f.status = :s', { s: filters.status });
    if (filters.type) qb.andWhere('f.type = :t', { t: filters.type });
    if (filters.line) qb.andWhere('f.line = :l', { l: filters.line });
    return qb.orderBy('f.raised_at', 'DESC').getMany();
  }

  async ackFloorEvent(id: string): Promise<SfFloorEvent> {
    const ev = await this.floor.findOne({ where: { id } });
    if (!ev) throw new NotFoundException('Evento no encontrado.');
    ev.status = 'ACK';
    ev.acknowledgedAt = new Date();
    return this.floor.save(ev);
  }

  async resolveFloorEvent(id: string, downtimeMinutes?: number, downtimeCode?: string): Promise<SfFloorEvent> {
    const ev = await this.floor.findOne({ where: { id } });
    if (!ev) throw new NotFoundException('Evento no encontrado.');
    ev.status = 'RESOLVED';
    ev.resolvedAt = new Date();
    ev.resolvedBy = this.tenantCtx.getUserEmail();
    if (downtimeMinutes !== undefined) ev.downtimeMinutes = downtimeMinutes;
    if (downtimeCode) ev.downtimeCode = downtimeCode;
    return this.floor.save(ev);
  }

  // ── Hour-by-hour + KPIs (operator/line) ─────────────────────────────────────
  async hourByHour(woId: string): Promise<{ hour: string; actual: number; planned: number }[]> {
    const wo = await this.plan.getOne(woId);
    const qb = this.events.createQueryBuilder('e');
    this.applyScope(qb, 'e');
    qb.andWhere('e.wo_id = :w', { w: woId });
    const evs = await qb.getMany();
    const plannedPerHour = wo.taktTargetSec > 0 ? Math.floor(3600 / wo.taktTargetSec) : 0;
    const buckets = new Map<string, number>();
    for (const e of evs) {
      const d = new Date(e.created_at);
      const hour = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:00`;
      buckets.set(hour, (buckets.get(hour) ?? 0) + Number(e.units ?? 0));
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, actual]) => ({ hour, actual, planned: plannedPerHour }));
  }

  async kpis(filters: { line?: string } = {}): Promise<{
    unitsToday: number; eventsToday: number; openAndons: number; defectsToday: number; unitsPerHour: number;
  }> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const qb = this.events.createQueryBuilder('e');
    this.applyScope(qb, 'e');
    const evs = await qb.getMany();
    const today = evs.filter((e) => new Date(e.created_at) >= start);
    const unitsToday = today.reduce((a, e) => a + Number(e.units ?? 0), 0);
    const floorEvents = await this.listFloorEvents({ line: filters.line });
    const openAndons = floorEvents.filter((f) => (f.status === 'OPEN' || f.status === 'ACK') && f.type.startsWith('ANDON')).length;
    const defectsToday = floorEvents.filter((f) => f.type === 'DEFECT' && f.raisedAt && new Date(f.raisedAt) >= start).length;
    const elapsedHours = Math.max(1, (Date.now() - start.getTime()) / 3_600_000);
    return {
      unitsToday,
      eventsToday: today.length,
      openAndons,
      defectsToday,
      unitsPerHour: round(unitsToday / elapsedHours, 1),
    };
  }

  private async record(action: string, referenceId: string, metadata: Record<string, unknown>): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        actorName: this.tenantCtx.getUserEmail(),
        domain: EventDomain.PRODUCTION,
        action,
        referenceType: 'SF_OPERATOR',
        referenceId,
        plant: this.tenantCtx.getPlantId() ?? undefined,
        metadata,
      });
    } catch (err) {
      this.logger.warn(`Ledger skipped for ${action}: ${(err as Error)?.message}`);
    }
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function round(n: number, dp = 2): number {
  const f = Math.pow(10, dp);
  return Math.round((Number(n) || 0) * f) / f;
}
