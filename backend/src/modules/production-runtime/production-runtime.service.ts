import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class ProductionRuntimeService {
  constructor(
    @InjectRepository(Kit) private readonly kitRepo: Repository<Kit>,
    @InjectRepository(KitMaterial) private readonly kitMaterialRepo: Repository<KitMaterial>,
    @InjectRepository(BayLayout) private readonly bayLayoutRepo: Repository<BayLayout>,
    @InjectRepository(BomItem) private readonly bomRepo: Repository<BomItem>,
    @InjectRepository(ProductionBayEvent) private readonly eventRepo: Repository<ProductionBayEvent>,
    @InjectRepository(ProductionBayIncident) private readonly incidentRepo: Repository<ProductionBayIncident>,
    @InjectRepository(ProductionBayMaterialState) private readonly materialStateRepo: Repository<ProductionBayMaterialState>,
    private readonly dataSource: DataSource,
  ) {}

  async getBackends() {
    const kits = await this.kitRepo.find({
      where: { status: In(['preparing', 'kitted', 'ready', 'requested', 'delivered', 'in_progress', 'received', 'sent']) },
      relations: ['plan'],
      order: { id: 'ASC' },
    });

    return Promise.all(kits.map((kit) => this.buildBackendView(kit.id)));
  }

  async getBackend(kitId: number) {
    return this.buildBackendView(kitId);
  }

  async receiveBackend(kitId: number) {
    const kit = await this.findKit(kitId);
    if (!['ready', 'requested'].includes(kit.status)) {
      throw new BadRequestException('Kit no está listo para recepción en línea');
    }
    await this.kitRepo.update(kitId, { status: 'requested', requestedAt: kit.requestedAt ?? new Date() });
    return this.buildBackendView(kitId);
  }

  async startBackend(kitId: number) {
    const kit = await this.findKit(kitId);
    if (!['requested', 'received', 'delivered', 'sent', 'ready', 'in_progress'].includes(kit.status)) {
      throw new BadRequestException('Kit no puede iniciar ensamble desde su estado actual');
    }
    await this.kitRepo.update(kitId, { status: 'in_progress' });
    return this.buildBackendView(kitId);
  }

  async registerBayEvent(kitId: number, bayId: number, dto: RegisterBayEventDto) {
    if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'quantity debe ser mayor a 0' });
    }
    if (bayId < 1 || bayId > 6) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'bayId debe estar entre 1 y 6' });
    }
    if (!dto.clientRequestId?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'clientRequestId es obligatorio' });
    }
    const clientRequestId = dto.clientRequestId.trim();

    const kit = await this.findKit(kitId);
    const model = kit.plan?.model;
    if (!model) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Kit sin modelo asociado' });

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
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `No hay materiales configurados para bahía ${bayId}` });
      }

      for (const state of states) {
        const consume = dto.quantity * state.usagePerAssembly;
        if (state.availableQty - consume < 0) {
          throw new ConflictException({
            code: 'MATERIAL_INSUFFICIENT',
            message: `Material insuficiente en ${state.partNumber} para registrar`,
          });
        }
        state.consumedQty = Math.round((state.consumedQty + consume) * 1e6) / 1e6;
        state.availableQty = Math.max(0, Math.round((state.availableQty - consume) * 1e6) / 1e6);
        if (state.availableQty < 0 || state.consumedQty < 0) {
          throw new ConflictException({ code: 'STATE_INCONSISTENT', message: 'Estado de material inconsistente' });
        }
      }

      await em.save(states);

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
      if (completedQty < 0) {
        throw new ConflictException({ code: 'STATE_INCONSISTENT', message: 'completedQty inválido' });
      }
      const nextStatus = completedQty >= kit.plan.quantity ? 'completed' : 'in_progress';
      await em.update(Kit, kitId, { status: nextStatus });

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
      if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: `Evento ${eventId} no encontrado` });
      if (event.revertedAt) {
        throw new ConflictException({ code: 'EVENT_ALREADY_REVERTED', message: 'El evento ya fue revertido' });
      }

      const undoWindowMs = 10_000;
      if ((Date.now() - new Date(event.createdAt).getTime()) > undoWindowMs) {
        throw new ConflictException({ code: 'UNDO_WINDOW_EXPIRED', message: 'Ventana de reversa expirada' });
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
        state.consumedQty = Math.max(0, Math.round((state.consumedQty - rollback) * 1e6) / 1e6);
        state.availableQty = Math.max(0, Math.round((state.availableQty + rollback) * 1e6) / 1e6);
        if (state.availableQty < 0 || state.consumedQty < 0) {
          throw new ConflictException({ code: 'STATE_INCONSISTENT', message: 'Estado de material inconsistente tras reversa' });
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
        throw new ConflictException({ code: 'STATE_INCONSISTENT', message: 'completedQty inválido tras reversa' });
      }
      const nextStatus = completedQty >= kit.plan.quantity ? 'completed' : 'in_progress';
      await em.update(Kit, kit.id, { status: nextStatus });

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

  async createBayIncident(kitId: number, bayId: number, dto: CreateBayIncidentDto) {
    if (bayId < 1 || bayId > 6) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'bayId debe estar entre 1 y 6' });
    }
    const allowedTypes = ['Falta material', 'Error de ensamble', 'Paro de estación', 'Otro'];
    if (!allowedTypes.includes(dto.type)) {
      throw new ConflictException({ code: 'INCIDENT_TYPE_INVALID', message: 'Tipo de incidencia inválido' });
    }
    await this.findKit(kitId);
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
    return this.incidentRepo.save(incident);
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
    return this.materialStateRepo.find({
      where: { kit: { id: kitId } },
      order: { bayId: 'ASC', partNumber: 'ASC' },
    });
  }

  async getHourly(kitId: number) {
    const events = await this.eventRepo.find({
      where: { kit: { id: kitId } },
      order: { timestamp: 'DESC' },
    });

    const agg = new Map<string, { bayId: number; totalQty: number; events: number }>();
    events.filter((event) => !event.revertedAt).forEach((event) => {
      const dt = new Date(event.timestamp);
      dt.setMinutes(0, 0, 0);
      const key = `${dt.toISOString()}-B${event.bayId}`;
      const row = agg.get(key) ?? { bayId: event.bayId, totalQty: 0, events: 0 };
      row.totalQty += event.quantity;
      row.events += 1;
      agg.set(key, row);
    });

    return [...agg.entries()]
      .map(([key, value]) => ({
        hourBucket: key.slice(0, 24),
        bayId: value.bayId,
        totalQty: value.totalQty,
        events: value.events,
      }))
      .sort((a, b) => b.hourBucket.localeCompare(a.hourBucket) || a.bayId - b.bayId);
  }

  async getCompleted() {
    const kits = await this.kitRepo.find({
      where: { status: 'completed' },
      relations: ['plan'],
      order: { id: 'DESC' },
      take: 100,
    });
    return Promise.all(kits.map((kit) => this.buildBackendView(kit.id)));
  }

  async getShortageRisk(kitId: number) {
    const materials = await this.getMaterials(kitId);
    const cutoff = new Date(Date.now() - (30 * 60 * 1000));
    const events = await this.eventRepo.find({
      where: { kit: { id: kitId } },
      order: { timestamp: 'DESC' },
      take: 500,
    });

    const recentByBay = new Map<number, number>();
    events.filter((event) => !event.revertedAt && new Date(event.timestamp) >= cutoff).forEach((event) => {
      recentByBay.set(event.bayId, (recentByBay.get(event.bayId) ?? 0) + event.quantity);
    });

    const materialsRisk = materials.map((item) => {
      const units30m = recentByBay.get(item.bayId) ?? 0;
      const perMinuteAssemblies = units30m / 30;
      const consumptionPerMinute = perMinuteAssemblies * item.usagePerAssembly;
      const minutesToStockout = consumptionPerMinute > 0 ? item.availableQty / consumptionPerMinute : null;

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
      };
    });

    const risky = materialsRisk.filter((item) => item.severity !== 'stable');
    const mostCritical = [...risky].sort((a, b) => (a.minutesToStockout ?? Infinity) - (b.minutesToStockout ?? Infinity))[0] ?? null;

    return {
      kitId,
      riskyCount: risky.length,
      mostCritical,
      materials: materialsRisk,
    };
  }

  async getLogisticsRisk() {
    const backends = await this.getBackends();
    const risks = await Promise.all(backends.map((backend) => this.getShortageRisk(backend.kitId)));
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
    const materials = await this.materialStateRepo.find({ where: { kit: { id: kitId } } });

    return {
      kitId,
      backendCode: `BK${kit.plan.backen}`,
      backen: kit.plan.backen,
      model: kit.plan.model,
      workOrder: kit.plan.workOrder,
      shift: kit.plan.shift,
      targetQty: kit.plan.quantity,
      completedQty,
      status: kit.status,
      hasIncident: false,
      receivedAt: kit.requestedAt ?? kit.receivedAt ?? null,
      startedAt: await this.firstEventAt(kitId),
      completedAt: kit.status === 'completed' ? await this.lastEventAt(kitId) : null,
      lowStockCount: materials.filter((item) => item.availableQty <= item.lowStockThreshold).length,
    };
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
    const existing = await this.materialStateRepo.count({ where: { kit: { id: kitId } } });
    if (existing > 0) return;

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
    const materialByPart = new Map(kit.materials.map((item) => [item.partNumber, item]));

    const rows = layouts.map((layout) => {
      const material = materialByPart.get(layout.partNumber);
      const bomItem = bomByPart.get(layout.partNumber);
      const quantityRequired = material?.quantityRequired ?? (bomItem?.usageFactor ?? 0) * kit.plan.quantity;
      const usagePerAssembly = kit.plan.quantity > 0 ? quantityRequired / kit.plan.quantity : (bomItem?.usageFactor ?? 0);
      const availableQty = Math.max(0, material?.quantityRemaining ?? quantityRequired);
      const lowStockThreshold = Math.max(5, Math.ceil((quantityRequired || 20) * 0.2));

      return this.materialStateRepo.create({
        kit: { id: kitId } as Kit,
        bayId: layout.bahia,
        model,
        partNumber: layout.partNumber,
        description: bomItem?.description ?? material?.description ?? undefined,
        usagePerAssembly,
        availableQty,
        consumedQty: material?.quantityConsumed ?? 0,
        lowStockThreshold,
      });
    });

    await this.materialStateRepo.save(rows);
  }

  private async findKit(kitId: number): Promise<Kit> {
    const kit = await this.kitRepo.findOne({ where: { id: kitId }, relations: ['plan'] });
    if (!kit) throw new NotFoundException(`Kit ${kitId} no encontrado`);
    return kit;
  }
}
