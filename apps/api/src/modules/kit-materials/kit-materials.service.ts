import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import {
  TenantScopedRepository,
  getTenantRepositoryToken,
} from '../../common/tenant/tenant-scoped.repository';
import { KitMaterial } from './entities/kit-material.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateKitMaterialDto } from './dto/create-kit-material.dto';
import { UpdateKitMaterialDto } from './dto/update-kit-material.dto';

@Injectable()
export class KitMaterialsService {
  constructor(
    @Inject(getTenantRepositoryToken(KitMaterial))
    private readonly repo: TenantScopedRepository<KitMaterial>,
  ) {}

  findByKit(kitId: number): Promise<KitMaterial[]> {
    return this.repo.find({ where: { kit: { id: kitId } } });
  }

  async findOne(id: number): Promise<KitMaterial> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`KitMaterial ${id} not found`);
    return item;
  }

  create(dto: CreateKitMaterialDto): Promise<KitMaterial> {
    const item = this.repo.create({
      kit: { id: dto.kitId } as Kit,
      partNumber: dto.partNumber,
      description: dto.description,
      quantityRequired: dto.quantityRequired,
      quantityActual: dto.quantityActual,
      unit: dto.unit ?? 'EA',
    });
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateKitMaterialDto): Promise<KitMaterial> {
    await this.findOne(id);
    await this.repo.update(id, {
      quantityActual: dto.quantityActual ?? null,
      isBulkResupply: dto.isBulkResupply ?? false,
    });
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
