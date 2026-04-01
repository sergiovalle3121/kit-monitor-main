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

  findAll(): Promise<Kit[]> {
    return this.repo.find({
      relations: ['plan', 'materials'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Kit> {
    const kit = await this.repo.findOne({
      where: { id },
      relations: ['plan', 'materials'],
    });
    if (!kit) throw new NotFoundException(`Kit ${id} not found`);
    return kit;
  }

  async create(dto: CreateKitDto): Promise<Kit> {
    // 1. Verify plan exists and load model + quantity
    const plan = await this.planRepo.findOneBy({ id: dto.planId });
    if (!plan) throw new NotFoundException(`Plan ${dto.planId} not found`);

    // 2. Load BOM items for that model
    const bomItems = await this.bomRepo.findBy({ model: plan.model });
    if (!bomItems.length) {
      throw new BadRequestException(
        `No BOM items found for model "${plan.model}". Load the BOM before creating a kit.`,
      );
    }

    // 3. Create kit + all KitMaterials atomically
    return this.dataSource.transaction(async (em) => {
      const kit = em.create(Kit, {
        plan: { id: plan.id } as Plan,
        preparedAt: dto.preparedAt ? new Date(dto.preparedAt) : new Date(),
      });
      const savedKit = await em.save(Kit, kit);

      const materials = bomItems.map((item) =>
        em.create(KitMaterial, {
          kit: { id: savedKit.id } as Kit,
          partNumber: item.partNumber,
          description: item.description,
          quantityRequired: item.usageFactor * plan.quantity,
          unit: item.unit,
        }),
      );
      await em.save(KitMaterial, materials);

      // Return with all relations populated
      return this.findOne(savedKit.id);
    });
  }

  async updateStatus(id: number, dto: UpdateKitStatusDto): Promise<Kit> {
    await this.findOne(id);
    const timestamps: Partial<Kit> = {};
    if (dto.status === 'sent')     timestamps.sentAt = new Date();
    if (dto.status === 'received') timestamps.receivedAt = new Date();
    await this.repo.update(id, { status: dto.status, ...timestamps });
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
