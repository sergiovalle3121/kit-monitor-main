import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { ProductionBayEvent } from './entities/production-bay-event.entity';
import { ProductionBayIncident } from './entities/production-bay-incident.entity';
import { ProductionBayMaterialState } from './entities/production-bay-material-state.entity';
import { RegisterBayEventDto } from './dto/register-bay-event.dto';
import { CreateBayIncidentDto } from './dto/create-bay-incident.dto';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { EnterpriseLine } from '../enterprise-campus/entities/enterprise-line.entity';
import { ProductionWip } from './entities/production-wip.entity';
import { InventoryService } from '../inventory/inventory.service';
import { MaterialMaster } from '../inventory/entities/material-master.entity';
import { AuditService } from '../governance/audit.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TransactionCostBasis,
  TransactionSourceType,
} from '../accounting/entities/transaction.entity';
import {
  ExceptionSeverity,
  ExceptionDomain,
} from '../governance/entities/operational-exception.entity';

type ScopeQuery = {
  line?: string;
  model?: string;
  workOrder?: string;
  buildingId?: string;
  programId?: string;
};

@Injectable()
export class ProductionRuntimeService {
  constructor(
    @InjectRepository(Kit) private readonly kitRepo: Repository<Kit>,
    @InjectRepository(KitMaterial)
    private readonly kitMaterialRepo: Repository<KitMaterial>,
    @InjectRepository(BayLayout)
    private readonly bayLayoutRepo: Repository<BayLayout>,
    @InjectRepository(BomItem) private readonly bomRepo: Repository<BomItem>,
    @InjectRepository(ProductionBayEvent)
    private readonly eventRepo: Repository<ProductionBayEvent>,
    @InjectRepository(ProductionBayIncident)
    private readonly incidentRepo: Repository<ProductionBayIncident>,
    @InjectRepository(ProductionBayMaterialState)
    private readonly materialStateRepo: Repository<ProductionBayMaterialState>,
    @InjectRepository(ProductionWip)
    private readonly wipRepo: Repository<ProductionWip>,
    @InjectRepository(EnterpriseProgram)
    private readonly programRepo: Repository<EnterpriseProgram>,
    @InjectRepository(EnterpriseLine)
    private readonly lineRepo: Repository<EnterpriseLine>,
    private readonly inventory: InventoryService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getLines(scope?: ScopeQuery) {
    const kits = await this.buildScopedKitQuery(
      [
        'preparing',
        'kitted',
        'ready',
        'requested',
        'delivered',
        'in_progress',
        'received',
        'sent',
      ],
      scope,
      'ASC',
    );
    const rows = await Promise.all(
      kits.map((kit) => this.buildBackendView(kit.id)),
    );
    return rows.filter(Boolean);
  }

  async getLine(kitId: number) {
    return this.buildBackendView(kitId);
  }

  async receiveLine(kitId: number) {
    const kit = await this.findKit(kitId);
    if (!['ready', 'requested'].includes(kit.status)) {
      throw new BadRequestException(
        'Kit no está listo para recepción en línea',
      );
    }
    await this.kitRepo.update(kitId, {
      status: 'requested',
      requestedAt: kit.requestedAt ?? new Date(),
    });

    await this.audit.recordAction({
      actor: this.tenantContext.getUserEmail(),
      action: 'PRODUCTION_LINE_RECEIVED',
      resourceType: 'Kit',
      resourceId: kitId.toString(),
      outcome: 'ALLOWED',
    });

    return this.buildBackendView(kitId);
  }

  async startLine(kitId: number) {
    const kit = await this.findKit(kitId);
    if (
      ![
        'requested',
        'received',
        'delivered',
        'sent',
        'ready',
        'in_progress',
      ].includes(kit.status)
    ) {
      throw new BadRequestException(
        'Kit no puede iniciar ensamble desde su estado actual',
      );
    }
    await this.kitRepo.update(kitId, { status: 'in_progress' });

    await this.audit.recordAction({
      actor: this.tenantContext.getUserEmail(),
      action: 'PRODUCTION_LINE_STARTED',
      resourceType: 'Kit',
      resourceId: kitId.toString(),
      outcome: 'ALLOWED',
    });

    return this.buildBackendView(kitId);
  }

  async registerBayEvent(
    kitId: number,
    bayId: number,
    dto: RegisterBayEventDto,
  ) {
    if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'quantity debe ser mayor a 0',
      });
    }
    if (bayId < 1 || bayId > 6) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'bayId debe estar entre 1 y 6',
      });
    }
    if (!dto.clientRequestId?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'clientRequestId es obligatorio',
      });
    }
    const clientRequestId = dto.clientRequestId.trim();

    const kit = await this.findKit(kitId);
    const model = kit.plan?.model;
    if (!model)
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Kit sin modelo asociado',
      });

    await this.ensureMaterialState(kitId);

    return this.dataSource.transaction(async (em) => {
      const duplicate = await em.findOne(ProductionBayEvent, {
        where: { clientRequestId },
      });
      if (duplicate) {
        const backend = await this.buildBackendView(kitId);
        return {
          ...backend,
          duplicated: true,
          code: 'DUPLICATE_REQUEST',
          message: 'Solicitud duplicada ignorada',
          lastEvent: {
            id: duplicate.id,
            bayId: duplicate.bayId,
            quantity: duplicate.quantity,
            timestamp: duplicate.timestamp,
            operator: duplicate.operator,
            notes: duplicate.notes,
          },
        };
      }

      const states = await em
        .createQueryBuilder(ProductionBayMaterialState, 'state')
        .setLock('pessimistic_write')
        .where('state.kitId = :kitId', { kitId })
        .andWhere('state.bayId = :bayId', { bayId })
        .getMany();

      if (!states.length) {
        const layoutCount = await em.count(BayLayout, { where: { model } });
        const bayLayoutCount = await em.count(BayLayout, {
          where: { model, bahia: bayId },
        });
        if (!layoutCount) {
          throw new BadRequestException({
            code: 'NO_LAYOUT_CONFIGURED',
            message: `No hay disposición IE guardada para el modelo ${model}`,
          });
        }
        if (!bayLayoutCount) {
          throw new BadRequestException({
            code: 'BAY_NOT_CONFIGURED_IN_LAYOUT',
            message: `La bahía ${bayId} no está configurada en la disposición IE del modelo ${model}`,
          });
        }
        throw new BadRequestException({
          code: 'BAY_NOT_MOUNTED_RUNTIME',
          message: `Bahía ${bayId} está configurada por IE pero aún no fue montada en backend`,
        });
      }

      for (const state of states) {
        const consume = dto.quantity * state.usagePerAssembly;
        if (state.availableQty - consume < 0) {
          throw new ConflictException({
            code: 'MATERIAL_INSUFFICIENT',
            message: `Material insuficiente en ${state.partNumber} para registrar`,
          });
        }

        // Formal Inventory Consumption
        await this.inventory
          .recordTransaction({
            type: 'CONSUME' as any,
            partNumber: state.partNumber,
            quantity: consume,
            fromWarehouseId: `LINE-${kit.plan.line}`, // Virtual line-side warehouse
            fromLocation: `BAY-${bayId}`,
            actorName: dto.operator || 'System',
            referenceType: 'PRODUCTION_EVENT',
            referenceId: clientRequestId,
            reason: `Production Consumption - WO ${kit.plan.workOrder}`,
          })
          .catch(() => {
            // Fallback if inventory is not hard-locked for production yet
            console.warn(
              `Inventory decrement failed for ${state.partNumber} at line ${kit.plan.line}`,
            );
          });

        state.consumedQty =
          Math.round((state.consumedQty + consume) * 1e6) / 1e6;
        state.availableQty = Math.max(
          0,
          Math.round((state.availableQty - consume) * 1e6) / 1e6,
        );
      }

      await em.save(states);

      // --- WIP Update ---
      let wip = await em.findOne(ProductionWip, {
        where: { kit: { id: kitId } },
      });
      if (!wip) {
        wip = em.create(ProductionWip, {
          kit: { id: kitId } as Kit,
          workOrder: kit.plan.workOrder,
          partNumber: kit.plan.model,
          targetQty: kit.plan.quantity,
          status: 'in_production',
          startedAt: new Date(),
          line: `Line ${kit.plan.line}`,
        });
      }

      const event = em.create(ProductionBayEvent, {
        kit: { id: kitId } as Kit,
        bayId,
        model,
        quantity: dto.quantity,
        notes: dto.notes,
        operator: dto.operator,
        source: 'bay_enter',
        clientRequestId,
        timestamp: new Date(),
      });
      await em.save(event);

      const total = await em
        .createQueryBuilder(ProductionBayEvent, 'event')
        .select('COALESCE(SUM(event.quantity), 0)', 'total')
        .where('event.kitId = :kitId', { kitId })
        .andWhere('event.revertedAt IS NULL')
        .getRawOne<{ total: string }>();

      const completedQty = Number(total?.total ?? 0);

      // Update WIP Progress
      if (wip) {
        wip.completedQty = completedQty;
        if (completedQty >= kit.plan.quantity) {
          wip.status = 'ready_for_fg';
          wip.completedAt = new Date();
        }
        await em.save(wip);
      }

      const nextStatus =
        completedQty >= kit.plan.quantity ? 'completed' : 'in_progress';
      await em.update(Kit, kitId, { status: nextStatus });

      await this.audit.recordAction({
        actor: this.tenantContext.getUserEmail(),
        action: 'PRODUCTION_BAY_EVENT',
        resourceType: 'Kit',
        resourceId: kitId.toString(),
        metadata: {
          bayId,
          quantity: dto.quantity,
          workOrder: kit.plan.workOrder,
        },
        outcome: 'ALLOWED',
      });

      const backend = await this.buildBackendView(kitId);
      return {
        ...backend,
        lastEvent: {
          id: event.id,
          bayId: event.bayId,
          quantity: event.quantity,
          timestamp: event.timestamp,
          operator: event.operator,
          notes: event.notes,
        },
      };
    });
  }

  async revertBayEvent(eventId: number) {
    return this.dataSource.transaction(async (em) => {
      const event = await em
        .createQueryBuilder(ProductionBayEvent, 'event')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('event.kit', 'kit')
        .where('event.id = :eventId', { eventId })
        .getOne();
      if (!event)
        throw new NotFoundException({
          code: 'EVENT_NOT_FOUND',
          message: `Evento ${eventId} no encontrado`,
        });
      if (event.revertedAt) {
        throw new ConflictException({
          code: 'EVENT_ALREADY_REVERTED',
          message: 'El evento ya fue revertido',
        });
      }

      const undoWindowMs = 10_000;
      if (Date.now() - new Date(event.createdAt).getTime() > undoWindowMs) {
        throw new ConflictException({
          code: 'UNDO_WINDOW_EXPIRED',
          message: 'Ventana de reversa expirada',
        });
      }

      const lastActive = await em
        .createQueryBuilder(ProductionBayEvent, 'event')
        .setLock('pessimistic_read')
        .where('event.kitId = :kitId', { kitId: event.kit.id })
        .andWhere('event.bayId = :bayId', { bayId: event.bayId })
        .andWhere('event.revertedAt IS NULL')
        .orderBy('event.timestamp', 'DESC')
        .addOrderBy('event.id', 'DESC')
        .getOne();
      if (!lastActive || lastActive.id !== event.id) {
        throw new ConflictException({
          code: 'EVENT_NOT_LAST_REVERSIBLE',
          message: 'Solo el último evento vigente de la bahía puede revertirse',
        });
      }

      const kit = await this.findKit(event.kit.id);
      await this.ensureMaterialState(kit.id);
      const states = await em
        .createQueryBuilder(ProductionBayMaterialState, 'state')
        .setLock('pessimistic_write')
        .where('state.kitId = :kitId', { kitId: kit.id })
        .andWhere('state.bayId = :bayId', { bayId: event.bayId })
        .getMany();

      for (const state of states) {
        const rollback = event.quantity * state.usagePerAssembly;
        state.consumedQty = Math.max(
          0,
          Math.round((state.consumedQty - rollback) * 1e6) / 1e6,
        );
        state.availableQty = Math.max(
          0,
          Math.round((state.availableQty + rollback) * 1e6) / 1e6,
        );
        if (state.availableQty < 0 || state.consumedQty < 0) {
          throw new ConflictException({
            code: 'STATE_INCONSISTENT',
            message: 'Estado de material inconsistente tras reversa',
          });
        }
      }
      await em.save(states);

      event.revertedAt = new Date();
      event.revertedReason = 'operator_undo';
      await em.save(event);

      const total = await em
        .createQueryBuilder(ProductionBayEvent, 'event')
        .select('COALESCE(SUM(event.quantity), 0)', 'total')
        .where('event.kitId = :kitId', { kitId: kit.id })
        .andWhere('event.revertedAt IS NULL')
        .getRawOne<{ total: string }>();

      const completedQty = Number(total?.total ?? 0);
      if (completedQty < 0) {
        throw new ConflictException({
          code: 'STATE_INCONSISTENT',
          message: 'completedQty inválido tras reversa',
        });
      }
      const nextStatus =
        completedQty >= kit.plan.quantity ? 'completed' : 'in_progress';
      await em.update(Kit, kit.id, { status: nextStatus });

      await this.audit.recordAction({
        actor: this.tenantContext.getUserEmail(),
        action: 'PRODUCTION_EVENT_REVERTED',
        resourceType: 'ProductionBayEvent',
        resourceId: eventId.toString(),
        outcome: 'ALLOWED',
      });

      const backend = await this.buildBackendView(kit.id);
      return {
        ...backend,
        reverted: true,
        revertedEvent: {
          id: event.id,
          bayId: event.bayId,
          quantity: event.quantity,
          timestamp: event.timestamp,
          operator: event.operator,
          notes: event.notes,
          revertedAt: event.revertedAt,
        },
      };
    });
  }

  async getEvents(kitId: number) {
    return this.eventRepo.find({
      where: { kit: { id: kitId } },
      order: { timestamp: 'DESC' },
    });
  }

  async createBayIncident(
    kitId: number,
    bayId: number,
    dto: CreateBayIncidentDto,
  ) {
    if (bayId < 1 || bayId > 6) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'bayId debe estar entre 1 y 6',
      });
    }
    const allowedTypes = [
      'Falta material',
      'Error de ensamble',
      'Paro de estación',
      'Otro',
    ];
    if (!allowedTypes.includes(dto.type)) {
      throw new ConflictException({
        code: 'INCIDENT_TYPE_INVALID',
        message: 'Tipo de incidencia inválido',
      });
    }
    const kit = await this.findKit(kitId);
    const note = dto.note?.trim() || undefined;
    const operator = dto.operator?.trim() || undefined;
    const incident = this.incidentRepo.create({
      kit: { id: kitId } as Kit,
      bayId,
      type: dto.type,
      note,
      operator,
      status: 'open',
    });
    const saved = await this.incidentRepo.save(incident);

    const actor = this.tenantContext.getUserEmail();
    await this.audit.recordAction({
      actor,
      action: 'PRODUCTION_INCIDENT_CREATED',
      resourceType: 'ProductionBayIncident',
      resourceId: saved.id.toString(),
      metadata: { bayId, type: dto.type },
      outcome: 'ALLOWED',
    });

    // AUTOMATION: Create Operational Exception for Production Incidents
    await this.audit.recordException({
      severity: ExceptionSeverity.HIGH,
      domain: ExceptionDomain.PRODUCTION,
      title: `Production Incident: ${dto.type}`,
      description: `Incident reported in Bay ${bayId} for Kit ${kitId}: ${dto.note || 'No details provided'}`,
      actor,
      buildingId: kit.plan?.buildingId?.toString(),
      resourceType: 'ProductionBayIncident',
      resourceId: saved.id.toString(),
      metadata: { kitId, bayId, type: dto.type },
    });

    return saved;
  }

  async getBayIncidents(kitId: number, bayId: number) {
    return this.incidentRepo.find({
      where: { kit: { id: kitId }, bayId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  async getMaterials(kitId: number) {
    await this.ensureMaterialState(kitId);
    const materials = await this.materialStateRepo.find({
      where: { kit: { id: kitId } },
      order: { bayId: 'ASC', partNumber: 'ASC' },
    });

    const kit = await this.findKit(kitId);
    const events = await this.eventRepo.find({
      where: { kit: { id: kitId } },
      order: { timestamp: 'DESC' },
      take: 500,
    });
    const incidents = await this.incidentRepo.find({
      where: { kit: { id: kitId }, status: 'open' },
      order: { createdAt: 'DESC' },
    });

    const activeEvents = events.filter((event) => !event.revertedAt);
    const assembledByBay = new Map<number, number>();
    activeEvents.forEach((event) => {
      assembledByBay.set(
        event.bayId,
        (assembledByBay.get(event.bayId) ?? 0) + Number(event.quantity ?? 0),
      );
    });

    const cutoff30m = new Date(Date.now() - 30 * 60 * 1000);
    const recentAssembliesByBay = new Map<number, number>();
    activeEvents
      .filter((event) => new Date(event.timestamp) >= cutoff30m)
      .forEach((event) => {
        recentAssembliesByBay.set(
          event.bayId,
          (recentAssembliesByBay.get(event.bayId) ?? 0) +
            Number(event.quantity ?? 0),
        );
      });

    const incidentsByBay = new Map<number, number>();
    incidents.forEach((incident) => {
      incidentsByBay.set(
        incident.bayId,
        (incidentsByBay.get(incident.bayId) ?? 0) + 1,
      );
    });

    const layouts = await this.bayLayoutRepo.find({
      where: { model: kit.plan.model },
    });
    const configuredBaySet = new Set<number>(
      layouts.map((layout) => layout.bahia),
    );

    return materials.map((item) => {
      const assemblies = assembledByBay.get(item.bayId) ?? 0;
      const theoreticalConsumed =
        assemblies * Number(item.usagePerAssembly ?? 0);
      const realConsumed = Number(item.consumedQty ?? 0);
      const delta = realConsumed - theoreticalConsumed;
      const deltaAbs = Math.abs(delta);
      const tolerance = Math.max(
        0.5,
        Number(item.usagePerAssembly ?? 0) * 1.25,
      );
      const deltaState =
        deltaAbs <= tolerance
          ? 'normal'
          : deltaAbs <= tolerance * 2.5
            ? 'vigilar'
            : 'desviado';

      const recentAssemblies30m = recentAssembliesByBay.get(item.bayId) ?? 0;
      const assembliesPerHour = recentAssemblies30m * 2;
      const realConsumptionPerHour =
        assembliesPerHour * Number(item.usagePerAssembly ?? 0);
      const depletionEtaMinutes =
        realConsumptionPerHour > 0
          ? (Number(item.availableQty ?? 0) / realConsumptionPerHour) * 60
          : null;

      const hasIncident = (incidentsByBay.get(item.bayId) ?? 0) > 0;
      const hasLowStock =
        Number(item.availableQty ?? 0) <= Number(item.lowStockThreshold ?? 0);
      const bayStatus = this.computeBayOperationalStatus({
        bayId: item.bayId,
        configured: configuredBaySet.has(item.bayId),
        mounted: true,
        hasIncident,
        hasLowStock,
        availableQty: Number(item.availableQty ?? 0),
        recentAssemblies30m,
        deltaState,
      });

      return {
        ...item,
        theoreticalConsumed,
        realConsumed,
        deltaConsumed: delta,
        deltaState,
        recentAssemblies30m,
        assembliesPerHour,
        realConsumptionPerHour,
        depletionEtaMinutes,
        bayStatus,
      };
    });
  }

  async getHourly(kitId: number) {
    await this.ensureMaterialState(kitId);
    const events = await this.eventRepo.find({
      where: { kit: { id: kitId } },
      order: { timestamp: 'DESC' },
    });
    const materials = await this.materialStateRepo.find({
      where: { kit: { id: kitId } },
      order: { bayId: 'ASC', partNumber: 'ASC' },
    });
    const usageByBay = new Map<number, number>();
    materials.forEach((item) => {
      usageByBay.set(
        item.bayId,
        (usageByBay.get(item.bayId) ?? 0) + Number(item.usagePerAssembly ?? 0),
      );
    });

    const agg = new Map<
      string,
      {
        bayId: number;
        totalQty: number;
        events: number;
        theoreticalConsumption: number;
      }
    >();
    events
      .filter((event) => !event.revertedAt)
      .forEach((event) => {
        const dt = new Date(event.timestamp);
        dt.setMinutes(0, 0, 0);
        const key = `${dt.toISOString()}-B${event.bayId}`;
        const row = agg.get(key) ?? {
          bayId: event.bayId,
          totalQty: 0,
          events: 0,
          theoreticalConsumption: 0,
        };
        row.totalQty += event.quantity;
        row.events += 1;
        row.theoreticalConsumption +=
          Number(event.quantity ?? 0) * (usageByBay.get(event.bayId) ?? 0);
        agg.set(key, row);
      });

    return [...agg.entries()]
      .map(([key, value]) => ({
        hourBucket: key.slice(0, 24),
        bayId: value.bayId,
        totalQty: value.totalQty,
        events: value.events,
        theoreticalConsumption: value.theoreticalConsumption,
      }))
      .sort(
        (a, b) => b.hourBucket.localeCompare(a.hourBucket) || a.bayId - b.bayId,
      );
  }

  private async buildScopedKitQuery(
    statuses: string[],
    scope: ScopeQuery | undefined,
    order: 'ASC' | 'DESC',
    take?: number,
  ): Promise<Kit[]> {
    const qb = this.kitRepo
      .createQueryBuilder('kit')
      .leftJoinAndSelect('kit.plan', 'plan')
      .where('kit.status IN (:...statuses)', { statuses })
      .orderBy('kit.id', order);

    if (take) qb.take(take);

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('kit.tenant_id = :tenantId', { tenantId });

    const scopes = this.tenantContext.getScopes();
    const scopeBids = scopes?.buildings ?? [];
    if (scopeBids.length > 0) {
      const lines = await this.lineRepo.find({
        where: { building: { id: In(scopeBids) } },
      });
      const legacyNums = lines
        .map((l) => l.legacyLineNumber)
        .filter((n): n is number => n != null);
      if (legacyNums.length > 0) {
        qb.andWhere('plan.line IN (:...scopeLineNums)', {
          scopeLineNums: legacyNums,
        });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    const scopePids = scopes?.programs ?? [];
    if (scopePids.length > 0) {
      const programs = await this.programRepo.find({
        where: { id: In(scopePids) },
      });
      const prefixes = programs
        .map((p) => p.primaryModelPrefix?.toUpperCase())
        .filter(Boolean);
      if (prefixes.length > 0) {
        qb.andWhere(
          '(' +
            prefixes
              .map((_, i) => `UPPER(plan.model) LIKE :scopePre${i}`)
              .join(' OR ') +
            ')',
          prefixes.reduce(
            (acc, pre, i) => ({ ...acc, [`scopePre${i}`]: `${pre}%` }),
            {},
          ),
        );
      }
    }

    if (!scope) return qb.getMany();

    if (scope.model) {
      qb.andWhere('UPPER(plan.model) LIKE :model', {
        model: `%${scope.model.toUpperCase()}%`,
      });
    }
    if (scope.workOrder) {
      qb.andWhere('UPPER(plan.workOrder) LIKE :workOrder', {
        workOrder: `%${scope.workOrder.toUpperCase()}%`,
      });
    }
    if (scope.line) {
      const lineRef = await this.lineRepo.findOne({
        where: { id: scope.line },
      });
      const legacyNum = lineRef?.legacyLineNumber ?? parseInt(scope.line, 10);
      if (!isNaN(legacyNum)) {
        qb.andWhere('plan.line = :lineNum', { lineNum: legacyNum });
      }
    }
    if (scope.buildingId) {
      const lines = await this.lineRepo.find({
        where: { building: { id: scope.buildingId } },
      });
      const legacyNums = lines
        .map((l) => l.legacyLineNumber)
        .filter((n): n is number => n != null);
      if (legacyNums.length) {
        qb.andWhere('plan.line IN (:...lineNums)', { lineNums: legacyNums });
      } else {
        qb.andWhere('1 = 0');
      }
    }
    if (scope.programId) {
      const program = await this.programRepo.findOne({
        where: { id: scope.programId },
      });
      const prefix = program?.primaryModelPrefix?.toUpperCase();
      if (prefix) {
        qb.andWhere('UPPER(plan.model) LIKE :prefix', { prefix: `${prefix}%` });
      }
    }

    return qb.getMany();
  }

  async getCompleted(scope?: ScopeQuery) {
    const kits = await this.buildScopedKitQuery(
      ['completed'],
      scope,
      'DESC',
      100,
    );
    const rows = await Promise.all(
      kits.map((kit) => this.buildBackendView(kit.id)),
    );
    return rows.filter(Boolean);
  }

  async getShortageRisk(kitId: number) {
    const kit = await this.findKit(kitId);
    const materials = await this.getMaterials(kitId);
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const events = await this.eventRepo.find({
      where: { kit: { id: kitId } },
      order: { timestamp: 'DESC' },
      take: 500,
    });

    const recentByBay = new Map<number, number>();
    events
      .filter(
        (event) => !event.revertedAt && new Date(event.timestamp) >= cutoff,
      )
      .forEach((event) => {
        recentByBay.set(
          event.bayId,
          (recentByBay.get(event.bayId) ?? 0) + event.quantity,
        );
      });

    const materialsRisk = materials.map((item: any) => {
      const units30m = recentByBay.get(item.bayId) ?? 0;
      const perMinuteAssemblies = units30m / 30;
      const consumptionPerMinute = perMinuteAssemblies * item.usagePerAssembly;
      const minutesToStockout =
        consumptionPerMinute > 0
          ? item.availableQty / consumptionPerMinute
          : null;

      let severity: 'stable' | 'attention' | 'critical' | 'urgent' = 'stable';
      if (minutesToStockout !== null) {
        if (minutesToStockout <= 30) severity = 'urgent';
        else if (minutesToStockout <= 60) severity = 'critical';
        else if (minutesToStockout <= 120) severity = 'attention';
      } else if (item.availableQty <= item.lowStockThreshold) {
        severity = 'attention';
      }

      return {
        bayId: item.bayId,
        partNumber: item.partNumber,
        availableQty: item.availableQty,
        consumedQty: item.consumedQty,
        usagePerAssembly: item.usagePerAssembly,
        lowStockThreshold: item.lowStockThreshold,
        recentAssemblies30m: units30m,
        consumptionPerMinute,
        minutesToStockout,
        severity,
        deltaState: item.deltaState ?? 'normal',
        theoreticalConsumed: item.theoreticalConsumed ?? 0,
        deltaConsumed: item.deltaConsumed ?? 0,
        bayStatus: item.bayStatus ?? null,
      };
    });

    const baySummaryMap = new Map<
      number,
      {
        bayId: number;
        assemblies30m: number;
        assembliesPerHour: number;
        avgMinutesToStockout: number | null;
        worstSeverity: 'stable' | 'attention' | 'critical' | 'urgent';
        hasIncident: boolean;
        status: string;
      }
    >();
    const severityRank = { stable: 0, attention: 1, critical: 2, urgent: 3 };
    materialsRisk.forEach((item) => {
      const current = baySummaryMap.get(item.bayId) ?? {
        bayId: item.bayId,
        assemblies30m: Number(item.recentAssemblies30m ?? 0),
        assembliesPerHour: Number(item.recentAssemblies30m ?? 0) * 2,
        avgMinutesToStockout: null,
        worstSeverity: 'stable' as const,
        hasIncident: false,
        status: item.bayStatus ?? 'ready_to_produce',
      };

      if (severityRank[item.severity] > severityRank[current.worstSeverity]) {
        current.worstSeverity = item.severity;
      }
      if (item.minutesToStockout !== null) {
        current.avgMinutesToStockout =
          current.avgMinutesToStockout === null
            ? item.minutesToStockout
            : (current.avgMinutesToStockout + item.minutesToStockout) / 2;
      }
      if (item.bayStatus === 'with_incident') current.hasIncident = true;
      if (item.bayStatus === 'out_of_material')
        current.status = 'out_of_material';
      else if (
        item.bayStatus === 'at_risk' &&
        current.status !== 'out_of_material'
      )
        current.status = 'at_risk';
      baySummaryMap.set(item.bayId, current);
    });

    const layouts = await this.bayLayoutRepo.find({
      where: { model: kit.plan.model },
    });
    const configuredBays = new Set<number>(
      layouts.map((layout) => layout.bahia),
    );
    configuredBays.forEach((bayId) => {
      if (baySummaryMap.has(bayId)) return;
      baySummaryMap.set(bayId, {
        bayId,
        assemblies30m: 0,
        assembliesPerHour: 0,
        avgMinutesToStockout: null,
        worstSeverity: 'stable',
        hasIncident: false,
        status: 'configured_not_mounted',
      });
    });

    const risky = materialsRisk.filter((item) => item.severity !== 'stable');
    const mostCritical =
      [...risky].sort(
        (a, b) =>
          (a.minutesToStockout ?? Infinity) - (b.minutesToStockout ?? Infinity),
      )[0] ?? null;

    return {
      kitId,
      riskyCount: risky.length,
      mostCritical,
      materials: materialsRisk,
      bays: [...baySummaryMap.values()].sort((a, b) => a.bayId - b.bayId),
    };
  }

  async getLogisticsRisk() {
    const backends = await this.getLines();
    const risks = await Promise.all(
      backends.map((backend) => this.getShortageRisk(backend.kitId)),
    );
    return backends.map((backend, idx) => ({
      backend,
      risk: risks[idx],
    }));
  }

  private async buildBackendView(kitId: number) {
    const kit = await this.kitRepo.findOne({
      where: { id: kitId },
      relations: ['plan'],
    });
    if (!kit?.plan) throw new NotFoundException(`Kit ${kitId} no encontrado`);

    const completedRaw = await this.eventRepo
      .createQueryBuilder('event')
      .select('COALESCE(SUM(event.quantity), 0)', 'total')
      .where('event.kitId = :kitId', { kitId })
      .andWhere('event.revertedAt IS NULL')
      .getRawOne<{ total: string }>();

    const completedQty = Number(completedRaw?.total ?? 0);
    const materials = await this.materialStateRepo.find({
      where: { kit: { id: kitId } },
    });
    const openIncidents = await this.incidentRepo.count({
      where: { kit: { id: kitId }, status: 'open' },
    });

    return {
      kitId,
      lineCode: `Línea ${kit.plan.line}`,
      line: kit.plan.line,
      model: kit.plan.model,
      workOrder: kit.plan.workOrder,
      shift: kit.plan.shift,
      targetQty: kit.plan.quantity,
      completedQty,
      status: kit.status,
      hasIncident: openIncidents > 0,
      receivedAt: kit.requestedAt ?? kit.receivedAt ?? null,
      startedAt: await this.firstEventAt(kitId),
      completedAt:
        kit.status === 'completed' ? await this.lastEventAt(kitId) : null,
      lowStockCount: materials.filter(
        (item) => item.availableQty <= item.lowStockThreshold,
      ).length,
    };
  }

  private computeBayOperationalStatus(input: {
    bayId: number;
    configured: boolean;
    mounted: boolean;
    hasIncident: boolean;
    hasLowStock: boolean;
    availableQty: number;
    recentAssemblies30m: number;
    deltaState: 'normal' | 'vigilar' | 'desviado';
  }): string {
    if (!input.configured) return 'not_configured';
    if (!input.mounted) return 'configured_not_mounted';
    if (input.hasIncident) return 'with_incident';
    if (input.availableQty <= 0) return 'out_of_material';
    if (input.hasLowStock) return 'at_risk';
    if (input.deltaState === 'desviado') return 'off_plan';
    if (input.recentAssemblies30m > 0) return 'in_production';
    return 'ready_to_produce';
  }

  private async firstEventAt(kitId: number): Promise<Date | null> {
    const row = await this.eventRepo.findOne({
      where: { kit: { id: kitId }, revertedAt: IsNull() },
      order: { timestamp: 'ASC' },
    });
    return row?.timestamp ?? null;
  }

  private async lastEventAt(kitId: number): Promise<Date | null> {
    const row = await this.eventRepo.findOne({
      where: { kit: { id: kitId }, revertedAt: IsNull() },
      order: { timestamp: 'DESC' },
    });
    return row?.timestamp ?? null;
  }

  private async ensureMaterialState(kitId: number) {
    const kit = await this.kitRepo.findOne({
      where: { id: kitId },
      relations: ['plan', 'materials'],
    });
    if (!kit?.plan) throw new NotFoundException(`Kit ${kitId} no encontrado`);

    const model = kit.plan.model;
    const layouts = await this.bayLayoutRepo.find({ where: { model } });
    if (!layouts.length) return;

    const bom = await this.bomRepo.find({ where: { model } });
    const bomByPart = new Map(bom.map((item) => [item.partNumber, item]));
    const materialByPart = new Map(
      kit.materials.map((item) => [item.partNumber, item]),
    );
    const existing = await this.materialStateRepo.find({
      where: { kit: { id: kitId } },
    });
    const existingKey = new Set(
      existing.map((item) => `${item.bayId}::${item.partNumber}`),
    );

    const rows = layouts
      .filter(
        (layout) => !existingKey.has(`${layout.bahia}::${layout.partNumber}`),
      )
      .map((layout) => {
        const material = materialByPart.get(layout.partNumber);
        const bomItem = bomByPart.get(layout.partNumber);
        const quantityRequired =
          material?.quantityRequired ??
          (bomItem?.usageFactor ?? 0) * kit.plan.quantity;
        const usagePerAssembly =
          kit.plan.quantity > 0
            ? quantityRequired / kit.plan.quantity
            : (bomItem?.usageFactor ?? 0);
        const availableQty = Math.max(
          0,
          material?.quantityRemaining ?? quantityRequired,
        );
        const lowStockThreshold =
          layout.minStock ??
          Math.max(5, Math.ceil((quantityRequired || 20) * 0.2));

        return this.materialStateRepo.create({
          kit: { id: kitId } as Kit,
          bayId: layout.bahia,
          model,
          partNumber: layout.partNumber,
          description:
            bomItem?.description ?? material?.description ?? undefined,
          usagePerAssembly,
          availableQty,
          consumedQty: material?.quantityConsumed ?? 0,
          lowStockThreshold,
        });
      });

    if (rows.length) {
      await this.materialStateRepo.save(rows);
    }
  }

  private async findKit(kitId: number): Promise<Kit> {
    const kit = await this.kitRepo.findOne({
      where: { id: kitId },
      relations: ['plan'],
    });
    if (!kit) throw new NotFoundException(`Kit ${kitId} no encontrado`);
    return kit;
  }

  async getWipStatus(scope: ScopeQuery): Promise<ProductionWip[]> {
    const qb = this.wipRepo
      .createQueryBuilder('wip')
      .leftJoinAndSelect('wip.kit', 'kit')
      .leftJoinAndSelect('kit.plan', 'plan');

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('wip.tenant_id = :tenantId', { tenantId });

    const scopes = this.tenantContext.getScopes();
    const scopeBids = scopes?.buildings ?? [];
    if (scopeBids.length > 0) {
      const lines = await this.lineRepo.find({
        where: { building: { id: In(scopeBids) } },
      });
      const legacyNums = lines
        .map((l) => l.legacyLineNumber)
        .filter((n): n is number => n != null);
      if (legacyNums.length > 0) {
        qb.andWhere('plan.line IN (:...scopeLineNums)', {
          scopeLineNums: legacyNums,
        });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (scope?.workOrder) {
      qb.andWhere('wip.workOrder = :wo', { wo: scope.workOrder });
    }

    qb.orderBy('wip.updatedAt', 'DESC');
    return qb.getMany();
  }

  async declareFinishedGoods(
    kitId: number,
    quantity: number,
    actor: string,
  ): Promise<ProductionWip> {
    const wip = await this.wipRepo.findOne({
      where: { kit: { id: kitId } },
      relations: ['kit', 'kit.plan'],
    });
    if (!wip) throw new NotFoundException('WIP record not found for this kit');
    if (wip.completedQty < quantity)
      throw new BadRequestException(
        'Cannot declare more FG than completed WIP',
      );

    return this.dataSource.transaction(async (em) => {
      const remainingCompletedQty = wip.completedQty - quantity;
      const isFinalDeclaration =
        remainingCompletedQty <= 0 && wip.status === 'ready_for_fg';
      const actualUnitCost = await this.estimateFinishedGoodUnitCost(kitId, em);

      // 1. Move from WIP to FG Inventory
      await this.inventory.recordTransaction({
        type: 'TRANSFER',
        partNumber: wip.partNumber,
        quantity: quantity,
        fromWarehouseId: `LINE-${wip.kit.plan.line}`,
        fromLocation: 'FINISHED_STAGING',
        toWarehouseId: 'WH-FG',
        toLocation: 'STAGING',
        actorName: actor,
        referenceType: 'FG_DECLARATION',
        referenceId: wip.workOrder,
        holdStatus: 'pending_oqc', // Hard lock for final quality
        reason: `FG Declaration - WO ${wip.workOrder}`,
        actualUnitCost,
        accountingCostBasis: TransactionCostBasis.BOM_ROLLUP,
        accountingSourceType: isFinalDeclaration
          ? TransactionSourceType.PRODUCTION_COMPLETION
          : TransactionSourceType.INVENTORY_MOVEMENT,
        accountingMetadata: {
          kitId,
          declaredFinishedGoodsQty: quantity,
          remainingCompletedQty: Math.max(0, remainingCompletedQty),
        },
      });

      // 2. Update WIP
      wip.completedQty = remainingCompletedQty;
      if (wip.completedQty <= 0 && wip.status === 'ready_for_fg') {
        wip.status = 'completed';
      }
      return em.save(wip);
    });
  }

  private async estimateFinishedGoodUnitCost(
    kitId: number,
    manager = this.dataSource.manager,
  ): Promise<number> {
    const states = await manager.find(ProductionBayMaterialState, {
      where: { kit: { id: kitId } },
    });
    const partNumbers = [...new Set(states.map((state) => state.partNumber))];
    if (!partNumbers.length) return 0;

    const materials = await manager.find(MaterialMaster, {
      where: { partNumber: In(partNumbers) },
    });
    const costByPart = new Map(
      materials.map((material) => [
        material.partNumber,
        Number(material.standardCost ?? 0),
      ]),
    );

    const unitCost = states.reduce(
      (sum, state) =>
        sum +
        Number(state.usagePerAssembly ?? 0) *
          Number(costByPart.get(state.partNumber) ?? 0),
      0,
    );

    return Math.round(unitCost * 1_000_000) / 1_000_000;
  }
}
