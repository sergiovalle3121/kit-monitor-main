import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { UnitFlow } from './entities/unit-flow.entity';
import {
  destinationForResult,
  stageForResult,
  UnitFlowStage,
} from './unit-flow-stage';
import {
  EnqueueFromAssemblyInput,
  RouteFromTestInput,
} from './dto/test-flow.dto';

import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { FloorQualityService } from '../floor-quality/floor-quality.service';
import { GenealogyService } from '../genealogy/genealogy.service';

export interface UnitFlowSummary {
  total: number;
  awaitingTest: number;
  readyForPackaging: number;
  inDisposition: number;
}

export interface UnitTrace {
  serial: string;
  workOrder: string | null;
  executionId: number | null;
  model: string | null;
  stage: UnitFlowStage;
  testResult: 'PASS' | 'FAIL' | null;
  failureCode: string | null;
  testRecordId: string | null;
  destination: 'PACKAGING' | 'DISPOSITION' | null;
  holdId: string | null;
  enqueuedAt: Date | null;
  testedAt: Date | null;
  routedAt: Date | null;
  /** Immutable journey from the Event Ledger (queued → routed). */
  events: unknown[];
  /** Component as-built tree (cradle-to-grave) when genealogy is available. */
  asBuilt: Record<string, unknown> | null;
}

/**
 * The Assembly → Pruebas → Empaque/Disposición weave (Frente Pruebas · Eslabón 1).
 *
 * Additive bridge service. It is *called by* the MES (when a serial finishes the
 * last assembly station) and *by* testing (when a result is captured), and it
 * *reuses* floor-quality holds for failures and the Event Ledger / genealogy for
 * traceability. It does not rewrite, or even hard-depend on, any of them — every
 * collaborator is optional so existing unit tests keep instantiating their
 * services unchanged.
 */
@Injectable()
export class TestFlowService {
  private readonly logger = new Logger(TestFlowService.name);

  constructor(
    @InjectRepository(UnitFlow)
    private readonly repo: Repository<UnitFlow>,
    private readonly tenantCtx: TenantContextService,
    @Optional() private readonly ledger?: EventLedgerService,
    @Optional() private readonly floorQuality?: FloorQualityService,
    @Optional() private readonly genealogy?: GenealogyService,
  ) {}

