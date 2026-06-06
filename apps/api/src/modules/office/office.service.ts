import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfficeDocument, OfficeDocType } from './entities/office-document.entity';

const TYPES: OfficeDocType[] = ['doc', 'sheet', 'slides'];

@Injectable()
export class OfficeService {
  constructor(
    @InjectRepository(OfficeDocument) private readonly repo: Repository<OfficeDocument>,
  ) {}

  list(type?: OfficeDocType) {
    return this.repo.find({
      where: type ? { type } : {},
      order: { updatedAt: 'DESC' },
      // keep payloads out of the list for speed
      select: ['id', 'type', 'title', 'model', 'createdBy', 'createdAt', 'updatedAt'],
    });
  }

  async get(id: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Documento no encontrado.');
    return doc;
  }

  create(dto: { type: OfficeDocType; title?: string; content?: any; model?: string }, actor?: string) {
    if (!TYPES.includes(dto.type)) throw new BadRequestException('Tipo inválido.');
    return this.repo.save(
      this.repo.create({
        type: dto.type,
        title: dto.title?.trim() || 'Sin título',
        content: dto.content ?? null,
        model: dto.model?.trim().toUpperCase() || null,
        createdBy: actor || null,
      }),
    );
  }

  async update(id: string, dto: { title?: string; content?: any; model?: string | null }) {
    const doc = await this.get(id);
    if (dto.title !== undefined) doc.title = dto.title.trim() || 'Sin título';
    if (dto.content !== undefined) doc.content = dto.content;
    if (dto.model !== undefined) doc.model = dto.model?.trim().toUpperCase() || null;
    return this.repo.save(doc);
  }

  async remove(id: string) {
    await this.get(id);
    await this.repo.delete(id);
    return { deleted: true, id };
  }
}
