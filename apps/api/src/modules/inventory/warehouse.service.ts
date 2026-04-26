import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseTask, WarehouseTaskStatus, WarehouseTaskType } from './entities/warehouse-task.entity';
import { InventoryService } from './inventory.service';
import { AuditService } from '../governance/audit.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseTask)
    private readonly taskRepo: Repository<WarehouseTask>,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAllTasks(filters: {
    status?: string;
    type?: string;
    warehouseId?: string;
  }): Promise<WarehouseTask[]> {
    const qb = this.taskRepo.createQueryBuilder('task');

    // 1. Tenant isolation
    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('task.tenant_id = :tenantId', { tenantId });

    // 2. Building-level scope
    const allowedBuildings = this.tenantContext.getAllowedBuildingIds();
    if (allowedBuildings.length > 0) {
      const whIds = await this.inventory.resolveWarehouseIdsByBuildings(allowedBuildings);
      whIds.length > 0
        ? qb.andWhere(
            '(task.fromWarehouseId IN (:...whIds) OR task.toWarehouseId IN (:...whIds))',
            { whIds },
          )
        : qb.andWhere('1 = 0');
    }

    if (filters.status) qb.andWhere('task.status = :status', { status: filters.status });
    if (filters.type) qb.andWhere('task.type = :type', { type: filters.type });
    if (filters.warehouseId)
      qb.andWhere(
        '(task.fromWarehouseId = :wh OR task.toWarehouseId = :wh)',
        { wh: filters.warehouseId },
      );

    return qb.orderBy('task.createdAt', 'DESC').getMany();
  }

  async createTask(dto: Partial<WarehouseTask>): Promise<WarehouseTask> {
    const count = await this.taskRepo.count();
    const year = new Date().getFullYear();
    const taskNumber = `TSK-${year}-${(count + 1).toString().padStart(4, '0')}`;

    const task = this.taskRepo.create({
      ...dto,
      taskNumber,
      status: WarehouseTaskStatus.PENDING,
      tenant_id: this.tenantContext.getTenantId(),
      organization_id: this.tenantContext.getOrganizationId(),
      plant_id: this.tenantContext.getPlantId(),
    });
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: this.tenantContext.getUserEmail(),
      action: 'WAREHOUSE_TASK_CREATED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { type: saved.type, from: saved.fromWarehouseId, to: saved.toWarehouseId },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  async startTask(id: number, actor: string): Promise<WarehouseTask> {
    const task = await this.findTaskInTenant(id);
    if (task.status !== WarehouseTaskStatus.PENDING)
      throw new BadRequestException('Task already started or completed');

    task.status = WarehouseTaskStatus.IN_PROGRESS;
    task.assignedTo = actor;
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: this.tenantContext.getUserEmail(),
      action: 'WAREHOUSE_TASK_STARTED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { assignedTo: actor },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  async completeTask(id: number, actor: string): Promise<WarehouseTask> {
    const task = await this.findTaskInTenant(id);
    if (task.status !== WarehouseTaskStatus.IN_PROGRESS)
      throw new BadRequestException('Task must be in progress to complete');

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
      reason: `Task Completion: ${task.type.toUpperCase()} - ${task.taskNumber}`,
    });

    task.status = WarehouseTaskStatus.COMPLETED;
    task.completedBy = actor;
    task.completedAt = new Date();
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: this.tenantContext.getUserEmail(),
      action: 'WAREHOUSE_TASK_COMPLETED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { completedBy: actor },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  async getPickingBacklog(warehouseId: string): Promise<WarehouseTask[]> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .where('task.status IN (:...statuses)', {
        statuses: [WarehouseTaskStatus.PENDING, WarehouseTaskStatus.IN_PROGRESS],
      })
      .andWhere('task.type IN (:...types)', {
        types: [WarehouseTaskType.PICK, WarehouseTaskType.TRANSFER],
      });

    const tenantId = this.tenantContext.getTenantId();
    if (tenantId) qb.andWhere('task.tenant_id = :tenantId', { tenantId });

    const allowedBuildings = this.tenantContext.getAllowedBuildingIds();
    if (allowedBuildings.length > 0) {
      const whIds = await this.inventory.resolveWarehouseIdsByBuildings(allowedBuildings);
      whIds.length > 0
        ? qb.andWhere('task.fromWarehouseId IN (:...whIds)', { whIds })
        : qb.andWhere('1 = 0');
    }

    if (warehouseId) qb.andWhere('task.fromWarehouseId = :wh', { wh: warehouseId });

    return qb.orderBy('task.createdAt', 'ASC').getMany();
  }

  async handlePickException(
    id: number,
    exception: { reason: string; pickedQty: number; actor: string },
  ): Promise<WarehouseTask> {
    const task = await this.findTaskInTenant(id);

    if (exception.reason === 'SHORT_PICK' && exception.pickedQty > 0) {
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
        reason: `Short Pick Exception: ${exception.reason}`,
      });

      await this.createTask({
        ...task,
        id: undefined,
        quantity: task.quantity - exception.pickedQty,
        status: WarehouseTaskStatus.PENDING,
        referenceId: `${task.taskNumber}-REMAINDER`,
      });
    }

    task.status = WarehouseTaskStatus.CANCELLED;
    task.completedBy = exception.actor;
    const saved = await this.taskRepo.save(task);

    await this.audit.recordAction({
      actor: this.tenantContext.getUserEmail(),
      action: 'PICK_EXCEPTION_HANDLED',
      resourceType: 'WarehouseTask',
      resourceId: saved.taskNumber,
      metadata: { reason: exception.reason, pickedQty: exception.pickedQty },
      outcome: 'ALLOWED',
    });

    return saved;
  }

  private async findTaskInTenant(id: number): Promise<WarehouseTask> {
    const tenantId = this.tenantContext.getTenantId();
    const where: Record<string, unknown> = { id };
    if (tenantId) where['tenant_id'] = tenantId;

    const task = await this.taskRepo.findOne({ where: where as any });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
}
