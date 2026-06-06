import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { WorkOrderExecution } from './entities/work-order-execution.entity';
import { ExecutionStep } from './entities/execution-step.entity';
import { ExecutionStepMaterial } from './entities/execution-step-material.entity';
import { ExecutionEvent } from './entities/execution-event.entity';
import { StationIncident } from './entities/station-incident.entity';
import { AndonCall } from './entities/andon-call.entity';
import { MesDowntime, DowntimeReason } from './entities/mes-downtime.entity';
import { StationAssignment } from './entities/station-assignment.entity';

import { Plan } from '../plans/entities/plan.entity';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { ProcessStep } from '../process-routing/entities/process-step.entity';

import { InventoryService } from '../inventory/inventory.service';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';
import { SignalGateway } from '../../common/gateway/signal.gateway';
import { MaterialRequestsService } from '../material-requests/material-requests.service';
import { VisualAidsService } from '../visual-aids/visual-aids.service';

import {
  AssignStationDto,
  ConfirmAdvanceDto,
  DispositionIncidentDto,
  OpenExecutionDto,
  RaiseAndonDto,
  ReportIncidentDto,
} from './dto/mes.dto';

const DEFAULT_TENANT = 'default';
const REVERT_WINDOW_MS = 180_000; // 3 min undo window for a confirmed advance
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export type VisualAidView =
  | { kind: 'image' | 'pdf'; id: string; title: string; fileUrl: string }
  | { kind: 'office'; id: string; documentUrl: string };

export interface StepMaterialView {
  id: number;
  partNumber: string;
  description: string | null;
  unit: string;
  qtyPerUnit: number;
  plannedQty: number;
  consumedQty: number;
  remaining: number;
  availableQty: number;
  short: boolean;
}

@Injectable()
export class MesExecutionService {
  private readonly logger = new Logger(MesExecutionService.name);

  constructor(
    @InjectRepository(WorkOrderExecution)
    private readonly execRepo: Repository<WorkOrderExecution>,
    @InjectRepository(ExecutionStep)
    private readonly stepRepo: Repository<ExecutionStep>,
    @InjectRepository(ExecutionStepMaterial)
    private readonly stepMatRepo: Repository<ExecutionStepMaterial>,
    @InjectRepository(ExecutionEvent)
    private readonly eventRepo: Repository<ExecutionEvent>,
    @InjectRepository(StationIncident)
    private readonly incidentRepo: Repository<StationIncident>,
    @InjectRepository(AndonCall)
    private readonly andonRepo: Repository<AndonCall>,
    @InjectRepository(MesDowntime)
    private readonly downtimeRepo: Repository<MesDowntime>,
    @InjectRepository(StationAssignment)
    private readonly assignRepo: Repository<StationAssignment>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(Kit) private readonly kitRepo: Repository<Kit>,
    @InjectRepository(ProcessStep)
    private readonly processStepRepo: Repository<ProcessStep>,
    private readonly inventory: InventoryService,
    private readonly ledger: EventLedgerService,
    private readonly signals: SignalGateway,
    private readonly materialRequests: MaterialRequestsService,
    private readonly visualAids: VisualAidsService,
    private readonly dataSource: DataSource,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Open / list executions
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Open a Work Order on the line: explode the model's route + the kit PickList
   * into per-station execution rows. Idempotent — returns the existing run.
   */
  async openExecution(dto: OpenExecutionDto, actor: string) {
    const plan = await this.resolvePlan(dto);

    const existing = await this.execRepo.findOne({
      where: { planId: plan.id },
    });
    if (existing) return this.getBoard({ executionId: existing.id });

    const route = await this.processStepRepo.find({
      where: {
        model: plan.model,
        ...(dto.revision ? { revision: dto.revision } : {}),
      },
      relations: ['materials'],
      order: { sequence: 'ASC' },
    });
    if (!route.length) {
      throw new BadRequestException(
        `El modelo ${plan.model} no tiene ruta de proceso autorada todavía.`,
      );
    }

    const kit = await this.kitRepo.findOne({
      where: { plan: { id: plan.id } },
      relations: ['materials', 'plan'],
    });
    const kitMaterials = kit?.materials ?? [];
    const revision = dto.revision || route[0].revision || '1.0';

    const execution = await this.execRepo.save(
      this.execRepo.create({
        planId: plan.id,
        kitId: kit?.id ?? null,
        workOrder: plan.workOrder,
        model: plan.model,
        revision,
        line: plan.line ?? null,
        buildingId: plan.buildingId ?? null,
        quantity: plan.quantity ?? 0,
        status: 'open',
        startedAt: null,
        completedAt: null,
      }),
    );

    for (const step of route) {
      const execStep = await this.stepRepo.save(
        this.stepRepo.create({
          executionId: execution.id,
          stepId: step.id,
          sequence: step.sequence,
          name: step.name,
          stationType: step.stationType ?? null,
          visualAidId: step.visualAidId ?? null,
          instructions: step.instructions ?? null,
          unitsTarget: execution.quantity,
          unitsCompleted: 0,
          scrapQty: 0,
          segregatedQty: 0,
          status: 'pending',
        }),
      );

      for (const mat of step.materials ?? []) {
        const km = kitMaterials.find((k) => k.partNumber === mat.partNumber);
        const delivered =
          km?.quantityActual ??
          km?.quantityRequired ??
          mat.qtyPerUnit * execution.quantity;
        await this.stepMatRepo.save(
          this.stepMatRepo.create({
            executionStepId: execStep.id,
            executionId: execution.id,
            partNumber: mat.partNumber,
            description: mat.description ?? km?.description ?? null,
            unit: mat.unit || km?.unit || 'EA',
            qtyPerUnit: mat.qtyPerUnit,
            kitMaterialId: km?.id ?? null,
            plannedQty: round6(mat.qtyPerUnit * execution.quantity),
            consumedQty: 0,
            scrapQty: 0,
            availableQty: round6(delivered + (km?.quantityResupplied ?? 0)),
            lowStockThreshold: 0,
          }),
        );
      }
    }

    await this.recordLedger(
      'MES_EXECUTION_OPENED',
      'WORK_ORDER',
      String(execution.id),
      execution,
      actor,
    );
    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:execution-opened', {
      executionId: execution.id,
      workOrder: execution.workOrder,
      model: execution.model,
      line: execution.line,
    });

