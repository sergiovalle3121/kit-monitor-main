import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Kit } from './entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { BayLayout } from '../bay-layout/entities/bay-layout.entity';
import { ProductionBayMaterialState } from '../production-runtime/entities/production-bay-material-state.entity';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitStatusDto } from './dto/update-kit-status.dto';
import { EventLedgerService } from '../event-ledger/event-ledger.service';
import { EventDomain } from '../event-ledger/entities/ledger-event.entity';

@Injectable()
export class KitsService {
  constructor(
    @InjectRepository(Kit) private readonly repo: Repository<Kit>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(BomItem) private readonly bomRepo: Repository<BomItem>,
    @InjectRepository(KitMaterial) private readonly materialRepo: Repository<KitMaterial>,
    @InjectRepository(BayLayout) private readonly bayLayoutRepo: Repository<BayLayout>,
    @InjectRepository(ProductionBayMaterialState) private readonly runtimeMaterialRepo: Repository<ProductionBayMaterialState>,
    private readonly dataSource: DataSource,
    private readonly eventLedger: EventLedgerService,
  ) {}

  async findAll(): Promise<any[]> {
    const kits = await this.repo.find({
      relations: ['plan', 'materials', 'advances', 'exceptions'],
      order: { createdAt: 'DESC' },
    });
    return kits.map((kit) => this.withTotalCompleted(kit));
  }

  async findOne(id: number): Promise<any> {
    const kit = await this.repo.findOne({
      where: { id },
      relations: ['plan', 'materials', 'advances', 'exceptions'],
    });
    if (!kit) throw new NotFoundException(`Kit ${id} not found`);
    return this.withTotalCompleted(kit);
  }

  private withTotalCompleted(kit: Kit): any {
    const totalCompleted = kit.advances?.reduce((sum, advance) => sum + advance.unitsAssembled, 0) ?? 0;
    const hasOpenException = kit.exceptions?.some((exception) => exception.status === 'open') ?? false;
    return { ...kit, totalCompleted, hasOpenException };
  }

