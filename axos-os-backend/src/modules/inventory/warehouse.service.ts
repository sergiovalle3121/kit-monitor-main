import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseTask, WarehouseTaskStatus, WarehouseTaskType } from './entities/warehouse-task.entity';
import { InventoryService } from './inventory.service';

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseTask)
    private readonly taskRepo: Repository<WarehouseTask>,
    private readonly inventory: InventoryService,
  ) {}

  async findAllTasks(filters: any): Promise<WarehouseTask[]> {
    const qb = this.taskRepo.createQueryBuilder('task');
    if (filters.status) qb.andWhere('task.status = :status', { status: filters.status });
    if (filters.type) qb.andWhere('task.type = :type', { type: filters.type });
    qb.orderBy('task.createdAt', 'DESC');
    return qb.getMany();
  }

  async createTask(dto: Partial<WarehouseTask>): Promise<WarehouseTask> {
    const count = await this.taskRepo.count();
    const taskNumber = `TSK-2024-${(count + 1).toString().padStart(4, '0')}`;
    const task = this.taskRepo.create({ ...dto, taskNumber, status: WarehouseTaskStatus.PENDING });
    return this.taskRepo.save(task);
  }

  async startTask(id: number, actor: string): Promise<WarehouseTask> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== WarehouseTaskStatus.PENDING) throw new BadRequestException('Task already started or completed');
    
    task.status = WarehouseTaskStatus.IN_PROGRESS;
    task.assignedTo = actor;
    return this.taskRepo.save(task);
  }

  async completeTask(id: number, actor: string): Promise<WarehouseTask> {
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
    return this.taskRepo.save(task);
  }
}
