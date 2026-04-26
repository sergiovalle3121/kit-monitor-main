import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { CreateVisualAidDto } from './dto/create-visual-aid.dto';
import { UpdateVisualAidDto } from './dto/update-visual-aid.dto';
import { VisualAid } from './entities/visual-aid.entity';

@Injectable()
export class VisualAidsService {
  constructor(
    @InjectRepository(VisualAid)
    private readonly repo: Repository<VisualAid>,
    @InjectRepository(EnterpriseProgram)
    private readonly programRepo: Repository<EnterpriseProgram>,
  ) {}

  async findAll(model?: string, programId?: string): Promise<VisualAid[]> {
    if (model)
      return this.repo.find({ where: { model }, order: { updatedAt: 'DESC' } });
    const all = await this.repo.find({ order: { updatedAt: 'DESC' } });
    if (programId) {
      const program = await this.programRepo.findOne({
        where: { id: programId },
      });
      const prefix = program?.primaryModelPrefix?.toUpperCase();
      if (prefix)
        return all.filter((item) =>
          item.model?.toUpperCase().startsWith(prefix),
        );
    }
    return all;
  }

  async create(
    dto: CreateVisualAidDto,
    filename: string,
    pdfData: Buffer,
  ): Promise<VisualAid> {
    const entity = this.repo.create({
      ...dto,
      pdfUrl: filename,
      pdfData,
      id: `va-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(entity);
  }

  async findByFilename(filename: string): Promise<VisualAid | null> {
    return this.repo
      .createQueryBuilder('visualAid')
      .addSelect('visualAid.pdfData')
      .where('visualAid.pdfUrl = :filename', { filename })
      .getOne();
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