  private applyScope(
    qb: SelectQueryBuilder<UnitFlow>,
    alias: string,
  ): SelectQueryBuilder<UnitFlow> {
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

  private async findBySerial(serial: string): Promise<UnitFlow | null> {
    const qb = this.repo
      .createQueryBuilder('u')
      .where('u.serial_number = :s', { s: serial });
    this.applyScope(qb, 'u');
    return qb.getOne();
  }

  // ── Assembly → test queue ───────────────────────────────────────────────────
  /**
   * Hand a finished serial off to the Pruebas queue. Idempotent per serial:
   * re-confirming the same serial refreshes its assembly provenance but never
   * duplicates the queue entry nor clobbers an existing test outcome.
   */
  async enqueueFromAssembly(
    input: EnqueueFromAssemblyInput,
  ): Promise<UnitFlow> {
    const serial = input.serialNumber?.trim();
    if (!serial) throw new BadRequestException('serialNumber requerido.');

    let unit = await this.findBySerial(serial);
    const isNew = !unit;
    if (!unit) {
      unit = this.repo.create({
        serialNumber: serial,
        stage: 'AWAITING_TEST',
        enqueuedAt: new Date(),
        ...this.scopeFields(),
      });
    }
    // Refresh provenance additively — keep whatever we already knew.
    unit.workOrder = input.workOrder?.trim() || unit.workOrder || null;
    unit.executionId = input.executionId ?? unit.executionId ?? null;
    unit.model = input.model?.trim() || unit.model || null;
    unit.assemblyStation =
      input.station?.trim() || unit.assemblyStation || null;
    unit.programId = input.programId?.trim() || unit.programId || null;
    if (!unit.enqueuedAt) unit.enqueuedAt = new Date();

    const saved = await this.repo.save(unit);
    if (isNew) {
      await this.record('UNIT_QUEUED_FOR_TEST', EventDomain.PRODUCTION, saved, {
        context: { serial, station: saved.assemblyStation },
      });
    }
    return saved;
  }

  // ── Test result → destination ───────────────────────────────────────────────
  /**
   * Route a serial by its test result. PASS → ready for Empaque; FAIL → the
   * existing floor-quality hold/disposition flow (no new disposition invented).
   * Works even if the serial never went through the assembly hook — it creates
   * the flow row on the fly so traceability is never lost.
   */
  async routeFromTest(input: RouteFromTestInput): Promise<UnitFlow> {
    const serial = input.serialNumber?.trim();
    if (!serial) throw new BadRequestException('serialNumber requerido.');

    let unit = await this.findBySerial(serial);
    if (!unit) {
      unit = this.repo.create({
        serialNumber: serial,
        stage: 'AWAITING_TEST',
        enqueuedAt: new Date(),
        model: input.model?.trim() || null,
        ...this.scopeFields(),
      });
    }

    unit.testResult = input.result;
    unit.testRecordId = input.testRecordId ?? unit.testRecordId ?? null;
    unit.model = unit.model || input.model?.trim() || null;
    unit.stage = stageForResult(input.result);
    unit.destination = destinationForResult(input.result);
    unit.testedAt = new Date();
    unit.routedAt = new Date();

    if (input.result === 'PASS') {
      unit.failureCode = null;
      const saved = await this.repo.save(unit);
      await this.record(
        'UNIT_ROUTED_TO_PACKAGING',
        EventDomain.PRODUCTION,
        saved,
        { context: { serial }, metadata: { result: 'PASS' } },
      );
      return saved;
    }

    // FAIL → disposition. Reuse the floor-quality hold flow.
    unit.failureCode = input.failureCode ?? 'UNKNOWN';
    if (this.floorQuality) {
      try {
        const hold = await this.floorQuality.createHold({
          origin: 'IN_PROCESS',
          part: (unit.model || serial).slice(0, 64),
          qty: 1,
          serial,
          station: (input.station || unit.assemblyStation || undefined)?.slice(
            0,
            32,
          ),
          defectType: (
            input.failureDescription || `Test FAIL · ${unit.failureCode}`
          ).slice(0, 120),
          severity: 'HIGH',
        });
        unit.holdId = hold.id;
      } catch (err) {
        this.logger.warn(
          `Disposition hold skipped for ${serial}: ${(err as Error)?.message}`,
        );
      }
    }
    const saved = await this.repo.save(unit);
    await this.record(
      'UNIT_ROUTED_TO_DISPOSITION',
      EventDomain.QUALITY,
      saved,
      {
        context: { serial },
        metadata: {
          result: 'FAIL',
          failureCode: saved.failureCode,
          holdId: saved.holdId,
        },
      },
    );
    return saved;
  }

  // ── Queries ─────────────────────────────────────────────────────────────────
  /** The Pruebas queue (default) or any stage; `stage=ALL` returns everything. */
  async getQueue(filters: { stage?: string } = {}): Promise<UnitFlow[]> {
    const qb = this.repo.createQueryBuilder('u');
    this.applyScope(qb, 'u');
    const stage = filters.stage ?? 'AWAITING_TEST';
    if (stage && stage !== 'ALL') qb.andWhere('u.stage = :st', { st: stage });
    return qb.orderBy('u.enqueued_at', 'DESC').getMany();
  }

  /** End-to-end trace for one serial: WO → prueba → destino (+ ledger journey). */
  async trace(serial: string): Promise<UnitTrace> {
    const s = serial?.trim();
    if (!s) throw new BadRequestException('serial requerido.');
    const unit = await this.findBySerial(s);
    if (!unit) throw new NotFoundException(`Sin flujo para el serial ${s}.`);

    let events: unknown[] = [];
    if (this.ledger) {
      events = await this.ledger
        .getEventsByReference('UNIT_FLOW', s)
        .catch(() => []);
    }
    let asBuilt: Record<string, unknown> | null = null;
    if (this.genealogy) {
      asBuilt = (await this.genealogy
        .asBuiltBySerial(s)
        .catch(() => null)) as Record<string, unknown> | null;
    }

    return {
      serial: s,
      workOrder: unit.workOrder,
      executionId: unit.executionId,
      model: unit.model,
      stage: unit.stage,
      testResult: unit.testResult,
      failureCode: unit.failureCode,
      testRecordId: unit.testRecordId,
      destination: unit.destination,
      holdId: unit.holdId,
      enqueuedAt: unit.enqueuedAt,
      testedAt: unit.testedAt,
      routedAt: unit.routedAt,
      events,
      asBuilt,
    };
  }

  /** Counts by stage for dashboards. */
  async summary(): Promise<UnitFlowSummary> {
    const rows = await this.getQueue({ stage: 'ALL' });
    const count = (st: UnitFlowStage) =>
      rows.filter((r) => r.stage === st).length;
    return {
      total: rows.length,
      awaitingTest: count('AWAITING_TEST'),
      readyForPackaging: count('READY_FOR_PACKAGING'),
      inDisposition: count('IN_DISPOSITION'),
    };
  }

  private async record(
    action: string,
    domain: EventDomain,
    unit: UnitFlow,
    extra?: {
      context?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!this.ledger) return;
    try {
      await this.ledger.recordEvent({
        domain,
        action,
        referenceType: 'UNIT_FLOW',
        referenceId: unit.serialNumber,
        actorName: this.tenantCtx.getUserEmail(),
        model: unit.model ?? undefined,
        workOrder: unit.workOrder ?? undefined,
        plant: unit.plant_id ?? undefined,
        context: extra?.context,
        metadata: extra?.metadata,
      });
    } catch (err) {
      this.logger.warn(
        `Ledger write skipped (${action}): ${(err as Error)?.message}`,
      );
    }
  }
}