  async create(dto: CreateKitDto): Promise<any> {
    const plan = await this.planRepo.findOneBy({ id: dto.planId });
    if (!plan) throw new NotFoundException(`Plan ${dto.planId} not found`);

    const bomItems = await this.bomRepo.findBy({ model: plan.model });
    if (!bomItems.length) {
      throw new BadRequestException(
        `No BOM items found for model "${plan.model}". Load the BOM before creating a kit.`,
      );
    }

    const created = await this.dataSource.transaction(async (em) => {
      const kit = em.create(Kit, {
        plan: { id: plan.id } as Plan,
        preparedAt: dto.preparedAt ? new Date(dto.preparedAt) : undefined,
      });
      const savedKit = await em.save(Kit, kit);

      const materials = bomItems.map((item) =>
        em.create(KitMaterial, {
          kit: { id: savedKit.id } as Kit,
          partNumber: item.partNumber,
          description: item.description,
          quantityRequired: item.usageFactor * plan.quantity,
          quantityActual: null,
          unit: item.unit,
          quantityConsumed: 0,
          quantityRemaining: item.usageFactor * plan.quantity,
          isBulkResupply: false,
        }),
      );
      await em.save(KitMaterial, materials);

      await em.update(Plan, plan.id, { status: 'active' });

      return {
        id: savedKit.id,
        status: savedKit.status,
        preparedAt: savedKit.preparedAt,
        sentAt: savedKit.sentAt,
        receivedAt: savedKit.receivedAt,
        kittedAt: savedKit.kittedAt,
        requestedAt: savedKit.requestedAt,
        deliveredAt: savedKit.deliveredAt,
        createdAt: savedKit.createdAt,
        plan: {
          ...plan,
          status: 'active',
        },
        materials,
        advances: [],
        exceptions: [],
        resupplies: [],
      };
    });

    const createdFromDb = await this.findOneWithRetry(created.id, 3, 100);
    const finalKit = createdFromDb ?? this.withTotalCompleted(created as any);

    // Record Event Ledger
    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'KIT_CREATED',
      referenceType: 'KIT',
      referenceId: finalKit.id.toString(),
      model: plan.model,
      workOrder: plan.workOrder,
      line: plan.line?.toString(),
      shift: plan.shift,
      transaction: {
        quantity: plan.quantity,
      },
    });

    return finalKit;
  }

  async startPreparation(id: number): Promise<any> {
    const kit = await this.repo.findOneBy({ id });
    if (!kit) throw new NotFoundException(`Kit ${id} not found`);

    if (!kit.preparedAt) {
      await this.repo.update(id, { preparedAt: new Date() });
    }

    return this.findOne(id);
  }

  async updateStatus(id: number, dto: UpdateKitStatusDto): Promise<any> {
    const kit = await this.findOne(id);
    const timestamps: Partial<Kit> = {};
    if (dto.status === 'kitted') timestamps.kittedAt = new Date();
    if (dto.status === 'requested') timestamps.requestedAt = new Date();
    if (dto.status === 'delivered') timestamps.deliveredAt = new Date();
    if (dto.status === 'sent') timestamps.sentAt = new Date();
    if (dto.status === 'received') timestamps.receivedAt = new Date();
    await this.repo.update(id, { status: dto.status, ...timestamps });

    if (dto.status === 'completed' && kit.plan?.id) {
      await this.planRepo.update(kit.plan.id, { status: 'completed' });
    }
    if (['requested', 'delivered', 'sent', 'received', 'in_progress'].includes(dto.status)) {
      await this.materializeRuntimeForDeliveredBackend(id);
    }

    // Record Event Ledger
    await this.eventLedger.recordEvent({
      domain: EventDomain.MATERIALS,
      action: 'KIT_STATUS_CHANGED',
      referenceType: 'KIT',
      referenceId: id.toString(),
      model: kit.plan?.model,
      workOrder: kit.plan?.workOrder,
      line: kit.plan?.line?.toString(),
      metadata: {
        beforeState: kit.status,
        afterState: dto.status,
      },
    });

    return this.findOne(id);
  }

  private async materializeRuntimeForDeliveredBackend(kitId: number): Promise<void> {
    const kit = await this.repo.findOne({
      where: { id: kitId },
      relations: ['plan', 'materials'],
    });
    if (!kit?.plan) return;

    const model = kit.plan.model;
    const layouts = await this.bayLayoutRepo.find({ where: { model } });
    if (!layouts.length) return;

    const bom = await this.bomRepo.find({ where: { model } });
    const bomByPart = new Map(bom.map((item) => [item.partNumber, item]));
    const materialByPart = new Map(kit.materials.map((item) => [item.partNumber, item]));
    const existing = await this.runtimeMaterialRepo.find({ where: { kit: { id: kitId } } });
    const existingKey = new Set(existing.map((row) => `${row.bayId}::${row.partNumber}`));

    const rows = layouts
      .filter((layout) => !existingKey.has(`${layout.bahia}::${layout.partNumber}`))
      .map((layout) => {
        const material = materialByPart.get(layout.partNumber);
        const bomItem = bomByPart.get(layout.partNumber);
        const quantityRequired = material?.quantityRequired ?? (bomItem?.usageFactor ?? 0) * kit.plan.quantity;
        const usagePerAssembly = kit.plan.quantity > 0
          ? quantityRequired / kit.plan.quantity
          : (bomItem?.usageFactor ?? 0);
        const availableQty = Math.max(0, material?.quantityRemaining ?? quantityRequired);
        const lowStockThreshold = Math.max(5, Math.ceil((quantityRequired || 20) * 0.2));

        return this.runtimeMaterialRepo.create({
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

    if (rows.length) {
      await this.runtimeMaterialRepo.save(rows);
    }
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    await this.findOne(id);
    await this.dataSource.transaction(async (em) => {
      await em.createQueryBuilder().delete().from('advances').where('"kitId" = :kitId', { kitId: id }).execute();
      await em
        .createQueryBuilder()
        .delete()
        .from(KitMaterial)
        .where('"kitId" = :kitId', { kitId: id })
        .execute();
      await em.createQueryBuilder().delete().from('kit_exceptions').where('"kitId" = :kitId', { kitId: id }).execute();
      await em.createQueryBuilder().delete().from('cancellation_requests').where('"kit_id" = :kitId', { kitId: id }).execute();
      await em.createQueryBuilder().delete().from('resupplies').where('"kitId" = :kitId', { kitId: id }).execute();
      await em.createQueryBuilder().delete().from('production_bay_events').where('"kitId" = :kitId', { kitId: id }).execute();
      await em.createQueryBuilder().delete().from('production_bay_material_states').where('"kitId" = :kitId', { kitId: id }).execute();
      await em.delete(Kit, id);
    });
    return { deleted: true, id };
  }

  private async findOneWithRetry(id: number, maxAttempts: number, waitMs: number): Promise<any | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const kit = await this.repo.findOne({
        where: { id },
        relations: ['plan', 'materials', 'advances', 'exceptions'],
      });
      if (kit) return this.withTotalCompleted(kit);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    return null;
  }
}
