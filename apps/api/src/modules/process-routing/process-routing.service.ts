import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessStep } from './entities/process-step.entity';
import { ProcessStepMaterial } from './entities/process-step-material.entity';
import { CreateStepDto, UpdateStepDto, AddStepMaterialDto } from './dto/process.dto';

@Injectable()
export class ProcessRoutingService {
  constructor(
    @InjectRepository(ProcessStep) private readonly stepRepo: Repository<ProcessStep>,
    @InjectRepository(ProcessStepMaterial) private readonly matRepo: Repository<ProcessStepMaterial>,
  ) {}

  /** The ordered route (steps + their materials) for a model/revision. */
  async getRoute(model: string, revision?: string): Promise<ProcessStep[]> {
    if (!model) throw new BadRequestException('Model is required.');
    return this.stepRepo.find({
      where: { model, ...(revision ? { revision } : {}) },
      relations: ['materials'],
      order: { sequence: 'ASC' },
    });
  }

  async createStep(dto: CreateStepDto): Promise<ProcessStep> {
    if (!dto.model?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Modelo y nombre del paso son obligatorios.');
    }
    const model = dto.model.trim().toUpperCase();
    const revision = dto.revision?.trim() || '1.0';
    let sequence = dto.sequence;
    if (sequence == null) {
      const last = await this.stepRepo.findOne({ where: { model, revision }, order: { sequence: 'DESC' } });
      sequence = (last?.sequence ?? 0) + 1;
    }
    const step = this.stepRepo.create({
      model,
      revision,
      sequence,
      name: dto.name.trim(),
      stationType: dto.stationType?.trim() || null,
      visualAidId: dto.visualAidId || null,
      instructions: dto.instructions?.trim() || null,
    });
    return this.stepRepo.save(step);
  }

  async updateStep(id: number, dto: UpdateStepDto): Promise<ProcessStep> {
    const step = await this.stepRepo.findOne({ where: { id } });
    if (!step) throw new NotFoundException('Paso no encontrado.');
    Object.assign(step, {
      sequence: dto.sequence ?? step.sequence,
      name: dto.name?.trim() ?? step.name,
      stationType: dto.stationType !== undefined ? dto.stationType || null : step.stationType,
      visualAidId: dto.visualAidId !== undefined ? dto.visualAidId || null : step.visualAidId,
      instructions: dto.instructions !== undefined ? dto.instructions || null : step.instructions,
    });
    return this.stepRepo.save(step);
  }

  async deleteStep(id: number): Promise<{ deleted: boolean; id: number }> {
    const step = await this.stepRepo.findOne({ where: { id } });
    if (!step) throw new NotFoundException('Paso no encontrado.');
    await this.matRepo.delete({ stepId: id });
    await this.stepRepo.delete(id);
    return { deleted: true, id };
  }

  async addMaterial(stepId: number, dto: AddStepMaterialDto): Promise<ProcessStepMaterial> {
    const step = await this.stepRepo.findOne({ where: { id: stepId } });
    if (!step) throw new NotFoundException('Paso no encontrado.');
    if (!dto.partNumber?.trim()) throw new BadRequestException('Número de parte obligatorio.');
    const qty = Number(dto.qtyPerUnit);
    if (!Number.isFinite(qty) || qty <= 0) throw new BadRequestException('Cantidad por unidad debe ser positiva.');
    return this.matRepo.save(
      this.matRepo.create({
        stepId,
        partNumber: dto.partNumber.trim(),
        description: dto.description?.trim() || null,
        qtyPerUnit: qty,
        unit: dto.unit?.trim() || 'EA',
      }),
    );
  }

  async removeMaterial(id: number): Promise<{ deleted: boolean; id: number }> {
    const mat = await this.matRepo.findOne({ where: { id } });
    if (!mat) throw new NotFoundException('Material no encontrado.');
    await this.matRepo.delete(id);
    return { deleted: true, id };
  }
}
