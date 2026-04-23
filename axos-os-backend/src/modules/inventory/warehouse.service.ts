import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseTask, WarehouseTaskStatus, WarehouseTaskType } from './entities/warehouse-task.entity';
import { InventoryService } from './inventory.service';
import { AuditService } from '../governance/audit.service';
import { User } from '../users/entities/user.entity';
import { EnterpriseWarehouse } from '../enterprise-campus/entities/enterprise-warehouse.entity';
import { In } from 'typeorm';

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

  async findAllTasks(filters: any, user: User): Promise<WarehouseTask[]> {
    const qb = this.taskRepo.createQueryBuilder('task');

    // 1. Scope-aware filtering
    if (user.scopes) {
      if (user.scopes.buildings?.length > 0) {
        const whs = await this.warehouseRepo.find({ where: { building: { id: In(user.scopes.buildings) } } as any });
        const whIds = whs.map(w => w.id);
        if (whIds.length > 0) {
          qb.andWhere('(task.fromWarehouseId IN (:...whIds) OR task.toWarehouseId IN (:...whIds))', { whIds });
        } else {
          qb.andWhere('1 = 0');
        }
      }
    }

    if (filters.status) qb.andWhere('task.status = :status', { status: filters.status });
    if (filters.type) qb.andWhere('task.type = :type', { type: filters.type });
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
    if (user.scopes) {
      if (user.scopes.buildings?.length > 0) {
        const whs = await this.warehouseRepo.find({ where: { building: { id: In(user.scopes.buildings) } } as any });
        const whIds = whs.map(w => w.id);
        if (whIds.length > 0) {
          qb.andWhere('task.fromWarehouseId IN (:...whIds)', { whIds });
        } else {
          qb.andWhere('1 = 0');
        }
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
}
