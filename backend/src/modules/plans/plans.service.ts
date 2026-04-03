import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly repo: Repository<Plan>,
  ) {}

  async findAll(): Promise<any[]> {
    const plans = await this.repo.find({
      relations: ['kit'],
      order: { createdAt: 'DESC' },
    });
    return plans.map((plan) => this.serialize(plan));
  }

  async findOne(id: number): Promise<any> {
    const plan = await this.repo.findOne({
      where: { id },
      relations: ['kit'],
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return this.serialize(plan);
  }

  async create(dto: CreatePlanDto): Promise<any> {
    const workOrder = dto.workOrder?.trim() || await this.generateWorkOrder();
    const plan = this.repo.create({
      ...dto,
      workOrder,
      model: dto.model.trim().toUpperCase(),
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    });
    const saved = await this.repo.save(plan);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdatePlanDto): Promise<any> {
    await this.findOne(id); // throws 404 if not found
    await this.repo.update(id, {
      ...dto,
      status: dto.status as any,
      model: dto.model ? dto.model.trim().toUpperCase() : undefined,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const plan = await this.repo.findOne({
      where: { id },
      relations: ['kit'],
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    if (plan.kit) {
      throw new BadRequestException('Este plan ya tiene un kit ligado y se conserva como historial operativo.');
    }
    await this.repo.delete(id);
    return { deleted: true, id };
  }

  private async generateWorkOrder(): Promise<string> {
    const plans = await this.repo.find({
      select: { workOrder: true },
    });
    const lastNumeric = plans
      .map((plan) => plan.workOrder?.trim())
      .filter((workOrder): workOrder is string => /^\d+$/.test(workOrder))
      .map((workOrder) => Number(workOrder))
      .reduce((max, current) => Math.max(max, current), 0);

    return this.pad(lastNumeric + 1, 5);
  }

  private pad(value: number, size = 2): string {
    return String(value).padStart(size, '0');
  }

  private serialize(plan: Plan): any {
    const { kit, ...rest } = plan;
    return {
      ...rest,
      hasKit: !!kit,
    };
  }
}
