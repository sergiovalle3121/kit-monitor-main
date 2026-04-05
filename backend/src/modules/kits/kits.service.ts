import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Kit } from './entities/kit.entity';
import { Plan } from '../plans/entities/plan.entity';
import { BomItem } from '../bom/entities/bom-item.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitStatusDto } from './dto/update-kit-status.dto';

@Injectable()
export class KitsService {
  constructor(
    @InjectRepository(Kit) private readonly repo: Repository<Kit>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(BomItem) private readonly bomRepo: Repository<BomItem>,
    @InjectRepository(KitMaterial) private readonly materialRepo: Repository<KitMaterial>,
    private readonly dataSource: DataSource,
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
    return createdFromDb ?? this.withTotalCompleted(created as any);
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

    return this.findOne(id);
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
