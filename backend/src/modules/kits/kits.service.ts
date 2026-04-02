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
    @InjectRepository(Kit)     private readonly repo: Repository<Kit>,
    @InjectRepository(Plan)    private readonly planRepo: Repository<Plan>,
    @InjectRepository(BomItem) private readonly bomRepo: Repository<BomItem>,
    @InjectRepository(KitMaterial) private readonly materialRepo: Repository<KitMaterial>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<any[]> {
    const kits = await this.repo.find({
      relations: ['plan', 'materials', 'advances', 'exceptions'],
      order: { createdAt: 'DESC' },
    });
    return kits.map(k => this.withTotalCompleted(k));
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
    const totalCompleted = kit.advances?.reduce((s, a) => s + a.unitsAssembled, 0) ?? 0;
    const hasOpenException = kit.exceptions?.some(e => e.status === 'open') ?? false;
    return { ...kit, totalCompleted, hasOpenException };
  }

  async create(dto: CreateKitDto): Promise<any> {
    // 1. Verify plan exists
    const plan = await this.planRepo.findOneBy({ id: dto.planId });
    if (!plan) throw new NotFoundException(`Plan ${dto.planId} not found`);

    // 2. Load BOM items for the model
    const bomItems = await this.bomRepo.findBy({ model: plan.model });
    if (!bomItems.length) {
      throw new BadRequestException(
        `No BOM items found for model "${plan.model}". Load the BOM before creating a kit.`,
      );
    }

    // 3. Create kit + all KitMaterials atomically
    return this.dataSource.transaction(async (em) => {
      const kit = em.create(Kit, {
        plan:       { id: plan.id } as Plan,
        preparedAt: dto.preparedAt ? new Date(dto.preparedAt) : new Date(),
      });
      const savedKit = await em.save(Kit, kit);

      const materials = bomItems.map((item) =>
        em.create(KitMaterial, {
          kit:              { id: savedKit.id } as Kit,
          partNumber:       item.partNumber,
          description:      item.description,
          quantityRequired: item.usageFactor * plan.quantity,
          unit:             item.unit,
          quantityConsumed:  0,
          quantityRemaining: item.usageFactor * plan.quantity,
        }),
      );
      await em.save(KitMaterial, materials);

      // Link plan status to active
      await em.update(Plan, plan.id, { status: 'active' });

      return this.findOne(savedKit.id);
    });
  }

  async updateStatus(id: number, dto: UpdateKitStatusDto): Promise<any> {
    const kit = await this.findOne(id);
    const timestamps: Partial<Kit> = {};
    if (dto.status === 'kitted')    timestamps.kittedAt = new Date();
    if (dto.status === 'requested') timestamps.requestedAt = new Date();
    if (dto.status === 'delivered') timestamps.deliveredAt = new Date();
    // Legacy compat
    if (dto.status === 'sent')      timestamps.sentAt = new Date();
    if (dto.status === 'received')  timestamps.receivedAt = new Date();
    await this.repo.update(id, { status: dto.status, ...timestamps });

    // Auto-complete plan when kit completes
    if (dto.status === 'completed' && kit.plan?.id) {
      await this.planRepo.update(kit.plan.id, { status: 'completed' });
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
