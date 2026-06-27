import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, Repository, SelectQueryBuilder, In, Brackets } from 'typeorm';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { EnterpriseLine } from '../enterprise-campus/entities/enterprise-line.entity';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Kit } from '../kits/entities/kit.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';

import { LineCapacity } from './entities/line-capacity.entity';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryPosition } from '../inventory/entities/inventory-position.entity';
import { QualityService } from '../quality/quality.service';
import { AuditService } from '../governance/audit.service';
import { deriveReadiness, ReadinessDemandLine, ReadinessSummary } from '@axos/contracts';

@Injectable()
export class PlansService {
  constructor(
    @Inject(getTenantRepositoryToken(Plan))
    private readonly repo: TenantScopedRepository<Plan>,
    @Inject(getTenantRepositoryToken(LineCapacity))
    private readonly capacityRepo: TenantScopedRepository<LineCapacity>,
    @InjectRepository(EnterpriseProgram) private readonly programRepo: Repository<EnterpriseProgram>,
    @InjectRepository(EnterpriseLine) private readonly lineRepo: Repository<EnterpriseLine>,
    @InjectRepository(InventoryPosition) private readonly positionRepo: Repository<InventoryPosition>,
    @InjectRepository(KitMaterial) private readonly kitMaterialRepo: Repository<KitMaterial>,
    private readonly inventory: InventoryService,
    private readonly quality: QualityService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private applyScope<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenant = this.tenantCtx.getTenantId();
    if (tenant) qb.andWhere(`${alias}.tenant_id = :tenant`, { tenant });
    else qb.andWhere(`${alias}.tenant_id IS NULL`);
    return qb;
  }

