import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { EnterpriseLine } from '../enterprise-campus/entities/enterprise-line.entity';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';

import { LineCapacity } from './entities/line-capacity.entity';
import { InventoryService } from '../inventory/inventory.service';
import { QualityService } from '../quality/quality.service';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly repo: Repository<Plan>,
    @InjectRepository(LineCapacity)
    private readonly capacityRepo: Repository<LineCapacity>,
    @InjectRepository(EnterpriseProgram) private readonly programRepo: Repository<EnterpriseProgram>,
    @InjectRepository(EnterpriseLine) private readonly lineRepo: Repository<EnterpriseLine>,
    private readonly inventory: InventoryService,
    private readonly quality: QualityService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(scope?: { line?: string; model?: string; workOrder?: string; buildingId?: string; programId?: string }): Promise<any[]> {
    const qb = this.repo.createQueryBuilder('plan')
      .leftJoinAndSelect('plan.kit', 'kit')
      .orderBy('plan.createdAt', 'DESC');
    await this.applyScopeToQb(qb, scope);
    const plans = await qb.getMany();
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
    if (plan.kit && plan.kit.status !== 'cancelled') {
      throw new BadRequestException('Este plan ya tiene un kit ligado y se conserva como historial operativo.');
    }
    await this.dataSource.transaction(async (em) => {
      if (plan.kit?.status === 'cancelled') {
        await em.createQueryBuilder().delete().from('advances').where('"kitId" = :kitId', { kitId: plan.kit.id }).execute();
        await em
          .createQueryBuilder()
          .delete()
          .from(KitMaterial)
          .where('"kitId" = :kitId', { kitId: plan.kit.id })
          .execute();
        await em.createQueryBuilder().delete().from('kit_exceptions').where('"kitId" = :kitId', { kitId: plan.kit.id }).execute();
        await em.createQueryBuilder().delete().from('cancellation_requests').where('"kit_id" = :kitId', { kitId: plan.kit.id }).execute();
        await em.createQueryBuilder().delete().from('resupplies').where('"kitId" = :kitId', { kitId: plan.kit.id }).execute();
        await em.createQueryBuilder().delete().from('production_bay_events').where('"kitId" = :kitId', { kitId: plan.kit.id }).execute();
        await em.createQueryBuilder().delete().from('production_bay_material_states').where('"kitId" = :kitId', { kitId: plan.kit.id }).execute();
        await em.delete(Kit, plan.kit.id);
      }
      await em.delete(Plan, id);
    });
    return { deleted: true, id };
  }


  async releaseWorkOrder(id: number, actor: string): Promise<any> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');

    // 1. Check Readiness (Simplified Mock for now, would use real inventory/quality check)
    const readiness = await this.calculateReadiness(plan);
    
    plan.status = 'released';
    plan.releasedAt = new Date();
    plan.releasedBy = actor;
    plan.readinessSummary = readiness;

    await this.repo.save(plan);
    return this.findOne(id);
  }

  async getSchedulingIntelligence() {
    const plans = await this.repo.find({ where: { status: 'pending' as any } });
    const activePlans = await this.repo.find({ where: { status: 'active' as any } });
    const capacities = await this.capacityRepo.find();

    const lineLoad = capacities.map(cap => {
      const lineActiveQty = activePlans
        .filter(p => p.line === cap.line)
        .reduce((sum, p) => sum + p.quantity, 0);
      
      const loadPercent = cap.dailyCapacityUnits > 0 
        ? (lineActiveQty / (cap.dailyCapacityUnits * (cap.efficiencyFactor / 100))) * 100 
        : 0;

      return {
        line: cap.line,
        buildingId: cap.buildingId,
        capacity: cap.dailyCapacityUnits,
        currentLoad: lineActiveQty,
        loadPercent: Math.round(loadPercent),
        status: loadPercent > 90 ? 'overloaded' : (loadPercent > 70 ? 'warning' : 'optimal')
      };
    });

    return {
      backlog: plans.length,
      lineLoad,
      readinessRisks: plans.filter(p => p.priority === 'critical').length
    };
  }

  private async calculateReadiness(plan: Plan) {
    // Real logic would check BOM shortages and Quality Holds
    return {
      materials: 'green',
      quality: 'green',
      shipping: 'green',
      timestamp: new Date()
    };
  }

  private async applyScopeToQb(
    qb: SelectQueryBuilder<Plan>,
    scope?: { line?: string; model?: string; workOrder?: string; buildingId?: string; programId?: string },
  ): Promise<void> {
    if (!scope) return;

    if (scope.model) {
      qb.andWhere('UPPER(plan.model) LIKE :model', { model: `%${scope.model.toUpperCase()}%` });
    }
    if (scope.workOrder) {
      qb.andWhere('UPPER(plan.workOrder) LIKE :workOrder', { workOrder: `%${scope.workOrder.toUpperCase()}%` });
    }
    if (scope.line) {
      // line param may be an enterprise line UUID — resolve to legacy integer
      const lineRef = await this.lineRepo.findOne({ where: { id: scope.line } });
      const legacyNum = lineRef?.legacyLineNumber ?? parseInt(scope.line, 10);
      if (!isNaN(legacyNum)) {
        qb.andWhere('plan.line = :lineNum', { lineNum: legacyNum });
      }
    }
    if (scope.buildingId) {
      const lines = await this.lineRepo.find({ where: { building: { id: scope.buildingId } } as any });
      const legacyNums = lines.map((l) => l.legacyLineNumber).filter((n): n is number => n != null);
      if (legacyNums.length) {
        qb.andWhere('plan.line IN (:...lineNums)', { lineNums: legacyNums });
      } else {
        qb.andWhere('1 = 0');
      }
    }
    if (scope.programId) {
      const program = await this.programRepo.findOne({ where: { id: scope.programId } });
      const prefix = program?.primaryModelPrefix?.toUpperCase();
      if (prefix) {
        qb.andWhere('UPPER(plan.model) LIKE :prefix', { prefix: `${prefix}%` });
      }
    }
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
      kitId: kit?.id ?? null,
      kitStatus: kit?.status ?? null,
    };
  }
}
