import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from './entities/model.entity';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(Model)
    private modelsRepository: Repository<Model>,
  ) {}

  async create(createModelDto: CreateModelDto): Promise<Model> {
    const model = this.modelsRepository.create(createModelDto);
    return this.modelsRepository.save(model);
  }

  async findAll(): Promise<Model[]> {
    return this.modelsRepository.find({ relations: ['kits', 'reports'] });
  }

  async findOne(id: number): Promise<Model> {
    const model = await this.modelsRepository.findOne({
      where: { id },
      relations: ['kits', 'reports'],
    });
    if (!model) throw new NotFoundException(`Model with ID ${id} not found`);
    return model;
  }

  async update(id: number, updateModelDto: UpdateModelDto): Promise<Model> {
    const model = await this.findOne(id);
    return this.modelsRepository.save({
      ...model,
      ...updateModelDto,
    });
  }

  async remove(id: number): Promise<void> {
    const result = await this.modelsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }
  }
}