    return this.getBoard({ executionId: execution.id });
  }

  async listExecutions(filters?: {
    line?: string;
    status?: string;
    model?: string;
  }) {
    const qb = this.execRepo
      .createQueryBuilder('e')
      .orderBy('e.createdAt', 'DESC');
    if (filters?.status)
      qb.andWhere('e.status = :status', { status: filters.status });
    if (filters?.model)
      qb.andWhere('e.model = :model', { model: filters.model });
    if (filters?.line)
      qb.andWhere('e.line = :line', { line: Number(filters.line) });
    const rows = await qb.getMany();

    return Promise.all(
      rows.map(async (e) => {
        const steps = await this.stepRepo.find({
          where: { executionId: e.id },
        });
        const totalTarget = e.quantity * (steps.length || 1);
        const totalDone = steps.reduce((s, st) => s + st.unitsCompleted, 0);
        return {
          id: e.id,
          workOrder: e.workOrder,
          model: e.model,
          revision: e.revision,
          line: e.line,
          quantity: e.quantity,
          status: e.status,
          steps: steps.length,
          progress: totalTarget ? round6(totalDone / totalTarget) : 0,
          blocked: steps.some((s) => s.status === 'blocked'),
          startedAt: e.startedAt,
          completedAt: e.completedAt,
        };
      }),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Operator board
  // ──────────────────────────────────────────────────────────────────────────

  async getBoard(args: {
    workOrder?: string;
    executionId?: number;
    stepId?: number;
  }) {
    const execution = await this.resolveExecution(args);
    const steps = await this.stepRepo.find({
      where: { executionId: execution.id },
      order: { sequence: 'ASC' },
    });

    const stepViews = steps.map((s, i) => {
      const upstreamAvailable =
        i === 0 ? execution.quantity : steps[i - 1].unitsCompleted;
      const consumedFromUpstream =
        s.unitsCompleted + s.scrapQty + s.segregatedQty;
      const maxConfirmable = Math.max(
        0,
        round6(upstreamAvailable - consumedFromUpstream),
      );
      const starved =
        s.status !== 'completed' &&
        s.status !== 'blocked' &&
        maxConfirmable <= 0 &&
        s.unitsCompleted < s.unitsTarget;
      return {
        id: s.id,
        stepId: s.stepId,
        sequence: s.sequence,
        name: s.name,
        stationType: s.stationType,
        status: s.status,
        unitsTarget: s.unitsTarget,
        unitsCompleted: s.unitsCompleted,
        scrapQty: s.scrapQty,
        segregatedQty: s.segregatedQty,
        upstreamAvailable,
        maxConfirmable,
        starved,
        currentOperator: s.currentOperator,
        blockReason: s.blockReason,
      };
    });

    const current =
      steps.find((s) => (args.stepId ? s.stepId === args.stepId : false)) ??
      steps.find((s) => s.status !== 'completed') ??
      steps[steps.length - 1];

    let materials: StepMaterialView[] = [];
    let visualAid: VisualAidView | null = null;
    let incidents: StationIncident[] = [];
    if (current) {
      const mats = await this.stepMatRepo.find({
        where: { executionStepId: current.id },
        order: { partNumber: 'ASC' },
      });
      materials = mats.map((m) => ({
        id: m.id,
        partNumber: m.partNumber,
        description: m.description,
        unit: m.unit,
        qtyPerUnit: m.qtyPerUnit,
        plannedQty: m.plannedQty,
        consumedQty: m.consumedQty,
        remaining: round6(m.plannedQty - m.consumedQty),
        availableQty: m.availableQty,
        short: m.availableQty <= m.lowStockThreshold,
      }));
      visualAid = await this.resolveVisualAid(
        execution.model,
        current.visualAidId,
      );
      incidents = await this.incidentRepo.find({
        where: { executionStepId: current.id, status: 'open' },
        order: { createdAt: 'DESC' },
      });
    }

    const [andons, downtimes, assignments] = await Promise.all([
      this.andonRepo.find({
        where: { executionId: execution.id },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.downtimeRepo.find({
        where: { executionId: execution.id },
        order: { startedAt: 'DESC' },
        take: 20,
      }),
      this.assignRepo.find({
        where: { executionId: execution.id, active: true },
      }),
    ]);

    let pendingRequests: any[] = [];
    if (execution.kitId) {
      try {
        pendingRequests = await this.materialRequests.findAll({
          kitId: execution.kitId,
          status: 'pending',
        });
      } catch {
        pendingRequests = [];
      }
    }

    const openDowntime = downtimes.filter((d) => !d.endedAt);

    return {
      execution: {
        id: execution.id,
        workOrder: execution.workOrder,
        model: execution.model,
        revision: execution.revision,
        line: execution.line,
        buildingId: execution.buildingId,
        quantity: execution.quantity,
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
      },
      steps: stepViews,
      currentStep: current ? stepViews.find((v) => v.id === current.id) : null,
      currentStepDetail: current
        ? {
            id: current.id,
            stepId: current.stepId,
            name: current.name,
            instructions: current.instructions,
            visualAid,
            materials,
            openIncidents: incidents.map((i) => this.serializeIncident(i)),
          }
        : null,
      andons: andons.map((a) => this.serializeAndon(a)),
      openDowntime: openDowntime.map((d) => this.serializeDowntime(d)),
      assignments: assignments.map((a) => ({
        stepId: a.stepId,
        operatorName: a.operatorName,
        operatorId: a.operatorId,
      })),
      materialRequests: pendingRequests,
      downtimeSummarySec: downtimes.reduce(
        (s, d) => s + (d.durationSec ?? this.elapsedSec(d.startedAt)),
        0,
      ),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Confirm advance (backflush)
  // ──────────────────────────────────────────────────────────────────────────

  async confirmAdvance(
    executionId: number,
    stepId: number,
    dto: ConfirmAdvanceDto,
    actor: string,
  ) {
    const quantity = Number(dto.quantity);
    const scrap = Math.max(0, Number(dto.scrap ?? 0));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity debe ser mayor a 0');
    }
    if (!dto.clientRequestId?.trim()) {
      throw new BadRequestException('clientRequestId es obligatorio');
    }
    const clientRequestId = dto.clientRequestId.trim();
    const operator = dto.operator || actor;

    const execution = await this.findExecution(executionId);

    const outcome = await this.dataSource.transaction(async (em) => {
      const duplicate = await em.findOne(ExecutionEvent, {
        where: { clientRequestId },
      });
      if (duplicate) return { duplicated: true } as const;

      const steps = await em.find(ExecutionStep, {
        where: { executionId },
        order: { sequence: 'ASC' },
      });
      const idx = steps.findIndex((s) => s.stepId === stepId);
      if (idx < 0)
        throw new NotFoundException(`Estación ${stepId} no está en esta WO.`);
      const step = steps[idx];

      if (step.status === 'blocked') {
        throw new ConflictException({
          code: 'STEP_BLOCKED',
          message: `La estación "${step.name}" está bloqueada por calidad.`,
        });
      }

      // Forward WIP + overbuild guard: cannot consume more than the upstream
      // station has released (or the WO quantity at the first station).
      const upstreamAvailable =
        idx === 0 ? execution.quantity : steps[idx - 1].unitsCompleted;
      const consumedFromUpstream =
        step.unitsCompleted + step.scrapQty + step.segregatedQty;
      const remainingUpstream = round6(
        upstreamAvailable - consumedFromUpstream,
      );
      if (quantity + scrap > remainingUpstream + 1e-6) {
        throw new ConflictException({
          code: 'UPSTREAM_LIMIT',
          message:
            idx === 0
              ? `Solo quedan ${remainingUpstream} u del plan (WO ${execution.workOrder}).`
              : `La estación previa solo ha liberado ${remainingUpstream} u buenas.`,
        });
      }

      const consumeUnits = quantity + scrap;
      const materials = await em.find(ExecutionStepMaterial, {
        where: { executionStepId: step.id },
      });

      const shortageParts: { partNumber: string; remaining: number }[] = [];
      const consumption: {
        partNumber: string;
        consumed: number;
        remaining: number;
      }[] = [];

      for (const m of materials) {
        const consume = round6(m.qtyPerUnit * consumeUnits);
        m.consumedQty = round6(m.consumedQty + consume);
        m.scrapQty = round6(m.scrapQty + m.qtyPerUnit * scrap);
        m.availableQty = round6(m.availableQty - consume);
        await em.save(ExecutionStepMaterial, m);

        // Authoritative decrement on the kit PickList row.
        if (m.kitMaterialId) {
          const km = await em.findOne(KitMaterial, {
            where: { id: m.kitMaterialId },
          });
          if (km) {
            km.quantityConsumed = round6((km.quantityConsumed ?? 0) + consume);
            const base = km.quantityActual ?? km.quantityRequired ?? 0;
            km.quantityRemaining = round6(
              base + (km.quantityResupplied ?? 0) - km.quantityConsumed,
            );
            await em.save(KitMaterial, km);
          }
        }

        // Formal inventory consumption — best-effort (works only once the part
        // exists in inventory; never blocks the line if it doesn't).
        await this.inventory
          .recordTransaction({
            type: 'CONSUME',
            partNumber: m.partNumber,
            quantity: consume,
            fromWarehouseId: `LINE-${execution.line ?? 0}`,
            fromLocation: step.name,
            actorName: operator,
            referenceType: 'MES_EXECUTION_EVENT',
            referenceId: clientRequestId,
            reason: `MES consumo · WO ${execution.workOrder} · ${step.name}`,
          })
          .catch(() => undefined);

        consumption.push({
          partNumber: m.partNumber,
          consumed: m.consumedQty,
          remaining: round6(m.plannedQty - m.consumedQty),
        });
        if (m.availableQty <= m.lowStockThreshold) {
          shortageParts.push({
            partNumber: m.partNumber,
            remaining: m.availableQty,
          });
        }
      }

      // Advance the station counters.
      step.unitsCompleted = round6(step.unitsCompleted + quantity);
      step.scrapQty = round6(step.scrapQty + scrap);
      step.currentOperator = operator;
      if (!step.startedAt) step.startedAt = new Date();
      // A station is done when it has processed all available upstream input
      // (good + scrap + segregated) and the upstream station won't feed it more.
      // This stays correct under scrap/segregation, where good output < target.
      const processed =
        step.unitsCompleted + step.scrapQty + step.segregatedQty;
      const upstreamCompleted =
        idx === 0 || steps[idx - 1].status === 'completed';
      if (upstreamCompleted && processed >= upstreamAvailable - 1e-6) {
        step.status = 'completed';
        step.completedAt = new Date();
      } else {
        step.status = 'in_process';
      }
      await em.save(ExecutionStep, step);

      const event = await em.save(
        em.create(ExecutionEvent, {
          executionId,
          executionStepId: step.id,
          quantity,
          scrapQty: scrap,
          operator,
          operatorPosition: dto.operatorPosition ?? null,
          serial: dto.serial ?? null,
          lot: dto.lot ?? null,
          clientRequestId,
          notes: dto.notes ?? null,
          timestamp: new Date(),
        }),
      );

      // Mark the execution complete when every station is done.
      const allDone = steps.every((s) =>
        s.id === step.id
          ? step.status === 'completed'
          : s.status === 'completed',
      );
      if (allDone && execution.status !== 'completed') {
        await em.update(WorkOrderExecution, execution.id, {
          status: 'completed',
          completedAt: new Date(),
        });
        execution.status = 'completed';
      } else if (!execution.startedAt) {
        await em.update(WorkOrderExecution, execution.id, {
          startedAt: new Date(),
        });
      }

      return {
        duplicated: false as const,
        eventId: event.id,
        stepDbId: step.id,
        stepName: step.name,
        shortageParts,
        consumption,
        remainingTargetUnits: round6(step.unitsTarget - step.unitsCompleted),
      };
    });

    if (outcome.duplicated) {
      const board = await this.getBoard({ executionId, stepId });
      return { ...board, duplicated: true, code: 'DUPLICATE_REQUEST' };
    }

    // After commit: resolve / recover downtime, raise replenishment, broadcast.
    if (outcome.shortageParts.length) {
      await this.raiseShortage(
        execution,
        stepId,
        outcome.stepDbId,
        outcome.stepName,
        outcome.shortageParts,
        outcome.remainingTargetUnits,
        operator,
      );
    } else {
      await this.closeDowntime({
        executionStepId: outcome.stepDbId,
        reason: 'material_shortage',
      });
    }

    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:step-advanced', {
      executionId,
      stepId,
      workOrder: execution.workOrder,
      model: execution.model,
      line: execution.line,
      quantity,
      scrap,
      operator,
      serial: dto.serial ?? null,
    });
    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:consumption', {
      executionId,
      stepId,
      consumption: outcome.consumption,
    });

    await this.recordLedger(
      'MES_STEP_ADVANCED',
      'WORK_ORDER',
      execution.workOrder,
      execution,
      operator,
      {
        transaction: { quantity },
        context: {
          serial: dto.serial,
          lot: dto.lot,
          station: outcome.stepName,
        },
        metadata: { stepId, scrap },
      },
    );

    const board = await this.getBoard({ executionId, stepId });
    return { ...board, lastEvent: { id: outcome.eventId, quantity, scrap } };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Quality incident + disposition (segregation)
  // ──────────────────────────────────────────────────────────────────────────

  async reportIncident(
    executionId: number,
    stepId: number,
    dto: ReportIncidentDto,
    actor: string,
  ) {
    if (!dto.type?.trim()) throw new BadRequestException('type es obligatorio');
    const execution = await this.findExecution(executionId);
    const step = await this.findStep(executionId, stepId);
    const operator = dto.operator || actor;
    const qtyAffected = Math.max(0, Number(dto.qtyAffected ?? 0));

    const incident = await this.incidentRepo.save(
      this.incidentRepo.create({
        executionId,
        executionStepId: step.id,
        stepName: step.name,
        type: dto.type.trim(),
        severity: dto.severity ?? 'medium',
        description: dto.description ?? null,
        qtyAffected,
        serial: dto.serial ?? null,
        photoVisualAidId: dto.photoVisualAidId ?? null,
        blocksFlow: !!dto.blocksFlow,
        status: 'open',
        raisedBy: operator,
        ncrId: dto.escalateToNcr ? 'PENDING_NCR' : null,
      }),
    );

    // Segregate the affected units out of the good flow.
    if (qtyAffected > 0) {
      const moved = Math.min(qtyAffected, step.unitsCompleted);
      step.unitsCompleted = round6(step.unitsCompleted - moved);
      step.segregatedQty = round6(step.segregatedQty + qtyAffected);
    }
    if (dto.blocksFlow) {
      step.status = 'blocked';
      step.blockReason = `Calidad: ${dto.type.trim()}`;
      await this.openDowntime(executionId, step.id, 'quality_block', {
        triggeredBy: operator,
        incidentId: incident.id,
        notes: dto.type.trim(),
      });
    } else if (step.status !== 'completed') {
      step.status = step.unitsCompleted > 0 ? 'in_process' : step.status;
    }
    await this.stepRepo.save(step);

    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:incident-raised', {
      executionId,
      stepId,
      incidentId: incident.id,
      type: incident.type,
      severity: incident.severity,
      blocksFlow: incident.blocksFlow,
      qtyAffected,
      workOrder: execution.workOrder,
      model: execution.model,
      line: execution.line,
    });
    await this.recordLedger(
      'MES_QUALITY_INCIDENT',
      'STATION_INCIDENT',
      String(incident.id),
      execution,
      operator,
      {
        metadata: {
          type: incident.type,
          severity: incident.severity,
          qtyAffected,
          blocksFlow: incident.blocksFlow,
        },
      },
      EventDomain.QUALITY,
    );

    return this.getBoard({ executionId, stepId });
  }

  async dispositionIncident(
    incidentId: number,
    dto: DispositionIncidentDto,
    actor: string,
  ) {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId },
    });
    if (!incident)
      throw new NotFoundException(`Incidente ${incidentId} no encontrado.`);
    if (incident.status === 'dispositioned') {
      throw new BadRequestException('El incidente ya fue disposicionado.');
    }
    if (!['rework', 'scrap', 'use_as_is'].includes(dto.disposition)) {
      throw new BadRequestException('disposition inválida.');
    }
    const resolvedBy = dto.resolvedBy || actor;

    incident.status = 'dispositioned';
    incident.disposition = dto.disposition;
    incident.resolvedBy = resolvedBy;
    incident.resolvedAt = new Date();
    await this.incidentRepo.save(incident);

    const step = await this.stepRepo.findOne({
      where: { id: incident.executionStepId },
    });
    if (step) {
      const seg = Math.min(incident.qtyAffected, step.segregatedQty);
      step.segregatedQty = round6(step.segregatedQty - seg);
      if (dto.disposition === 'use_as_is') {
        step.unitsCompleted = round6(step.unitsCompleted + seg);
      } else if (dto.disposition === 'scrap') {
        step.scrapQty = round6(step.scrapQty + seg);
      }
      // 'rework' simply releases the hold; units are re-run through the station.

      if (step.status === 'blocked') {
        const otherBlocking = await this.incidentRepo.count({
          where: { executionStepId: step.id, status: 'open', blocksFlow: true },
        });
        if (!otherBlocking) {
          step.blockReason = null;
          step.status =
            step.unitsCompleted >= step.unitsTarget
              ? 'completed'
              : 'in_process';
          await this.closeDowntime({
            executionStepId: step.id,
            reason: 'quality_block',
          });
        }
      }
      await this.stepRepo.save(step);
    }

    const execution = await this.findExecution(incident.executionId);
    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:incident-dispositioned', {
      executionId: incident.executionId,
      incidentId: incident.id,
      disposition: incident.disposition,
    });
    await this.recordLedger(
      'MES_INCIDENT_DISPOSITIONED',
      'STATION_INCIDENT',
      String(incident.id),
      execution,
      resolvedBy,
      { metadata: { disposition: incident.disposition } },
      EventDomain.QUALITY,
    );

    return this.getBoard({
      executionId: incident.executionId,
      stepId: step?.stepId,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Andon
  // ──────────────────────────────────────────────────────────────────────────

  async raiseAndon(executionId: number, dto: RaiseAndonDto, actor: string) {
    if (!['material', 'quality', 'maintenance', 'stop'].includes(dto.type)) {
      throw new BadRequestException('type de andon inválido.');
    }
    const execution = await this.findExecution(executionId);
    const raisedBy = dto.raisedBy || actor;
    let execStep: ExecutionStep | null = null;
    if (dto.stepId)
      execStep = await this.stepRepo.findOne({
        where: { executionId, stepId: dto.stepId },
      });

    const andon = await this.andonRepo.save(
      this.andonRepo.create({
        executionId,
        executionStepId: execStep?.id ?? null,
        stepName: execStep?.name ?? null,
        type: dto.type,
        status: 'open',
        note: dto.note ?? null,
        raisedBy,
      }),
    );

    if (dto.type === 'stop') {
      await this.openDowntime(executionId, execStep?.id ?? null, 'andon_stop', {
        triggeredBy: raisedBy,
        andonId: andon.id,
        notes: dto.note ?? null,
      });
    }

    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:andon', {
      executionId,
      andonId: andon.id,
      type: andon.type,
      status: andon.status,
      workOrder: execution.workOrder,
      model: execution.model,
      line: execution.line,
      raisedBy,
    });
    await this.recordLedger(
      'MES_ANDON_RAISED',
      'ANDON',
      String(andon.id),
      execution,
      raisedBy,
      { metadata: { type: andon.type } },
    );

    return this.serializeAndon(andon);
  }

  async updateAndon(andonId: number, action: 'ack' | 'resolve', actor: string) {
    const andon = await this.andonRepo.findOne({ where: { id: andonId } });
    if (!andon) throw new NotFoundException(`Andon ${andonId} no encontrado.`);
    if (action === 'ack') {
      andon.status = 'ack';
      andon.acknowledgedBy = actor;
      andon.acknowledgedAt = new Date();
    } else {
      andon.status = 'resolved';
      andon.resolvedBy = actor;
      andon.resolvedAt = new Date();
      if (andon.type === 'stop') {
        await this.closeDowntime({ andonId: andon.id });
      }
    }
    await this.andonRepo.save(andon);
    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:andon', {
      executionId: andon.executionId,
      andonId: andon.id,
      type: andon.type,
      status: andon.status,
    });
    return this.serializeAndon(andon);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Revert (undo last confirm within the window)
  // ──────────────────────────────────────────────────────────────────────────

  async revertEvent(eventId: number, actor: string) {
    const result = await this.dataSource.transaction(async (em) => {
      const event = await em.findOne(ExecutionEvent, {
        where: { id: eventId },
      });
      if (!event)
        throw new NotFoundException(`Evento ${eventId} no encontrado.`);
      if (event.revertedAt)
        throw new BadRequestException('El evento ya fue revertido.');
      if (Date.now() - new Date(event.timestamp).getTime() > REVERT_WINDOW_MS) {
        throw new BadRequestException(
          'Fuera de la ventana de 3 min para deshacer.',
        );
      }

      const step = await em.findOne(ExecutionStep, {
        where: { id: event.executionStepId },
      });
      if (step) {
        const undoUnits = event.quantity + event.scrapQty;
        step.unitsCompleted = Math.max(
          0,
          round6(step.unitsCompleted - event.quantity),
        );
        step.scrapQty = Math.max(0, round6(step.scrapQty - event.scrapQty));
        if (step.status === 'completed') {
          step.status = 'in_process';
          step.completedAt = null;
        }
        await em.save(ExecutionStep, step);

        const materials = await em.find(ExecutionStepMaterial, {
          where: { executionStepId: step.id },
        });
        for (const m of materials) {
          const giveBack = round6(m.qtyPerUnit * undoUnits);
          m.consumedQty = Math.max(0, round6(m.consumedQty - giveBack));
          m.availableQty = round6(m.availableQty + giveBack);
          await em.save(ExecutionStepMaterial, m);
          if (m.kitMaterialId) {
            const km = await em.findOne(KitMaterial, {
              where: { id: m.kitMaterialId },
            });
            if (km) {
              km.quantityConsumed = Math.max(
                0,
                round6((km.quantityConsumed ?? 0) - giveBack),
              );
              const base = km.quantityActual ?? km.quantityRequired ?? 0;
              km.quantityRemaining = round6(
                base + (km.quantityResupplied ?? 0) - km.quantityConsumed,
              );
              await em.save(KitMaterial, km);
            }
          }
        }
      }

      event.revertedAt = new Date();
      event.revertedReason = `Revertido por ${actor}`;
      await em.save(ExecutionEvent, event);
      return {
        executionId: event.executionId,
        stepDbId: event.executionStepId,
      };
    });

    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:event-reverted', {
      executionId: result.executionId,
      eventId,
    });
    const step = await this.stepRepo.findOne({
      where: { id: result.stepDbId },
    });
    return this.getBoard({
      executionId: result.executionId,
      stepId: step?.stepId,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Assignments & hour-by-hour
  // ──────────────────────────────────────────────────────────────────────────

  async assignStation(
    executionId: number,
    dto: AssignStationDto,
    actor: string,
  ) {
    await this.findExecution(executionId);
    if (!dto.operatorName?.trim())
      throw new BadRequestException('operatorName es obligatorio.');
    await this.assignRepo.update(
      { executionId, stepId: dto.stepId, active: true },
      { active: false },
    );
    const assignment = await this.assignRepo.save(
      this.assignRepo.create({
        executionId,
        stepId: dto.stepId,
        operatorName: dto.operatorName.trim(),
        operatorId: dto.operatorId ?? null,
        assignedBy: actor,
        active: true,
      }),
    );
    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:assignment', {
      executionId,
      stepId: dto.stepId,
      operatorName: assignment.operatorName,
    });
    return assignment;
  }

  async getHourly(executionId: number) {
    await this.findExecution(executionId);
    const events = await this.eventRepo.find({
      where: { executionId },
      order: { timestamp: 'ASC' },
    });
    const buckets = new Map<
      string,
      { hour: string; good: number; scrap: number }
    >();
    for (const e of events) {
      if (e.revertedAt) continue;
      const d = new Date(e.timestamp);
      const hour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
      const b = buckets.get(hour) ?? { hour, good: 0, scrap: 0 };
      b.good = round6(b.good + e.quantity);
      b.scrap = round6(b.scrap + e.scrapQty);
      buckets.set(hour, b);
    }
    return Array.from(buckets.values());
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async resolvePlan(dto: OpenExecutionDto): Promise<Plan> {
    let plan: Plan | null = null;
    if (dto.planId)
      plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    else if (dto.workOrder)
      plan = await this.planRepo.findOne({
        where: { workOrder: dto.workOrder },
      });
    if (!plan) throw new NotFoundException('Plan / WO no encontrado.');
    return plan;
  }

  private async resolveExecution(args: {
    workOrder?: string;
    executionId?: number;
  }): Promise<WorkOrderExecution> {
    let execution: WorkOrderExecution | null = null;
    if (args.executionId)
      execution = await this.execRepo.findOne({
        where: { id: args.executionId },
      });
    else if (args.workOrder)
      execution = await this.execRepo.findOne({
        where: { workOrder: args.workOrder },
      });
    if (!execution)
      throw new NotFoundException('Ejecución / WO no encontrada en el MES.');
    return execution;
  }

  private async findExecution(id: number): Promise<WorkOrderExecution> {
    const execution = await this.execRepo.findOne({ where: { id } });
    if (!execution)
      throw new NotFoundException(`Ejecución ${id} no encontrada.`);
    return execution;
  }

  private async findStep(
    executionId: number,
    stepId: number,
  ): Promise<ExecutionStep> {
    const step = await this.stepRepo.findOne({
      where: { executionId, stepId },
    });
    if (!step)
      throw new NotFoundException(`Estación ${stepId} no está en esta WO.`);
    return step;
  }

  /** Resolve a step's visualAidId to a renderable descriptor for the operator screen. */
  private async resolveVisualAid(
    model: string,
    visualAidId: string | null,
  ): Promise<VisualAidView | null> {
    if (!visualAidId) return null;
    try {
      const aids = await this.visualAids.findAll(model);
      const va = aids.find((a) => a.id === visualAidId);
      if (va) {
        const filename = (va as { pdfUrl?: string }).pdfUrl ?? '';
        const kind = filename.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image';
        return {
          kind,
          id: va.id,
          title: va.title,
          fileUrl: `/visual-aids/file/${filename}`,
        };
      }
    } catch {
      /* fall through to office */
    }
    // Not a visual aid → assume an Office presentation/document id.
    return {
      kind: 'office',
      id: visualAidId,
      documentUrl: `/office-documents/${visualAidId}`,
    };
  }

  /**
   * Material short at a station → raise a capped replenishment request to the
   * warehouse (reusing the pull system) and open a downtime clock. The cap
   * prevents over-issuing material when the plan is nearly finished.
   */
  private async raiseShortage(
    execution: WorkOrderExecution,
    routeStepId: number,
    execStepId: number,
    stepName: string,
    parts: { partNumber: string; remaining: number }[],
    remainingTargetUnits: number,
    operator: string,
  ) {
    if (remainingTargetUnits <= 0) {
      // Plan basically done — do NOT request more material (avoid excess).
      this.signals.emitToTenant(DEFAULT_TENANT, 'mes:shortage', {
        executionId: execution.id,
        stepId: routeStepId,
        parts,
        suppressed: true,
        reason: 'plan_near_complete',
      });
      return;
    }

    const partList = parts.map((p) => p.partNumber).join(', ');
    const note = `MES · Línea ${execution.line ?? '?'} · ${stepName}: faltante de ${partList}. Faltan ~${remainingTargetUnits} u del plan (WO ${execution.workOrder}).`;

    let materialRequestId: number | null = null;
    if (execution.kitId) {
      try {
        const req = await this.materialRequests.create(
          { kitId: execution.kitId, note },
          operator,
        );
        materialRequestId = (req as { id?: number })?.id ?? null;
      } catch (err) {
        // A pending request may already exist, or the plan isn't published —
        // the downtime + socket signal still capture the shortage.
        this.logger.debug(
          `Shortage request skipped: ${(err as Error).message}`,
        );
      }
    }

    await this.openDowntime(execution.id, execStepId, 'material_shortage', {
      triggeredBy: operator,
      partNumber: parts[0]?.partNumber ?? null,
      materialRequestId,
      notes: note,
    });

    this.signals.emitToTenant(DEFAULT_TENANT, 'mes:shortage', {
      executionId: execution.id,
      stepId: routeStepId,
      workOrder: execution.workOrder,
      model: execution.model,
      line: execution.line,
      parts,
      materialRequestId,
    });
  }

  private async openDowntime(
    executionId: number,
    executionStepId: number | null,
    reason: DowntimeReason,
    extra: {
      triggeredBy?: string;
      partNumber?: string | null;
      materialRequestId?: number | null;
      andonId?: number | null;
      incidentId?: number | null;
      notes?: string | null;
    },
  ) {
    const open = await this.downtimeRepo.findOne({
      where: {
        executionId,
        executionStepId: executionStepId ?? IsNull(),
        reason,
        endedAt: IsNull(),
      },
    });
    if (open) return open;
    return this.downtimeRepo.save(
      this.downtimeRepo.create({
        executionId,
        executionStepId: executionStepId ?? null,
        reason,
        startedAt: new Date(),
        partNumber: extra.partNumber ?? null,
        triggeredBy: extra.triggeredBy ?? null,
        materialRequestId: extra.materialRequestId ?? null,
        andonId: extra.andonId ?? null,
        incidentId: extra.incidentId ?? null,
        notes: extra.notes ?? null,
      }),
    );
  }

  private async closeDowntime(filter: {
    executionStepId?: number;
    reason?: DowntimeReason;
    andonId?: number;
  }) {
    const where: FindOptionsWhere<MesDowntime> = { endedAt: IsNull() };
    if (filter.executionStepId !== undefined)
      where.executionStepId = filter.executionStepId;
    if (filter.reason) where.reason = filter.reason;
    if (filter.andonId !== undefined) where.andonId = filter.andonId;
    const open = await this.downtimeRepo.find({ where });
    for (const d of open) {
      d.endedAt = new Date();
      d.durationSec = this.elapsedSec(d.startedAt);
      await this.downtimeRepo.save(d);
    }
  }

  private elapsedSec(from: Date): number {
    return Math.max(
      0,
      Math.round((Date.now() - new Date(from).getTime()) / 1000),
    );
  }

  private serializeIncident(i: StationIncident) {
    return {
      id: i.id,
      stepName: i.stepName,
      type: i.type,
      severity: i.severity,
      description: i.description,
      qtyAffected: i.qtyAffected,
      blocksFlow: i.blocksFlow,
      status: i.status,
      disposition: i.disposition,
      raisedBy: i.raisedBy,
      createdAt: i.createdAt,
    };
  }

  private serializeAndon(a: AndonCall) {
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      stepName: a.stepName,
      note: a.note,
      raisedBy: a.raisedBy,
      acknowledgedBy: a.acknowledgedBy,
      createdAt: a.createdAt,
    };
  }

  private serializeDowntime(d: MesDowntime) {
    return {
      id: d.id,
      reason: d.reason,
      partNumber: d.partNumber,
      startedAt: d.startedAt,
      endedAt: d.endedAt,
      durationSec: d.durationSec ?? this.elapsedSec(d.startedAt),
      materialRequestId: d.materialRequestId,
    };
  }

  private async recordLedger(
    action: string,
    referenceType: string,
    referenceId: string,
    execution: WorkOrderExecution,
    actor: string,
    extra?: {
      transaction?: { quantity?: number };
      context?: Record<string, any>;
      metadata?: Record<string, any>;
    },
    domain: EventDomain = EventDomain.PRODUCTION,
  ) {
    try {
      await this.ledger.recordEvent({
        domain,
        action,
        referenceType,
        referenceId,
        actorName: actor,
        model: execution.model,
        workOrder: execution.workOrder,
        line: execution.line?.toString(),
        transaction: extra?.transaction,
        context: extra?.context,
        metadata: extra?.metadata,
      });
    } catch (err) {
      this.logger.error(`Ledger write failed for ${action}`, err as Error);
    }
  }
}
