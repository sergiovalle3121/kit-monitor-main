import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resupply } from './entities/resupply.entity';
import { Kit } from '../kits/entities/kit.entity';
import { CreateResupplyDto } from './dto/create-resupply.dto';
import { DeliverResupplyDto } from './dto/deliver-resupply.dto';

@Injectable()
export class ResuppliesService {
  constructor(
    @InjectRepository(Resupply)
    private readonly repo: Repository<Resupply>,
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
    await this.findOne(id);
    await this.repo.update(id, {
      quantityDelivered: dto.quantityDelivered,
      status: 'delivered',
      deliveredAt: new Date(),
    });
    return this.findOne(id);
  }
}
