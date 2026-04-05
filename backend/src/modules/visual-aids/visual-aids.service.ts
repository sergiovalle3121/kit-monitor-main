import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVisualAidDto } from './dto/create-visual-aid.dto';
import { UpdateVisualAidDto } from './dto/update-visual-aid.dto';
import { VisualAid } from './entities/visual-aid.entity';

@Injectable()
export class VisualAidsService {
  constructor(
    @InjectRepository(VisualAid)
    private readonly repo: Repository<VisualAid>,
  ) {}

  findAll(): Promise<VisualAid[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  async create(dto: CreateVisualAidDto, filename: string): Promise<VisualAid> {
    const entity = this.repo.create({
      ...dto,
      pdfUrl: filename,
      id: `va-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateVisualAidDto): Promise<VisualAid> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`VisualAid ${id} not found`);
    Object.assign(existing, dto);
    return this.repo.save(existing);
  }

  async remove(id: string): Promise<{ deleted: boolean; id: string }> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`VisualAid ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
