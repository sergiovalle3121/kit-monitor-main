import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnterpriseProgram } from '../enterprise-campus/entities/enterprise-program.entity';
import { BomItem } from './entities/bom-item.entity';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { parseBomXlsx } from './bom-parser';
import { parseKanbanXlsx } from './kanban-parser';

const UPSERT_CHUNK = 500;

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(BomItem)
    private readonly repo: Repository<BomItem>,
    @InjectRepository(EnterpriseProgram)
    private readonly programRepo: Repository<EnterpriseProgram>,
  ) {}

  async findAll(model?: string, programId?: string): Promise<BomItem[]> {
    if (model) return this.repo.findBy({ model });
    if (programId) {
      const program = await this.programRepo.findOne({
        where: { id: programId },
      });
      const prefix = program?.primaryModelPrefix?.toUpperCase();
      if (prefix) {
        const all = await this.repo.find({
          order: { model: 'ASC', partNumber: 'ASC' },
        });
        return all.filter((item) =>
          item.model?.toUpperCase().startsWith(prefix),
        );
      }
    }
    return this.repo.find({ order: { model: 'ASC', partNumber: 'ASC' } });
  }

  async findOne(id: number): Promise<BomItem> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`BomItem ${id} not found`);
    return item;
  }

  create(dto: CreateBomItemDto): Promise<BomItem> {
    const normalizedImageUrl = dto.imageUrl?.trim() || null;
    const item = this.repo.create({
      unit: 'EA',
      ...dto,
      imageUrl: normalizedImageUrl,
      hasImage: dto.hasImage ?? !!normalizedImageUrl,
    });
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateBomItemDto): Promise<BomItem> {
    await this.findOne(id);

    const normalizedImageUrl = dto.imageUrl?.trim();
    const hasImage =
      dto.hasImage !== undefined
        ? dto.hasImage
        : normalizedImageUrl !== undefined
          ? normalizedImageUrl.length > 0
          : undefined;

    await this.repo.update(id, {
      ...dto,
      imageUrl: normalizedImageUrl ?? dto.imageUrl,
      ...(hasImage !== undefined ? { hasImage } : {}),
    });

    return this.findOne(id);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true, id };
  }

  async importFromBuffer(
    buffer: Buffer,
  ): Promise<{ imported: number; errors: any[] }> {
    const { rows, errors } = parseBomXlsx(buffer);

    if (rows.length === 0) {
      return { imported: 0, errors };
    }

    // Upsert in chunks — avoids SQLite bind-parameter limits
    let imported = 0;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      await this.repo.upsert(chunk, ['model', 'partNumber']);
      imported += chunk.length;
    }

    return { imported, errors };
  }

  async syncCatalogFromKanban(buffer: Buffer): Promise<{
    updated: number;
    catalogRows: number;
    matchedPartNumbers: number;
  }> {
    const catalogRows = parseKanbanXlsx(buffer);
    if (catalogRows.length === 0) {
      return { updated: 0, catalogRows: 0, matchedPartNumbers: 0 };
    }

    const catalogByPartNumber = new Map(
      catalogRows.map((row) => [row.partNumber, row] as const),
    );

    const partNumbers = [...catalogByPartNumber.keys()];
    const matchedItems: BomItem[] = [];

    for (let i = 0; i < partNumbers.length; i += UPSERT_CHUNK) {
      const chunk = partNumbers.slice(i, i + UPSERT_CHUNK);
      const items = await this.repo.findBy({ partNumber: In(chunk) });
      matchedItems.push(...items);
    }

    const changedItems = matchedItems
      .map((item) => {
        const catalog = catalogByPartNumber.get(item.partNumber);
        if (!catalog) return null;

        const nextDescription = catalog.description ?? item.description ?? '';
        const nextLocation = catalog.location ?? item.location ?? '';
        const changed =
          nextDescription !== item.description ||
          nextLocation !== item.location;

        if (!changed) return null;

        item.description = nextDescription;
        item.location = nextLocation;
        return item;
      })
      .filter((item): item is BomItem => item !== null);

    for (let i = 0; i < changedItems.length; i += UPSERT_CHUNK) {
      await this.repo.save(changedItems.slice(i, i + UPSERT_CHUNK));
    }

    return {
      updated: changedItems.length,
      catalogRows: catalogRows.length,
      matchedPartNumbers: new Set(matchedItems.map((item) => item.partNumber))
        .size,
    };
  }
}
