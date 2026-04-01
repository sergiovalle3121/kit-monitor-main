import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kit } from './entities/kit.entity';
import { Model } from '../models/entities/model.entity';
import { CreateKitDto } from './dto/create-kit.dto';
import { UpdateKitDto } from './dto/update-kit.dto';

@Injectable()
export class KitsService {
  constructor(
    @InjectRepository(Kit)
    private readonly kitsRepository: Repository<Kit>,

    @InjectRepository(Model)
    private readonly modelsRepository: Repository<Model>,
  ) {}

  async create(createKitDto: CreateKitDto): Promise<Kit> {
    const kit = this.kitsRepository.create(createKitDto);
    return this.kitsRepository.save(kit);
  }

  async findAll(): Promise<Kit[]> {
    return this.kitsRepository.find({ relations: ['model'] });
  }

  async findOne(id: number): Promise<Kit> {
    const kit = await this.kitsRepository.findOne({ where: { id }, relations: ['model'] });
    if (!kit) throw new NotFoundException(`Kit con ID ${id} no encontrado`);
    return kit;
  }

  async update(id: number, updateKitDto: UpdateKitDto): Promise<Kit> {
    const kit = await this.findOne(id);

    let model: Model | undefined;
    const result = await this.modelsRepository.findOneBy({ id: updateKitDto.modelId });
    model = result === null ? undefined : result;
    if (!model) throw new NotFoundException(`Modelo con ID ${updateKitDto.modelId} no encontrado`);

    const updated = Object.assign(kit, {
      serialNumber: updateKitDto.serialNumber || kit.serialNumber,
      model: model || kit.model,
    });

    return this.kitsRepository.save(updated);
  }

  async remove(id: number): Promise<void> {
    const kit = await this.findOne(id);
    await this.kitsRepository.remove(kit);
  }
}
