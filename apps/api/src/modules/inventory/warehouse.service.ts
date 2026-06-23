import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { WarehouseTask, WarehouseTaskStatus, WarehouseTaskType } from './entities/warehouse-task.entity';
import { InventoryService } from './inventory.service';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { In } from 'typeorm';
import {
  computeAgingMinutes,
  effectiveSla,
  isSlaBreached,
  pullSemaphore,
  DEFAULT_PULL_SLA_MINUTES,
} from './pull.util';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseTask)
    private readonly taskRepo: Repository<WarehouseTask>,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
  ) {}

  /**
   * Filtro de scope organizacional (seesAllAreas = sin buildings → ve todo):
   * limita las tareas a los almacenes de los edificios en el scope del usuario.
   * Devuelve false si el scope no resuelve ningún almacén (la consulta no debe
   * devolver nada).
   */
  private async applyBuildingScope(qb: SelectQueryBuilder<WarehouseTask>, user: User): Promise<void> {
    const scopeBids = user?.scopes?.buildings ?? [];
    if (scopeBids.length === 0) return; // admin / executive: sin restricción
    const whs = await this.warehouseRepo.find({ where: { building: { id: In(scopeBids) } } as any });
    const whIds = whs.map((w) => w.id);
    if (whIds.length > 0) {
      qb.andWhere('(task.fromWarehouseId IN (:...whIds) OR task.toWarehouseId IN (:...whIds))', { whIds });
    } else {
      qb.andWhere('1 = 0');
    }
  }

  async findAllTasks(filters: any, user: User): Promise<WarehouseTask[]> {
    const qb = this.taskRepo.createQueryBuilder('task');
    await this.applyBuildingScope(qb, user);

    if (filters.status) qb.andWhere('task.status = :status', { status: filters.status });
    if (filters.type) qb.andWhere('task.type = :type', { type: filters.type });
    if (filters.warehouseId) qb.andWhere('task.fromWarehouseId = :wh', { wh: filters.warehouseId });
    if (filters.project) qb.andWhere('task.project = :project', { project: filters.project });
    if (filters.assignedTo) qb.andWhere('task.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
    if (filters.urgent === 'true' || filters.urgent === true) qb.andWhere('task.urgent = :u', { u: true });
    qb.orderBy('task.createdAt', 'DESC');
    return qb.getMany();
  }

  async createTask(dto: Partial<WarehouseTask>, user: User): Promise<WarehouseTask> {
    const count = await this.taskRepo.count();
    const taskNumber = `TSK-2024-${(count + 1).toString().padStart(4, '0')}`;
    const task = this.taskRepo.create({ ...dto, taskNumber, status: WarehouseTaskStatus.PENDING });
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: user.email,
      action: 'WAREHOUSE_TASK_CREATED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { type: saved.type, from: saved.fromWarehouseId, to: saved.toWarehouseId },
      outcome: 'ALLOWED'
    });

    return saved;
  }

  async startTask(id: number, actor: string, user: User): Promise<WarehouseTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== WarehouseTaskStatus.PENDING) throw new BadRequestException('Task already started or completed');
    
    task.status = WarehouseTaskStatus.IN_PROGRESS;
    task.assignedTo = actor;
    task.touches = (task.touches ?? 0) + 1; // tomar un pull cuenta como una manipulación
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: user.email,
      action: 'WAREHOUSE_TASK_STARTED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { assignedTo: actor },
      outcome: 'ALLOWED'
    });

    return saved;
  }

  async completeTask(id: number, actor: string, user: User): Promise<WarehouseTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== WarehouseTaskStatus.IN_PROGRESS) throw new BadRequestException('Task must be in progress to complete');

    // Execute Physical Movement
    await this.inventory.recordTransaction({
      type: 'TRANSFER',
      partNumber: task.partNumber,
      quantity: task.quantity,
      fromWarehouseId: task.fromWarehouseId,
      fromLocation: task.fromLocation,
      toWarehouseId: task.toWarehouseId,
      toLocation: task.toLocation,
      actorName: actor,
      referenceType: 'WAREHOUSE_TASK',
      referenceId: task.taskNumber,
      lotNumber: task.lotNumber,
      reason: `Task Completion: ${task.type.toUpperCase()} - ${task.taskNumber}`
    });

    task.status = WarehouseTaskStatus.COMPLETED;
    task.completedBy = actor;
    task.completedAt = new Date();
    // Sella deliveredAt para que la analítica de suministro (aging al entregar)
    // tome también las tareas cerradas por la vía clásica de "completar".
    if (!task.deliveredAt) task.deliveredAt = task.completedAt;
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: user.email,
      action: 'WAREHOUSE_TASK_COMPLETED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { completedBy: actor },
      outcome: 'ALLOWED'
    });

    return saved;
  }

  // --- GUIDED PICKING ---

  async getPickingBacklog(warehouseId: string, user: User): Promise<WarehouseTask[]> {
    const qb = this.taskRepo.createQueryBuilder('task')
      .where('task.status IN (:...statuses)', { statuses: [WarehouseTaskStatus.PENDING, WarehouseTaskStatus.IN_PROGRESS] })
      .andWhere('task.type IN (:...types)', { types: [WarehouseTaskType.PICK, WarehouseTaskType.TRANSFER] });
    
    // 1. Scope-aware filtering
    const scopeBids = user.scopes?.buildings ?? [];
    if (scopeBids.length > 0) {
      const whs = await this.warehouseRepo.find({ where: { building: { id: In(scopeBids) } } as any });
      const whIds = whs.map(w => w.id);
      if (whIds.length > 0) {
        qb.andWhere('task.fromWarehouseId IN (:...whIds)', { whIds });
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (warehouseId) qb.andWhere('task.fromWarehouseId = :wh', { wh: warehouseId });
    
    qb.orderBy('task.createdAt', 'ASC');
    return qb.getMany();
  }

  async handlePickException(id: number, exception: { reason: string; pickedQty: number; actor: string }, user: User): Promise<WarehouseTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');

    if (exception.reason === 'SHORT_PICK' && exception.pickedQty > 0) {
      // Execute partial movement
      await this.inventory.recordTransaction({
        type: 'TRANSFER',
        partNumber: task.partNumber,
        quantity: exception.pickedQty,
        fromWarehouseId: task.fromWarehouseId,
        fromLocation: task.fromLocation,
        toWarehouseId: task.toWarehouseId,
        toLocation: task.toLocation,
        actorName: exception.actor,
        referenceType: 'PICK_EXCEPTION',
        referenceId: task.taskNumber,
        reason: `Short Pick Exception: ${exception.reason}`
      });
      
      // Create new task for remaining balance
      await this.createTask({
        ...task,
        id: undefined,
        quantity: task.quantity - exception.pickedQty,
        status: WarehouseTaskStatus.PENDING,
        referenceId: `${task.taskNumber}-REMAINDER`
      }, user);
    }

    task.status = WarehouseTaskStatus.CANCELLED; // Cancel original task
    task.completedBy = exception.actor;
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: user.email,
      action: 'PICK_EXCEPTION_HANDLED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { reason: exception.reason, pickedQty: exception.pickedQty },
      outcome: 'ALLOWED'
    });

    return saved;
  }

  // ─── PULL MONITOR (nativo) ──────────────────────────────────────────────────
  // Un PULL es un pedido de material del piso al almacén. Se modela como una
  // warehouse_task (PICK por defecto) con los campos de pull. El monitor agrupa
  // por almacén y decora cada pull con aging/SLA en vivo.

  /**
   * Lista de pulls decorada para el monitor: resuelve el nombre del almacén y
   * calcula aging/SLA. Respeta el scope organizacional (seesAllAreas).
   */
  async getPullMonitor(filters: any, user: User): Promise<any[]> {
    const tasks = await this.findAllTasks(filters, user);

    // Mapa id→almacén para etiquetar cada pull con un nombre legible.
    const whIds = Array.from(
      new Set(tasks.flatMap((t) => [t.fromWarehouseId, t.toWarehouseId]).filter(Boolean)),
    );
    const whMap = new Map<string, { name: string; code: string }>();
    if (whIds.length > 0) {
      const whs = await this.warehouseRepo.find({ where: { id: In(whIds) } as any });
      for (const w of whs) whMap.set(w.id, { name: w.name, code: w.code });
    }

    const now = new Date();
    return tasks.map((t) => this.decoratePull(t, whMap, now));
  }

  private decoratePull(
    t: WarehouseTask,
    whMap: Map<string, { name: string; code: string }>,
    now: Date,
  ): any {
    const closedAt = t.deliveredAt ?? t.canceledAt ?? (t.status === WarehouseTaskStatus.COMPLETED ? t.completedAt : null);
    const agingMinutes = computeAgingMinutes(t.createdAt, closedAt, now);
    const sla = effectiveSla(t.slaMinutes);
    const wh = whMap.get(t.fromWarehouseId);
    return {
      ...t,
      warehouseName: wh?.name ?? t.fromWarehouseId,
      warehouseCode: wh?.code ?? t.fromWarehouseId,
      slaMinutes: sla,
      agingMinutes,
      slaBreached: isSlaBreached(agingMinutes, t.slaMinutes),
      semaphore: pullSemaphore(agingMinutes, t.slaMinutes),
    };
  }

  /**
   * Crea un pull (pedido de material). Es una warehouse_task de tipo PICK con los
   * campos de pull. Reutiliza createTask (folio + auditoría) para no duplicar.
   *
   * TODO (integración SAP — fuera de alcance de este PR): una futura importación
   * de pull-lists por archivo/API entraría por aquí, mapeando cada línea SAP a un
   * createPull. Se deja como interfaz; NO se integra a SAP en este PR.
   */
  async createPull(dto: any, user: User): Promise<WarehouseTask> {
    if (!dto.partNumber) throw new BadRequestException('partNumber requerido para el pull');
    if (!dto.fromWarehouseId) throw new BadRequestException('Almacén origen (fromWarehouseId) requerido');
    const pull: Partial<WarehouseTask> = {
      type: WarehouseTaskType.PICK,
      partNumber: dto.partNumber,
      quantity: Number(dto.quantity) || 0,
      lotNumber: dto.lotNumber,
      fromWarehouseId: dto.fromWarehouseId,
      fromLocation: dto.fromLocation || 'ALMACEN',
      toWarehouseId: dto.toWarehouseId || dto.fromWarehouseId,
      toLocation: dto.toLocation || 'LINEA',
      project: dto.project,
      requestor: dto.requestor || user.email,
      urgent: dto.urgent === true || dto.urgent === 'true',
      touches: 0,
      slaMinutes: dto.slaMinutes ? Number(dto.slaMinutes) : DEFAULT_PULL_SLA_MINUTES,
      referenceType: dto.referenceType || 'PULL',
      referenceId: dto.referenceId,
      assignedTo: dto.assignedTo,
    };
    return this.createTask(pull, user);
  }

  /**
   * ENTREGAR un pull: lo cierra como COMPLETED y sella deliveredAt. Intenta el
   * movimiento físico (TRANSFER almacén→destino) de forma best-effort: si el
   * inventario no alcanza o la parte no está en maestro, NO se bloquea la entrega
   * — recordTransaction ya levanta la excepción operativa, y el pull se marca
   * entregado con una nota. Así "Entregar" siempre cierra el SLA en piso.
   */
  async deliverTask(id: number, actor: string, user: User): Promise<WarehouseTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Pull not found');
    if (task.status === WarehouseTaskStatus.COMPLETED || task.status === WarehouseTaskStatus.CANCELLED) {
      throw new BadRequestException('El pull ya está cerrado (entregado o cancelado)');
    }

    let deliveryNote: string | undefined;
    if (task.partNumber && task.fromWarehouseId && task.toWarehouseId) {
      try {
        await this.inventory.recordTransaction({
          type: 'TRANSFER',
          partNumber: task.partNumber,
          quantity: task.quantity,
          fromWarehouseId: task.fromWarehouseId,
          fromLocation: task.fromLocation,
          toWarehouseId: task.toWarehouseId,
          toLocation: task.toLocation,
          actorName: actor,
          referenceType: 'WAREHOUSE_PULL',
          referenceId: task.taskNumber,
          lotNumber: task.lotNumber,
          reason: `Pull delivered: ${task.taskNumber}`,
        });
      } catch (err) {
        // El movimiento no debe bloquear el cierre operativo del pull.
        deliveryNote = `Entregado sin movimiento de inventario: ${(err as Error).message}`;
      }
    }

    task.status = WarehouseTaskStatus.COMPLETED;
    task.assignedTo = task.assignedTo ?? actor;
    task.completedBy = actor;
    task.completedAt = new Date();
    task.deliveredAt = task.completedAt;
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: user.email,
      action: 'WAREHOUSE_PULL_DELIVERED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { deliveredBy: actor, note: deliveryNote },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  /** CANCELAR un pull: lo marca CANCELLED y sella canceledAt. No mueve inventario. */
  async cancelTask(id: number, actor: string, reason: string | undefined, user: User): Promise<WarehouseTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Pull not found');
    if (task.status === WarehouseTaskStatus.COMPLETED) {
      throw new BadRequestException('No se puede cancelar un pull ya entregado');
    }
    task.status = WarehouseTaskStatus.CANCELLED;
    task.canceledAt = new Date();
    task.completedBy = actor;
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: user.email,
      action: 'WAREHOUSE_PULL_CANCELLED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { canceledBy: actor, reason: reason ?? null },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  /** Asignar un pull a alguien (supervisor reparte la carga). */
  async assignTask(id: number, assignee: string, user: User): Promise<WarehouseTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Pull not found');
    task.assignedTo = assignee;
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: user.email,
      action: 'WAREHOUSE_PULL_ASSIGNED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { assignedTo: assignee },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  // ─── ANALÍTICA DE SUMINISTRO ────────────────────────────────────────────────
  // Responde "qué se pide, quién, cuándo, de dónde y cuánto tarda" sobre el
  // histórico de pulls: tiempo de suministro (aging al entregar) por almacén y
  // proyecto, pulls por día, top proyectos/partes, % fuera de SLA, touches.

  async getSupplyAnalytics(filters: any, user: User): Promise<any> {
    // Histórico completo (scope-aware) — sin filtro de estado para incluir
    // entregados, abiertos y cancelados.
    const tasks = await this.findAllTasks({ ...filters, status: undefined }, user);
    const now = new Date();

    const delivered = tasks.filter((t) => !!t.deliveredAt || t.status === WarehouseTaskStatus.COMPLETED);
    const open = tasks.filter(
      (t) => t.status === WarehouseTaskStatus.PENDING || t.status === WarehouseTaskStatus.IN_PROGRESS,
    );

    const supplyMinutes = (t: WarehouseTask): number =>
      computeAgingMinutes(t.createdAt, t.deliveredAt ?? t.completedAt, now);
    const avg = (xs: number[]): number => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

    // Por almacén
    const byWhMap = new Map<string, { open: number; delivered: number; supply: number[]; touches: number[]; breachedOpen: number }>();
    const ensureWh = (id: string) => {
      if (!byWhMap.has(id)) byWhMap.set(id, { open: 0, delivered: 0, supply: [], touches: [], breachedOpen: 0 });
      return byWhMap.get(id)!;
    };
    for (const t of tasks) {
      const b = ensureWh(t.fromWarehouseId);
      if (t.deliveredAt || t.status === WarehouseTaskStatus.COMPLETED) {
        b.delivered++;
        b.supply.push(supplyMinutes(t));
      }
      if (t.status === WarehouseTaskStatus.PENDING || t.status === WarehouseTaskStatus.IN_PROGRESS) {
        b.open++;
        if (isSlaBreached(computeAgingMinutes(t.createdAt, null, now), t.slaMinutes)) b.breachedOpen++;
      }
      b.touches.push(t.touches ?? 0);
    }

    // Nombres de almacén
    const whIds = Array.from(byWhMap.keys()).filter(Boolean);
    const whMap = new Map<string, string>();
    if (whIds.length > 0) {
      const whs = await this.warehouseRepo.find({ where: { id: In(whIds) } as any });
      for (const w of whs) whMap.set(w.id, w.name);
    }
    const byWarehouse = Array.from(byWhMap.entries()).map(([id, b]) => ({
      warehouseId: id,
      warehouseName: whMap.get(id) ?? id,
      open: b.open,
      delivered: b.delivered,
      avgSupplyMinutes: avg(b.supply),
      avgTouches: b.touches.length ? Number((b.touches.reduce((a, c) => a + c, 0) / b.touches.length).toFixed(1)) : 0,
      breachedOpen: b.breachedOpen,
    }));

    // Por proyecto
    const byProjMap = new Map<string, { count: number; supply: number[] }>();
    for (const t of tasks) {
      const key = t.project || '—';
      if (!byProjMap.has(key)) byProjMap.set(key, { count: 0, supply: [] });
      const p = byProjMap.get(key)!;
      p.count++;
      if (t.deliveredAt || t.status === WarehouseTaskStatus.COMPLETED) p.supply.push(supplyMinutes(t));
    }
    const byProject = Array.from(byProjMap.entries())
      .map(([project, p]) => ({ project, count: p.count, avgSupplyMinutes: avg(p.supply) }))
      .sort((a, b) => b.count - a.count);

    // Pulls por día (creados vs entregados), últimos 14 días con dato
    const dayMap = new Map<string, { created: number; delivered: number }>();
    const dayKey = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
    for (const t of tasks) {
      if (t.createdAt) {
        const k = dayKey(t.createdAt);
        if (!dayMap.has(k)) dayMap.set(k, { created: 0, delivered: 0 });
        dayMap.get(k)!.created++;
      }
      if (t.deliveredAt) {
        const k = dayKey(t.deliveredAt);
        if (!dayMap.has(k)) dayMap.set(k, { created: 0, delivered: 0 });
        dayMap.get(k)!.delivered++;
      }
    }
    const perDay = Array.from(dayMap.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // Top partes
    const partMap = new Map<string, number>();
    for (const t of tasks) partMap.set(t.partNumber, (partMap.get(t.partNumber) ?? 0) + 1);
    const topParts = Array.from(partMap.entries())
      .map(([partNumber, count]) => ({ partNumber, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const allSupply = delivered.map(supplyMinutes);
    const breachedDelivered = delivered.filter((t) => isSlaBreached(supplyMinutes(t), t.slaMinutes)).length;

    return {
      totals: {
        total: tasks.length,
        open: open.length,
        delivered: delivered.length,
        avgSupplyMinutes: avg(allSupply),
        avgTouches: tasks.length
          ? Number((tasks.reduce((a, t) => a + (t.touches ?? 0), 0) / tasks.length).toFixed(1))
          : 0,
        pctOutOfSla: delivered.length ? Math.round((breachedDelivered / delivered.length) * 100) : 0,
      },
      byWarehouse,
      byProject,
      perDay,
      topParts,
    };
  }
}
