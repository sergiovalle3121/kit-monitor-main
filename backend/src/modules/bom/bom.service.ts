import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BomItem } from './entities/bom-item.entity';
import { CreateBomItemDto } from './dto/create-bom-item.dto';
import { UpdateBomItemDto } from './dto/update-bom-item.dto';
import { parseBomXlsx } from './bom-parser';

const UPSERT_CHUNK = 500;

@Injectable()
export class BomService {
  constructor(
    @InjectRepository(BomItem)
    private readonly repo: Repository<BomItem>,
  ) {}

  findAll(model?: string): Promise<BomItem[]> {
    if (model) return this.repo.findBy({ model });
    return this.repo.find({ order: { model: 'ASC', partNumber: 'ASC' } });
  }

  async findOne(id: number): Promise<BomItem> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`BomItem ${id} not found`);
    return item;
  }

  create(dto: CreateBomItemDto): Promise<BomItem> {
    const item = this.repo.create({ unit: 'EA', ...dto });
    return this.repo.save(item);
  }

  async update(id: number, dto: UpdateBomItemDto): Promise<BomItem> {
    await this.findOne(id);
    await this.repo.update(id, dto);
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
}
