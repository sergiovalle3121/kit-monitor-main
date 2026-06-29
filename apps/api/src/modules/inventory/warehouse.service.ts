import { Injectable, NotFoundException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { WarehouseTask, WarehouseTaskStatus, WarehouseTaskType } from './entities/warehouse-task.entity';
import { InventoryService } from './inventory.service';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { MaterialStagingService } from '../material-staging/material-staging.service';
import { In } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import {
  computeAgingMinutes,
  effectiveSla,
  isSlaBreached,
  pullSemaphore,
  DEFAULT_PULL_SLA_MINUTES,
} from './pull.util';
import { InventoryPosition } from './entities/inventory-position.entity';

export interface WarehouseLocationVisibility {
  warehouseId: string;
  warehouseName: string;
  warehouseCode?: string;
  location: string;
  programIds: string[];
  partCount: number;
  lotCount: number;
  onHand: number;
  allocated: number;
  available: number;
  inTransit: number;
  holdQty: number;
  quarantineQty: number;
  qualityBlockQty: number;
  openOutboundPulls: number;
  openInboundPulls: number;
  outboundQty: number;
  inboundQty: number;
  signal: 'available' | 'busy' | 'blocked' | 'empty';
  statuses: Array<{ status: string; positions: number; onHand: number }>;
  topParts: Array<{
    partNumber: string;
    onHand: number;
    available: number;
    holdStatus: string;
    programId?: string | null;
    lotNumber?: string | null;
  }>;
}

@Injectable()
export class WarehouseService {
  constructor(
    @Inject(getTenantRepositoryToken(WarehouseTask))
    private readonly taskRepo: TenantScopedRepository<WarehouseTask>,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    @InjectRepository(EnterpriseWarehouse)
    private readonly warehouseRepo: Repository<EnterpriseWarehouse>,
    private readonly tenantCtx: TenantContextService,
    // Lectura del lado de material-staging para importar llamados de resurtido
    // (e-kanban) como pulls. @Optional: si el módulo no está, el import no-opera.
    @Optional() private readonly materialStaging?: MaterialStagingService,
  ) {}

  // ── tenant scope helper (QueryBuilder reads bypass the tenant-scoped repo) ───
  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    return qb;
  }

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
    this.applyScope(qb, 'task');
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

  async getLocationVisibility(filters: any, user: User): Promise<WarehouseLocationVisibility[]> {
    const safeFilters = filters ?? {};
    const { warehouseId, location, holdStatus, partNumber, programId, ...taskFilters } = safeFilters;
    const positions = await this.inventory.findAllPositions(user, {
      warehouseId,
      partNumber,
      programId,
    });
    const openTasks = (await this.findAllTasks({ ...taskFilters, status: undefined }, user)).filter(
      (t) => t.status === WarehouseTaskStatus.PENDING || t.status === WarehouseTaskStatus.IN_PROGRESS,
    );

    const locationNeedle = String(location ?? '').trim().toLowerCase();
    const holdFilter = String(holdStatus ?? '').trim().toLowerCase();
    const partNeedle = String(partNumber ?? '').trim().toLowerCase();
    const warehouseFilter = String(warehouseId ?? '').trim();
    const programFilter = String(programId ?? '').trim();

    const map = new Map<
      string,
      {
        warehouseId: string;
        warehouseName: string;
        warehouseCode?: string;
        location: string;
        programIds: Set<string>;
        parts: Set<string>;
        lots: Set<string>;
        onHand: number;
        allocated: number;
        inTransit: number;
        holdQty: number;
        quarantineQty: number;
        qualityBlockQty: number;
        openOutboundPulls: number;
        openInboundPulls: number;
        outboundQty: number;
        inboundQty: number;
        statuses: Map<string, { positions: number; onHand: number }>;
        topParts: Map<
          string,
          { partNumber: string; onHand: number; available: number; holdStatus: string; programId?: string | null; lotNumber?: string | null }
        >;
      }
    >();

    const keyFor = (warehouseId: string, location: string) => `${warehouseId}::${location || 'BULK'}`;
    const ensure = (warehouseId: string, location: string, seed?: InventoryPosition) => {
      const loc = location || 'BULK';
      const key = keyFor(warehouseId, loc);
      if (!map.has(key)) {
        map.set(key, {
          warehouseId,
          warehouseName: seed?.warehouse?.name ?? warehouseId,
          warehouseCode: seed?.warehouse?.code,
          location: loc,
          programIds: new Set<string>(),
          parts: new Set<string>(),
          lots: new Set<string>(),
          onHand: 0,
          allocated: 0,
          inTransit: 0,
          holdQty: 0,
          quarantineQty: 0,
          qualityBlockQty: 0,
          openOutboundPulls: 0,
          openInboundPulls: 0,
          outboundQty: 0,
          inboundQty: 0,
          statuses: new Map<string, { positions: number; onHand: number }>(),
          topParts: new Map<
            string,
            { partNumber: string; onHand: number; available: number; holdStatus: string; programId?: string | null; lotNumber?: string | null }
          >(),
        });
      }
      return map.get(key)!;
    };

    for (const pos of positions) {
      if (locationNeedle && !String(pos.location ?? '').toLowerCase().includes(locationNeedle)) continue;
      if (holdFilter && String(pos.holdStatus ?? '').toLowerCase() !== holdFilter) continue;
      const bucket = ensure(pos.warehouseId, pos.location, pos);
      bucket.parts.add(pos.partNumber);
      if (pos.programId) bucket.programIds.add(pos.programId);
      if (pos.lotNumber) bucket.lots.add(pos.lotNumber);
      bucket.onHand += pos.onHand ?? 0;
      bucket.allocated += pos.allocated ?? 0;
      bucket.inTransit += pos.inTransit ?? 0;

      const holdStatus = pos.holdStatus ?? 'available';
      if (holdStatus !== 'available') bucket.holdQty += pos.onHand ?? 0;
      if (holdStatus === 'quarantine') bucket.quarantineQty += pos.onHand ?? 0;
      if (['hold', 'quarantine', 'expired', 'pending_iqc', 'pending_oqc'].includes(holdStatus)) {
        bucket.qualityBlockQty += pos.onHand ?? 0;
      }

      const status = bucket.statuses.get(holdStatus) ?? { positions: 0, onHand: 0 };
      status.positions += 1;
      status.onHand += pos.onHand ?? 0;
      bucket.statuses.set(holdStatus, status);

      const partKey = `${pos.partNumber}::${pos.programId ?? ''}::${pos.lotNumber ?? ''}::${holdStatus}`;
      const existing = bucket.topParts.get(partKey) ?? {
        partNumber: pos.partNumber,
        onHand: 0,
        available: 0,
        holdStatus,
        programId: pos.programId,
        lotNumber: pos.lotNumber,
      };
      existing.onHand += pos.onHand ?? 0;
      existing.available += (pos.onHand ?? 0) - (pos.allocated ?? 0);
      bucket.topParts.set(partKey, existing);
    }

    const taskMatchesFilters = (task: WarehouseTask): boolean => {
      if (partNeedle && !String(task.partNumber ?? '').toLowerCase().includes(partNeedle)) return false;
      if (programFilter && task.project !== programFilter) return false;
      return true;
    };

    for (const task of openTasks) {
      if (!taskMatchesFilters(task)) continue;
      if (task.fromWarehouseId && (!warehouseFilter || task.fromWarehouseId === warehouseFilter)) {
        if (!locationNeedle || String(task.fromLocation ?? '').toLowerCase().includes(locationNeedle)) {
          const out = ensure(task.fromWarehouseId, task.fromLocation);
          out.openOutboundPulls += 1;
          out.outboundQty += task.quantity ?? 0;
          out.parts.add(task.partNumber);
          if (task.project) out.programIds.add(task.project);
        }
      }
      if (task.toWarehouseId && (!warehouseFilter || task.toWarehouseId === warehouseFilter)) {
        if (!locationNeedle || String(task.toLocation ?? '').toLowerCase().includes(locationNeedle)) {
          const inbound = ensure(task.toWarehouseId, task.toLocation);
          inbound.openInboundPulls += 1;
          inbound.inboundQty += task.quantity ?? 0;
          inbound.parts.add(task.partNumber);
          if (task.project) inbound.programIds.add(task.project);
        }
      }
    }

    return Array.from(map.values())
      .map((b) => {
        const available = b.onHand - b.allocated;
        const signal: WarehouseLocationVisibility['signal'] =
          b.qualityBlockQty > 0
            ? 'blocked'
            : b.openOutboundPulls + b.openInboundPulls > 0
              ? 'busy'
              : b.onHand > 0 || b.inTransit > 0
                ? 'available'
                : 'empty';
        return {
          warehouseId: b.warehouseId,
          warehouseName: b.warehouseName,
          warehouseCode: b.warehouseCode,
          location: b.location,
          programIds: Array.from(b.programIds).sort(),
          partCount: b.parts.size,
          lotCount: b.lots.size,
          onHand: Number(b.onHand.toFixed(3)),
          allocated: Number(b.allocated.toFixed(3)),
          available: Number(available.toFixed(3)),
          inTransit: Number(b.inTransit.toFixed(3)),
          holdQty: Number(b.holdQty.toFixed(3)),
          quarantineQty: Number(b.quarantineQty.toFixed(3)),
          qualityBlockQty: Number(b.qualityBlockQty.toFixed(3)),
          openOutboundPulls: b.openOutboundPulls,
          openInboundPulls: b.openInboundPulls,
          outboundQty: Number(b.outboundQty.toFixed(3)),
          inboundQty: Number(b.inboundQty.toFixed(3)),
          signal,
          statuses: Array.from(b.statuses.entries())
            .map(([status, value]) => ({ status, ...value, onHand: Number(value.onHand.toFixed(3)) }))
            .sort((a, c) => c.onHand - a.onHand),
          topParts: Array.from(b.topParts.values())
            .sort((a, c) => c.onHand - a.onHand)
            .slice(0, 5),
        };
      })
      .sort((a, b) => {
        const signalRank = { blocked: 0, busy: 1, available: 2, empty: 3 } as const;
        const bySignal = signalRank[a.signal] - signalRank[b.signal];
        if (bySignal !== 0) return bySignal;
        const byWarehouse = a.warehouseName.localeCompare(b.warehouseName);
        return byWarehouse !== 0 ? byWarehouse : a.location.localeCompare(b.location);
      });
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
    this.applyScope(qb, 'task');

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
   * Importa los llamados de resurtido (e-kanban) abiertos de material-staging como
   * pulls del monitor — así el surtido de un kit publicado aparece en la cola del
   * almacén. Es ADITIVO y de SOLO LECTURA del lado de staging (usa el método
   * público tenant-scoped `listReplenishCalls`); NO toca su lógica ni su ciclo de
   * vida. Idempotente: cada llamado se enlaza por referenceType='REPLENISH_CALL' +
   * referenceId=call.id y no se vuelve a crear.
   *
   * Como SfReplenishCall no trae almacén/ubicación (sólo estación/parte/cant.), el
   * operador elige el almacén origen al importar. Es un puente de UNA VÍA (surfacing
   * de demanda): entregar el pull no cierra el llamado en staging — ese ciclo lo
   * gobierna material-staging. (Cierre bidireccional = follow-up, requeriría tocar
   * staging.)
   */
  async importReplenishCalls(
    dto: { sourceWarehouseId: string; sourceLocation?: string },
    user: User,
  ): Promise<{ imported: number; skipped: number; total: number }> {
    if (!this.materialStaging) {
      throw new BadRequestException('La integración con material-staging no está disponible.');
    }
    if (!dto.sourceWarehouseId) {
      throw new BadRequestException('Almacén origen requerido para importar los resurtidos.');
    }

    const calls = await this.materialStaging.listReplenishCalls();
    const open = calls.filter((c) => c.status === 'OPEN' || c.status === 'IN_TRANSIT');

    let imported = 0;
    let skipped = 0;
    for (const call of open) {
      const existing = await this.taskRepo.findOne({
        where: { referenceType: 'REPLENISH_CALL', referenceId: call.id },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const urgent = call.priority === 'URGENT' || call.priority === 'HIGH';
      const slaMinutes =
        call.priority === 'URGENT' ? 30 : call.priority === 'HIGH' ? 60 : call.priority === 'LOW' ? 240 : 120;
      await this.createTask(
        {
          type: WarehouseTaskType.PICK,
          partNumber: call.part,
          quantity: call.qty,
          fromWarehouseId: dto.sourceWarehouseId,
          fromLocation: dto.sourceLocation || 'ALMACEN',
          toWarehouseId: dto.sourceWarehouseId,
          toLocation: call.station,
          project: call.woFolio || call.woId,
          requestor: call.raisedBy || 'e-kanban',
          urgent,
          touches: 0,
          slaMinutes,
          referenceType: 'REPLENISH_CALL',
          referenceId: call.id,
        },
        user,
      );
      imported += 1;
    }
    return { imported, skipped, total: open.length };
  }

  /**
   * Importa una pull-list (p.ej. de un archivo CSV) creando un pull por fila. Es la
   * vía de importación POR ARCHIVO que prepara el terreno para una integración SAP
   * futura: hoy el front sube/parsea el CSV y manda las filas como JSON; mañana un
   * conector SAP podría llamar a este mismo método con las líneas mapeadas. NO
   * integra SAP (sin credenciales ni middleware).
   *
   * Best-effort por fila: una fila inválida no tumba el lote — se reporta su error
   * y se sigue. Cada pull queda marcado con referenceType='PULL_LIST'.
   */
  async importPullList(
    rows: any[],
    user: User,
  ): Promise<{ imported: number; failed: number; errors: { row: number; message: string }[] }> {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No hay filas para importar.');
    }
    if (rows.length > 1000) {
      throw new BadRequestException('La pull-list excede el máximo de 1000 filas por importación.');
    }

    let imported = 0;
    const errors: { row: number; message: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {};
      const urgent =
        r.urgent === true ||
        ['true', 'sí', 'si', '1', 'x', 'y', 'yes'].includes(String(r.urgent ?? '').trim().toLowerCase());
      try {
        await this.createPull(
          {
            project: r.project,
            partNumber: r.partNumber,
            quantity: Number(r.quantity) || 0,
            fromWarehouseId: r.fromWarehouseId,
            toLocation: r.toLocation,
            requestor: r.requestor || user.email,
            slaMinutes: r.slaMinutes ? Number(r.slaMinutes) : undefined,
            urgent,
            referenceId: r.referenceId,
            referenceType: 'PULL_LIST',
          },
          user,
        );
        imported += 1;
      } catch (err) {
        errors.push({ row: i + 1, message: (err as Error).message });
      }
    }
    return { imported, failed: errors.length, errors };
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
