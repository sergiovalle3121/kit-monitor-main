import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resupply } from './entities/resupply.entity';
import { KitMaterial } from '../kit-materials/entities/kit-material.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateResupplyDto } from './dto/create-resupply.dto';
import { DeliverResupplyDto } from './dto/deliver-resupply.dto';

@Injectable()
export class ResuppliesService {
  constructor(
    @InjectRepository(Resupply)
    private readonly repo: Repository<Resupply>,
    @InjectRepository(KitMaterial)
    private readonly materialRepo: Repository<KitMaterial>,
  ) {}

  findByKit(kitId: number): Promise<Resupply[]> {
    return this.repo.find({
      where: { kit: { id: kitId } },
      order: { requestedAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Resupply> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`Resupply ${id} not found`);
    return item;
  }

  create(dto: CreateResupplyDto): Promise<Resupply> {
    const resupply = this.repo.create({
      kit: { id: dto.kitId } as Kit,
      partNumber: dto.partNumber,
      description: dto.description,
      quantityRequested: dto.quantityRequested,
      reason: dto.reason,
    });
    return this.repo.save(resupply);
  }

  async deliver(id: number, dto: DeliverResupplyDto): Promise<Resupply> {
    // Load with kit relation to get kit.id
    const resupply = await this.repo.findOne({ where: { id }, relations: ['kit'] });
    if (!resupply) throw new NotFoundException(`Resupply ${id} not found`);

    // Mark as delivered
    await this.repo.update(id, {
      quantityDelivered: dto.quantityDelivered,
      status: 'delivered',
      deliveredAt: new Date(),
    });

    // Sum all delivered quantities for this kit + partNumber (including the one just updated)
    const allDelivered = await this.repo.find({
      where: { kit: { id: resupply.kit.id }, partNumber: resupply.partNumber },
    });
    const totalResupplied = allDelivered.reduce((sum, r) => {
      const qty = r.id === id ? dto.quantityDelivered : (r.quantityDelivered ?? 0);
      return r.id === id || r.status === 'delivered' ? sum + qty : sum;
    }, 0);

    // Update the matching KitMaterial
    const material = await this.materialRepo.findOne({
      where: { kit: { id: resupply.kit.id }, partNumber: resupply.partNumber },
    });
    if (material) {
      const quantityRemaining = Math.round(
        ((material.quantityRequired + totalResupplied) - (material.quantityConsumed ?? 0)) * 1e6,
      ) / 1e6;
      await this.materialRepo.update(material.id, {
        quantityResupplied: totalResupplied,
        quantityRemaining,
      });
    }

    return this.findOne(id);
  }
}
