import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EngineeringDocument,
  EngineeringDocumentType,
} from './entities/engineering-document.entity';
import {
  CreateEngineeringDocumentDto,
  UpdateEngineeringDocumentDto,
} from './dto/engineering-document.dto';

@Injectable()
export class EngineeringService {
  constructor(
    @InjectRepository(EngineeringDocument)
    private readonly docRepo: Repository<EngineeringDocument>,
  ) {}

  async findAll(type?: EngineeringDocumentType) {
    const where = type ? { documentType: type } : {};
    return this.docRepo.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Engineering document not found');
    return doc;
  }

  async create(dto: CreateEngineeringDocumentDto, creator: string) {
    const doc = this.docRepo.create({
      ...dto,
      createdBy: creator,
    });
    return this.docRepo.save(doc);
  }

  async update(id: string, dto: UpdateEngineeringDocumentDto, updater: string) {
    const doc = await this.findOne(id);
    Object.assign(doc, { ...dto, updatedBy: updater });
    return this.docRepo.save(doc);
  }

  async remove(id: string) {
    const doc = await this.findOne(id);
    return this.docRepo.remove(doc);
  }

  async findByScope(scope: any, type?: EngineeringDocumentType) {
    const query = this.docRepo.createQueryBuilder('doc');
    if (type) query.andWhere('doc.documentType = :type', { type });

    // Simple scope filtering (exact match on keys if provided)
    if (scope.buildingId)
      query.andWhere("doc.scope->>'buildingId' = :bid", {
        bid: scope.buildingId,
      });
    if (scope.programId)
      query.andWhere("doc.scope->>'programId' = :pid", {
        pid: scope.programId,
      });
    if (scope.lineId)
      query.andWhere("doc.scope->>'lineId' = :lid", { lid: scope.lineId });
    if (scope.model)
      query.andWhere("doc.scope->>'model' = :model", { model: scope.model });

    return query.orderBy('doc.updatedAt', 'DESC').getMany();
  }
}