  async findAll(filters?: { line?: string; model?: string; workOrder?: string; buildingId?: string; programId?: string }, user?: any): Promise<any[]> {
    const qb = this.repo.createQueryBuilder('plan')
      .leftJoinAndSelect('plan.kit', 'kit')
      .orderBy('plan.createdAt', 'DESC');
    this.applyScope(qb, 'plan');
    await this.applyScopeToQb(qb, filters, user);
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

    // 1. Real Clear-to-Build readiness (material vs inventory, quality holds,
    //    schedule) — computed from existing tables, no longer a hard-coded mock.
    const readiness = await this.calculateReadiness(plan);

    const before = { ...plan };
    plan.status = 'released';
    plan.releasedAt = new Date();
    plan.releasedBy = actor;
    plan.readinessSummary = readiness;

    const saved = await this.repo.save(plan);

    await this.audit.log({
      actor,
      action: 'RELEASE_WO',
      entity: 'Plan',
      entityId: String(plan.id),
      before,
      after: saved,
      scope: { buildingId: plan.buildingId }
    });

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

  /**
   * Reusable Clear-to-Build readiness for a plan — the SAME computation
   * `releaseWorkOrder` seals at release time, exposed so out-of-request callers
   * (e.g. the readiness alerts engine) can evaluate a plan without recomputing
   * the rules by hand. Pure delegation to `calculateReadiness`; no behavior change.
   */
  async computeReadiness(plan: Plan): Promise<ReadinessSummary> {
    return this.calculateReadiness(plan);
  }

  /**
   * REAL Clear-to-Build readiness for a plan/WO, read from existing tables (no
   * new columns): the WO's picked BOM (`kit_materials`) is the material demand,
   * checked against available `inventory_positions`; active `quality_holds` on
   * those parts gate quality; the plan's due date gates shipping. The pure
   * verdict lives in `deriveReadiness` so the rules are unit-testable. Replaces
   * the previous mock that always returned green and made the floor semaphore lie.
   */
  private async calculateReadiness(plan: Plan): Promise<ReadinessSummary> {
    // Demand = the WO's picked BOM (kit_materials), persisted when the plan was
    // published. Joined through the kit so it resolves from just the plan id.
    const materials = await this.kitMaterialRepo
      .createQueryBuilder('km')
      .innerJoin('km.kit', 'kit')
      .innerJoin('kit.plan', 'plan')
      .where('plan.id = :id', { id: plan.id })
      .getMany();

    const demand: ReadinessDemandLine[] = materials
      .filter((m) => !!m.partNumber)
      .map((m) => ({
        partNumber: m.partNumber,
        quantityRequired: Number(m.quantityRequired) || 0,
        description: m.description ?? null,
        unit: m.unit ?? 'EA',
      }));

    const partNumbers = [...new Set(demand.map((d) => d.partNumber))];

    // Available inventory for those parts: only `available` stock counts, net of
    // what's already allocated (mirrors the floor's Clear-to-Build map).
    const availableByPart = new Map<string, number>();
    if (partNumbers.length) {
      const positions = await this.positionRepo.find({
        where: { partNumber: In(partNumbers), holdStatus: 'available' },
      });
      for (const p of positions) {
        const avail = Math.max(0, (Number(p.onHand) || 0) - (Number(p.allocated) || 0));
        availableByPart.set(p.partNumber, (availableByPart.get(p.partNumber) ?? 0) + avail);
      }
    }

    // Active quality holds touching the WO's parts (reuses the exported service).
    const heldParts = new Set<string>();
    if (partNumbers.length) {
      const demandSet = new Set(partNumbers);
      const holds = await this.quality.findAllActiveHolds();
      for (const h of holds) {
        if (h?.partNumber && demandSet.has(h.partNumber)) heldParts.add(h.partNumber);
      }
    }

    return deriveReadiness({
      demand,
      availableByPart,
      heldParts,
      dueDate: plan.dueDate ?? null,
    });
  }

  private async applyScopeToQb(
    qb: SelectQueryBuilder<Plan>,
    filters?: { line?: string; model?: string; workOrder?: string; buildingId?: string; programId?: string },
    user?: any
  ): Promise<void> {
    // 1. Enforce Hard Organizational Scopes from User
    if (user && user.role !== 'Admin' && user.scopes) {
      if (user.scopes.buildings?.length > 0) {
        const linesInBuildings = await this.lineRepo.find({ where: { building: { id: In(user.scopes.buildings) } } as any });
        const buildingLegacyNums = linesInBuildings.map(l => l.legacyLineNumber).filter((n): n is number => n != null);
        qb.andWhere('plan.line IN (:...bLegacy)', { bLegacy: buildingLegacyNums.length ? buildingLegacyNums : [-1] });
      }
      
      if (user.scopes.lines?.length > 0) {
        qb.andWhere('plan.line IN (:...uLines)', { uLines: user.scopes.lines });
      }
      
      if (user.scopes.programs?.length > 0) {
        // Find prefixes for scoped programs
        const programs = await this.programRepo.find({ where: { id: In(user.scopes.programs) } });
        const prefixes = programs.map(p => p.primaryModelPrefix?.toUpperCase()).filter(Boolean);
        if (prefixes.length > 0) {
          qb.andWhere(new Brackets(sub => {
            prefixes.forEach((pre, i) => {
              sub.orWhere(`UPPER(plan.model) LIKE :pre${i}`, { [`pre${i}`]: `${pre}%` });
            });
          }));
        }
      }
    }

    // 2. Apply Optional Filters
    if (!filters) return;

    if (filters.model) {
      qb.andWhere('UPPER(plan.model) LIKE :model', { model: `%${filters.model.toUpperCase()}%` });
    }
    if (filters.workOrder) {
      qb.andWhere('UPPER(plan.workOrder) LIKE :workOrder', { workOrder: `%${filters.workOrder.toUpperCase()}%` });
    }
    if (filters.line) {
      // line param may be an enterprise line UUID — resolve to legacy integer
      const lineRef = await this.lineRepo.findOne({ where: { id: filters.line } });
      const legacyNum = lineRef?.legacyLineNumber ?? parseInt(filters.line, 10);
      if (!isNaN(legacyNum)) {
        qb.andWhere('plan.line = :lineNum', { lineNum: legacyNum });
      }
    }
    if (filters.buildingId) {
      const lines = await this.lineRepo.find({ where: { building: { id: filters.buildingId } } as any });
      const legacyNums = lines.map((l) => l.legacyLineNumber).filter((n): n is number => n != null);
      if (legacyNums.length) {
        qb.andWhere('plan.line IN (:...lineNums)', { lineNums: legacyNums });
      } else {
        qb.andWhere('1 = 0');
      }
    }
    if (filters.programId) {
      const program = await this.programRepo.findOne({ where: { id: filters.programId } });
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
